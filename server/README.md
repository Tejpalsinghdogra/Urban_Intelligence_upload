# Urban Intelligence Backend Server

Express and Socket.IO server powering the Urban Intelligence dashboard.

## Features
- MongoDB storage for road defect and vehicle detections.
- Real-time broadcasts over Socket.IO (`new-detection` event).
- REST API for querying detections with filters (`type`, `startDate`, `endDate`).

## Setup & Running

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

Server will run on `http://localhost:5000`.
