import express from 'express';
import Detection from '../models/Detection.js';
import { uploadToCloudinary, deleteCloudinaryFolderImages } from '../utils/cloudinary.js';

const router = express.Router();



// GET /api/detections - Fetch detections with optional filters
router.get('/', async (req, res) => {
  try {
    const { type, startDate, endDate, limit } = req.query;
    const filter = {};

    if (type && ['pothole', 'vehicle', 'pedestrian'].includes(type)) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    let query = Detection.find(filter).sort({ timestamp: -1 });

    if (limit && !isNaN(parseInt(limit, 10))) {
      query = query.limit(parseInt(limit, 10));
    }

    const detections = await query.exec();
    res.json(detections);
  } catch (error) {
    console.error('Error fetching detections:', error);
    res.status(500).json({ error: 'Failed to fetch detections', details: error.message });
  }
});

// POST /api/detections - Create detection, save to DB, emit over Socket.IO
router.post('/', async (req, res) => {
  try {
    const { type, confidence, timestamp, lat, lng, vehicleCount, count } = req.body;

    // Validation
    if (!type || !['pothole', 'vehicle', 'pedestrian'].includes(type)) {
      return res.status(400).json({ error: 'Valid type ("pothole", "vehicle", or "pedestrian") is required' });
    }

    if (confidence === undefined || typeof confidence !== 'number') {
      return res.status(400).json({ error: 'Confidence number is required' });
    }

    if (lat === undefined || lng === undefined || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }

    const detectionData = {
      type,
      confidence: Number(confidence),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      lat: Number(lat),
      lng: Number(lng)
    };

    if (type === 'vehicle' && (vehicleCount !== undefined || count !== undefined)) {
      detectionData.vehicleCount = Number(vehicleCount || count);
      detectionData.count = Number(vehicleCount || count);
    } else if (type === 'pedestrian' && count !== undefined) {
      detectionData.count = Number(count);
    }

    const newDetection = new Detection(detectionData);
    const savedDetection = await newDetection.save();

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('new-detection', savedDetection);
    }

    res.status(201).json(savedDetection);
  } catch (error) {
    console.error('Error saving detection:', error);
    res.status(500).json({ error: 'Failed to create detection', details: error.message });
  }
});

