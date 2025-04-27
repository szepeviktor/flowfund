import React from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Badge from '../components/UI/Badge';
import { Calendar as CalendarIcon } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

const CalendarPage: React.FC = () => {
  const { outgoings, getAccountById } = useAppContext();

  // Sort outgoings by due date
  const sortedOutgoings = [...outgoings].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  // Group outgoings by month
  const groupedOutgoings = sortedOutgoings.reduce((groups, outgoing) => {
    const date = new Date(outgoing.dueDate);
    const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(outgoing);
    return groups;
  }, {} as Record<string, typeof outgoings>);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-500 mt-2">
          View all your upcoming outgoings
        </p>
      </div>

      {Object.entries(groupedOutgoings).map(([monthYear, monthOutgoings]) => (
        <div key={monthYear} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{monthYear}</h2>
          
          <div className="grid gap-4">
            {monthOutgoings.map((outgoing) => {
              const account = getAccountById(outgoing.accountId);
              
              return (
                <Card 
                  key={outgoing.id}
                  className="hover:border-indigo-100 transition-colors"
                >
                  <div className="flex items-center">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center mr-4"
                      style={{ backgroundColor: account?.color + '20' }}
                    >
                      <CalendarIcon size={24} style={{ color: account?.color }} />
                    </div>
                    
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {outgoing.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {account?.name}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(outgoing.amount)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Due {formatDate(outgoing.dueDate)}
                      </p>
                    </div>
                    
                    <Badge 
                      variant={outgoing.recurrence === 'none' ? 'info' : 'primary'}
                      className="ml-4"
                    >
                      {outgoing.recurrence === 'none' ? 'One-time' : 'Recurring'}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CalendarPage;