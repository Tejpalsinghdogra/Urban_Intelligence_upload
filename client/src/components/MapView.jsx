import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  MapPin, 
  Layers, 
  AlertTriangle, 
  Car, 
  User, 
  Crosshair, 
  Compass, 
  Eye, 
  Maximize2 
} from 'lucide-react';

// Fix default leaflet marker icon asset resolution
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Transit bus corridor coordinates
const TRANSIT_CORRIDOR = [
  [30.9001, 75.8501],
  [30.9005, 75.8510],
  [30.9010, 75.8520],
  [30.9015, 75.8530],
  [30.9020, 75.8540],
  [30.9025, 75.8552],
  [30.9030, 75.8565],
  [30.9038, 75.8580],
  [30.9045, 75.8595],
  [30.9052, 75.8610],
  [30.9060, 75.8625],
  [30.9070, 75.8640]
];

export default function MapView({ detections = [] }) {
  const [activeLayer, setActiveLayer] = useState('all'); // 'all' | 'potholes' | 'vehicles' | 'route'
  const center = [30.9035, 75.8570];

  const filtered = detections.filter(d => {
    if (activeLayer === 'all') return true;
    if (activeLayer === 'potholes') return d.type === 'pothole';
    if (activeLayer === 'vehicles') return d.type === 'vehicle';
    return true;
  });

  return (
    <div className="cyber-map-card">
      <div className="map-card-header">
        <div className="map-title-wrap">
          <div className="map-icon-box">
            <Compass size={18} />
          </div>
          <div>
            <h3 className="map-title">GIS Transit Route & Spatial Telemetry</h3>
            <p className="map-subtitle">Live fleet GPS coordinate tracking & geospatial defect mapping</p>
          </div>
        </div>

        {/* Layer Filters */}
        <div className="map-layer-controls">
          <button 
            className={`map-chip ${activeLayer === 'all' ? 'active' : ''}`}
            onClick={() => setActiveLayer('all')}
          >
            <span>All Pins ({detections.length})</span>
          </button>
          <button 
            className={`map-chip amber ${activeLayer === 'potholes' ? 'active' : ''}`}
            onClick={() => setActiveLayer('potholes')}
          >
            <AlertTriangle size={11} />
            <span>Potholes</span>
          </button>
          <button 
            className={`map-chip cyan ${activeLayer === 'vehicles' ? 'active' : ''}`}
            onClick={() => setActiveLayer('vehicles')}
          >
            <Car size={11} />
            <span>Traffic</span>
          </button>
        </div>
      </div>

      <div className="map-wrapper">
        <MapContainer 
          center={center} 
          zoom={15} 
          scrollWheelZoom={true} 
          className="leaflet-cyber-container"
        >
          {/* Cyber Dark Basemap Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {/* Transit Bus Route Polyline */}
          <Polyline 
            positions={TRANSIT_CORRIDOR} 
            pathOptions={{ 
              color: '#2563eb', 
              weight: 5, 
              opacity: 0.95, 
              dashArray: '8, 8' 
            }} 
          />

          {/* Bus Route Waypoints */}
          {TRANSIT_CORRIDOR.map((coord, idx) => (
            <CircleMarker
              key={`wp-${idx}`}
              center={coord}
              radius={5}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#ffffff',
                fillOpacity: 1,
                weight: 2.5
              }}
            >
              <Popup className="cyber-popup">
                <div className="popup-box">
                  <strong>Waypoint #{idx + 1}</strong>
                  <span>Lat: {coord[0]}, Lng: {coord[1]}</span>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Incident Pins */}
          {filtered.map((item, idx) => {
            const isPothole = item.type === 'pothole';
            const isPedestrian = item.type === 'pedestrian';
            const color = isPothole ? '#b45309' : (isPedestrian ? '#7e22ce' : '#1d4ed8');
            const fillColor = isPothole ? '#f59e0b' : (isPedestrian ? '#a855f7' : '#2563eb');

            return (
              <CircleMarker
                key={item._id || `map-det-${idx}`}
                center={[item.lat || 30.9005, item.lng || 75.8510]}
                radius={8}
                pathOptions={{
                  color,
                  fillColor,
                  fillOpacity: 0.85,
                  weight: 3
                }}
              >
                <Popup className="cyber-popup">
                  <div className="popup-box">
                    <div className="popup-header">
                      <span className="popup-type" style={{ color }}>
                        {item.type.toUpperCase()}
                      </span>
                      <span className="popup-conf">
                        {(item.confidence * 100).toFixed(0)}% CONF
                      </span>
                    </div>
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt="Incident" className="popup-thumb" />
                    )}
                    <div className="popup-coords">
                      <span>GPS: {Number(item.lat).toFixed(4)}°N, {Number(item.lng).toFixed(4)}°E</span>
                      <span>Time: {new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Map Cyber HUD Overlay */}
        <div className="map-hud-legend">
          <div className="legend-item">
            <span className="legend-dot cyan"></span>
            <span>Simulated Route Corridor</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot amber"></span>
            <span>Pothole Defect Pin</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot blue"></span>
            <span>Traffic Segment</span>
          </div>
        </div>
      </div>
    </div>
  );
}
