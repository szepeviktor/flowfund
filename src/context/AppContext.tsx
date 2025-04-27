import React, { createContext, useContext, useState, useEffect } from 'react';
import { Income, Outgoing, Account, FundSource } from '../types';

interface Allocation {
  id: string;
  accountId: string;
  amount: number;
}

interface AppContextType {
  // Data
  accounts: Account[];
  outgoings: Outgoing[];
  availableFunds: number; // Keep for backward compatibility
  fundSources: FundSource[];
  allocations: Allocation[];
  
  // Data manipulation functions
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  
  addOutgoing: (outgoing: Omit<Outgoing, 'id'>) => void;
  updateOutgoing: (outgoing: Outgoing) => void;
  deleteOutgoing: (id: string) => void;
  
  updateAvailableFunds: (amount: number) => void; // Keep for backward compatibility
  addFundSource: (amount: number) => void;
  updateFundSource: (source: FundSource) => void;
  deleteFundSource: (id: string) => void;
  resetFundSources: () => string;
  updateAllocations: (allocations: Allocation[]) => void;
  
  // Derived data
  totalAllocated: number;
  totalRequired: number;
  remainingToAllocate: number;
  totalFunds: number;
  getOutgoingsForAccount: (accountId: string) => Outgoing[];
  getAllocationForAccount: (accountId: string) => number;
  getAccountById: (id: string) => Account | undefined;
  calculateTotalUpcomingOutgoings: () => number;
}

const STORAGE_KEYS = {
  ACCOUNTS: 'flowfund_accounts',
  OUTGOINGS: 'flowfund_outgoings',
  AVAILABLE_FUNDS: 'flowfund_available_funds',
  FUND_SOURCES: 'flowfund_fund_sources',
  ALLOCATIONS: 'flowfund_allocations',
};

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`Error loading from localStorage (${key}):`, error);
    return defaultValue;
  }
};

