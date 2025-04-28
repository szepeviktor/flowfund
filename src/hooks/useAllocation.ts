import { useAppContext } from '../context/AppContext';
import { FundSource, Outgoing } from '../types';
import { getNextOccurrence } from '../utils/formatters';

/**
 * Hook for handling the allocation logic in a consistent way across components
 */
export const useAllocation = () => {
  const { 
    accounts,
    getOutgoingsForAccount,
    updateAllocations,
    updateAvailableFunds,
    fundSources,
    addFundSource,
    updateFundSource,
    deleteFundSource,
    getPayPeriod
  } = useAppContext();

  /**
   * Updates both available funds and allocations based on a total amount
   * This is kept for backward compatibility
   * @param amount - The total amount to allocate
   */
  const updateFundsAndAllocations = (amount: number) => {
    // Update the global available funds state
    updateAvailableFunds(amount);

    if (amount <= 0) {
      updateAllocations([]);
      return;
    }

    // Get current pay period dates
    const { startDate, endDate } = getPayPeriod();
    
    let remainingFunds = amount;
    const newAllocations = [];

    // Sort accounts by priority or any other criteria if needed
    // For now, we'll just process them in the original order

    // Simple sequential allocation
    for (const account of accounts) {
      // Get all outgoings for this account
      const accountOutgoings = getOutgoingsForAccount(account.id);
      
      // Filter outgoings to only include those in the current pay period
      const outgoingsInPayPeriod = accountOutgoings.flatMap(outgoing => {
        return getOutgoingOccurrencesInPayPeriod(outgoing, startDate, endDate);
      });
      
      // Calculate the total needed for this account by summing pay period outgoings
      const totalNeeded = outgoingsInPayPeriod.reduce((sum, outgoing) => sum + outgoing.amount, 0);
      
      // Only allocate funds if this account has outgoings and funds remain
      if (totalNeeded > 0 && remainingFunds > 0) {
        // Allocate either what's needed or what's left, whichever is smaller
        const allocation = Math.min(totalNeeded, remainingFunds);
        
        // Create allocation entry for this account
        newAllocations.push({
          id: crypto.randomUUID(),
          accountId: account.id,
          amount: allocation
        });
        
        // Deduct the allocated amount from remaining funds
        remainingFunds -= allocation;
      }
    }

    // Update the allocations state with the new allocations
    updateAllocations(newAllocations);
  };

  /**
   * Helper function to get all occurrences of an outgoing within the pay period
   */
  const getOutgoingOccurrencesInPayPeriod = (outgoing: Outgoing, startDate: Date, endDate: Date): Outgoing[] => {
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

  return {
    updateFundsAndAllocations,
    addFundSource,
    updateFundSource,
    deleteFundSource
  };
}; 