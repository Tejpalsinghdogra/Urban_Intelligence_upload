import React, { useState } from 'react';
import { 
  ListFilter, 
  AlertTriangle, 
  Car, 
  Clock, 
  MapPin, 
  Trash2, 
  Radio, 
  User, 
  ExternalLink,
  Eye,
  X,
  ShieldCheck,
  CheckCircle
} from 'lucide-react';

// Format relative timestamp (e.g. "Just now", "2m ago")
function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DetectionList({ detections, onClearAll, isConnected }) {
  const [filterType, setFilterType] = useState('all');
  const [activeModalImg, setActiveModalImg] = useState(null);

  const filteredDetections = detections.filter(d => {
    if (filterType === 'all') return true;
    return d.type === filterType;
  });

  return (
    <>
      <div className="incident-feed-card">
        {/* Card Header */}
        <div className="feed-card-header">
          <div className="feed-header-left">
            <div className="feed-icon-circle">
              <Radio size={16} color="#06b6d4" />
            </div>
            <div>
              <div className="feed-title-line">
                <h3 className="feed-title">Real-Time Incident Stream</h3>
                <span className="feed-count-badge">{detections.length}</span>
              </div>
              <p className="feed-subtitle">Live vision telemetry recorded to Atlas cluster</p>
            </div>
          </div>

          <div className="feed-header-right">
            {onClearAll && (
              <button
                onClick={onClearAll}
                className="btn-reset-feed"
                title="Wipe feed from MongoDB Atlas & Cloudinary"
              >
                <Trash2 size={13} />
                <span>Reset Feed</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div className="feed-filter-bar">
          <div className="segmented-filter">
            <button
              className={`segmented-tab ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              <span>All Events</span>
              <span className="tab-pill-count">{detections.length}</span>
            </button>
            <button
              className={`segmented-tab ${filterType === 'pothole' ? 'active' : ''}`}
              onClick={() => setFilterType('pothole')}
            >
              <span>Potholes</span>
              <span className="tab-pill-count">{detections.filter(d => d.type === 'pothole').length}</span>
            </button>
            <button
              className={`segmented-tab ${filterType === 'vehicle' ? 'active' : ''}`}
              onClick={() => setFilterType('vehicle')}
            >
              <span>Vehicles</span>
              <span className="tab-pill-count">{detections.filter(d => d.type === 'vehicle').length}</span>
            </button>
            <button
              className={`segmented-tab ${filterType === 'pedestrian' ? 'active' : ''}`}
              onClick={() => setFilterType('pedestrian')}
            >
              <span>Pedestrians</span>
              <span className="tab-pill-count">{detections.filter(d => d.type === 'pedestrian').length}</span>
            </button>
          </div>
        </div>

        {/* Incident Items Feed */}
        <div className="incident-list">
          {filteredDetections.length === 0 ? (
            <div className="empty-state">
              <div className="empty-radar-circle">
                <div className="radar-sweep"></div>
                <Radio size={28} color="#06b6d4" />
              </div>
              <p className="empty-title">Awaiting Vision Telemetry</p>
              <span className="empty-subtext">
                Upload road surface media on the left or stream camera telemetry to log defect and traffic events.
              </span>
            </div>
          ) : (
            filteredDetections.map((item, index) => {
              const isPothole = item.type === 'pothole';
              const isPedestrian = item.type === 'pedestrian';
              const badgeClass = isPothole ? 'badge-pothole' : (isPedestrian ? 'badge-pedestrian' : 'badge-vehicle');
              const badgeLabel = isPothole ? 'Pothole Defect' : (isPedestrian ? 'Pedestrian' : 'Vehicle Group');
              const Icon = isPothole ? AlertTriangle : (isPedestrian ? User : Car);

              return (
                <div key={item._id || `inc-${index}-${item.timestamp}`} className="incident-item-card">
                  {/* Left Column: Type Icon & Info */}
                  <div className="incident-main-col">
                    <div className="incident-badge-row">
                      <span className={`incident-type-badge ${badgeClass}`}>
                        <Icon size={12} />
                        <span>{badgeLabel}</span>
                      </span>

                      <span className="relative-time-tag">
                        <Clock size={11} />
                        <span>{formatRelativeTime(item.timestamp)}</span>
                      </span>
                    </div>

                    <div className="incident-location-row">
                      <MapPin size={12} className="loc-icon" />
                      <span className="coord-text">
                        {Number(item.lat).toFixed(4)}°N, {Number(item.lng).toFixed(4)}°E
                      </span>
                      <span className="clock-time">
                        ({new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Metrics & Cloudinary Snapshot */}
                  <div className="incident-right-col">
                    <div className="metrics-pill-cluster">
                      <span className="confidence-pill" title="Model Confidence Rating">
                        {(item.confidence * 100).toFixed(0)}% conf
                      </span>

                      {item.type === 'vehicle' && (item.vehicleCount !== undefined || item.count !== undefined) && (
                        <span className="vehicle-count-pill">
                          Count: {item.vehicleCount || item.count}
                        </span>
                      )}

                      {item.type === 'pedestrian' && item.count !== undefined && (
                        <span className="pedestrian-count-pill">
                          Count: {item.count}
                        </span>
                      )}
                    </div>

                    {item.imageUrl ? (
                      <div className="snapshot-preview-block">
                        <button
                          className="thumb-zoom-btn"
                          onClick={() => setActiveModalImg({ url: item.imageUrl, item })}
                          title="Open Verified Snapshot Lightbox"
                        >
                          <img src={item.imageUrl} alt="Verified Snapshot" className="incident-thumb-img" />
                          <div className="thumb-hover-overlay">
                            <Eye size={12} />
                          </div>
                        </button>
                        <a
                          href={item.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cloud-direct-link"
                          title="Open Original in Cloudinary"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    ) : (
                      <span className="unarchived-tag">No Snapshot</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Snapshot Lightbox Modal */}
      {activeModalImg && (
        <div className="lightbox-backdrop" onClick={() => setActiveModalImg(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <div className="lightbox-title-group">
                <ShieldCheck size={18} color="#34d399" />
                <span className="lightbox-title">Verified Cloudinary Snapshot</span>
              </div>
              <button className="lightbox-close-btn" onClick={() => setActiveModalImg(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="lightbox-image-wrap">
              <img src={activeModalImg.url} alt="Enlarged Defect Snapshot" className="lightbox-full-image" />
            </div>

            <div className="lightbox-footer">
              <div className="lightbox-metadata">
                <span>Location: {Number(activeModalImg.item.lat).toFixed(5)}, {Number(activeModalImg.item.lng).toFixed(5)}</span>
                <span>Type: {activeModalImg.item.type.toUpperCase()}</span>
                <span>Recorded: {new Date(activeModalImg.item.timestamp).toLocaleString()}</span>
              </div>
              <a 
                href={activeModalImg.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-open-cloud"
              >
                <span>View Full Resolution</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
