import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
  animate?: boolean;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  color = '#3B82F6',
  height = 8,
  showLabel = false,
  animate = true,
  className = '',
}) => {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100);
  
  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-1">
        {showLabel && (
          <>
            <span className="text-xs font-medium text-gray-500">Progress</span>
            <span className="text-xs font-medium text-gray-700">{Math.round(percentage)}%</span>
          </>
        )}
      </div>
      <div 
        className="w-full bg-gray-200 rounded-full overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <div 
          className={`rounded-full ${animate ? 'transition-all duration-500 ease-out' : ''}`}
          style={{ 
            width: `${percentage}%`, 
            height: '100%',
            backgroundColor: color
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;