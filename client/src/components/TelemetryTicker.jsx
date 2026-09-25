import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Activity, 
  ShieldAlert, 
  Cpu, 
  Zap, 
  MapPin, 
  Satellite, 
  Gauge
} from 'lucide-react';

export default function TelemetryTicker({ detectionsCount, isConnected, latestIncident }) {
  const [timeStr, setTimeStr] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="cyber-ticker-wrapper">
      <div className="ticker-badge-live">
        <span className="ticker-live-dot"></span>
        <span className="ticker-live-text">TELEMETRY STREAM</span>
      </div>

      <div className="ticker-track">
        <div className="ticker-content">
          <span className="ticker-item highlight-cyan">
            <Radio size={12} className="ticker-icon" />
            <span>FLEET-AI FLEET MONITOR V5</span>
          </span>
          <span className="ticker-sep">///</span>

          <span className="ticker-item">
            <Satellite size={12} className="ticker-icon" />
            <span>STATUS: {isConnected ? 'ONLINE [LINK ESTABLISHED]' : 'STANDBY [CONNECTING]'}</span>
          </span>
          <span className="ticker-sep">///</span>

          <span className="ticker-item highlight-amber">
            <ShieldAlert size={12} className="ticker-icon" />
            <span>INCIDENTS IN BUFFER: {detectionsCount} RECORDED</span>
          </span>
          <span className="ticker-sep">///</span>

          {latestIncident && (
            <>
              <span className="ticker-item highlight-pink">
                <Zap size={12} className="ticker-icon" />
                <span>LATEST: {latestIncident.type.toUpperCase()} @ {Number(latestIncident.lat).toFixed(4)}°N, {Number(latestIncident.lng).toFixed(4)}°E ({(latestIncident.confidence * 100).toFixed(0)}% CONF)</span>
              </span>
              <span className="ticker-sep">///</span>
            </>
          )}

          <span className="ticker-item highlight-emerald">
            <Cpu size={12} className="ticker-icon" />
            <span>MODELS ACTIVE: [ROADLENS-POTHOLE-V5] + [SEGMENTATION-VEHICLE-API] + [PEDESTRIAN-SAFETY-AI]</span>
          </span>
          <span className="ticker-sep">///</span>

          <span className="ticker-item">
            <Gauge size={12} className="ticker-icon" />
            <span>SYS TIME: {timeStr}</span>
          </span>
          <span className="ticker-sep">///</span>

          <span className="ticker-item highlight-cyan">
            <MapPin size={12} className="ticker-icon" />
            <span>CORRIDOR: SIMULATED TRANSIT BUS CORRIDOR (URBAN SECTOR 7)</span>
          </span>
          <span className="ticker-sep">///</span>

          {/* Repeated for continuous seamless ticker loop */}
          <span className="ticker-item highlight-cyan">
            <Radio size={12} className="ticker-icon" />
            <span>FLEET-AI FLEET MONITOR V5</span>
          </span>
          <span className="ticker-sep">///</span>

          <span className="ticker-item">
            <Satellite size={12} className="ticker-icon" />
            <span>STATUS: {isConnected ? 'ONLINE [LINK ESTABLISHED]' : 'STANDBY [CONNECTING]'}</span>
          </span>
          <span className="ticker-sep">///</span>

          <span className="ticker-item highlight-amber">
            <ShieldAlert size={12} className="ticker-icon" />
            <span>INCIDENTS IN BUFFER: {detectionsCount} RECORDED</span>
          </span>
        </div>
      </div>
    </div>
  );
}
