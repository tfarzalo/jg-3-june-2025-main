// TemplatesList.jsx - placeholder component showing saved templates
import React from 'react';

export default function TemplatesList() {
  // TODO: fetch user's saved templates
  const templates = [
    { id: 'preset-daily', name: 'Daily Work Order Report (Wufoo compatible)' }
  ];

  return (
    <div className="templates-list">
      <ul>
        {templates.map(t => (
          <li key={t.id}>{t.name} <button className="btn btn-link">Run</button></li>
        ))}
      </ul>
    </div>
  );
}
