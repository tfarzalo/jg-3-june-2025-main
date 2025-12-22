import React, { useState } from 'react';
import { UserLoginAlert } from './UserLoginAlert';

// Test component to verify alert stacking
export function AlertStackingTest() {
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    user: {
      id: string;
      email: string;
      full_name: string | null;
      role: string;
      avatar_url: string | null;
    };
  }>>([]);

  const addTestAlert = () => {
    const newAlert = {
      id: `test-${Date.now()}`,
      user: {
        id: `user-${Date.now()}`,
        email: `test${alerts.length + 1}@example.com`,
        full_name: `Test User ${alerts.length + 1}`,
        role: 'user',
        avatar_url: null
      }
    };
    setAlerts(prev => [...prev, newAlert]);
  };

  const removeAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Alert Stacking Test</h1>
      
      <div className="mb-6">
        <button
          onClick={addTestAlert}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg mr-4"
        >
          Add Test Alert
        </button>
        
        <button
          onClick={() => setAlerts([])}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
        >
          Clear All Alerts
        </button>
      </div>

      <div className="mb-4">
        <p className="text-gray-600">
          Current alerts: {alerts.length}
        </p>
      </div>

      {/* Test the alert stacking */}
      <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-3">
        {alerts.map((alert, index) => (
          <div
            key={alert.id}
            className="transform transition-all duration-300 ease-out"
            style={{
              zIndex: 99999 - index
            }}
          >
            <UserLoginAlert
              user={alert.user}
              onClose={() => removeAlert(alert.id)}
            />
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Instructions:</h2>
        <ol className="list-decimal list-inside space-y-1 text-gray-700">
          <li>Click "Add Test Alert" to add multiple alerts</li>
          <li>Verify that alerts stack vertically without overlap</li>
          <li>Check that each alert has proper spacing (gap-3)</li>
          <li>Test that alerts can be dismissed individually</li>
          <li>Verify smooth animations and transitions</li>
        </ol>
      </div>
    </div>
  );
}
