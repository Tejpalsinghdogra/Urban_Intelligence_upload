import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import DetectionList from './components/DetectionList';
import InspectionStudio from './components/InspectionStudio';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function App() {
  const [detections, setDetections] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch initial historical detections
  const fetchDetections = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/detections`);
      setDetections(response.data);
    } catch (err) {
      console.warn('Could not fetch historical detections from backend:', err.message);
    }
  };

  useEffect(() => {
    fetchDetections();

    // Initialize Socket.IO connection
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for new detections broadcasted by backend
    socket.on('new-detection', (newDetection) => {
      setDetections((prev) => [newDetection, ...prev]);
    });

    // Listen for clear-detections event
    socket.on('clear-detections', () => {
      setDetections([]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleClearAll = async () => {
    try {
      await axios.delete(`${API_URL}/api/detections`);
      setDetections([]);
    } catch (err) {
      console.error('Failed to clear detections:', err);
    }
  };

  return (
    <div className="focused-app-container">
      <div className="focused-app-grid">
        {/* Card 1: AI Detection & Verification Studio */}
        <InspectionStudio apiUrl={API_URL} />

        {/* Card 2: Incident Feed Stream */}
        <DetectionList 
          detections={detections} 
          onClearAll={handleClearAll}
          isConnected={isConnected}
        />
      </div>
    </div>
  );
}