// POST /api/detections/analyze-image - Run Pothole AI, Vehicle Workflow, and Pedestrian Workflow in parallel
router.post('/analyze-image', async (req, res) => {
  try {
    const { imageBase64, lat, lng } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image base64 data is required' });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY?.trim();
    const POTHOLE_ENDPOINT = process.env.ROBOFLOW_POTHOLE_ENDPOINT?.trim() || 'https://serverless.roboflow.com/roadlens-omcpi/5';
    const VEHICLE_WORKFLOW_ENDPOINT = process.env.ROBOFLOW_VEHICLE_WORKFLOW_ENDPOINT?.trim() || 'https://serverless.roboflow.com/tejpal-singh-dogra/workflows/general-segmentation-api-5';
    const PEDESTRIAN_WORKFLOW_ENDPOINT = process.env.ROBOFLOW_PEDESTRIAN_WORKFLOW_ENDPOINT?.trim() || 'https://serverless.roboflow.com/tejpal-singh-dogra/workflows/general-segmentation-api-6';

    // Route coordinates fallback if not provided
    const routeCoords = [
      { lat: 30.9005, lng: 75.8510 },
      { lat: 30.9015, lng: 75.8530 },
      { lat: 30.9025, lng: 75.8552 },
      { lat: 30.9038, lng: 75.8580 },
      { lat: 30.9052, lng: 75.8610 }
    ];
    const defaultLoc = routeCoords[Math.floor(Math.random() * routeCoords.length)];
    const targetLat = lat !== undefined ? Number(lat) : defaultLoc.lat;
    const targetLng = lng !== undefined ? Number(lng) : defaultLoc.lng;

    const io = req.app.get('io');
    const savedDetections = [];
    const aiResults = {
      potholes: { count: 0, predictions: [] },
      vehicles: { count: 0, congestion: 'LOW', predictions: [] },
      pedestrians: { count: 0, predictions: [] }
    };

    // Run all 3 AI models in parallel
    const [potholeRes, vehicleRes, pedestrianRes] = await Promise.allSettled([
      // AI 1: Pothole Detection Model
      fetch(POTHOLE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ROBOFLOW_API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: cleanBase64
      }).then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(`Pothole AI error ${r.status}: ${t}`)))),

      // AI 2: Vehicle Segmentation & Congestion Workflow
      fetch(VEHICLE_WORKFLOW_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ROBOFLOW_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            image: { type: 'base64', value: cleanBase64 },
            classes: 'Car, truck, bus, minibus, 2 wheeler'
          }
        })
      }).then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(`Vehicle AI error ${r.status}: ${t}`)))),

      // AI 3: Pedestrian Detection Workflow
      fetch(PEDESTRIAN_WORKFLOW_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ROBOFLOW_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            image: { type: 'base64', value: cleanBase64 },
            classes: 'pedestrian'
          }
        })
      }).then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(`Pedestrian AI error ${r.status}: ${t}`))))
    ]);

    // 1. Process Pothole Predictions
    let potholePredictions = [];
    if (potholeRes.status === 'fulfilled' && potholeRes.value) {
      potholePredictions = potholeRes.value.predictions || [];
    }

    // 2. Process Vehicle Predictions
    let vehicleList = [];
    if (vehicleRes.status === 'fulfilled' && vehicleRes.value) {
      const vData = vehicleRes.value;
      if (Array.isArray(vData.outputs)) {
        for (const out of vData.outputs) {
          if (Array.isArray(out.predictions)) vehicleList.push(...out.predictions);
          else if (out.predictions && Array.isArray(out.predictions.predictions)) vehicleList.push(...out.predictions.predictions);
          else if (Array.isArray(out)) vehicleList.push(...out);
        }
      } else if (vData.outputs && typeof vData.outputs === 'object') {
        for (const key of Object.keys(vData.outputs)) {
          const val = vData.outputs[key];
          if (Array.isArray(val?.predictions)) vehicleList.push(...val.predictions);
          else if (Array.isArray(val)) vehicleList.push(...val);
        }
      } else if (Array.isArray(vData.predictions)) {
        vehicleList = vData.predictions;
      } else if (Array.isArray(vData.result)) {
        vehicleList = vData.result;
      }
    }

    // 3. Process Pedestrian Predictions
    let pedestrianList = [];
    if (pedestrianRes.status === 'fulfilled' && pedestrianRes.value) {
      const pData = pedestrianRes.value;
      if (Array.isArray(pData.outputs)) {
        for (const out of pData.outputs) {
          if (Array.isArray(out.predictions)) pedestrianList.push(...out.predictions);
          else if (out.predictions && Array.isArray(out.predictions.predictions)) pedestrianList.push(...out.predictions.predictions);
          else if (Array.isArray(out)) pedestrianList.push(...out);
        }
      } else if (pData.outputs && typeof pData.outputs === 'object') {
        for (const key of Object.keys(pData.outputs)) {
          const val = pData.outputs[key];
          if (Array.isArray(val?.predictions)) pedestrianList.push(...val.predictions);
          else if (Array.isArray(val)) pedestrianList.push(...val);
        }
      } else if (Array.isArray(pData.predictions)) {
        pedestrianList = pData.predictions;
      } else if (Array.isArray(pData.result)) {
        pedestrianList = pData.result;
      }
    }

    const hasVerifiedDefect = potholePredictions.length > 0;
    const hasVerifiedVehicle = vehicleList.length > 0;
    const hasVerifiedPedestrian = pedestrianList.length > 0;

    // Upload image to Cloudinary in dedicated folder ONLY when verified by any model
    let cloudImageUrl = null;
    if (hasVerifiedDefect || hasVerifiedVehicle || hasVerifiedPedestrian) {
      const defectType = hasVerifiedDefect ? 'pothole' : (hasVerifiedVehicle ? 'vehicle' : 'pedestrian');
      cloudImageUrl = await uploadToCloudinary(cleanBase64, defectType);
    }

    // Save AI 1 (Potholes) to DB
    aiResults.potholes.predictions = potholePredictions;
    aiResults.potholes.count = potholePredictions.length;

    for (const pred of potholePredictions) {
      const potholeDoc = new Detection({
        type: 'pothole',
        confidence: Number(pred.confidence ? pred.confidence.toFixed(2) : 0.85),
        timestamp: new Date(),
        lat: targetLat,
        lng: targetLng,
        imageUrl: cloudImageUrl
      });

      const saved = await potholeDoc.save();
      savedDetections.push(saved);
      if (io) io.emit('new-detection', saved);
    }

    // Save AI 2 (Vehicles & Congestion) to DB
    const vehicleCount = vehicleList.length;
    aiResults.vehicles.count = vehicleCount;
    aiResults.vehicles.predictions = vehicleList;

    let congestion = 'LOW';
    if (vehicleCount >= 7) congestion = 'HIGH';
    else if (vehicleCount >= 4) congestion = 'MEDIUM';
    aiResults.vehicles.congestion = congestion;

    if (vehicleCount > 0) {
      const avgConfidence = vehicleList.reduce((acc, v) => acc + (v.confidence || 0.85), 0) / vehicleCount;
      const vehicleDoc = new Detection({
        type: 'vehicle',
        confidence: Number(avgConfidence.toFixed(2)),
        timestamp: new Date(),
        lat: targetLat,
        lng: targetLng,
        vehicleCount,
        count: vehicleCount,
        imageUrl: cloudImageUrl
      });

      const saved = await vehicleDoc.save();
      savedDetections.push(saved);
      if (io) io.emit('new-detection', saved);
    }

    // Save AI 3 (Pedestrians) to DB
    const pedestrianCount = pedestrianList.length;
    aiResults.pedestrians.count = pedestrianCount;
    aiResults.pedestrians.predictions = pedestrianList;

    if (pedestrianCount > 0) {
      const avgConfidence = pedestrianList.reduce((acc, p) => acc + (p.confidence || 0.85), 0) / pedestrianCount;
      const pedestrianDoc = new Detection({
        type: 'pedestrian',
        confidence: Number(avgConfidence.toFixed(2)),
        timestamp: new Date(),
        lat: targetLat,
        lng: targetLng,
        count: pedestrianCount,
        imageUrl: cloudImageUrl
      });

      const saved = await pedestrianDoc.save();
      savedDetections.push(saved);
      if (io) io.emit('new-detection', saved);
    }

    res.json({
      success: true,
      aiResults,
      cloudImageUrl,
      detections: savedDetections,
      message: `Analysis complete: Found ${aiResults.potholes.count} pothole(s), ${aiResults.vehicles.count} vehicle(s) (Congestion: ${aiResults.vehicles.congestion}), and ${aiResults.pedestrians.count} pedestrian(s).${cloudImageUrl ? ' Image archived in Cloudinary.' : ''}`
    });
  } catch (error) {
    console.error('Image analysis error:', error.message);
    res.status(500).json({ error: 'Failed to analyze image with AI models', details: error.message });
  }
});



// DELETE /api/detections - Clear all detections from MongoDB and Cloudinary folder
router.delete('/', async (req, res) => {
  try {
    // 1. Delete all images from the Cloudinary folder
    await deleteCloudinaryFolderImages();

    // 2. Delete all records from MongoDB Atlas
    await Detection.deleteMany({});

    // 3. Broadcast real-time reset to React Dashboard
    const io = req.app.get('io');
    if (io) {
      io.emit('clear-detections');
    }

    res.json({ success: true, message: 'All detections wiped from MongoDB and Cloudinary folder' });
  } catch (error) {
    console.error('Failed to clear detections:', error);
    res.status(500).json({ error: 'Failed to clear detections', details: error.message });
  }
});


export default router;

