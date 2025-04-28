import React, { useEffect, useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  PiggyBank, 
  CreditCard,
  ArrowDownUp,
  Calendar,
  Settings
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { formatCurrency, formatDate, getNextOccurrence } from '../../utils/formatters';
import { Outgoing } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, closeSidebar }) => {
  const { 
    totalFunds, 
    outgoings,
    totalAllocated,
    getPayPeriod,
    payCycle
  } = useAppContext();
  
  const { startDate, endDate } = useMemo(() => getPayPeriod(), [getPayPeriod, payCycle]);
  
  // Calculate the actual next pay date (one day after the end of the pay period)
  const nextPayDate = useMemo(() => {
    const date = new Date(endDate);
    date.setDate(date.getDate() + 1);
    return date;
  }, [endDate]);

  // Calculate required funds for the current pay period
  const requiredForPayPeriod = useMemo(() => {
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

  // Calculate remaining funds for the current pay period
  const remainingForPayPeriod = totalFunds - requiredForPayPeriod;
  
  const navLinks = [
    { to: '/', icon: <ArrowDownUp size={20} />, text: 'Allocate' },
    { to: '/accounts', icon: <PiggyBank size={20} />, text: 'Accounts' },
    { to: '/outgoings', icon: <CreditCard size={20} />, text: 'Outgoings' },
  ];
  
  const sidebarClasses = isOpen 
    ? 'lg:translate-x-0 translate-x-0'
    : 'lg:translate-x-0 -translate-x-full';
  
  const overlayClasses = isOpen
    ? 'lg:hidden bg-black bg-opacity-50 fixed inset-0 z-20'
    : 'hidden';
    
  return (
    <>
      <div 
        className={`${overlayClasses} transition-opacity duration-200 ease-in-out`}
        onClick={closeSidebar}
      />
      
      <aside className={`${sidebarClasses} transform transition duration-200 ease-in-out fixed z-30 inset-y-0 left-0 w-64 bg-gray-50 border-r border-gray-200 lg:relative lg:z-0 flex flex-col`}>
        <div className="overflow-y-auto flex-grow">
          <div className="pt-6 pb-4 px-4">
            {/* Pay Period Widget */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 mb-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Pay Period</p>
                  <span className="text-sm text-gray-900">
                    {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Next Payday</p>
                  <span className="text-sm text-gray-900">
                    {formatDate(nextPayDate.toISOString())}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Available Funds</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(totalFunds)}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-baseline">
                    <p className="text-sm text-gray-500">Required</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(requiredForPayPeriod)}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Allocated</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(totalAllocated)}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Remaining</p>
                  <p className={`text-xl font-bold ${
                    remainingForPayPeriod >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(remainingForPayPeriod)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 px-2 space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => closeSidebar()}
                className={({ isActive }) => 
                  `group flex items-center px-2 py-3 rounded-md transition-colors ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="mr-3">{link.icon}</span>
                <span className="font-medium">{link.text}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              &copy; {new Date().getFullYear()} FlowFund
            </div>
            <NavLink
              to="/settings"
              onClick={() => closeSidebar()}
              className={({ isActive }) => 
                `flex items-center text-gray-500 hover:text-gray-700 transition-colors ${
                  isActive ? 'text-indigo-600' : ''
                }`
              }
            >
              <Settings size={16} className="mr-1" />
              <span className="text-sm">Settings</span>
            </NavLink>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;