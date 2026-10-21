import React from 'react';
import QassLogo from './QassLogo';

// Shown on phone-sized touch screens (App.jsx): the simulator needs a larger screen,
// but the visitor can go on anyway.
export default function MobileBlocker({ onContinue }) {
  return (
    <div className="mobile-blocker-overlay">
      <div className="glass-card mobile-blocker-card">
        <QassLogo size={84} style={{ marginBottom: '20px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px', color: 'var(--text-primary)' }}>QASS</h2>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
          This immersive 3D quantum experience requires a larger screen to run properly.
        </p>
        <p style={{ fontSize: '16px', color: '#4facfe', fontWeight: '600' }}>
          Please experience it in a Desktop or Tablet Browser.
        </p>
        {onContinue && (
          <button type="button" className="glass-btn" style={{ marginTop: '18px' }} onClick={onContinue}>
            Continue anyway
          </button>
        )}
      </div>
    </div>
  );
}
