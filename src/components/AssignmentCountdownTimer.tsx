import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { getTimeRemaining, formatTimeRemaining, getColorClasses } from '../utils/deadlineCalculations';

interface AssignmentCountdownTimerProps {
  deadline: string; // ISO timestamp
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showIcon?: boolean;
  compact?: boolean; // For table/list views
  language?: 'en' | 'es';
  onExpire?: () => void;
}

export const AssignmentCountdownTimer: React.FC<AssignmentCountdownTimerProps> = ({
  deadline,
  size = 'medium',
  showLabel = true,
  showIcon = true,
  compact = false,
  language = 'en',
  onExpire
}) => {
  const [timeData, setTimeData] = useState(() => {
    const ms = getTimeRemaining(deadline);
    return formatTimeRemaining(ms);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = getTimeRemaining(deadline);
      const newTimeData = formatTimeRemaining(ms);
      setTimeData(newTimeData);

      // Call onExpire callback when timer expires
      if (newTimeData.isExpired && !timeData.isExpired && onExpire) {
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, onExpire, timeData.isExpired]);

  // Translations
  const labels = {
    en: {
      timeToAccept: 'Time to Accept:',
      expired: 'EXPIRED'
    },
    es: {
      timeToAccept: 'Tiempo para Aceptar:',
      expired: 'EXPIRADO'
    }
  };

  const text = labels[language];

  // Size classes
  const sizeClasses = {
    small: 'text-xs px-2 py-1',
    medium: 'text-sm px-2.5 py-1.5',
    large: 'text-base px-3 py-2'
  };

  const iconSizes = {
    small: 12,
    medium: 16,
    large: 20
  };

  // Get color classes
  const colors = getColorClasses(timeData.color);

  // Compact mode for tables
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 ${sizeClasses.small} rounded-md font-medium ${colors.bg} ${colors.text}`}>
        {showIcon && (
          timeData.isExpired ? (
            <AlertCircle size={iconSizes.small} className="flex-shrink-0" />
          ) : (
            <Clock size={iconSizes.small} className="flex-shrink-0" />
          )
        )}
        <span className="font-semibold whitespace-nowrap">
          {timeData.isExpired ? text.expired : timeData.displayStringShort}
        </span>
      </div>
    );
  }

  // Full display mode
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg font-medium ${sizeClasses[size]} ${colors.bg} ${colors.text} ${timeData.color === 'red' && !timeData.isExpired ? 'animate-pulse' : ''}`}>
      {showIcon && (
        timeData.isExpired ? (
          <AlertCircle size={iconSizes[size]} className="flex-shrink-0" />
        ) : (
          <Clock size={iconSizes[size]} className="flex-shrink-0" />
        )
      )}
      <div className="flex items-center gap-1.5">
        {showLabel && !timeData.isExpired && (
          <span className="font-normal opacity-80">{text.timeToAccept}</span>
        )}
        <span className="font-bold">
          {timeData.isExpired ? text.expired : timeData.displayString}
        </span>
      </div>
    </div>
  );
};

export default AssignmentCountdownTimer;
