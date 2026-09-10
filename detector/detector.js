import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Configure dotenv
dotenv.config();

// Set ffmpeg path from installer
if (ffmpegInstaller.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurations
const API_URL = process.env.API_URL || 'http://localhost:5000';
const VIDEO_PATH = process.env.VIDEO_PATH || './video/sample.mp4';
const FRAME_INTERVAL = parseInt(process.env.FRAME_INTERVAL || '10', 10);
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_MODEL_ID = process.env.ROBOFLOW_MODEL_ID;
const ROBOFLOW_API_URL = process.env.ROBOFLOW_API_URL || 'https://detect.roboflow.com';
const SIMULATION_MODE = process.env.SIMULATION_MODE === 'true';

// Simulated Bus Route (Placeholders for demonstration)
export const BUS_ROUTE = [
  { lat: 30.9001, lng: 75.8501 },
  { lat: 30.9005, lng: 75.8510 },
  { lat: 30.9010, lng: 75.8520 },
  { lat: 30.9015, lng: 75.8530 },
  { lat: 30.9020, lng: 75.8540 },
  { lat: 30.9025, lng: 75.8552 },
  { lat: 30.9030, lng: 75.8565 },
  { lat: 30.9038, lng: 75.8580 },
  { lat: 30.9045, lng: 75.8595 },
  { lat: 30.9052, lng: 75.8610 },
  { lat: 30.9060, lng: 75.8625 },
  { lat: 30.9070, lng: 75.8640 }
];

/**
 * Get GPS coordinate for a given step/frame index along the simulated route
 */
function getSimulatedLocation(index) {
  const routeIndex = index % BUS_ROUTE.length;
  // Add micro jitter to simulate vehicle positioning variability along segment
  const baseLoc = BUS_ROUTE[routeIndex];
  const jitterLat = (Math.random() - 0.5) * 0.0001;
  const jitterLng = (Math.random() - 0.5) * 0.0001;
  return {
    lat: Number((baseLoc.lat + jitterLat).toFixed(6)),
    lng: Number((baseLoc.lng + jitterLng).toFixed(6))
  };
}

/**
 * Post detection payload to Express backend
 */
async function sendDetectionToBackend(payload) {
  try {
    const res = await axios.post(`${API_URL}/api/detections`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    return res.data;
  } catch (error) {
    console.error(`[Detector Error] Failed to send detection to backend: ${error.message}`);
    return null;
  }
}

/**
 * Log detection in terminal according to project specification
 */
function logDetection(frameNum, type, confidence, location, vehicleCount = null) {
  console.log(`\n-----------------------------------------`);
  console.log(`[FRAME ${frameNum}]`);
  if (type === 'vehicle') {
    console.log(`Vehicle detected`);
    if (vehicleCount !== null) {
      console.log(`Vehicles detected: ${vehicleCount}`);
      let congestion = 'LOW';
      if (vehicleCount >= 7) congestion = 'HIGH';
      else if (vehicleCount >= 4) congestion = 'MEDIUM';
      console.log(`Estimated Congestion: ${congestion}`);
    }
  } else {
    console.log(`Pothole detected`);
  }
  console.log(`Confidence: ${(confidence * 100).toFixed(0)}%`);
  console.log(`Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
  console.log(`Timestamp: ${new Date().toLocaleTimeString()}`);
  console.log(`-----------------------------------------`);
}

/**
 * Call Roboflow Pothole Detection Model
 */
async function queryRoboflow(imagePath) {
  try {
    const apiKey = process.env.ROBOFLOW_API_KEY?.trim();
    const endpoint = process.env.ROBOFLOW_POTHOLE_ENDPOINT?.trim() || `${process.env.ROBOFLOW_API_URL}/${process.env.ROBOFLOW_MODEL_ID}`;

    if (!apiKey || apiKey === 'your_roboflow_api_key' || !endpoint) {
      throw new Error('Roboflow credentials not configured');
    }

    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

    const response = await axios({
      method: 'POST',
      url: endpoint,
      data: imageBase64,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    return response.data;
  } catch (err) {
    console.warn(`[Roboflow Pothole AI] Notice: ${err.message}`);
    return null;
  }
}

/**
 * Call Roboflow Vehicle Detection & Congestion Workflow
 */
async function queryRoboflowVehicles(imagePath) {
  try {
    const apiKey = process.env.ROBOFLOW_API_KEY?.trim();
    const endpoint = process.env.ROBOFLOW_VEHICLE_WORKFLOW_ENDPOINT?.trim();

    if (!apiKey || apiKey === 'your_roboflow_api_key' || !endpoint) {
      return null;
    }

    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

    const response = await axios({
      method: 'POST',
      url: endpoint,
      data: {
        inputs: {
          image: { type: 'base64', value: imageBase64 },
          classes: 'Car, truck, bus, minibus, 2 wheeler'
        }
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });


    return response.data;
  } catch (err) {
    console.warn(`[Roboflow Vehicle Workflow] Notice: ${err.message}`);
    return null;
  }
}



/**
 * Extract frames from video using fluent-ffmpeg
 */
async function extractFramesFromVideo(videoPath, outputDir, frameInterval) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[FFmpeg] Analyzing video file: ${videoPath}`);
  
  return new Promise((resolve, reject) => {
    // Extract 1 frame every (frameInterval / 10) seconds or at fixed rate
    const fpsRate = 1 / Math.max(1, Math.floor(frameInterval / 10));
    
    ffmpeg(videoPath)
      .outputOptions([`-vf fps=${fpsRate}`])
      .output(path.join(outputDir, 'frame_%04d.jpg'))
      .on('start', (cmd) => {
        console.log(`[FFmpeg] Extraction started with command: ${cmd}`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r[FFmpeg] Progress: ${Math.floor(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log(`\n[FFmpeg] Frame extraction completed.`);
        const files = fs.readdirSync(outputDir)
          .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
          .sort();
        resolve(files);
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
}

/**
 * Process video by extracting frames and feeding them to Roboflow AI
 */
async function processVideoFrames() {
  const videoFullPath = path.resolve(__dirname, VIDEO_PATH);
  const framesDir = path.resolve(__dirname, 'frames');

  if (!fs.existsSync(videoFullPath)) {
    console.warn(`[Detector Video] Video file not found at: ${videoFullPath}`);
    return runSimulationMode();
  }

  try {
    console.log(`\n[Detector Video] Initiating frame extraction for: ${VIDEO_PATH}`);
    const frameFiles = await extractFramesFromVideo(videoFullPath, framesDir, FRAME_INTERVAL);

    if (!frameFiles || frameFiles.length === 0) {
      console.warn(`[Detector Video] No frames extracted from video. Defaulting to simulation mode.`);
      return runSimulationMode();
    }

    console.log(`[Detector Video] Extracted ${frameFiles.length} frame(s). Commencing AI inference pipeline...`);

    let index = 0;
    for (const frameFile of frameFiles) {
      index++;
      const frameNum = index * FRAME_INTERVAL;
      const location = getSimulatedLocation(index);
      const framePath = path.join(framesDir, frameFile);

      console.log(`\n[AI Inference] Analyzing video frame ${index}/${frameFiles.length}: ${frameFile}...`);

      const [potholeRes, vehicleRes] = await Promise.all([
        queryRoboflow(framePath),
        queryRoboflowVehicles(framePath)
      ]);

      // 1. Process Pothole Predictions
      if (potholeRes && potholeRes.predictions && potholeRes.predictions.length > 0) {
        for (const pothole of potholeRes.predictions) {
          logDetection(frameNum, 'pothole', pothole.confidence, location);
          await sendDetectionToBackend({
            type: 'pothole',
            confidence: Number(pothole.confidence.toFixed(2)),
            timestamp: new Date().toISOString(),
            lat: location.lat,
            lng: location.lng
          });
        }
      }

      // 2. Process Vehicle Predictions
      if (vehicleRes) {
        let vehicleList = [];
        if (Array.isArray(vehicleRes.outputs)) {
          for (const out of vehicleRes.outputs) {
            if (Array.isArray(out.predictions)) vehicleList.push(...out.predictions);
            else if (out.predictions?.predictions && Array.isArray(out.predictions.predictions)) vehicleList.push(...out.predictions.predictions);
            else if (Array.isArray(out)) vehicleList.push(...out);
          }
        } else if (Array.isArray(vehicleRes.predictions)) {
          vehicleList = vehicleRes.predictions;
        }

        if (vehicleList.length > 0) {
          const count = vehicleList.length;
          const avgConfidence = vehicleList.reduce((acc, p) => acc + (p.confidence || 0.8), 0) / count;
          logDetection(frameNum, 'vehicle', avgConfidence, location, count);
          await sendDetectionToBackend({
            type: 'vehicle',
            confidence: Number(avgConfidence.toFixed(2)),
            timestamp: new Date().toISOString(),
            lat: location.lat,
            lng: location.lng,
            vehicleCount: count
          });
        }
      }

      // Pause between frames
      await new Promise(res => setTimeout(res, 2000));
    }

    console.log(`\n[Detector Video] Completed AI video inspection of all ${frameFiles.length} frames.`);
  } catch (err) {
    console.error(`[Detector Video Error]:`, err.message);
    console.log(`[Detector Video] Falling back to simulation mode.`);
    runSimulationMode();
  }
}

/**
 * Process a single image or folder of images
 */
async function processImages() {
  const imagesDir = path.resolve(__dirname, 'images');
  const singleImagePath = process.env.IMAGE_PATH ? path.resolve(__dirname, process.env.IMAGE_PATH) : null;

  let imageFiles = [];

  if (singleImagePath && fs.existsSync(singleImagePath)) {
    imageFiles = [singleImagePath];
  } else if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir)
      .filter(f => /\.(jpe?g|png|webp|bmp)$/i.test(f))
      .map(f => path.join(imagesDir, f));
    imageFiles = files;
  }

  if (imageFiles.length === 0) {
    console.log(`[Detector] No images found in detector/images/ or configured IMAGE_PATH.`);
    console.log(`[Detector] Defaulting to simulated bus route telemetry.`);
    return runSimulationMode();
  }

  console.log(`\n[Detector] Found ${imageFiles.length} image(s) for AI inspection.`);

  let index = 0;
  for (const imgPath of imageFiles) {
    index++;
    const frameNum = index * FRAME_INTERVAL;
    const location = getSimulatedLocation(index);
    const fileName = path.basename(imgPath);

    console.log(`\n[AI Inference] Analyzing image: ${fileName}...`);
    const inferenceResult = await queryRoboflow(imgPath);

    if (inferenceResult && inferenceResult.predictions) {
      const predictions = inferenceResult.predictions;
      console.log(`[Roboflow] Returned ${predictions.length} prediction(s) for ${fileName}`);

      const vehicleClasses = ['car', 'vehicle', 'truck', 'bus', 'motorcycle', 'van'];
      const potholeClasses = ['pothole', 'road defect', 'defect', 'crack', 'potholes'];

      const vehiclePredictions = predictions.filter(p => vehicleClasses.some(c => p.class.toLowerCase().includes(c)));
      const potholePredictions = predictions.filter(p => potholeClasses.some(c => p.class.toLowerCase().includes(c)) || !vehicleClasses.some(c => p.class.toLowerCase().includes(c)));

      if (vehiclePredictions.length > 0) {
        const avgConfidence = vehiclePredictions.reduce((acc, p) => acc + p.confidence, 0) / vehiclePredictions.length;
        const count = vehiclePredictions.length;
        
        logDetection(frameNum, 'vehicle', avgConfidence, location, count);
        
        await sendDetectionToBackend({
          type: 'vehicle',
          confidence: Number(avgConfidence.toFixed(2)),
          timestamp: new Date().toISOString(),
          lat: location.lat,
          lng: location.lng,
          vehicleCount: count
        });
      }

      if (potholePredictions.length > 0) {
        for (const pothole of potholePredictions) {
          logDetection(frameNum, 'pothole', pothole.confidence, location);
          
          await sendDetectionToBackend({
            type: 'pothole',
            confidence: Number(pothole.confidence.toFixed(2)),
            timestamp: new Date().toISOString(),
            lat: location.lat,
            lng: location.lng
          });
        }
      } else if (vehiclePredictions.length === 0) {
        // If Roboflow returned 0 predictions on this image, record as clear or default
        console.log(`[Roboflow] No defects or vehicles detected in ${fileName}.`);
      }
    } else {
      console.log(`[Detector] Roboflow returned no detections for image: ${fileName}`);
    }


    // Short pause between images
    await new Promise(res => setTimeout(res, 2000));
  }

  console.log(`\n[Detector] Completed image analysis.`);
}


/**
 * Handle simulated detections when Roboflow is not yet linked
 */
async function handleFallbackFrameDetection(frameNum, location) {
  // Alternate detections to demonstrate both potholes and vehicle counts
  const isVehicle = Math.random() > 0.4;

  if (isVehicle) {
    const vehicleCount = Math.floor(Math.random() * 9) + 1; // 1 to 9 vehicles
    const confidence = Number((0.80 + Math.random() * 0.18).toFixed(2));
    
    logDetection(frameNum, 'vehicle', confidence, location, vehicleCount);

    await sendDetectionToBackend({
      type: 'vehicle',
      confidence,
      timestamp: new Date().toISOString(),
      lat: location.lat,
      lng: location.lng,
      vehicleCount
    });
  } else {
    const confidence = Number((0.75 + Math.random() * 0.22).toFixed(2));
    
    logDetection(frameNum, 'pothole', confidence, location);

    await sendDetectionToBackend({
      type: 'pothole',
      confidence,
      timestamp: new Date().toISOString(),
      lat: location.lat,
      lng: location.lng
    });
  }
}

/**
 * Autonomous route simulation mode (for live presentation demo without local video)
 */
async function runSimulationMode() {
  console.log(`\n======================================================`);
  console.log(`   AI URBAN INTELLIGENCE FLEET SIMULATOR ACTIVE       `);
  console.log(`   Simulating bus movement along predefined route     `);
  console.log(`======================================================\n`);

  let step = 0;
  
  const tick = async () => {
    step++;
    const frameNum = step * FRAME_INTERVAL;
    const location = getSimulatedLocation(step);
    
    await handleFallbackFrameDetection(frameNum, location);
    
    // Continue running simulator every 3 seconds
    setTimeout(tick, 3000);
  };

  tick();
}

// Entry Point
console.log(`======================================================`);
console.log(` Smart India Hackathon - Problem Statement 26124     `);
console.log(` Mobile Urban Intelligence Platform - AI Detector     `);
console.log(`======================================================`);
console.log(`Target Backend API: ${API_URL}`);
console.log(`Roboflow Model: ${ROBOFLOW_MODEL_ID}`);

const imagesDir = path.resolve(__dirname, 'images');
const hasImages = fs.existsSync(imagesDir) && fs.readdirSync(imagesDir).some(f => /\.(jpe?g|png|webp|bmp)$/i.test(f));
const hasSingleImage = process.env.IMAGE_PATH && fs.existsSync(path.resolve(__dirname, process.env.IMAGE_PATH));

if (hasSingleImage || hasImages) {
  console.log(`[Detector] Image mode activated. Scanning images directory...`);
  processImages();
} else if (fs.existsSync(path.resolve(__dirname, VIDEO_PATH))) {
  console.log(`[Detector] Video mode activated. Processing video...`);
  processVideoFrames();
} else if (SIMULATION_MODE) {
  console.log(`[Detector] Running in explicitly enabled SIMULATION_MODE.`);
  runSimulationMode();
} else {
  console.log(`[Detector] No local video or images found. Running simulated route stream.`);
  runSimulationMode();
}

