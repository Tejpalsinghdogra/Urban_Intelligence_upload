import React from 'react';

export default function AudioWaveform({ isActive }) {
  // 12 dynamic visualizer frequency bars
  const bars = [16, 28, 45, 75, 32, 85, 60, 95, 40, 70, 30, 50];

  return (
    <div className={`cyber-waveform ${isActive ? 'active' : ''}`} title="Telemetry Frequency Visualizer">
      {bars.map((height, i) => (
        <span 
          key={i} 
          className="waveform-bar"
          style={{
            '--target-height': `${height}%`,
            '--anim-delay': `${(i * 0.08).toFixed(2)}s`
          }}
        />
      ))}
    </div>
  );
}
