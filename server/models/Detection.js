import mongoose from 'mongoose';

const detectionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['pothole', 'vehicle', 'pedestrian'],
    required: true
  },
  confidence: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  vehicleCount: {
    type: Number,
    required: false
  },
  count: {
    type: Number,
    required: false
  },

  imageUrl: {
    type: String,
    required: false
  }
}, {

  timestamps: true
});

const Detection = mongoose.model('Detection', detectionSchema);

export default Detection;
