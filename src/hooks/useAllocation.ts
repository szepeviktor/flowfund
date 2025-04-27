import { useAppContext } from '../context/AppContext';
import { FundSource } from '../types';

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
    deleteFundSource
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

    let remainingFunds = amount;
    const newAllocations = [];

    // Sort accounts by priority or any other criteria if needed
    // For now, we'll just process them in the original order

    // Simple sequential allocation
    for (const account of accounts) {
      // Get all outgoings for this account
      const outgoings = getOutgoingsForAccount(account.id);
      
      // Calculate the total needed for this account by summing all outgoings
      const totalNeeded = outgoings.reduce((sum, outgoing) => sum + outgoing.amount, 0);
      
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

  return {
    updateFundsAndAllocations,
    addFundSource,
    updateFundSource,
    deleteFundSource
  };
}; 