import React from 'react';
import QassLogo from './QassLogo';

// Shown on windows narrower than 768 px: the simulator needs a larger screen.
export default function MobileBlocker() {
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
      </div>
    </div>
  );
}
