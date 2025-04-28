import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  PiggyBank, 
  CreditCard,
  ArrowDownUp,
  Calendar
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, closeSidebar }) => {
  const { 
    totalFunds, 
    totalRequired, 
    remainingToAllocate, 
    totalAllocated,
    getNextPayDate,
    getLastPayDate,
    payCycle,
    outgoings
  } = useAppContext();
  
  const [nextPayDate, setNextPayDate] = useState<Date>(getNextPayDate());
  const [lastPayDate, setLastPayDate] = useState<Date>(getLastPayDate());
  const [requiredUntilPayday, setRequiredUntilPayday] = useState<number>(0);

  // Update pay dates when payCycle changes
  useEffect(() => {
    setNextPayDate(getNextPayDate());
    setLastPayDate(getLastPayDate());
  }, [payCycle, getNextPayDate, getLastPayDate]);

  // Calculate required funds until next payday
  useEffect(() => {
    // Function to calculate the total outgoings within the pay period
    const calculateOutgoingsInPayPeriod = () => {
      // Create date objects for comparison
      const nextPay = nextPayDate;
      const lastPay = lastPayDate;
      
      let total = 0;
      
      // Loop through all outgoings to find those due in the pay period
      outgoings.forEach(outgoing => {
        const baseDate = new Date(outgoing.dueDate);
        
        // Different handling based on recurrence type
        if (outgoing.recurrence === 'none') {
          // For one-time payments, check if they're due during this pay period
          if (baseDate >= lastPay && baseDate <= nextPay) {
            total += outgoing.amount;
          }
        } else {
          // For recurring payments, find the next occurrences that fall within the pay period
          let currentDate = new Date(baseDate);
          
          // Find the first occurrence that happens after the last pay date
          while (currentDate < lastPay) {
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
          let moreDates = true;
          while (moreDates && currentDate <= nextPay) {
            // This occurrence is within our pay period, so add its amount
            total += outgoing.amount;
            
            // Check if there are more occurrences within the pay period
            let nextDate = new Date(currentDate);
            
            if (outgoing.recurrence === 'weekly') {
              nextDate.setDate(nextDate.getDate() + 7);
            } else if (outgoing.recurrence === 'biweekly') {
              nextDate.setDate(nextDate.getDate() + 14);
            } else {
              // Monthly, quarterly, and yearly won't have multiple occurrences in typical pay periods
              moreDates = false;
              continue;
            }
            
            if (nextDate <= nextPay) {
              currentDate = nextDate;
            } else {
              moreDates = false;
            }
          }
        }
      });
      
      return total;
    };
    
    setRequiredUntilPayday(calculateOutgoingsInPayPeriod());
  }, [outgoings, nextPayDate, lastPayDate]);
  
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
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Available Funds</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(totalFunds)}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500">Pay Period</p>
                    <span className="flex items-center text-xs text-gray-400">
                      <Calendar size={12} className="mr-1" />
                      {formatDate(nextPayDate.toISOString()).slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <p className="text-lg font-semibold text-gray-900">
                      Required
                    </p>
                    <p className="text-sm text-gray-500">
                      Until payday
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(requiredUntilPayday)}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Allocated</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(totalAllocated)}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Remaining</p>
                  <p className={`text-lg font-semibold ${
                    totalFunds - requiredUntilPayday >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(totalFunds - requiredUntilPayday)}
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
          <div className="flex items-center">
            <div className="text-xs text-gray-500">
              &copy; {new Date().getFullYear()} FlowFund
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;