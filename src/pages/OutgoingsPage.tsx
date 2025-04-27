import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import OutgoingForm from '../components/Forms/OutgoingForm';
import Badge from '../components/UI/Badge';
import { Calendar, Plus } from 'lucide-react';
import { formatCurrency, formatDate, getRelativeDateDescription, getNextOccurrence } from '../utils/formatters';
import { Outgoing } from '../types';

// Helper type for outgoings with next date
interface OutgoingWithNextDate extends Outgoing {
  nextDate: Date;
}

// Helper to create human-readable date heading
const getDateHeading = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  
  // Normalize dates to start of day for comparison
  today.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  // Check for today, tomorrow, or specific date
  if (normalizedDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (normalizedDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else {
    // For other dates, just use the formatted date
    return formatDate(normalizedDate.toISOString());
  }
};

// Helper to get the sort value for headings (to ensure Today, Tomorrow come first)
const getHeadingSortValue = (heading: string): number => {
  if (heading === 'Today') return 1;
  if (heading === 'Tomorrow') return 2;
  return 3; // All other dates come after
};

const OutgoingsPage: React.FC = () => {
  const { outgoings, getAccountById } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutgoing, setEditingOutgoing] = useState<typeof outgoings[0] | undefined>();

  const handleEdit = (outgoing: typeof outgoings[0]) => {
    setEditingOutgoing(outgoing);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setEditingOutgoing(undefined);
    setIsModalOpen(false);
  };

  // Get the next payment date for each outgoing
  const nextPayments: OutgoingWithNextDate[] = outgoings.map(outgoing => ({
    ...outgoing,
    nextDate: getNextOccurrence(new Date(outgoing.dueDate), outgoing.recurrence)
  }));

  // Sort by next payment date
  const sortedPayments = nextPayments.sort((a, b) => 
    a.nextDate.getTime() - b.nextDate.getTime()
  );

  // Group outgoings by date heading
  const groupedOutgoings: { [heading: string]: OutgoingWithNextDate[] } = {};
  
  sortedPayments.forEach(outgoing => {
    const heading = getDateHeading(outgoing.nextDate);
    if (!groupedOutgoings[heading]) {
      groupedOutgoings[heading] = [];
    }
    groupedOutgoings[heading].push(outgoing);
  });

  // Sort headings to ensure Today, Tomorrow come first, then dates
  const sortedHeadings = Object.keys(groupedOutgoings).sort((a, b) => {
    // First by special heading order
    const aValue = getHeadingSortValue(a);
    const bValue = getHeadingSortValue(b);
    
    if (aValue !== bValue) return aValue - bValue;
    
    // If both are dates, sort chronologically
    if (aValue === 3 && bValue === 3) {
      return new Date(a).getTime() - new Date(b).getTime();
    }
    
    return 0;
  });

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outgoings</h1>
          <p className="text-gray-500 mt-1">Manage your upcoming payments</p>
        </div>
        <Button 
          icon={<Plus size={18} />}
          onClick={() => setIsModalOpen(true)}
        >
          New Outgoing
        </Button>
      </div>

      <div className="space-y-6 mb-8">
        {sortedHeadings.map(heading => {
          const outgoings = groupedOutgoings[heading];
          return (
            <div key={heading}>
              <h2 className="text-lg font-semibold text-gray-700 mb-3 border-l-4 border-indigo-500 pl-3">
                {heading}
              </h2>
              <div className="grid gap-3">
                {outgoings.map((outgoing) => {
                  const account = getAccountById(outgoing.accountId);
                  
                  return (
                    <Card 
                      key={outgoing.id}
                      className="hover:border-indigo-100 transition-colors"
                      onClick={() => handleEdit(outgoing)}
                    >
                      <div className="flex items-center">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center mr-4"
                          style={{ backgroundColor: account?.color + '20' }}
                        >
                          <Calendar size={24} style={{ color: account?.color }} />
                        </div>
                        
                        <div className="flex-grow">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">{outgoing.name}</h3>
                            <Badge 
                              variant={outgoing.recurrence === 'none' ? 'info' : 'primary'}
                            >
                              {outgoing.recurrence === 'none' ? 'One-time' : 'Recurring'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            {account?.name} • {getRelativeDateDescription(outgoing.dueDate, outgoing.recurrence)}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(outgoing.amount)}
                          </p>
                          <p className="text-sm text-gray-500">
                            Next due {formatDate(outgoing.nextDate.toISOString())}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
        
        {Object.keys(groupedOutgoings).length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No outgoings found</p>
            <p className="text-sm text-gray-400 mt-1">Click "New Outgoing" to add one</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleClose}
        title={editingOutgoing ? 'Edit Outgoing' : 'New Outgoing'}
      >
        <OutgoingForm
          onClose={handleClose}
          initialData={editingOutgoing}
        />
      </Modal>
    </div>
  );
};

export default OutgoingsPage;