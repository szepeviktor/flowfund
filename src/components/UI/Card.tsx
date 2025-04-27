import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      className={`bg-white rounded-lg shadow-sm border border-gray-100 p-5 ${className} ${onClick ? 'cursor-pointer transition-transform hover:scale-[1.01]' : ''}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;