import React from 'react';

// A visually hidden live region: screen readers read `message` out whenever it
// changes (a measurement's result, the step a lesson is on). Empty says nothing.
export default function Announcer({ message }) {
  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message || ''}
    </div>
  );
}
