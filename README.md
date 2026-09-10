# AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet
### Smart India Hackathon — Problem Statement 26124

A complete working prototype of a mobile urban intelligence platform that leverages city public transport fleets to monitor road surface defects (potholes) and quantify traffic density/congestion in real-time.

---

## 🏛️ System Architecture

```text
                    LOCAL ROAD VIDEO
                         │
                         ▼
              +─────────────────────+
              │  Node.js Detector   │
              │                     │
              │  • FFmpeg Sampling  │
              │  • Roboflow API     │
              +──────────┬──────────+
                         │
                         ▼
                AI Detection Result
                  /            \
             Pothole          Vehicle
                 │                │
                 +───────┬────────+
                         │
                         ▼
                 Simulated GPS
                         │
                         ▼
             Express REST & WebSocket
                         │
                         ▼
                     MongoDB
                         │
                         ▼
                     Socket.IO
                         │
                         ▼
                React Dashboard
                         │
             +───────────┴───────────+
             │                       │
             ▼                       ▼
        Leaflet Map             Incident Log
             │
             ▼
      Pothole Heatmap
```

---

## 🚀 Key Features

* **Pothole / Road Defect Detection**: Captures defective road segments and visualizes defect density via a Leaflet heatmap layer.
* **Vehicle Counting & Congestion Index**: Computes live vehicle counts per frame and categorizes urban traffic congestion (`LOW`, `MEDIUM`, `HIGH`).
* **Simulated GPS Fleet Route**: Correlates video frame timestamps to simulated public transit bus route coordinates.
* **Real-time Live Telemetry**: Instantly updates maps, statistics, and incident feeds via WebSockets without manual browser refreshes.
* **Full JavaScript/Node.js Ecosystem**: Zero Python dependencies; uses native Node.js frame extraction and hosted Roboflow AI inference.

---

## 📋 Prerequisites

* **Node.js** (v18+ recommended)
* **MongoDB** (Local MongoDB instance or MongoDB Atlas connection string)
* **FFmpeg** (Included automatically via `@ffmpeg-installer/ffmpeg`)
* **Roboflow Account & API Key** *(Optional for live inference on custom models)*

---

## 🛠️ Project Structure

```text
smart-urban-intelligence/
├── detector/                # Node.js Video Frame Sampler & Roboflow AI
│   ├── detector.js          # Core frame extraction & telemetry engine
│   ├── video/               # Sample dashboard video container
│   ├── frames/              # Temporary extracted frame cache
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── server/                  # Express + Socket.IO + MongoDB Backend
│   ├── models/
│   │   └── Detection.js     # Mongoose schema for road defects & vehicles
│   ├── routes/
│   │   └── detections.js    # REST endpoints (GET / POST) with filters
│   ├── server.js            # Express app & Socket.IO server
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── client/                  # React + Vite Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── Stats.jsx         # KPI metrics & live congestion gauge
│   │   │   ├── MapView.jsx       # React-Leaflet map with bus route & markers
│   │   │   ├── HeatmapLayer.jsx  # Pothole density heatmap layer
│   │   │   └── DetectionList.jsx # Real-time chronological incident feed
│   │   ├── App.jsx               # WebSocket state manager
│   │   ├── main.jsx
│   │   └── index.css             # UI styling & design system
│   ├── package.json
│   └── .env.example
│
├── .gitignore
└── README.md
```

---

## ⚙️ Environment Setup

### 1. Backend Server (`server/.env`)
Copy `server/.env.example` to `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/urban_intelligence
CLIENT_URL=http://localhost:5173
```

### 2. Frontend Client (`client/.env`)
Copy `client/.env.example` to `client/.env`:
```env
VITE_API_URL=http://localhost:5000
```

### 3. AI Detector (`detector/.env`)
Copy `detector/.env.example` to `detector/.env`:
```env
ROBOFLOW_API_KEY=your_roboflow_api_key
ROBOFLOW_MODEL_ID=your_model_id
ROBOFLOW_API_URL=https://detect.roboflow.com
API_URL=http://localhost:5000
VIDEO_PATH=./video/sample.mp4
FRAME_INTERVAL=10
SIMULATION_MODE=false
```

---

## 📦 Installation

Install dependencies for each service:

```bash
# 1. Install Backend dependencies
cd server
npm install

# 2. Install Frontend dependencies
cd ../client
npm install

# 3. Install AI Detector dependencies
cd ../detector
npm install
```

---

## 🚦 Running the Prototype

Follow this startup order:

### Step 1 — Ensure MongoDB is Running
Make sure your local MongoDB daemon is running or your MongoDB Atlas URI is set in `server/.env`.

### Step 2 — Start Express Server
```bash
cd server
npm run dev
```
*The server will start at `http://localhost:5000`.*

### Step 3 — Start React Dashboard
```bash
cd client
npm run dev
```
*Open `http://localhost:5173` in your browser.*

### Step 4 — Run AI Detector
In a new terminal:
```bash
cd detector
node detector.js
```
*Or force simulated route mode directly:*
```bash
npm run simulate
```

---

## 🔍 Demonstration Flow

1. **Express & Socket.IO Start**: Backend connects to MongoDB and awaits detections.
2. **React Dashboard Loads**: Fetches historical detections via `GET /api/detections` and connects to Socket.IO.
3. **Detector Runs**:
   - Reads the road video file and samples every Nth frame with FFmpeg.
   - Sends frames to the Roboflow hosted inference API.
   - Calculates vehicle count per frame (`LOW`: 0–3, `MEDIUM`: 4–6, `HIGH`: 7+).
   - Generates simulated bus GPS coordinates along the route.
   - Transmits telemetry via `POST http://localhost:5000/api/detections`.
4. **Instant Updates**:
   - Backend saves detection to MongoDB and broadcasts `new-detection`.
   - React updates the **Pothole Heatmap**, drops **Leaflet Markers**, refreshes the **Incident Log**, and updates **KPI Statistics** with zero page reload.

---

## 📌 Prototype Notes & Scope

* **Simulated Hardware**: Bus dashboard cameras and GPS units are simulated in software.
* **Simulated GPS**: Coordinates are mapped from a predefined urban route array.
* **AI Model**: Uses hosted Roboflow inference API. No models are trained locally.
* **Built strictly for Hackathon Demo Scope**: Focused exclusively on Potholes and Vehicle Congestion detection.
