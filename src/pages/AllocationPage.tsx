import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAllocation } from '../hooks/useAllocation';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import { formatCurrency } from '../utils/formatters';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';
import { FundSource } from '../types';

const AllocationPage: React.FC = () => {
  const { 
    accounts, 
    getOutgoingsForAccount,
    getAllocationForAccount,
    totalFunds,
    fundSources,
    outgoings,
    allocations,
    totalRequired,
    totalAllocated,
    remainingToAllocate,
    updateAllocations,
    updateAvailableFunds,
    resetFundSources
  } = useAppContext();
  
  const { updateFundsAndAllocations, addFundSource, updateFundSource, deleteFundSource } = useAllocation();
  const [sourceAmounts, setSourceAmounts] = useState<{[id: string]: string}>({});
  const [newSourceIds, setNewSourceIds] = useState<string[]>([]);
  const latestSourceRef = useRef<string | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);

  // Calculate the unallocated amount directly (funds that haven't been allocated)
  const unallocatedFunds = totalFunds - totalAllocated;
  
  // Monitor changes to key values
  useEffect(() => {
    console.log('Context values:', { 
      totalFunds, 
      totalRequired, 
      totalAllocated, 
      remainingToAllocate, // This is funds - required (available minus needed)
      unallocatedFunds    // This is funds - allocated (what's left unallocated)
    });
  }, [totalFunds, totalRequired, totalAllocated, remainingToAllocate, unallocatedFunds]);

  // Recalculate allocations whenever total funds or outgoings change
  useEffect(() => {
    // Only run this if we have accounts
    if (accounts.length > 0) {
      // Always run allocation even with zero funds
      // This ensures allocations are properly cleared when funds become zero
      setIsAllocating(true);
      
      // Use a small timeout to debounce multiple rapid changes
      const timer = setTimeout(() => {
        updateFundsAndAllocations(totalFunds);
        // Short delay to ensure UI updates after allocation completes
        setTimeout(() => {
          setIsAllocating(false);
        }, 20);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [totalFunds, accounts.length, outgoings, updateFundsAndAllocations]);

  // Track when allocations actually change
  useEffect(() => {
    setIsAllocating(false);
  }, [allocations]);

  // Monitor fundSources for newly added sources and track their IDs
  useEffect(() => {
    // Skip if there are no fund sources
    if (fundSources.length === 0) return;
    
    // Only track the latest added source that's not already being tracked
    const latestSource = fundSources[fundSources.length - 1];
    if (latestSource && latestSource.id !== latestSourceRef.current) {
      latestSourceRef.current = latestSource.id;
      
      if (!newSourceIds.includes(latestSource.id)) {
        setNewSourceIds(prev => [...prev, latestSource.id]);
      }
    }
  }, [fundSources, newSourceIds]);

  // Initialize the sourceAmounts state with the current fund source amounts
  useEffect(() => {
    const amountsMap: {[id: string]: string} = {};
    
    fundSources.forEach(source => {
      // Keep existing user input values if they exist
      if (sourceAmounts[source.id] !== undefined) {
        amountsMap[source.id] = sourceAmounts[source.id];
      }
      // Don't set any initial value for new sources (let placeholder show)
      else if (!newSourceIds.includes(source.id)) {
        // Only set a value if the amount is greater than 0
        if (source.amount > 0) {
          amountsMap[source.id] = source.amount.toString();
        } else {
          // For sources with 0, don't set a value to avoid issues with leading zeroes
          amountsMap[source.id] = '';
        }
      }
    });
    
    // Check if we need to update
    let needsUpdate = false;
    for (const id in amountsMap) {
      if (sourceAmounts[id] !== amountsMap[id]) {
        needsUpdate = true;
        break;
      }
    }
    
    // Only update if needed to avoid unnecessary renders
    if (needsUpdate) {
      setSourceAmounts(prevAmounts => ({
        ...prevAmounts,
        ...amountsMap
      }));
    }
  }, [fundSources, sourceAmounts, newSourceIds]);

  const handleReset = () => {
    // Use our direct reset function that creates a single empty fund source
    const newSourceId = resetFundSources();
    
    // Clear allocations
    updateAllocations([]);
    
    // Reset our tracking states
    setSourceAmounts({});
    
    // Track the new source to ensure placeholder shows
    setNewSourceIds([newSourceId]);
    latestSourceRef.current = newSourceId;
  };

  const handleAddSource = () => {
    // Add a new source with 0 value - we'll track it via the useEffect
    addFundSource(0);
  };

  const handleSourceAmountChange = (sourceId: string, value: string) => {
    // Update the source amounts state with the raw value
    setSourceAmounts(prevAmounts => ({
      ...prevAmounts,
      [sourceId]: value
    }));

    // Find the corresponding source
    const source = fundSources.find(s => s.id === sourceId);
    if (!source) return;

    // Special handling for empty input - treat as zero
    if (value === '' || value === '.') {
      // Only update if the value has actually changed to avoid unnecessary renders
      if (source.amount !== 0) {
        updateFundSource({
          ...source,
          amount: 0
        });
      }
      return;
    }

    // Handle valid numeric inputs, including partial decimals like "1."
    let numericValue = value;
    // If input starts with decimal point, add leading zero for parsing
    if (numericValue.startsWith('.')) {
      numericValue = '0' + numericValue;
    }
    
    const amount = parseFloat(numericValue);
    if (!isNaN(amount) && amount >= 0) {
      // Only update if the value has actually changed
      if (source.amount !== amount) {
        // Update the actual fund source in real-time
        updateFundSource({
          ...source,
          amount: amount
        });
      }
    }

    // For new sources, mark them as "edited" by storing a non-empty value
    if (newSourceIds.includes(sourceId) && value !== '') {
      // We don't actually remove from newSourceIds until blur to keep the placeholder
      // This prevents any state update conflicts during typing
    }
  };

  const handleSourceAmountBlur = (source: FundSource) => {
    const inputValue = sourceAmounts[source.id];
    
    // Handle empty input - treat as zero but show empty field (for cleaner UI)
    if (inputValue === undefined || inputValue === '') {
      // Always ensure the source has a 0 amount in the data model
      if (source.amount !== 0) {
        updateFundSource({
          ...source,
          amount: 0
        });
      }
      
      // Clear the input display for existing sources if it was already 0
      // (this prevents "0" from appearing when a field is deliberately emptied)
      if (!newSourceIds.includes(source.id)) {
        setSourceAmounts(prevAmounts => ({
          ...prevAmounts,
          [source.id]: '' // Keep input empty for better UX
        }));
      }
      return;
    }
    
    // Properly parse numeric input, handling inputs like "00123" or ".5"
    let numericValue = inputValue;
    // If input starts with decimal point, add leading zero
    if (numericValue.startsWith('.')) {
      numericValue = '0' + numericValue;
    }
    
    const amount = parseFloat(numericValue);
    if (!isNaN(amount) && amount >= 0) {
      // Format the displayed value to show properly
      setSourceAmounts(prevAmounts => ({
        ...prevAmounts,
        [source.id]: amount.toString()
      }));
      
      // Ensure source amount is updated
      if (source.amount !== amount) {
        updateFundSource({
          ...source,
          amount: amount
        });
      }
      
      // Once a value is saved, it's no longer a new source
      if (newSourceIds.includes(source.id)) {
        setNewSourceIds(prev => prev.filter(id => id !== source.id));
      }
    } else {
      // Reset to the current source amount if invalid
      setSourceAmounts(prevAmounts => ({
        ...prevAmounts,
        [source.id]: source.amount > 0 ? source.amount.toString() : ''
      }));
      
      // Ensure source has valid amount
      updateFundSource({
        ...source,
        amount: source.amount || 0
      });
    }
  };

  const handleDeleteSource = (id: string) => {
    deleteFundSource(id);
    if (newSourceIds.includes(id)) {
      setNewSourceIds(prev => prev.filter(sourceId => sourceId !== id));
    }
    if (latestSourceRef.current === id) {
      latestSourceRef.current = fundSources.length > 1 ? fundSources[fundSources.length - 2].id : null;
    }
  };

  const totalNeeded = accounts.reduce((sum, account) => {
    const outgoings = getOutgoingsForAccount(account.id);
    return sum + outgoings.reduce((acc, outgoing) => acc + outgoing.amount, 0);
  }, 0);

  const unallocated = totalFunds - totalAllocated;

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Allocate Funds</h1>
        <p className="text-gray-500 mt-2">
          Add your available funds and we'll allocate them to your accounts
        </p>
      </div>

      <Card className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Available Funds</h2>
            <p className="text-gray-500 text-sm">Total: {formatCurrency(totalFunds)}</p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Plus size={16} />}
              onClick={handleAddSource}
            >
              Add Source
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw size={16} />}
              onClick={handleReset}
            >
              Reset
            </Button>
          </div>
        </div>
        
        {fundSources.length > 0 && (
          <div className="mb-4 space-y-2">
            {fundSources.map((source) => (
              <div key={source.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text" 
                    inputMode="decimal"
                    value={sourceAmounts[source.id] !== undefined ? sourceAmounts[source.id] : ''}
                    onChange={(e) => handleSourceAmountChange(source.id, e.target.value)}
                    onBlur={() => handleSourceAmountBlur(source)}
                    className="block w-full pl-8 pr-4 py-2 rounded-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder={newSourceIds.includes(source.id) ? "0.00" : ""}
                    onKeyDown={(e) => {
                      // Only allow numeric input, decimal point, and control keys
                      const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
                      if (!allowedKeys.includes(e.key)) {
                        e.preventDefault();
                      }
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    autoFocus={newSourceIds.includes(source.id)}
                  />
                </div>
                {fundSources.length > 1 && (
                  <div className="ml-2">
                    <button
                      onClick={() => handleDeleteSource(source.id)}
                      className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                      aria-label="Delete source"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 mb-2 pt-4 border-t border-gray-200">
          <h3 className="text-md font-medium text-gray-700 mb-2">Summary</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div>
              <p className="text-sm text-gray-500">Total Available Funds:</p>
              <p className="text-lg font-semibold">{formatCurrency(totalFunds)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Required:</p>
              <p className="text-lg font-semibold">{formatCurrency(totalRequired)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Allocated:</p>
              <p className="text-lg font-semibold">{formatCurrency(totalAllocated)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Remaining:</p>
              <p className={`text-lg font-semibold ${remainingToAllocate < 0 ? 'text-red-600' : remainingToAllocate > 0 ? 'text-emerald-600' : ''}`}>
                {formatCurrency(remainingToAllocate)}
                <span className="text-sm ml-1">
                  {remainingToAllocate < 0 ? '(shortage)' : remainingToAllocate > 0 ? '(surplus)' : ''}
                </span>
              </p>
            </div>
          </div>
          
          {unallocatedFunds > 0 && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-100 rounded-md text-amber-700 text-sm">
              Note: You have {formatCurrency(unallocatedFunds)} in unallocated funds that could be distributed.
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 mb-8">
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