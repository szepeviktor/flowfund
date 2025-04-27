import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import Card from '../UI/Card';
import { Wallet } from 'lucide-react';

const AvailableFundsCard: React.FC = () => {
  const { availableFunds, updateAvailableFunds } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState(availableFunds.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setAmount(availableFunds.toString());
  }, [availableFunds]);

  const handleBlur = () => {
    const newAmount = parseFloat(amount);
    if (!isNaN(newAmount) && newAmount >= 0) {
      updateAvailableFunds(newAmount);
    } else {
      setAmount(availableFunds.toString());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setAmount(availableFunds.toString());
      setIsEditing(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Wallet className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-gray-500">Available Funds</h2>
            <div
              className="relative cursor-pointer group"
              onClick={() => !isEditing && setIsEditing(true)}
            >
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    ref={inputRef}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="pl-4 pr-2 py-1 w-40 text-2xl font-bold text-gray-900 border-b-2 border-indigo-500 focus:outline-none bg-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {formatCurrency(availableFunds)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AvailableFundsCard;