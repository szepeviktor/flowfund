import React, { createContext, useContext, useState, useEffect } from 'react';
import { Income, Outgoing, Account, FundSource, PayCycle } from '../types';

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
  payCycle: PayCycle;
  
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
  updatePayCycle: (payCycle: PayCycle) => void;
  
  // Derived data
  totalAllocated: number;
  totalRequired: number;
  remainingToAllocate: number;
  totalFunds: number;
  getOutgoingsForAccount: (accountId: string) => Outgoing[];
  getAllocationForAccount: (accountId: string) => number;
  getAccountById: (id: string) => Account | undefined;
  calculateTotalUpcomingOutgoings: () => number;
  
  // Pay cycle utilities
  getNextPayDate: () => Date;
  getLastPayDate: () => Date;
  isWithinPayCycle: (date: Date) => boolean;
}

const STORAGE_KEYS = {
  ACCOUNTS: 'flowfund_accounts',
  OUTGOINGS: 'flowfund_outgoings',
  AVAILABLE_FUNDS: 'flowfund_available_funds',
  FUND_SOURCES: 'flowfund_fund_sources',
  ALLOCATIONS: 'flowfund_allocations',
  PAY_CYCLE: 'flowfund_pay_cycle',
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
  
  const [payCycle, setPayCycle] = useState<PayCycle>(() => 
    loadFromStorage(STORAGE_KEYS.PAY_CYCLE, {
      dayOfMonth: 28, // Default to 28th of the month
      frequency: 'monthly'
    })
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
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PAY_CYCLE, payCycle);
  }, [payCycle]);
  
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
  
  const updatePayCycle = (newPayCycle: PayCycle) => {
    setPayCycle(newPayCycle);
  };
  
  // Get the next pay date based on the pay cycle settings
  const getNextPayDate = (): Date => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    if (payCycle.frequency === 'monthly') {
      // Create a date for this month's payday
      const thisMonthPayday = new Date(currentYear, currentMonth, payCycle.dayOfMonth);
      
      // If payday is in the future or today, return it
      if (thisMonthPayday > today) {
        return thisMonthPayday;
      }
      
      // Otherwise, return next month's payday
      return new Date(currentYear, currentMonth + 1, payCycle.dayOfMonth);
    } 
    else if (payCycle.frequency === 'biweekly' || payCycle.frequency === 'weekly') {
      // For these frequencies, we need the last pay date to calculate the next one
      if (!payCycle.lastPayDate) {
        // If no last pay date is set, use today as the base and calculate forward
        const defaultPayDate = new Date(currentYear, currentMonth, payCycle.dayOfMonth);
        return defaultPayDate > today ? defaultPayDate : new Date(currentYear, currentMonth + 1, payCycle.dayOfMonth);
      }
      
      const lastPay = new Date(payCycle.lastPayDate);
      let nextPay = new Date(lastPay);
      
      // Add appropriate number of days based on frequency
      if (payCycle.frequency === 'biweekly') {
        nextPay.setDate(lastPay.getDate() + 14); // Add two weeks
      } else {
        nextPay.setDate(lastPay.getDate() + 7); // Add one week
      }
      
      // If the calculated next pay date is in the past, keep adding periods until it's in the future
      while (nextPay <= today) {
        if (payCycle.frequency === 'biweekly') {
          nextPay.setDate(nextPay.getDate() + 14);
        } else {
          nextPay.setDate(nextPay.getDate() + 7);
        }
      }
      
      return nextPay;
    }
    
    // Fallback in case of unexpected frequency
    return new Date(currentYear, currentMonth + 1, payCycle.dayOfMonth);
  };
  
  // Get the last pay date based on the pay cycle settings
  const getLastPayDate = (): Date => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    if (payCycle.frequency === 'monthly') {
      // Create a date for this month's payday
      const thisMonthPayday = new Date(currentYear, currentMonth, payCycle.dayOfMonth);
      
      // If payday is in the future or today, return last month's payday
      if (thisMonthPayday > today) {
        return new Date(currentYear, currentMonth - 1, payCycle.dayOfMonth);
      }
      
      // Otherwise, return this month's payday since it's in the past
      return thisMonthPayday;
    } 
    else if (payCycle.frequency === 'biweekly' || payCycle.frequency === 'weekly') {
      // For these frequencies, we need the last pay date from our settings
      if (payCycle.lastPayDate) {
        const lastPay = new Date(payCycle.lastPayDate);
        let nextPay = new Date(lastPay);
        
        // Calculate the most recent pay date by starting from the last known
        // pay date and adding periods until we're past today, then step back once
        while (true) {
          const prevPay = new Date(nextPay);
          
          if (payCycle.frequency === 'biweekly') {
            nextPay.setDate(nextPay.getDate() + 14);
          } else {
            nextPay.setDate(nextPay.getDate() + 7);
          }
          
          if (nextPay > today) {
            return prevPay;
          }
        }
      }
      
      // If no last pay date is set, default to the previous occurrence of the day of month
      const defaultPayDate = new Date(currentYear, currentMonth, payCycle.dayOfMonth);
      return defaultPayDate > today 
        ? new Date(currentYear, currentMonth - 1, payCycle.dayOfMonth)
        : defaultPayDate;
    }
    
    // Fallback
    return new Date(currentYear, currentMonth, payCycle.dayOfMonth);
  };
  
  // Check if a date falls within the current pay cycle
  const isWithinPayCycle = (date: Date): boolean => {
    const lastPayDate = getLastPayDate();
    const nextPayDate = getNextPayDate();
    
    // Check if the date is after the last payday and before the next payday
    // Note: We use >= for lastPayDate to include the start of the period
    // and < for nextPayDate to exclude the end of the period
    return date >= lastPayDate && date < nextPayDate;
  };
  
  return (
    <AppContext.Provider value={{
      // Data
      accounts,
      outgoings,
      availableFunds,
      fundSources,
      allocations,
      payCycle,
      
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
      updatePayCycle,
      
      // Derived data
      totalAllocated,
      totalRequired,
      remainingToAllocate,
      totalFunds,
      getOutgoingsForAccount,
      getAllocationForAccount,
      getAccountById,
      calculateTotalUpcomingOutgoings,
      
      // Pay cycle utilities
      getNextPayDate,
      getLastPayDate,
      isWithinPayCycle,
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