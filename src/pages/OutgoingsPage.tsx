import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import OutgoingForm from '../components/Forms/OutgoingForm';
import Badge from '../components/UI/Badge';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate, getRelativeDateDescription, getNextOccurrence } from '../utils/formatters';
import { Outgoing, RecurrenceType } from '../types';

// Helper type for outgoings with specific date
interface OutgoingWithDate extends Outgoing {
  specificDate: Date;
  isRepeatedInstance?: boolean; // Flag to indicate this is a repeated instance within the month
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

// Helper to get all occurrences of an outgoing within the current month or next occurrence if outside current month
const getOutgoingOccurrences = (outgoing: Outgoing): OutgoingWithDate[] => {
  const baseDate = new Date(outgoing.dueDate);
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  
  // For non-repeating outgoings or monthly/longer frequencies, just get the next occurrence
  if (outgoing.recurrence === 'none' || 
      outgoing.recurrence === 'monthly' || 
      outgoing.recurrence === 'quarterly' || 
      outgoing.recurrence === 'yearly') {
    const nextDate = getNextOccurrence(baseDate, outgoing.recurrence);
    return [{
      ...outgoing,
      specificDate: nextDate
    }];
  }
  
  // For weekly and biweekly, get all occurrences within the current month
  const occurrences: OutgoingWithDate[] = [];
  let currentDate = getNextOccurrence(baseDate, outgoing.recurrence);
  
  // If the first occurrence is already in next month, just return that
  if (currentDate >= nextMonth) {
    return [{
      ...outgoing,
      specificDate: currentDate
    }];
  }
  
  // Add all occurrences within the current month
  while (currentDate < nextMonth) {
    occurrences.push({
      ...outgoing,
      specificDate: new Date(currentDate.getTime()),
      isRepeatedInstance: occurrences.length > 0 // Mark as repeated if not the first occurrence
    });
    
    // Move to next occurrence
    if (outgoing.recurrence === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (outgoing.recurrence === 'biweekly') {
      currentDate.setDate(currentDate.getDate() + 14);
    }
  }
  
  return occurrences;
};

// Helper to format the badge for recurring payments
const getRecurrenceBadge = (recurrence: RecurrenceType, isRepeatedInstance?: boolean) => {
  if (recurrence === 'none') {
    return <Badge variant="info">One-time</Badge>;
  }
  
  if (isRepeatedInstance) {
    return <Badge variant="warning">Repeating</Badge>;
  }
  
  return <Badge variant="primary">Recurring</Badge>;
};

const OutgoingsPage: React.FC = () => {
  const { outgoings, getAccountById, deleteOutgoing } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutgoing, setEditingOutgoing] = useState<typeof outgoings[0] | undefined>();
  const [deletingOutgoing, setDeletingOutgoing] = useState<typeof outgoings[0] | undefined>();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleEdit = (outgoing: typeof outgoings[0]) => {
    // Find the original outgoing (not the repeated instance)
    const originalOutgoing = outgoings.find(o => o.id === outgoing.id);
    if (originalOutgoing) {
      setEditingOutgoing(originalOutgoing);
      setIsModalOpen(true);
    }
  };

  const handleClose = () => {
    setEditingOutgoing(undefined);
    setIsModalOpen(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, outgoing: typeof outgoings[0]) => {
    e.stopPropagation(); // Prevent card click from triggering
    setDeletingOutgoing(outgoing);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingOutgoing) {
      deleteOutgoing(deletingOutgoing.id);
      setIsDeleteModalOpen(false);
      setDeletingOutgoing(undefined);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setDeletingOutgoing(undefined);
  };

  // Get all occurrences for each outgoing
  const allOutgoingOccurrences: OutgoingWithDate[] = outgoings.flatMap(outgoing => 
    getOutgoingOccurrences(outgoing)
  );

  // Sort by date
  const sortedOccurrences = allOutgoingOccurrences.sort((a, b) => 
    a.specificDate.getTime() - b.specificDate.getTime()
  );

  // Group outgoings by date heading
  const groupedOutgoings: { [heading: string]: OutgoingWithDate[] } = {};
  
  sortedOccurrences.forEach(outgoing => {
    const heading = getDateHeading(outgoing.specificDate);
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
                {outgoings.map((outgoing, index) => {
                  const account = getAccountById(outgoing.accountId);
                  const key = `${outgoing.id}-${index}`;
                  
                  return (
                    <Card 
                      key={key}
                      className={`hover:border-indigo-100 transition-colors ${outgoing.isRepeatedInstance ? 'border-l-4 border-l-gray-200' : ''}`}
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
                            {getRecurrenceBadge(outgoing.recurrence, outgoing.isRepeatedInstance)}
                          </div>
                          <p className="text-sm text-gray-500">
                            {account?.name} • {outgoing.isRepeatedInstance ? 
                              `Due on ${formatDate(outgoing.specificDate.toISOString())}` : 
                              getRelativeDateDescription(outgoing.dueDate, outgoing.recurrence)}
                          </p>
                        </div>
                        
                        <div className="text-right flex items-center">
                          <p className="text-lg font-semibold text-gray-900 mr-4">
                            {formatCurrency(outgoing.amount)}
                          </p>
                          <p className="text-sm text-gray-500 mr-4">
                            {outgoing.isRepeatedInstance ? 
                              'Recurring payment' : 
                              `Next due ${formatDate(outgoing.specificDate.toISOString())}`}
                          </p>
                          {!outgoing.isRepeatedInstance && (
                            <button 
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                              onClick={(e) => handleDeleteClick(e, outgoing)}
                              aria-label="Delete outgoing"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
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

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        title="Delete Outgoing"
      >
        <div className="p-4">
          <p className="mb-4">
            Are you sure you want to delete "{deletingOutgoing?.name}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OutgoingsPage;