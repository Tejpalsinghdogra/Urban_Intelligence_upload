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
  User,
  Video,
  Film,
  Play,
  Pause,
  Clock,
  Square,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';

export default function InspectionStudio({ apiUrl }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileType, setFileType] = useState(null); // 'image' | 'video'
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('Detecting GPS...');
  
  // Video specific state
  const [videoDuration, setVideoDuration] = useState(0);
  const [samplingInterval, setSamplingInterval] = useState(2); // every 2 seconds
  const [videoProgress, setVideoProgress] = useState({ currentFrame: 0, totalFrames: 0, currentTime: 0, percent: 0 });
  const [timelineResults, setTimelineResults] = useState([]);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const cancelScanRef = useRef(false);

  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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
          setLocationStatus('GPS unavailable (Using transit route coords)');
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
      const isVid = file.type.startsWith('video') || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
      setSelectedFile(file);
      setFileType(isVid ? 'video' : 'image');
      setPreviewUrl(URL.createObjectURL(file));
      setResultData(null);
      setErrorMessage(null);
      setTimelineResults([]);
      setVideoProgress({ currentFrame: 0, totalFrames: 0, currentTime: 0, percent: 0 });
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration || 0);
    }
  };

  // Robust client-side canvas frame extraction from video
  const extractFrameAtTimestamp = (videoEl, targetTime) => {
    return new Promise((resolve) => {
      const safeTime = Math.min(targetTime, videoEl.duration || targetTime);
      
      const capture = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoEl.videoWidth || 640;
          canvas.height = videoEl.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch (err) {
          console.error('Frame capture canvas error:', err);
          resolve(null);
        }
      };

      if (Math.abs(videoEl.currentTime - safeTime) < 0.08) {
        capture();
        return;
      }

      let timer = null;
      const onSeeked = () => {
        videoEl.removeEventListener('seeked', onSeeked);
        if (timer) clearTimeout(timer);
        capture();
      };

      timer = setTimeout(() => {
        videoEl.removeEventListener('seeked', onSeeked);
        capture();
      }, 1500);

      videoEl.addEventListener('seeked', onSeeked, { once: true });
      videoEl.currentTime = safeTime;
    });
  };

  // Run AI analysis on single photo
  const handleAnalyzeImage = async () => {
    if (!previewUrl) return;

    setIsAnalyzing(true);
    setErrorMessage(null);
    setResultData(null);

    try {
      // Read file to base64 if not already
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(selectedFile);
      });
      const base64 = await base64Promise;

      const payload = {
        imageBase64: base64,
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

  // Run AI analysis on MP4 / Video by sampling frames across the duration
  const handleAnalyzeVideo = async () => {
    const videoEl = videoRef.current;
    if (!videoEl || !previewUrl) return;

    setIsAnalyzing(true);
    setErrorMessage(null);
    setResultData(null);
    setTimelineResults([]);
    cancelScanRef.current = false;

    const duration = videoEl.duration || 10;
    
    // Generate timestamps array
    const timestamps = [];
    for (let t = 0; t <= duration; t += samplingInterval) {
      timestamps.push(Number(t.toFixed(1)));
    }
    if (timestamps[timestamps.length - 1] < duration - 0.8) {
      timestamps.push(Number(duration.toFixed(1)));
    }

    const total = timestamps.length;
    setVideoProgress({ currentFrame: 0, totalFrames: total, currentTime: 0, percent: 0 });

    let cumulativePotholes = 0;
    let maxVehicles = 0;
    let cumulativePedestrians = 0;
    let highCongestionDetected = false;
    let latestCloudImageUrl = null;
    const collectedTimeline = [];

    try {
      for (let i = 0; i < timestamps.length; i++) {
        if (cancelScanRef.current) {
          console.log('[Video Scan] Aborted by user.');
          break;
        }

        const t = timestamps[i];
        const frameNum = i + 1;
        const percent = Math.round((frameNum / total) * 100);

        setVideoProgress({
          currentFrame: frameNum,
          totalFrames: total,
          currentTime: t,
          percent
        });

        // Extract frame at exact timestamp
        const frameBase64 = await extractFrameAtTimestamp(videoEl, t);
        if (!frameBase64) continue;

        // Progressive coordinate simulation along transit corridor
        const latOffset = (i * 0.0006);
        const lngOffset = (i * 0.0008);
        const targetLat = userLocation ? Number((userLocation.lat + latOffset).toFixed(6)) : Number((30.9005 + latOffset).toFixed(6));
        const targetLng = userLocation ? Number((userLocation.lng + lngOffset).toFixed(6)) : Number((75.8510 + lngOffset).toFixed(6));

        try {
          const response = await axios.post(`${apiUrl}/api/detections/analyze-image`, {
            imageBase64: frameBase64,
            lat: targetLat,
            lng: targetLng
          });

          if (response.data.success) {
            const ai = response.data.aiResults;
            const potholes = ai?.potholes?.count || 0;
            const vehicles = ai?.vehicles?.count || 0;
            const pedestrians = ai?.pedestrians?.count || 0;
            const congestion = ai?.vehicles?.congestion || 'LOW';

            cumulativePotholes += potholes;
            if (vehicles > maxVehicles) maxVehicles = vehicles;
            cumulativePedestrians += pedestrians;
            if (congestion === 'HIGH') highCongestionDetected = true;
            if (response.data.cloudImageUrl) latestCloudImageUrl = response.data.cloudImageUrl;

            collectedTimeline.push({
              frameIndex: frameNum,
              timeSec: t,
              timeFormatted: formatTime(t),
              potholes,
              vehicles,
              pedestrians,
              congestion,
              cloudImageUrl: response.data.cloudImageUrl
            });
            setTimelineResults([...collectedTimeline]);
          }
        } catch (postErr) {
          console.warn(`[Video Scan] Frame error at ${formatTime(t)}:`, postErr.message);
        }

        // Brief delay between frames for smooth streaming UX
        await new Promise(r => setTimeout(r, 600));
      }

      let overallCongestion = 'LOW';
      if (maxVehicles >= 7 || highCongestionDetected) overallCongestion = 'HIGH';
      else if (maxVehicles >= 4) overallCongestion = 'MEDIUM';

      setResultData({
        isVideoResult: true,
        totalFramesScanned: collectedTimeline.length,
        cloudImageUrl: latestCloudImageUrl,
        aiResults: {
          potholes: { count: cumulativePotholes },
          vehicles: { count: maxVehicles, congestion: overallCongestion },
          pedestrians: { count: cumulativePedestrians }
        }
      });

    } catch (err) {
      console.error('Video analysis failed:', err);
      setErrorMessage(err.message || 'Error occurred during video analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStopScan = () => {
    cancelScanRef.current = true;
    setIsAnalyzing(false);
  };

  const jumpToTime = (timeSec) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
    }
  };

  const resetStudio = () => {
    cancelScanRef.current = true;
    setSelectedFile(null);
    setFileType(null);
    setPreviewUrl(null);
    setResultData(null);
    setErrorMessage(null);
    setTimelineResults([]);
    setVideoProgress({ currentFrame: 0, totalFrames: 0, currentTime: 0, percent: 0 });
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
            accept="image/*,video/mp4,video/quicktime,video/webm,video/*,.mp4,.mov,.webm,.mkv"
            style={{ display: 'none' }}
          />

          {previewUrl ? (
            <div className="preview-container">
              {fileType === 'video' ? (
                <div className="video-player-box">
                  <video
                    ref={videoRef}
                    src={previewUrl}
                    onLoadedMetadata={handleVideoLoadedMetadata}
                    controls={!isAnalyzing}
                    playsInline
                    muted
                    className="preview-video"
                  />
                  <div className="video-format-pill">
                    <Film size={12} />
                    <span>MP4 Video Stream ({formatTime(videoDuration)})</span>
                  </div>
                </div>
              ) : (
                <img src={previewUrl} alt="Inspection Candidate" className="preview-image" />
              )}
              
              {/* Computer Vision LiDAR Laser Scanning Beam */}
              {isAnalyzing && (
                <div className="laser-scanner-overlay">
                  <div className="laser-scanner-beam"></div>
                  <div className="laser-scanner-hud">
                    <span className="hud-radar-dot"></span>
                    <span>
                      {fileType === 'video' 
                        ? `SCANNING VIDEO FRAME ${videoProgress.currentFrame}/${videoProgress.totalFrames} (${formatTime(videoProgress.currentTime)})...` 
                        : 'RUNNING INFERENCE PIPELINE...'}
                    </span>
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
                Change Media
              </button>
            </div>
          ) : (
            <div className="dropzone-prompt">
              <div className="dropzone-icon-circle">
                <UploadCloud size={30} color="#38bdf8" />
              </div>
              <p className="dropzone-main-text">Upload Video Feed (MP4) or Road Surface Photo</p>
              <p className="dropzone-sub-text">Dashcam footage, transit surveillance, or road defect snapshots</p>
              <div className="dropzone-tags">
                <span className="dz-tag highlight-tag">MP4</span>
                <span className="dz-tag highlight-tag">MOV</span>
                <span className="dz-tag">JPG</span>
                <span className="dz-tag">PNG</span>
                <span className="dz-tag">WEBP</span>
              </div>
            </div>
          )}
        </div>

        {/* Action & Controls Panel */}
        <div className="studio-controls">
          {/* Target Coordinates */}
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

          {/* Video Sampling Interval Control (only if video selected) */}
          {fileType === 'video' && (
            <div className="control-metric-box video-sampling-box">
              <div className="control-metric-label">
                <SlidersHorizontal size={13} color="#38bdf8" />
                <span>AI Frame Sampling Interval</span>
              </div>
              <div className="sampling-interval-options">
                {[1, 2, 3, 5].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`interval-chip ${samplingInterval === sec ? 'active' : ''}`}
                    onClick={() => setSamplingInterval(sec)}
                    disabled={isAnalyzing}
                  >
                    Every {sec}s
                  </button>
                ))}
                <span className="sampling-est-label">
                  (~{Math.ceil((videoDuration || 10) / samplingInterval)} frames)
                </span>
              </div>
            </div>
          )}

          {/* Cloud Archive Vault */}
          <div className="control-metric-box">
            <div className="control-metric-label">
              <Sparkles size={13} color="#f59e0b" />
              <span>Cloud Archive Vault</span>
            </div>
            <div className="control-metric-value">
              <span className="cloud-vault-tag">Cloudinary: urban_intelligence/road_defects</span>
            </div>
          </div>

          {/* Video Live Progress Bar */}
          {isAnalyzing && fileType === 'video' && (
            <div className="video-progress-wrapper">
              <div className="video-progress-header">
                <span>Analyzing Frame {videoProgress.currentFrame} of {videoProgress.totalFrames} ({formatTime(videoProgress.currentTime)})</span>
                <span className="progress-pct">{videoProgress.percent}%</span>
              </div>
              <div className="video-progress-track">
                <div 
                  className="video-progress-bar" 
                  style={{ width: `${videoProgress.percent}%` }}
                ></div>
              </div>
            </div>
          )}

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

            {isAnalyzing && fileType === 'video' ? (
              <button
                onClick={handleStopScan}
                className="btn-danger"
              >
                <Square size={15} />
                <span>Stop Analysis</span>
              </button>
            ) : (
              <button
                onClick={fileType === 'video' ? handleAnalyzeVideo : handleAnalyzeImage}
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
                    {fileType === 'video' ? <Film size={16} /> : <Cpu size={16} />}
                    <span>{fileType === 'video' ? 'Analyze MP4 Video with Tri-Model AI' : 'Run Tri-Model AI Verification'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video Frame Timeline Log (if video analyzed) */}
      {timelineResults.length > 0 && (
        <div className="video-timeline-card">
          <div className="timeline-header">
            <div className="timeline-title">
              <Film size={16} color="#38bdf8" />
              <span>Video Frame Telemetry Stream ({timelineResults.length} Samples)</span>
            </div>
            <span className="timeline-hint">Click any timestamp to seek video</span>
          </div>

          <div className="timeline-chips-row">
            {timelineResults.map((item, idx) => (
              <div 
                key={idx} 
                className={`timeline-chip ${item.potholes > 0 ? 'has-pothole' : ''} ${item.congestion === 'HIGH' ? 'heavy-traffic' : ''}`}
                onClick={() => jumpToTime(item.timeSec)}
                title={`Click to jump to ${item.timeFormatted}`}
              >
                <div className="chip-time">
                  <Clock size={11} />
                  <span>{item.timeFormatted}</span>
                </div>
                <div className="chip-data">
                  {item.potholes > 0 && (
                    <span className="chip-badge amber">
                      <AlertTriangle size={10} /> {item.potholes} Pothole{item.potholes > 1 ? 's' : ''}
                    </span>
                  )}
                  {item.vehicles > 0 && (
                    <span className="chip-badge cyan">
                      <Car size={10} /> {item.vehicles} Veh ({item.congestion})
                    </span>
                  )}
                  {item.pedestrians > 0 && (
                    <span className="chip-badge purple">
                      <User size={10} /> {item.pedestrians} Ped
                    </span>
                  )}
                  {item.potholes === 0 && item.vehicles === 0 && item.pedestrians === 0 && (
                    <span className="chip-badge clear">Road Clear</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Diagnostic Panel */}
      {resultData && (
        <div className="studio-result-panel">
          <div className="result-panel-header">
            <div className="result-badge-success">
              <CheckCircle2 size={16} />
              <span>
                {resultData.isVideoResult 
                  ? `Video Analysis Completed (${resultData.totalFramesScanned} Frames Evaluated) • Telemetry Broadcasted Live` 
                  : 'Verification Completed • Archived to Atlas & Cloudinary'}
              </span>
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
                <span className="stat-card-label">
                  {resultData.isVideoResult ? 'Total Potholes Flagged' : 'Potholes Detected'}
                </span>
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
                <span className="stat-card-label">
                  {resultData.isVideoResult ? 'Peak Vehicles In Frame' : 'Vehicles Counted'}
                </span>
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
                <span className="stat-card-label">
                  {resultData.isVideoResult ? 'Total Pedestrians Spotted' : 'Pedestrians Detected'}
                </span>
                <User size={15} color="#c084fc" />
              </div>
              <div className="stat-card-body">
                <span className="stat-card-number purple">
                  {resultData.aiResults?.pedestrians?.count || 0}
                </span>
                <span className="stat-card-status">
                  {(resultData.aiResults?.pedestrians?.count || 0) > 0 ? 'Pedestrian Activity' : 'No Foot Traffic'}
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
                <span className="stat-card-status">
                  {resultData.isVideoResult ? 'Route Flow Rating' : 'Flow Rating'}
                </span>
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
