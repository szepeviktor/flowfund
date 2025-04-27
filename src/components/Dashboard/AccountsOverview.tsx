import React from 'react';
import { PiggyBank, ArrowRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import Card from '../UI/Card';
import ProgressBar from '../UI/ProgressBar';
import { Link } from 'react-router-dom';

const AccountsOverview: React.FC = () => {
  const { accounts, getOutgoingsForAccount, getAllocationForAccount } = useAppContext();
  
  if (accounts.length === 0) {
    return (
      <Card>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Accounts Overview</h2>
        <div className="text-center py-8">
          <p className="text-gray-500">No accounts created yet</p>
          <Link to="/accounts" className="text-indigo-600 font-medium mt-2 inline-block hover:underline">
            Create your first account
          </Link>
        </div>
      </Card>
    );
  }
  
  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Accounts Overview</h2>
        <Link 
          to="/accounts" 
          className="text-indigo-600 text-sm font-medium flex items-center hover:text-indigo-800"
        >
          Manage Accounts <ArrowRight size={16} className="ml-1" />
        </Link>
      </div>
      
      <div className="space-y-4">
        {accounts.map((account) => {
          const outgoings = getOutgoingsForAccount(account.id);
          const totalOutgoings = outgoings.reduce((sum, outgoing) => sum + outgoing.amount, 0);
          const currentAllocation = getAllocationForAccount(account.id);
          const fundingPercentage = totalOutgoings > 0 
            ? (currentAllocation / totalOutgoings) * 100
            : currentAllocation > 0 ? 100 : 0;
          
          return (
            <div 
              key={account.id} 
              className="p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center mb-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                  style={{ backgroundColor: account.color + '20' }}
                >
                  <PiggyBank size={18} style={{ color: account.color }} />
                </div>
                
                <div className="flex-grow">
                  <h3 className="font-semibold text-gray-900">{account.name}</h3>
                  {account.description && (
                    <p className="text-xs text-gray-500">{account.description}</p>
                  )}
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-gray-900">{formatCurrency(currentAllocation)}</p>
                  <p className="text-xs text-gray-500">
                    {outgoings.length} outgoing{outgoings.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              
              <ProgressBar 
                value={currentAllocation} 
                max={totalOutgoings > 0 ? totalOutgoings : currentAllocation || 100}
                color={account.color}
                height={6}
                className="mb-2"
              />
              
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Allocated</span>
                <span className={`font-medium ${fundingPercentage >= 100 ? 'text-green-600' : 'text-gray-700'}`}>
                  {Math.round(fundingPercentage)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-100">
        <Link 
          to="/allocate" 
          className="text-indigo-600 text-sm font-medium flex items-center justify-center hover:text-indigo-800"
        >
          Allocate Funds <ArrowRight size={16} className="ml-1" />
        </Link>
      </div>
    </Card>
  );
};

export default AccountsOverview;