const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error);
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State with localStorage initialization
  const [accounts, setAccounts] = useState<Account[]>(() => 
    loadFromStorage(STORAGE_KEYS.ACCOUNTS, [])
  );
  
  const [outgoings, setOutgoings] = useState<Outgoing[]>(() => 
    loadFromStorage(STORAGE_KEYS.OUTGOINGS, [])
  );
  
  // For backward compatibility
  const [availableFunds, setAvailableFunds] = useState<number>(() => 
    loadFromStorage(STORAGE_KEYS.AVAILABLE_FUNDS, 0)
  );

  const [fundSources, setFundSources] = useState<FundSource[]>(() => {
    const storedSources = loadFromStorage<FundSource[]>(STORAGE_KEYS.FUND_SOURCES, []);
    
    // If we have no fund sources but have availableFunds, create an initial source
    if (storedSources.length === 0 && availableFunds > 0) {
      return [{
        id: crypto.randomUUID(),
        amount: availableFunds
      }];
    }
    
    return storedSources;
  });

  const [allocations, setAllocations] = useState<Allocation[]>(() =>
    loadFromStorage(STORAGE_KEYS.ALLOCATIONS, [])
  );
  
  // Calculated total funds from all sources
  const totalFunds = fundSources.reduce((sum, source) => sum + source.amount, 0);
  
  // Update availableFunds to match total from sources (for backward compatibility)
  useEffect(() => {
    setAvailableFunds(totalFunds);
  }, [totalFunds]);
  
  // Save to localStorage whenever data changes
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);
  }, [accounts]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.OUTGOINGS, outgoings);
  }, [outgoings]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.AVAILABLE_FUNDS, availableFunds);
  }, [availableFunds]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.FUND_SOURCES, fundSources);
  }, [fundSources]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ALLOCATIONS, allocations);
  }, [allocations]);
  
  const addAccount = (account: Omit<Account, 'id'>) => {
    const newAccount = { ...account, id: crypto.randomUUID() };
    setAccounts([...accounts, newAccount]);
  };
  
  const updateAccount = (updatedAccount: Account) => {
    setAccounts(accounts.map(account => 
      account.id === updatedAccount.id ? updatedAccount : account
    ));
  };
  
  const deleteAccount = (id: string) => {
    const hasOutgoings = outgoings.some(outgoing => outgoing.accountId === id);
    if (hasOutgoings) {
      alert('Cannot delete account with assigned outgoings');
      return;
    }
    setAccounts(accounts.filter(account => account.id !== id));
  };
  
  const addOutgoing = (outgoing: Omit<Outgoing, 'id'>) => {
    const newOutgoing = { ...outgoing, id: crypto.randomUUID() };
    setOutgoings([...outgoings, newOutgoing]);
  };
  
  const updateOutgoing = (updatedOutgoing: Outgoing) => {
    setOutgoings(outgoings.map(outgoing => 
      outgoing.id === updatedOutgoing.id ? updatedOutgoing : outgoing
    ));
  };
  
  const deleteOutgoing = (id: string) => {
    setOutgoings(outgoings.filter(outgoing => outgoing.id !== id));
  };
  
  // Kept for backward compatibility
  const updateAvailableFunds = (amount: number) => {
    // If no fund sources exist, create one
    if (fundSources.length === 0) {
      setFundSources([{
        id: crypto.randomUUID(),
        amount: amount
      }]);
    } 
    // If exactly one fund source exists, update it
    else if (fundSources.length === 1) {
      setFundSources([{
        ...fundSources[0],
        amount: amount
      }]);
    } 
    // If multiple sources exist, adjust the first one to make the total match
    else {
      const currentTotal = fundSources.reduce((sum, source) => sum + source.amount, 0);
      const firstSourceAmount = fundSources[0].amount;
      const adjustment = amount - currentTotal;
      
      // Don't allow negative amounts
      const newAmount = Math.max(0, firstSourceAmount + adjustment);
      
      setFundSources([
        {
          ...fundSources[0],
          amount: newAmount
        },
        ...fundSources.slice(1)
      ]);
    }
  };

  const addFundSource = (amount: number) => {
    setFundSources([
      ...fundSources,
      {
        id: crypto.randomUUID(),
        amount
      }
    ]);
  };

  const updateFundSource = (updatedSource: FundSource) => {
    setFundSources(fundSources.map(source => 
      source.id === updatedSource.id ? updatedSource : source
    ));
  };

  const deleteFundSource = (id: string) => {
    setFundSources(fundSources.filter(source => source.id !== id));
  };

  const resetFundSources = () => {
    // Replace all existing fund sources with a single new source with zero amount
    const newSource = {
      id: crypto.randomUUID(),
      amount: 0
    };
    setFundSources([newSource]);
    return newSource.id; // Return the ID of the new source for tracking
  };

  const updateAllocations = (newAllocations: Allocation[]) => {
    setAllocations(newAllocations);
  };
  
  const getOutgoingsForAccount = (accountId: string) => {
    return outgoings.filter(outgoing => outgoing.accountId === accountId);
  };

  const getAllocationForAccount = (accountId: string) => {
    const accountAllocation = allocations.find(allocation => allocation.accountId === accountId);
    return accountAllocation ? accountAllocation.amount : 0;
  };
  
  const getAccountById = (id: string) => {
    return accounts.find(account => account.id === id);
  };
  
  const calculateTotalUpcomingOutgoings = () => {
    return outgoings.reduce((sum, outgoing) => sum + outgoing.amount, 0);
  };
  
  // Derived values
  const totalRequired = outgoings.reduce((sum, outgoing) => sum + outgoing.amount, 0);
  const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const remainingToAllocate = totalFunds - totalRequired;
  
  return (
    <AppContext.Provider value={{
      // Data
      accounts,
      outgoings,
      availableFunds,
      fundSources,
      allocations,
      
      // Functions
      addAccount,
      updateAccount,
      deleteAccount,
      
      addOutgoing,
      updateOutgoing,
      deleteOutgoing,
      
      updateAvailableFunds,
      addFundSource,
      updateFundSource,
      deleteFundSource,
      resetFundSources,
      updateAllocations,
      
      // Derived data
      totalAllocated,
      totalRequired,
      remainingToAllocate,
      totalFunds,
      getOutgoingsForAccount,
      getAllocationForAccount,
      getAccountById,
      calculateTotalUpcomingOutgoings,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};