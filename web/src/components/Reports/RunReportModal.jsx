// RunReportModal.jsx - modal to select date range and run report
import React, { useState } from 'react';

export default function RunReportModal({ onClose }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!from || !to) return alert('Please select from and to dates');
    setLoading(true);
    try {
      const resp = await fetch('/api/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to })
      });
      if (resp.ok) {
        // Response is a zip stream download; browser will prompt download
        // We simply close modal
        onClose();
      } else {
        const j = await resp.json();
        alert('Error: ' + (j.error || resp.statusText));
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Run Report</h3>
        <label>
          From
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <div className="actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={run} disabled={loading} className="btn btn-primary">{loading ? 'Running...' : 'Run'}</button>
        </div>
      </div>
    </div>
  );
}
