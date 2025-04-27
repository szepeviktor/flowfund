import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import Card from '../UI/Card';
import ProgressBar from '../UI/ProgressBar';

const FundingSummary: React.FC = () => {
  const { 
    accounts,
    totalAllocated, 
    remainingToAllocate,
    calculateTotalUpcomingOutgoings
  } = useAppContext();
  
  const totalUpcoming = calculateTotalUpcomingOutgoings();
  const totalAvailable = accounts.reduce((sum, account) => sum + account.currentAllocation, 0);
  const fundingPercentage = totalUpcoming > 0 
    ? (totalAllocated / totalUpcoming) * 100
    : 0;
  
  return (
    <Card className="mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Funding Summary</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Available</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAvailable)}</p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Allocated</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCurrency(totalAllocated)}</p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Remaining to Allocate</p>
          <p className={`text-2xl font-bold ${remainingToAllocate <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(Math.abs(remainingToAllocate))}
            <span className="text-sm ml-1">
              {remainingToAllocate <= 0 ? 'surplus' : 'needed'}
            </span>
          </p>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Funding Progress</span>
          <span className="text-sm font-medium text-gray-700">{Math.round(fundingPercentage)}%</span>
        </div>
        <ProgressBar 
          value={totalAllocated} 
          max={totalUpcoming || 1} 
          height={10}
          animate={true}
        />
      </div>
      
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500">Total Upcoming Outgoings</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalUpcoming)}</p>
        </div>
        
        <div className={`px-4 py-2 rounded-full ${totalAllocated >= totalUpcoming ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {totalAllocated >= totalUpcoming ? 'Fully Funded' : 'Needs Funding'}
        </div>
      </div>
    </Card>
  );
};

export default FundingSummary;