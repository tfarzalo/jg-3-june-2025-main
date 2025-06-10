import { useState, useEffect } from 'react';
import { gibsonApi } from '../services/gibsonClient';

export const GibsonTest = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const response = await gibsonApi.getProperties();
        setProperties(response.data.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching properties:', err);
        setError(err.message || 'Failed to fetch properties');
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  return (
    <div className="p-6 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Gibson API Test</h2>
      {loading && <p className="text-gray-600 dark:text-gray-400">Loading properties...</p>}
      {error && <p className="text-red-600 dark:text-red-400">Error: {error}</p>}
      {!loading && !error && (
        <>
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Properties ({properties.length})</h3>
          {properties.length > 0 ? (
            <ul className="space-y-2">
              {properties.map(property => (
                <li key={property.id} className="p-3 bg-gray-50 dark:bg-[#0F172A] rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white">{property.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ID: {property.id}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">No properties found</p>
          )}
        </>
      )}
    </div>
  );
};

export default GibsonTest;