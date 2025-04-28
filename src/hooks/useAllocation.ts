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
    // Skip outgoings that are paused
    if (outgoing.isPaused) {
      return [];
    }
    
    // Check if this outgoing has a payment plan
    if (outgoing.paymentPlan?.enabled) {
      const occurrences: Outgoing[] = [];
      const planStartDate = new Date(outgoing.paymentPlan.startDate);
      const dueDate = new Date(outgoing.dueDate);
      
      // Ensure dates are valid
      if (isNaN(planStartDate.getTime()) || isNaN(dueDate.getTime()) || planStartDate >= dueDate) {
        return [];
      }
      
      // Calculate installment amount
      let currentDate = new Date(planStartDate);
      let totalInstallments = 0;
      
      // First count total installments
      while (currentDate < dueDate) {
        totalInstallments++;
        if (outgoing.paymentPlan.frequency === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (outgoing.paymentPlan.frequency === 'biweekly') {
          currentDate.setDate(currentDate.getDate() + 14);
        } else if (outgoing.paymentPlan.frequency === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
      
      // Calculate installment amount
      const installmentAmount = outgoing.paymentPlan.installmentAmount !== undefined ? 
        outgoing.paymentPlan.installmentAmount : 
        (totalInstallments > 0 ? Math.ceil((outgoing.amount / totalInstallments) * 100) / 100 : outgoing.amount);
      
      // Reset currentDate to re-iterate and find installments within the pay period
      currentDate = new Date(planStartDate);
      let installmentNumber = 1;
      
      // Add installments within the pay period
      while (currentDate < dueDate) {
        if (currentDate >= startDate && currentDate <= endDate) {
          // Create a new outgoing instance for this installment
          occurrences.push({
            ...outgoing,
            id: `${outgoing.id}-installment-${installmentNumber}`,
            amount: installmentAmount,
            name: `${outgoing.name} (Installment ${installmentNumber}/${totalInstallments})`
          });
        }
        
        // Move to next date based on frequency
        if (outgoing.paymentPlan.frequency === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (outgoing.paymentPlan.frequency === 'biweekly') {
          currentDate.setDate(currentDate.getDate() + 14);
        } else if (outgoing.paymentPlan.frequency === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        installmentNumber++;
      }
      
      return occurrences;
    }

    const baseDate = new Date(outgoing.dueDate);
    const occurrences: Outgoing[] = [];
    
    // For non-repeating outgoings, just check if it's in this pay period
    if (outgoing.recurrence === 'none' && !outgoing.isCustomRecurrence) {
      const nextDate = getNextOccurrence(baseDate, outgoing.recurrence);
      if (nextDate >= startDate && nextDate <= endDate) {
        return [outgoing];
      }
      return [];
    }
    
    // For all recurring payments, find occurrences within the pay period
    let currentDate = getNextOccurrence(
      baseDate, 
      outgoing.recurrence,
      outgoing.isCustomRecurrence ? outgoing.recurrenceInterval : undefined,
      outgoing.isCustomRecurrence ? outgoing.recurrenceUnit : undefined
    );
    
    // If the first occurrence is already beyond the end date, return empty array
    if (currentDate > endDate) {
      return [];
    }
    
    // Find the first occurrence that falls after the start date
    while (currentDate < startDate) {
      // Move to next occurrence based on recurrence type
      if (outgoing.isCustomRecurrence && outgoing.recurrenceInterval && outgoing.recurrenceUnit) {
        // Handle custom recurrence
        if (outgoing.recurrenceUnit === 'day') {
          currentDate.setDate(currentDate.getDate() + outgoing.recurrenceInterval);
        } else if (outgoing.recurrenceUnit === 'week') {
          currentDate.setDate(currentDate.getDate() + (7 * outgoing.recurrenceInterval));
        } else if (outgoing.recurrenceUnit === 'month') {
          currentDate.setMonth(currentDate.getMonth() + outgoing.recurrenceInterval);
        } else if (outgoing.recurrenceUnit === 'year') {
          currentDate.setFullYear(currentDate.getFullYear() + outgoing.recurrenceInterval);
        }
      } else if (outgoing.recurrence === 'weekly') {
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
      
      // Safety check in case we've gone past the end date while finding the first occurrence
      if (currentDate > endDate) {
        return [];
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
      if (outgoing.isCustomRecurrence && outgoing.recurrenceInterval && outgoing.recurrenceUnit) {
        // For custom recurrence, add more occurrences if they fit within pay period
        const nextDate = new Date(currentDate);
        
        if (outgoing.recurrenceUnit === 'day') {
          nextDate.setDate(nextDate.getDate() + outgoing.recurrenceInterval);
        } else if (outgoing.recurrenceUnit === 'week') {
          nextDate.setDate(nextDate.getDate() + (7 * outgoing.recurrenceInterval));
        } else if (outgoing.recurrenceUnit === 'month') {
          nextDate.setMonth(nextDate.getMonth() + outgoing.recurrenceInterval);
        } else if (outgoing.recurrenceUnit === 'year') {
          nextDate.setFullYear(nextDate.getFullYear() + outgoing.recurrenceInterval);
        }
        
        if (nextDate <= endDate) {
          currentDate = nextDate;
        } else {
          shouldAddMore = false;
        }
      } else if (outgoing.recurrence === 'weekly' || outgoing.recurrence === 'biweekly') {
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