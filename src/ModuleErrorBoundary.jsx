import React from 'react';

// A module's code is downloaded on demand. If that download fails (a flaky
// connection, or a redeploy replaced the file while the page was open) the
// browser remembers the failure, so only a page reload can fetch it again.
const isLoadFailure = (error) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
    .test(String(error?.message || error));

const buttonStyle = {
  padding: '10px 18px',
  borderRadius: '999px',
  fontSize: '13.5px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', 'Inter', sans-serif",
};

/**
 * Keeps one module's failure from taking down the whole app: the sidebar and
 * hub stay usable and the user gets a way back in. Remount it with a `key`
 * per module so switching modules clears the error.
 */
export default class ModuleErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Module failed to render:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { moduleTitle, boundsStyle, onRetry, onBackToHub } = this.props;
    const loadFailure = isLoadFailure(error);

    return (
      <div style={{ ...boundsStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          role="alert"
          data-module-load-error
          className="glass-card"
          style={{ maxWidth: '420px', pointerEvents: 'auto', textAlign: 'center' }}
        >
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', fontFamily: "'Deltha', 'Inter', sans-serif", letterSpacing: '0.5px' }}>
            {moduleTitle ? `${moduleTitle} didn't load` : "This module didn't load"}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 20px' }}>
            {loadFailure
              ? 'Part of the simulator could not be downloaded. Check your connection, or QVerse may have just been updated.'
              : 'Something went wrong while running this module.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onRetry}
              style={{ ...buttonStyle, background: 'rgba(56, 189, 248, 0.18)', border: '1px solid rgba(56, 189, 248, 0.6)', color: '#7dd3fc' }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onBackToHub}
              style={{ ...buttonStyle, background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.18)', color: 'var(--text-secondary)' }}
            >
              Back to hub
            </button>
          </div>
        </div>
      </div>
    );
  }
}
