import React, { createContext, useContext, useState, useEffect } from 'react';
import { Income, Outgoing, Account } from '../types';

interface Allocation {
  id: string;
  accountId: string;
  amount: number;
}

interface AppContextType {
  // Data
  accounts: Account[];
  outgoings: Outgoing[];
  availableFunds: number;
  allocations: Allocation[];
  
  // Data manipulation functions
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  
  addOutgoing: (outgoing: Omit<Outgoing, 'id'>) => void;
  updateOutgoing: (outgoing: Outgoing) => void;
  deleteOutgoing: (id: string) => void;
  
  updateAvailableFunds: (amount: number) => void;
  updateAllocations: (allocations: Allocation[]) => void;
  
  // Derived data
  totalAllocated: number;
  totalRequired: number;
  remainingToAllocate: number;
  getOutgoingsForAccount: (accountId: string) => Outgoing[];
  getAllocationForAccount: (accountId: string) => number;
  getAccountById: (id: string) => Account | undefined;
  calculateTotalUpcomingOutgoings: () => number;
}

const STORAGE_KEYS = {
  ACCOUNTS: 'flowfund_accounts',
  OUTGOINGS: 'flowfund_outgoings',
  AVAILABLE_FUNDS: 'flowfund_available_funds',
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
  
  const [availableFunds, setAvailableFunds] = useState<number>(() => 
    loadFromStorage(STORAGE_KEYS.AVAILABLE_FUNDS, 0)
  );

  const [allocations, setAllocations] = useState<Allocation[]>(() =>
    loadFromStorage(STORAGE_KEYS.ALLOCATIONS, [])
  );
  
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
  
  const updateAvailableFunds = (amount: number) => {
    setAvailableFunds(amount);
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
  const remainingToAllocate = availableFunds - totalRequired;
  
  return (
    <AppContext.Provider value={{
      // Data
      accounts,
      outgoings,
      availableFunds,
      allocations,
      
      // Functions
      addAccount,
      updateAccount,
      deleteAccount,
      
      addOutgoing,
      updateOutgoing,
      deleteOutgoing,
      
      updateAvailableFunds,
      updateAllocations,
      
      // Derived data
      totalAllocated,
      totalRequired,
      remainingToAllocate,
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