import React from 'react';
import { ArrowRight, Calendar } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { formatCurrency, formatDate, getRelativeDateDescription } from '../../utils/formatters';
import Card from '../UI/Card';
import { Link } from 'react-router-dom';

const UpcomingOutgoings: React.FC = () => {
  const { outgoings, getAccountById } = useAppContext();
  
  // Sort outgoings by due date
  const sortedOutgoings = [...outgoings].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  
  // Get the next 5 upcoming outgoings
  const upcomingOutgoings = sortedOutgoings.slice(0, 5);
  
  if (upcomingOutgoings.length === 0) {
    return (
      <Card className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Upcoming Outgoings</h2>
        <div className="text-center py-8">
          <p className="text-gray-500">No upcoming outgoings</p>
          <Link to="/outgoings" className="text-indigo-600 font-medium mt-2 inline-block hover:underline">
            Add your first outgoing
          </Link>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Upcoming Outgoings</h2>
        <Link 
          to="/calendar" 
          className="text-indigo-600 text-sm font-medium flex items-center hover:text-indigo-800"
        >
          View Calendar <ArrowRight size={16} className="ml-1" />
        </Link>
      </div>
      
      <div className="space-y-3">
        {upcomingOutgoings.map((outgoing) => {
          const account = getAccountById(outgoing.accountId);
          return (
            <div 
              key={outgoing.id} 
              className="flex items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center mr-4"
                style={{ backgroundColor: account?.color + '20' }} // Light version of the account color
              >
                <Calendar size={18} style={{ color: account?.color }} />
              </div>
              
              <div className="flex-grow">
                <p className="font-medium text-gray-900">{outgoing.name}</p>
                <p className="text-sm text-gray-500">{account?.name}</p>
              </div>
              
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(outgoing.amount)}</p>
                <p className="text-xs text-gray-500">
                  {getRelativeDateDescription(outgoing.dueDate)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <Link 
          to="/outgoings" 
          className="text-indigo-600 text-sm font-medium flex items-center justify-center hover:text-indigo-800"
        >
          View All Outgoings <ArrowRight size={16} className="ml-1" />
        </Link>
      </div>
    </Card>
  );
};

export default UpcomingOutgoings;