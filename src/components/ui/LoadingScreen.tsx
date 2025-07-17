import React, { useState, useEffect } from 'react';

interface LoadingScreenProps {
  message?: string;
  duration?: number;
}

export function LoadingScreen({ message = 'Loading...', duration = 4000 }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);
      
      if (newProgress >= 100) {
        clearInterval(interval);
      }
    }, 16); // Update every 16ms for smooth animation

    return () => clearInterval(interval);
  }, [duration]);

  // Calculate gradient stops based on progress
  const getGradientStops = () => {
    const blueStop = Math.min(25, progress);
    const purpleStop = Math.min(50, progress);
    const orangeStop = Math.min(75, progress);
    const greenStop = progress;

    return {
      blue: `${blueStop}%`,
      purple: `${purpleStop}%`,
      orange: `${orangeStop}%`,
      green: `${greenStop}%`
    };
  };

  const stops = getGradientStops();

  return (
    <div className="fixed inset-0 bg-white dark:bg-[#0F172A] flex items-center justify-center z-50">
      <div className="w-64 flex flex-col items-center gap-4">
        {/* Progress bar background */}
        <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          {/* Progress bar fill with gradient */}
          <div 
            className="h-full transition-all duration-100 ease-linear"
            style={{ 
              width: `${progress}%`,
              background: `linear-gradient(to right, 
                #3B82F6 0%, 
                #3B82F6 ${stops.blue}, 
                #A855F7 ${stops.blue}, 
                #A855F7 ${stops.purple}, 
                #F97316 ${stops.purple}, 
                #F97316 ${stops.orange}, 
                #22C55E ${stops.orange}, 
                #22C55E ${stops.green}
              )`
            }}
          />
        </div>
        <h3 className="text-gray-900 dark:text-white font-medium text-xl text-center">
          PAINTING DASHBOARD
        </h3>
      </div>
    </div>
  );
} 