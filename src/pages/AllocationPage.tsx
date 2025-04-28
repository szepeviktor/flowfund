import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAllocation } from '../hooks/useAllocation';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import { formatCurrency } from '../utils/formatters';
import { RefreshCw, Plus, Trash2, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { FundSource, Outgoing } from '../types';
import { getNextOccurrence } from '../utils/formatters';

// Use a namespace for localStorage keys to avoid collisions
const LS_PREFIX = 'flowfund_';
const LS_MANUAL_ALLOCATIONS = `${LS_PREFIX}manual_allocations_v1`;
const LS_DISTRIBUTION_STATE = `${LS_PREFIX}distribution_open`;

// Initial state loading functions (defined outside component to prevent recreation)
const getInitialManualAllocations = (): {[id: string]: number} => {
  try {
    const saved = localStorage.getItem(LS_MANUAL_ALLOCATIONS);
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, number>;
      
      // Verify structure and content
      const hasNonZeroValues = Object.values(parsed).some(v => v > 0);
      if (hasNonZeroValues) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load initial manual allocations:', error);
  }
  
  return {};
};

const getInitialDistributingState = (): boolean => {
  try {
    return localStorage.getItem(LS_DISTRIBUTION_STATE) === 'true';
  } catch (error) {
    return false;
  }
};

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
    resetFundSources,
    getPayPeriod,
    currency
  } = useAppContext();
  
  const { updateFundsAndAllocations, addFundSource, updateFundSource, deleteFundSource } = useAllocation();
  const [sourceAmounts, setSourceAmounts] = useState<{[id: string]: string}>({});
  const [newSourceIds, setNewSourceIds] = useState<string[]>([]);
  const latestSourceRef = useRef<string | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isDistributingExcess, setIsDistributingExcess] = useState<boolean>(getInitialDistributingState());
  const [manualAllocations, setManualAllocations] = useState<{[id: string]: number}>(getInitialManualAllocations());
  
  // Get pay period dates
  const { startDate, endDate } = useMemo(() => getPayPeriod(), [getPayPeriod]);

  // Calculate the unallocated amount directly (funds that haven't been allocated)
  const unallocatedFunds = totalFunds - totalAllocated;

  // Calculate total manually allocated amount
  const totalManuallyAllocated = useMemo(() => 
    Object.values(manualAllocations).reduce((sum, amount) => sum + amount, 0),
    [manualAllocations]
  );

  // Calculate total required funds for the current pay period
  const totalRequiredForPayPeriod = useMemo(() => {
    // Helper function to get all occurrences of an outgoing within the pay period
    const getOutgoingOccurrencesInPayPeriod = (outgoing: Outgoing): number => {
      const baseDate = new Date(outgoing.dueDate);
      let totalAmount = 0;
      
      // For non-repeating outgoings, just check if it's in this pay period
      if (outgoing.recurrence === 'none') {
        const nextDate = getNextOccurrence(baseDate, outgoing.recurrence);
        if (nextDate >= startDate && nextDate <= endDate) {
          return outgoing.amount;
        }
        return 0;
      }
      
      // For all recurring payments, find occurrences within the pay period
      let currentDate = getNextOccurrence(baseDate, outgoing.recurrence);
      
      // Find the first occurrence that falls after the last pay date
      while (currentDate < startDate) {
        // Move to next occurrence based on recurrence type
        if (outgoing.recurrence === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (outgoing.recurrence === 'biweekly') {
          currentDate.setDate(currentDate.getDate() + 14);
        } else if (outgoing.recurrence === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (outgoing.recurrence === 'quarterly') {
          currentDate.setMonth(currentDate.getMonth() + 3);
        } else if (outgoing.recurrence === 'yearly') {
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
      }
      
      // Now add all occurrences that fall within the pay period
      let shouldAddMore = true;
      while (shouldAddMore) {
        // Add the current occurrence if it's within the pay period
        if (currentDate <= endDate) {
          totalAmount += outgoing.amount;
        }
        
        // Determine if we should add more occurrences based on recurrence type
        if (outgoing.recurrence === 'weekly' || outgoing.recurrence === 'biweekly') {
          // Move to next occurrence
          const nextDate = new Date(currentDate);
          if (outgoing.recurrence === 'weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
          } else {
            nextDate.setDate(nextDate.getDate() + 14);
          }
          
          // Add the occurrence if it's within the pay period
          if (nextDate <= endDate) {
            currentDate = nextDate;
          } else {
            shouldAddMore = false;
          }
        } else {
          // For monthly, quarterly, and yearly, we only count one occurrence per pay period
          shouldAddMore = false;
        }
      }
      
      return totalAmount;
    };

    // Calculate total required funds by summing all outgoing occurrences in the pay period
    return outgoings.reduce((total, outgoing) => {
      return total + getOutgoingOccurrencesInPayPeriod(outgoing);
    }, 0);
  }, [outgoings, startDate, endDate]);

  // Filter outgoings for current pay period
  const payPeriodOutgoings = useMemo(() => {
    return outgoings.filter(outgoing => {
      const outgoingDate = new Date(outgoing.dueDate);
      return outgoingDate >= startDate && outgoingDate <= endDate;
    });
  }, [outgoings, startDate, endDate]);

  // Calculate remaining funds for the current pay period
  const remainingForPayPeriod = totalFunds - totalRequiredForPayPeriod;

  // Calculate the remaining amount after both automatic and manual allocations
  const remainingAfterManualAllocations = remainingForPayPeriod - totalManuallyAllocated;

  // Get outgoings for the current pay period
  const getOutgoingsForPayPeriod = (accountId: string) => {
    const accountOutgoings = getOutgoingsForAccount(accountId);
    
    // Helper function to get all occurrences of an outgoing within the pay period
    const getOutgoingOccurrencesInPayPeriod = (outgoing: Outgoing): Outgoing[] => {
      const baseDate = new Date(outgoing.dueDate);
      const occurrences: Outgoing[] = [];
      
      // For non-repeating outgoings, just check if it's in this pay period
      if (outgoing.recurrence === 'none') {
        const nextDate = getNextOccurrence(baseDate, outgoing.recurrence);
        if (nextDate >= startDate && nextDate <= endDate) {
          return [outgoing];
        }
        return [];
      }
      
      // For all recurring payments, find occurrences within the pay period
      let currentDate = getNextOccurrence(baseDate, outgoing.recurrence);
      
      // Find the first occurrence that falls after the last pay date
      while (currentDate < startDate) {
        // Move to next occurrence based on recurrence type
        if (outgoing.recurrence === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (outgoing.recurrence === 'biweekly') {
          currentDate.setDate(currentDate.getDate() + 14);
        } else if (outgoing.recurrence === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (outgoing.recurrence === 'quarterly') {
          currentDate.setMonth(currentDate.getMonth() + 3);
        } else if (outgoing.recurrence === 'yearly') {
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
      }
      
      // Now add all occurrences that fall within the pay period
      let shouldAddMore = true;
      while (shouldAddMore) {
        // Add the current occurrence if it's within the pay period
        if (currentDate <= endDate) {
          occurrences.push(outgoing);
        }
        
        // Determine if we should add more occurrences based on recurrence type
        if (outgoing.recurrence === 'weekly' || outgoing.recurrence === 'biweekly') {
          // Move to next occurrence
          const nextDate = new Date(currentDate);
          if (outgoing.recurrence === 'weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
          } else {
            nextDate.setDate(nextDate.getDate() + 14);
          }
          
          // Add the occurrence if it's within the pay period
          if (nextDate <= endDate) {
            currentDate = nextDate;
          } else {
            shouldAddMore = false;
          }
        } else {
          // For monthly, quarterly, and yearly, we only count one occurrence per pay period
          shouldAddMore = false;
        }
      }
      
      return occurrences;
    };
    
    // Flatten all occurrences for all outgoings in this account
    return accountOutgoings.flatMap(outgoing => getOutgoingOccurrencesInPayPeriod(outgoing));
  };

  // Function to save distribution state
  const saveDistributionState = useCallback((isOpen: boolean) => {
    try {
      localStorage.setItem(LS_DISTRIBUTION_STATE, isOpen.toString());
    } catch (error) {
      console.error('Failed to save distribution state:', error);
    }
  }, []);
  
  // Function to save manual allocations
  const saveManualAllocations = useCallback((allocs: {[id: string]: number}) => {
    try {
      const hasNonZeroValues = Object.values(allocs).some(val => val > 0);
      
      if (hasNonZeroValues) {
        localStorage.setItem(LS_MANUAL_ALLOCATIONS, JSON.stringify(allocs));
      } else if (localStorage.getItem(LS_MANUAL_ALLOCATIONS)) {
        localStorage.removeItem(LS_MANUAL_ALLOCATIONS);
      }
    } catch (error) {
      console.error('Failed to save manual allocations:', error);
    }
  }, []);
  
  // Save distribution state when it changes
  useEffect(() => {
    saveDistributionState(isDistributingExcess);
  }, [isDistributingExcess, saveDistributionState]);
  
  // Save manual allocations when they change
  useEffect(() => {
    saveManualAllocations(manualAllocations);
  }, [manualAllocations, saveManualAllocations]);
  
  // Validate manual allocations against current accounts (only when accounts change)
  useEffect(() => {
    if (accounts.length > 0) {
      const accountIds = accounts.map(account => account.id);
      
      setManualAllocations(prev => {
        // Don't do anything if there are no manual allocations
        if (Object.values(prev).every(val => val === 0)) {
          return prev;
        }
        
        // Filter to only keep allocations for existing accounts
        const validated: {[id: string]: number} = {};
        let hasChanges = false;
        
        // Add existing accounts
        for (const id of accountIds) {
          // Init with 0 if not present
          if (prev[id] === undefined) {
            validated[id] = 0;
            hasChanges = true;
          } else {
            validated[id] = prev[id];
          }
        }
        
        // Check if we need to drop any allocations for non-existent accounts
        for (const id in prev) {
          if (!accountIds.includes(id)) {
            hasChanges = true;
            // Not copying this id to the validated object
          }
        }
        
        // Only create a new object if needed
        return hasChanges ? validated : prev;
      });
    }
  }, [accounts]);

  // For debugging - can be commented out in production
  useEffect(() => {
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.log('Allocation state:', { 
        totalFunds, 
        totalRequired, 
        totalAllocated, 
        remainingToAllocate,
        unallocatedFunds,
        totalManuallyAllocated,
        remainingAfterManualAllocations
      });
    }
  }, [
    totalFunds, 
    totalRequired, 
    totalAllocated, 
    remainingToAllocate, 
    unallocatedFunds, 
    totalManuallyAllocated, 
    remainingAfterManualAllocations
  ]);

  // Reset manual allocations when unallocated funds change to 0
  useEffect(() => {
    if (unallocatedFunds === 0) {
      setManualAllocations({});
      setIsDistributingExcess(false);
    }
  }, [unallocatedFunds]);

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
    setManualAllocations({});
    setIsDistributingExcess(false);
    
    // Clear localStorage
    localStorage.removeItem(LS_MANUAL_ALLOCATIONS);
    localStorage.removeItem(LS_DISTRIBUTION_STATE);
    
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

  const handleManualAllocationChange = (accountId: string, value: number) => {
    // Calculate total allocated amount across all accounts
    const currentTotal = Object.values(manualAllocations).reduce((sum, amount) => sum + amount, 0);
    const currentAccountAmount = manualAllocations[accountId] || 0;
    
    // Calculate the change in allocation
    const change = value - currentAccountAmount;
    
    // Make sure we don't exceed unallocated funds
    if (currentTotal + change > unallocatedFunds) {
      // Cap at maximum available
      const maxAllocation = unallocatedFunds - (currentTotal - currentAccountAmount);
      value = Math.max(0, maxAllocation);
    }
    
    // Update the manual allocation for this account
    setManualAllocations(prev => ({
      ...prev,
      [accountId]: value
    }));
  };

  const handleResetManualAllocations = () => {
    setManualAllocations({});
  };

  const handleToggleDistribution = () => {
    const newState = !isDistributingExcess;
    setIsDistributingExcess(newState);
  };

  const getRemainingUnallocated = () => {
    return unallocatedFunds - totalManuallyAllocated;
  };

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Allocate Funds</h1>
          <p className="text-gray-500 mt-1">Add your available funds and we'll allocate them to your accounts</p>
        </div>
      </div>

      <Card className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Available Funds</h2>
            <p className="text-gray-500 text-sm">Total: {formatCurrency(totalFunds, currency)}</p>
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
              <p className="text-lg font-semibold">{formatCurrency(totalFunds, currency)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Required for Pay Period:</p>
              <p className="text-lg font-semibold">{formatCurrency(totalRequiredForPayPeriod, currency)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Allocated:</p>
              <p className="text-lg font-semibold">{formatCurrency(totalAllocated, currency)}</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  {totalManuallyAllocated > 0 ? 'Remaining after distribution:' : 'Remaining:'}
                </p>
                <p className={`text-lg font-semibold ${remainingAfterManualAllocations < 0 ? 'text-red-600' : remainingAfterManualAllocations > 0 ? 'text-emerald-600' : ''}`}>
                  {formatCurrency(remainingAfterManualAllocations, currency)}
                </p>
              </div>
              {remainingForPayPeriod > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<SlidersHorizontal size={16} />}
                  onClick={handleToggleDistribution}
                >
                  {isDistributingExcess ? 'Hide' : 'Distribute'}
                </Button>
              )}
            </div>
          </div>
          
          {remainingForPayPeriod > 0 && isDistributingExcess && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-gray-700">
                  Manually Allocated: {formatCurrency(totalManuallyAllocated, currency)} 
                  <span className="text-sm text-gray-500 ml-2">
                    (Remaining: {formatCurrency(getRemainingUnallocated(), currency)})
                  </span>
                </p>
                {totalManuallyAllocated > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<RefreshCcw size={14} />}
                    onClick={handleResetManualAllocations}
                  >
                    Reset
                  </Button>
                )}
              </div>
              
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="space-y-4 mt-1">
                  {accounts.map(account => {
                    const outgoings = getOutgoingsForPayPeriod(account.id);
                    const totalOutgoings = outgoings.reduce((sum, outgoing) => sum + outgoing.amount, 0);
                    const currentAllocation = getAllocationForAccount(account.id);
                    const manualAllocation = manualAllocations[account.id] || 0;
                    const totalForAccount = currentAllocation + manualAllocation;
                    const fundingPercentage = totalOutgoings > 0 
                      ? (currentAllocation / totalOutgoings) * 100
                      : 0;
                    const totalFundingPercentage = totalOutgoings > 0
                      ? (totalForAccount / totalOutgoings) * 100
                      : 0;
                    
                    return (
                      <div key={`manual-${account.id}`} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-medium" style={{ color: account.color }}>{account.name}</p>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{formatCurrency(manualAllocation, currency)}</p>
                            <p className="text-xs text-gray-500">Total: {formatCurrency(totalForAccount, currency)}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="range"
                            min="0"
                            max={unallocatedFunds}
                            step="1"
                            value={manualAllocation}
                            onChange={(e) => handleManualAllocationChange(account.id, parseInt(e.target.value, 10))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, ${account.color} 0%, ${account.color} ${(manualAllocation/unallocatedFunds)*100}%, #e5e7eb ${(manualAllocation/unallocatedFunds)*100}%, #e5e7eb 100%)`,
                              accentColor: account.color
                            }}
                          />
                          <button
                            onClick={() => handleManualAllocationChange(account.id, getRemainingUnallocated() + manualAllocation)}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Max
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 mb-8">
        {accounts.map((account) => {
          const outgoings = getOutgoingsForPayPeriod(account.id);
          const totalOutgoings = outgoings.reduce((sum, outgoing) => sum + outgoing.amount, 0);
          const currentAllocation = getAllocationForAccount(account.id);
          const manualAllocation = manualAllocations[account.id] || 0;
          const totalForAccount = currentAllocation + manualAllocation;
          const fundingPercentage = totalOutgoings > 0 
            ? (currentAllocation / totalOutgoings) * 100
            : 0;
          const totalFundingPercentage = totalOutgoings > 0
            ? (totalForAccount / totalOutgoings) * 100
            : 0;
          
          return (
            <Card key={account.id}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                  <p className="text-sm text-gray-500">{account.description}</p>
                </div>
                <div className="text-right">
                  {manualAllocation > 0 ? (
                    <div className="flex flex-col items-end">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(totalForAccount, currency)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(totalOutgoings, currency)} needed
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(currentAllocation, currency)}
                      </p>
                      <p className="text-sm text-gray-500">
                        of {formatCurrency(totalOutgoings, currency)} needed
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2 relative">
                {/* For automatic funding */}
                {!manualAllocation && fundingPercentage <= 100 && (
                  <div 
                    className="h-full absolute top-0 left-0 rounded-full"
                    style={{ 
                      width: `${fundingPercentage}%`,
                      backgroundColor: account.color
                    }}
                  />
                )}

                {/* For automatic overfunding */}
                {!manualAllocation && fundingPercentage > 100 && (
                  <>
                    {/* Base 100% */}
                    <div 
                      className="h-full absolute top-0 left-0"
                      style={{ 
                        width: `${100 * (100/fundingPercentage)}%`,
                        backgroundColor: account.color
                      }}
                    />
                    
                    {/* Overfunding area with lighter color */}
                    <div 
                      className="h-full absolute top-0 right-0 overflow-hidden"
                      style={{ 
                        width: `${100 - (100 * (100/fundingPercentage))}%`,
                        backgroundColor: account.color,
                        opacity: 0.6
                      }}
                    />
                  </>
                )}

                {/* For manual allocation without overfunding */}
                {manualAllocation > 0 && totalFundingPercentage <= 100 && (
                  <>
                    {/* Show base funding */}
                    <div 
                      className="h-full absolute top-0 left-0"
                      style={{ 
                        width: `${fundingPercentage}%`,
                        backgroundColor: account.color
                      }}
                    />
                    
                    {/* Show manual funding */}
                    <div 
                      className="h-full absolute top-0 left-0"
                      style={{ 
                        width: `${totalFundingPercentage}%`,
                        backgroundColor: account.color,
                        opacity: 0.4
                      }}
                    />
                  </>
                )}

                {/* For manual allocation with overfunding */}
                {manualAllocation > 0 && totalFundingPercentage > 100 && (
                  <>
                    {/* Base funding up to 100% */}
                    <div 
                      className="h-full absolute top-0 left-0"
                      style={{ 
                        width: `${100 * (100/totalFundingPercentage)}%`,
                        backgroundColor: account.color
                      }}
                    />
                    
                    {/* Overfunding area with lighter color */}
                    <div 
                      className="h-full absolute top-0 right-0 overflow-hidden"
                      style={{ 
                        width: `${100 - (100 * (100/totalFundingPercentage))}%`,
                        backgroundColor: account.color,
                        opacity: 0.3
                      }}
                    />
                  </>
                )}

                {/* 100% funding marker line */}
                {totalFundingPercentage > 100 && (
                  <div 
                    className="absolute top-0 h-full w-0.5 bg-white"
                    style={{ 
                      left: `${100 * (100/totalFundingPercentage)}%`
                    }}
                  />
                )}
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  {outgoings.length} outgoing{outgoings.length !== 1 ? 's' : ''}
                </p>
                <p className={`text-sm font-medium ${
                  totalFundingPercentage >= 100 ? 'text-emerald-600' : 
                  fundingPercentage >= 100 ? 'text-emerald-600' : 'text-gray-500'
                }`}>
                  {manualAllocation > 0 
                    ? `${Math.round(totalFundingPercentage)}% Funded`
                    : `${Math.round(fundingPercentage)}% Funded`
                  }
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