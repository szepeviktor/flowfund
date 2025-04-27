import { useAppContext } from '../context/AppContext';

/**
 * Hook for handling the allocation logic in a consistent way across components
 */
export const useAllocation = () => {
  const { 
    accounts,
    getOutgoingsForAccount,
    updateAllocations,
    updateAvailableFunds
  } = useAppContext();

  /**
   * Updates both available funds and allocations based on a total amount
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

  return {
    updateFundsAndAllocations
  };
}; 