import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  PiggyBank, 
  CreditCard,
  ArrowDownUp
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, closeSidebar }) => {
  const { totalFunds, totalRequired, remainingToAllocate, totalAllocated } = useAppContext();
  
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
                  <p className="text-sm text-gray-500">Required</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(totalRequired)}
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
                  <p className={`text-lg font-semibold ${remainingToAllocate >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(remainingToAllocate)}
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