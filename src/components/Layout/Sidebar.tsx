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

const DEBUG_SIDEBAR = false; // Set to true only when debugging sidebar calculations

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
    payCycle,
    currency
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
      // Skip outgoings that are paused
      if (outgoing.isPaused) {
        if (import.meta.env.DEV && DEBUG_SIDEBAR) {
          console.log(`Outgoing (${outgoing.name}): Skipped - paused`);
        }
        return 0;
      }
      
      // Check if this outgoing has a payment plan
      if (outgoing.paymentPlan?.enabled) {
        let totalAmount = 0;
        const planStartDate = new Date(outgoing.paymentPlan.startDate);
        const dueDate = new Date(outgoing.dueDate);
        
        // Ensure dates are valid
        if (isNaN(planStartDate.getTime()) || isNaN(dueDate.getTime()) || planStartDate >= dueDate) {
          if (import.meta.env.DEV && DEBUG_SIDEBAR) {
            console.log(`Payment plan (${outgoing.name}): Invalid dates, return 0`);
          }
          return 0;
        }
        
        // Calculate installment amount based on total installments
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
        
        // Calculate installment amount using provided amount or dividing total
        const installmentAmount = outgoing.paymentPlan.installmentAmount !== undefined ? 
          outgoing.paymentPlan.installmentAmount : 
          (totalInstallments > 0 ? Math.ceil((outgoing.amount / totalInstallments) * 100) / 100 : outgoing.amount);
          
        // Reset currentDate to re-iterate and find installments within the pay period
        currentDate = new Date(planStartDate);
        
        // Add installments within the pay period
        let installmentsInPeriod = 0;
        while (currentDate < dueDate) {
          // Check if this installment date falls within the pay period
          if (currentDate >= startDate && currentDate <= endDate) {
            totalAmount += installmentAmount;
            installmentsInPeriod++;
          }
          
          // Move to next date based on frequency
          if (outgoing.paymentPlan.frequency === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (outgoing.paymentPlan.frequency === 'biweekly') {
            currentDate.setDate(currentDate.getDate() + 14);
          } else if (outgoing.paymentPlan.frequency === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        }
        
        if (import.meta.env.DEV && DEBUG_SIDEBAR) {
          console.log(`Payment plan (${outgoing.name}): ${installmentsInPeriod} installments in period, ${installmentAmount} each, total ${totalAmount}`);
          console.log(`  Pay period: ${startDate.toDateString()} - ${endDate.toDateString()}`);
          console.log(`  Plan period: ${planStartDate.toDateString()} - ${dueDate.toDateString()}`);
        }
        return totalAmount;
      }

      const baseDate = new Date(outgoing.dueDate);
      let totalAmount = 0;
      
      // For non-repeating outgoings, just check if it's in this pay period
      if (outgoing.recurrence === 'none' && !outgoing.isCustomRecurrence) {
        const nextDate = getNextOccurrence(baseDate, outgoing.recurrence);
        if (nextDate >= startDate && nextDate <= endDate) {
          if (import.meta.env.DEV && DEBUG_SIDEBAR) {
            console.log(`One-time (${outgoing.name}): In period, amount ${outgoing.amount}`);
          }
          return outgoing.amount;
        }
        if (import.meta.env.DEV && DEBUG_SIDEBAR) {
          console.log(`One-time (${outgoing.name}): Not in period, return 0`);
        }
        return 0;
      }
      
      // For all recurring payments, find occurrences within the pay period
      let currentDate = getNextOccurrence(
        baseDate, 
        outgoing.recurrence,
        outgoing.isCustomRecurrence ? outgoing.recurrenceInterval : undefined,
        outgoing.isCustomRecurrence ? outgoing.recurrenceUnit : undefined
      );
      
      // If the first occurrence is already beyond the end date, no need to process further
      if (currentDate > endDate) {
        if (import.meta.env.DEV && DEBUG_SIDEBAR) {
          console.log(`Recurring (${outgoing.name}): First occurrence beyond pay period, return 0`);
        }
        return 0;
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
          if (import.meta.env.DEV && DEBUG_SIDEBAR) {
            console.log(`Recurring (${outgoing.name}): No occurrences in pay period, return 0`);
          }
          return 0;
        }
      }
      
      // Now add all occurrences that fall within the pay period
      let shouldAddMore = true;
      let occurrencesCount = 0;
      while (shouldAddMore) {
        // Add the current occurrence if it's within the pay period
        if (currentDate <= endDate) {
          totalAmount += outgoing.amount;
          occurrencesCount++;
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
      
      if (import.meta.env.DEV && DEBUG_SIDEBAR) {
        console.log(`Recurring (${outgoing.name}): ${occurrencesCount} occurrences in period, ${outgoing.amount} each, total ${totalAmount}`);
      }
      return totalAmount;
    };

    // Calculate total required funds by summing all outgoing occurrences in the pay period
    const total = outgoings.reduce((total, outgoing) => {
      const amount = getOutgoingOccurrencesInPayPeriod(outgoing);
      return total + amount;
    }, 0);
    
    if (import.meta.env.DEV && DEBUG_SIDEBAR) {
      console.log(`Total required for pay period: ${total}`);
    }
    
    return total;
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
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Pay Period</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Next Payday</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDate(nextPayDate.toISOString())}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Available Funds</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(totalFunds, currency)}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-baseline">
                    <p className="text-sm text-gray-500">Required</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(requiredForPayPeriod, currency)}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Allocated</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(totalAllocated, currency)}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Remaining</p>
                  <p className={`text-xl font-bold ${
                    remainingForPayPeriod >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(remainingForPayPeriod, currency)}
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