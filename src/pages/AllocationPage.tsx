import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import { formatCurrency } from '../utils/formatters';
import { RefreshCw } from 'lucide-react';

const AllocationPage: React.FC = () => {
  const { 
    accounts, 
    getOutgoingsForAccount,
    updateAllocations,
    getAllocationForAccount,
  } = useAppContext();

  const [availableFundsInput, setAvailableFundsInput] = useState<string>('');

  const handleReset = () => {
    updateAllocations([]);
    setAvailableFundsInput('');
  };

  const handleFundsChange = (value: string) => {
    setAvailableFundsInput(value);
    const total = parseFloat(value) || 0;

    if (total <= 0) {
      updateAllocations([]);
      return;
    }

    let remainingFunds = total;
    const newAllocations = [];

    // Simple sequential allocation
    for (const account of accounts) {
      const outgoings = getOutgoingsForAccount(account.id);
      const needed = outgoings.reduce((sum, outgoing) => sum + outgoing.amount, 0);
      
      if (needed > 0 && remainingFunds > 0) {
        // Allocate either what's needed or what's left, whichever is smaller
        const allocation = Math.min(needed, remainingFunds);
        newAllocations.push({
          id: crypto.randomUUID(),
          accountId: account.id,
          amount: allocation
        });
        remainingFunds -= allocation;
      }
    }

    updateAllocations(newAllocations);
  };

  const totalNeeded = accounts.reduce((sum, account) => {
    const outgoings = getOutgoingsForAccount(account.id);
    return sum + outgoings.reduce((acc, outgoing) => acc + outgoing.amount, 0);
  }, 0);

  const totalAllocated = accounts.reduce((sum, account) => 
    sum + getAllocationForAccount(account.id), 0
  );
  
  const unallocated = (parseFloat(availableFundsInput) || 0) - totalAllocated;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Allocate Funds</h1>
        <p className="text-gray-500 mt-2">
          Enter your available funds and we'll allocate them to your accounts
        </p>
      </div>

      <Card className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Available Funds</h2>
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={16} />}
            onClick={handleReset}
          >
            Reset
          </Button>
        </div>
        
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={availableFundsInput}
            onChange={(e) => handleFundsChange(e.target.value)}
            className="block w-full pl-8 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Needed: {formatCurrency(totalNeeded)}</span>
          {unallocated > 0 && (
            <span className="text-gray-500">Unallocated: {formatCurrency(unallocated)}</span>
          )}
        </div>
      </Card>

      <div className="grid gap-6">
        {accounts.map((account) => {
          const outgoings = getOutgoingsForAccount(account.id);
          const totalOutgoings = outgoings.reduce((sum, outgoing) => sum + outgoing.amount, 0);
          const currentAllocation = getAllocationForAccount(account.id);
          const fundingPercentage = totalOutgoings > 0 
            ? (currentAllocation / totalOutgoings) * 100
            : 0;
          
          return (
            <Card key={account.id}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                  <p className="text-sm text-gray-500">{account.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(currentAllocation)}
                  </p>
                  <p className="text-sm text-gray-500">
                    of {formatCurrency(totalOutgoings)} needed
                  </p>
                </div>
              </div>

              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full transition-all duration-500 ease-out rounded-full"
                  style={{ 
                    width: `${Math.min(fundingPercentage, 100)}%`,
                    backgroundColor: account.color
                  }}
                />
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  {outgoings.length} outgoing{outgoings.length !== 1 ? 's' : ''}
                </p>
                <p className={`text-sm font-medium ${
                  fundingPercentage >= 100 ? 'text-emerald-600' : 'text-gray-500'
                }`}>
                  {Math.round(fundingPercentage)}% Funded
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AllocationPage;