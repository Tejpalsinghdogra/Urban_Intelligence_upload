# Urban Intelligence AI Detector

Node.js AI Detector module for SIH PS 26124: AI-Powered Mobile Urban Intelligence Platform.

## Features
- Reads local video files using FFmpeg.
- Samples video frames at configurable intervals.
- Connects to Roboflow Hosted Inference API.
- Generates simulated GPS coordinates along a predefined public transport fleet route.
- Calculates vehicle counts and congestion severity (`LOW`, `MEDIUM`, `HIGH`).
- Emits real-time detection telemetry to Express backend (`POST /api/detections`).
- Seamless Simulation Mode fallback for instant demoing.

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure Roboflow (Optional for live video AI inference):
   - `ROBOFLOW_API_KEY`: Your Roboflow API key
   - `ROBOFLOW_MODEL_ID`: Your Roboflow project model ID
   - `VIDEO_PATH`: Path to your sample road video file

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run the detector:
   ```bash
   node detector.js
   ```

   Or to explicitly force simulation mode:
   ```bash
   npm run simulate
   ```
