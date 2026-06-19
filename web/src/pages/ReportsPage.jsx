// ReportsPage.jsx - simple Reports UI scaffold
import React, { useState } from 'react';
import RunReportModal from '../components/Reports/RunReportModal';
import TemplatesList from '../components/Reports/TemplatesList';

export default function ReportsPage() {
  const [showRun, setShowRun] = useState(false);

  return (
    <div className="reports-page container">
      <div className="header">
        <h1>Reports</h1>
        <button className="btn btn-primary" onClick={() => setShowRun(true)}>Run Report</button>
      </div>

      <section className="presets">
        <h2>Preset Reports</h2>
        <ul>
          <li>Daily Work Order Report</li>
          <li>Invoices Report</li>
          <li>Labor Report</li>
        </ul>
      </section>

      <section className="templates">
        <h2>Your Templates</h2>
        <TemplatesList />
      </section>

      {showRun && <RunReportModal onClose={() => setShowRun(false)} />}
    </div>
  );
}
