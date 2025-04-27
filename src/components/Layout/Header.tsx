import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wallet, Menu, X } from 'lucide-react';

interface HeaderProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, isSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Allocate Funds';
      case '/accounts':
        return 'Accounts';
      case '/outgoings':
        return 'Outgoings';
      case '/allocate':
        return 'Allocate Funds';
      case '/calendar':
        return 'Calendar';
      default:
        return 'FlowFund';
    }
  };
  
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-md mr-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 lg:hidden"
          aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
          <div className="bg-indigo-600 p-2 rounded-md mr-2">
            <Wallet size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">FlowFund</span>
        </div>
      </div>
      
      <div className="text-lg font-semibold text-gray-700 hidden sm:block">
        {getPageTitle()}
      </div>
      
      <div className="w-12">
        {/* Placeholder for future actions/avatar */}
      </div>
    </header>
  );
};

export default Header;