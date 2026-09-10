import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  UploadCloud, 
  CheckCircle2, 
  Loader2, 
  Image as ImageIcon, 
  MapPin, 
  Cpu, 
  Car, 
  AlertTriangle, 
  ExternalLink,
  RefreshCw,
  Sparkles,
  User
} from 'lucide-react';

export default function InspectionStudio({ apiUrl }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('Detecting GPS...');
  const fileInputRef = useRef(null);

  // Fetch user's exact device GPS coordinates
  const getExactLocation = () => {
    if ('geolocation' in navigator) {
      setLocationStatus('Acquiring precise GPS...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6))
          };
          setUserLocation(coords);
          setLocationStatus(`${coords.lat}, ${coords.lng}`);
        },
        (error) => {
          console.warn('Geolocation notice:', error.message);
          setLocationStatus('GPS unavailable (Using fleet route coords)');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationStatus('Geolocation unsupported');
    }
  };

  useEffect(() => {
    getExactLocation();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
      setResultData(null);
      setErrorMessage(null);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!previewUrl) return;

    setIsAnalyzing(true);
    setErrorMessage(null);
    setResultData(null);

    try {
      const payload = {
        imageBase64: previewUrl,
        lat: userLocation ? userLocation.lat : undefined,
        lng: userLocation ? userLocation.lng : undefined
      };

      const response = await axios.post(`${apiUrl}/api/detections/analyze-image`, payload);

      if (response.data.success) {
        setResultData(response.data);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setErrorMessage(err.response?.data?.details || err.message || 'Failed to analyze image with AI');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetStudio = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setResultData(null);
    setErrorMessage(null);
  };

  return (
    <div className="studio-card">
      {/* Studio Header */}
      <div className="studio-header">
        <div className="studio-title-group">
          <div className="studio-icon-badge">
            <Cpu size={20} color="#38bdf8" />
          </div>
          <div>
            <h2 className="studio-title">AI Road Inspection Studio</h2>
            <p className="studio-subtitle">
              Parallel Vision Pipeline: Potholes, Traffic Congestion & Pedestrian Safety
            </p>
          </div>
        </div>

        <div className="studio-model-badges">
          <div className="model-chip pothole" title="Model: roadlens-omcpi/5">
            <span className="chip-led amber"></span>
            <AlertTriangle size={12} />
            <span>Pothole Defect AI</span>
          </div>
          <div className="model-chip vehicle" title="Workflow: general-segmentation-api-5">
            <span className="chip-led cyan"></span>
            <Car size={12} />
            <span>Vehicle Density AI</span>
          </div>
          <div className="model-chip pedestrian" title="Workflow: general-segmentation-api-6">
            <span className="chip-led violet"></span>
            <User size={12} />
            <span>Pedestrian Vision AI</span>
          </div>
        </div>
      </div>

      <div className="studio-body">
        {/* Upload Dropzone */}
        <div 
          className={`studio-dropzone ${previewUrl ? 'has-preview' : ''} ${isAnalyzing ? 'analyzing' : ''}`}
          onClick={() => !previewUrl && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {previewUrl ? (
            <div className="preview-container">
              <img src={previewUrl} alt="Inspection Candidate" className="preview-image" />
              
              {/* Computer Vision LiDAR Laser Scanning Beam */}
              {isAnalyzing && (
                <div className="laser-scanner-overlay">
                  <div className="laser-scanner-beam"></div>
                  <div className="laser-scanner-hud">
                    <span className="hud-radar-dot"></span>
                    <span>RUNNING INFERENCE PIPELINE...</span>
                  </div>
                </div>
              )}

              <button 
                className="change-image-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Change Image
              </button>
            </div>
          ) : (
            <div className="dropzone-prompt">
              <div className="dropzone-icon-circle">
                <UploadCloud size={30} color="#38bdf8" />
              </div>
              <p className="dropzone-main-text">Upload or Drop Road Surface Media</p>
              <p className="dropzone-sub-text">Dashcam footage, street snapshots, surveillance captures</p>
              <div className="dropzone-tags">
                <span className="dz-tag">JPG</span>
                <span className="dz-tag">PNG</span>
                <span className="dz-tag">WEBP</span>
              </div>
            </div>
          )}
        </div>

        {/* Action & Controls Panel */}
        <div className="studio-controls">
          <div className="control-metric-box">
            <div className="control-metric-label">
              <MapPin size={13} color="#38bdf8" />
              <span>Target Incident Coordinates</span>
            </div>
            <div className="control-metric-value">
              <span className="coord-mono">{locationStatus}</span>
              <button onClick={getExactLocation} className="refresh-gps-btn" title="Re-detect GPS Coordinates">
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          <div className="control-metric-box">
            <div className="control-metric-label">
              <Sparkles size={13} color="#f59e0b" />
              <span>Cloud Archive Vault</span>
            </div>
            <div className="control-metric-value">
              <span className="cloud-vault-tag">Cloudinary: urban_intelligence/road_defects</span>
            </div>
          </div>

          <div className="studio-action-row">
            {previewUrl && (
              <button 
                onClick={resetStudio}
                className="btn-secondary"
                disabled={isAnalyzing}
              >
                Clear
              </button>
            )}

            <button
              onClick={handleUploadAndAnalyze}
              disabled={!previewUrl || isAnalyzing}
              className="btn-primary"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing Tri-Model AI...</span>
                </>
              ) : (
                <>
                  <Cpu size={16} />
                  <span>Run Tri-Model AI Verification</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Diagnostic Panel */}
      {resultData && (
        <div className="studio-result-panel">
          <div className="result-panel-header">
            <div className="result-badge-success">
              <CheckCircle2 size={16} />
              <span>Verification Completed • Archived to Atlas & Cloudinary</span>
            </div>
            {resultData.cloudImageUrl && (
              <a 
                href={resultData.cloudImageUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="cloudinary-pill-link"
              >
                <span>Inspect in Cloudinary</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div className="result-metrics-grid">
            {/* Pothole Defect Metric */}
            <div className="diagnostic-stat-card amber-tint">
              <div className="stat-card-top">
                <span className="stat-card-label">Potholes Detected</span>
                <AlertTriangle size={15} color="#fbbf24" />
              </div>
              <div className="stat-card-body">
                <span className="stat-card-number amber">
                  {resultData.aiResults?.potholes?.count || 0}
                </span>
                <span className="stat-card-status">
                  {(resultData.aiResults?.potholes?.count || 0) > 0 ? 'Defects Flagged' : 'Surface Intact'}
                </span>
              </div>
            </div>

            {/* Vehicle Density Metric */}
            <div className="diagnostic-stat-card blue-tint">
              <div className="stat-card-top">
                <span className="stat-card-label">Vehicles Counted</span>
                <Car size={15} color="#38bdf8" />
              </div>
              <div className="stat-card-body">
                <span className="stat-card-number blue">
                  {resultData.aiResults?.vehicles?.count || 0}
                </span>
                <span className="stat-card-status">
                  {(resultData.aiResults?.vehicles?.count || 0) > 0 ? 'Traffic Registered' : 'Clear Road'}
                </span>
              </div>
            </div>

            {/* Pedestrian Vision Metric */}
            <div className="diagnostic-stat-card purple-tint">
              <div className="stat-card-top">
                <span className="stat-card-label">Pedestrians Detected</span>
                <User size={15} color="#c084fc" />
              </div>
              <div className="stat-card-body">
                <span className="stat-card-number purple">
                  {resultData.aiResults?.pedestrians?.count || 0}
                </span>
                <span className="stat-card-status">
                  {(resultData.aiResults?.pedestrians?.count || 0) > 0 ? 'Pedestrian Zone' : 'No Foot Traffic'}
                </span>
              </div>
            </div>

            {/* Congestion Index Metric */}
            <div className={`diagnostic-stat-card ${
              resultData.aiResults?.vehicles?.congestion === 'HIGH' ? 'rose-tint' :
              resultData.aiResults?.vehicles?.congestion === 'MEDIUM' ? 'amber-tint' : 'emerald-tint'
            }`}>
              <div className="stat-card-top">
                <span className="stat-card-label">Congestion Index</span>
                <Sparkles size={15} />
              </div>
              <div className="stat-card-body">
                <span className={`stat-card-number ${
                  resultData.aiResults?.vehicles?.congestion === 'HIGH' ? 'rose' :
                  resultData.aiResults?.vehicles?.congestion === 'MEDIUM' ? 'amber' : 'emerald'
                }`}>
                  {resultData.aiResults?.vehicles?.congestion || 'LOW'}
                </span>
                <span className="stat-card-status">Flow Rating</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="studio-error-banner">
          <AlertTriangle size={16} color="#fb7185" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
