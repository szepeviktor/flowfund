import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import OutgoingForm from '../components/Forms/OutgoingForm';
import Badge from '../components/UI/Badge';
import Select from '../components/UI/Select';
import { Calendar, Plus, Trash2, Settings, List, Clock, ListFilter } from 'lucide-react';
import { formatCurrency, formatDate, getRelativeDateDescription, getNextOccurrence } from '../utils/formatters';
import { Outgoing, RecurrenceType, PayCycle } from '../types';

// Helper type for outgoings with specific date
interface OutgoingWithDate extends Outgoing {
  specificDate: Date;
  isRepeatedInstance?: boolean; // Flag to indicate this is a repeated instance within the pay period
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
    // For other dates, include the day of the week
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = days[normalizedDate.getDay()];
    return `${dayOfWeek}, ${formatDate(normalizedDate.toISOString())}`;
  }
};

// Helper to get the sort value for headings (to ensure Today, Tomorrow come first)
const getHeadingSortValue = (heading: string): number => {
  if (heading === 'Today') return 1;
  if (heading === 'Tomorrow') return 2;
  return 3; // All other dates come after
};

// Helper to format the badge for recurring payments
const getRecurrenceBadge = (recurrence: RecurrenceType, isRepeatedInstance?: boolean): JSX.Element => {
  if (recurrence === 'none') {
    return <Badge variant="info" className="bg-purple-100 text-purple-800 border-purple-200">One-time</Badge>;
  }
  
  if (isRepeatedInstance) {
    return <Badge variant="warning">Repeating</Badge>;
  }
  
  // Show specific cadence for recurring outgoings with different colors
  switch (recurrence) {
    case 'weekly':
      return <Badge variant="danger">Weekly</Badge>;
    case 'biweekly':
      return <Badge variant="warning">Bi-weekly</Badge>;
    case 'monthly':
      return <Badge variant="primary">Monthly</Badge>;
    case 'quarterly':
      return <Badge variant="success">Quarterly</Badge>;
    case 'yearly':
      return <Badge variant="info" className="bg-teal-100 text-teal-800 border-teal-200">Yearly</Badge>;
    default:
      return <Badge variant="primary">Recurring</Badge>;
  }
};

// Component for pay cycle settings
interface PayCycleSettingsProps {
  onClose: () => void;
  initialData: PayCycle;
  onSave: (payCycle: PayCycle) => void;
}

const PayCycleSettingsForm: React.FC<PayCycleSettingsProps> = ({ onClose, initialData, onSave }) => {
  const [formData, setFormData] = useState<PayCycle>({
    ...initialData,
    lastPayDate: initialData.lastPayDate || new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        id="frequency"
        label="Pay Frequency"
        value={formData.frequency}
        onChange={(e) => setFormData({ ...formData, frequency: e.target.value as PayCycle['frequency'] })}
      >
        <option value="monthly">Monthly</option>
        <option value="biweekly">Bi-weekly</option>
        <option value="weekly">Weekly</option>
      </Select>

      {formData.frequency === 'monthly' && (
        <Select
          id="dayOfMonth"
          label="Pay Day (Day of Month)"
          value={formData.dayOfMonth}
          onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value, 10) })}
        >
          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </Select>
      )}

      {(formData.frequency === 'biweekly' || formData.frequency === 'weekly') && (
        <div>
          <label htmlFor="lastPayDate" className="block text-sm font-medium text-gray-700 mb-1">
            Last Pay Date
          </label>
          <input
            type="date"
            id="lastPayDate"
            value={formData.lastPayDate?.split('T')[0] || ''}
            onChange={(e) => setFormData({ ...formData, lastPayDate: e.target.value })}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">
          Save Settings
        </Button>
      </div>
    </form>
  );
};

type ViewMode = 'timeline' | 'list';

// Helper to get a human-readable recurrence description
const getRecurrenceDescription = (recurrence: RecurrenceType): string => {
  switch (recurrence) {
    case 'none':
      return 'One-time payment';
    case 'weekly':
      return 'Repeats every week';
    case 'biweekly':
      return 'Repeats every two weeks';
    case 'monthly':
      return 'Repeats monthly';
    case 'quarterly':
      return 'Repeats quarterly';
    case 'yearly':
      return 'Repeats yearly';
    default:
      return 'Recurring payment';
  }
};

const OutgoingsPage: React.FC = () => {
  const { 
    outgoings, 
    getAccountById, 
    deleteOutgoing, 
    payCycle, 
    updatePayCycle,
    getPayPeriod,
    accounts,
    currency
  } = useAppContext();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayCycleModalOpen, setIsPayCycleModalOpen] = useState(false);
  const [editingOutgoing, setEditingOutgoing] = useState<Outgoing | undefined>(undefined);
  const [deletingOutgoing, setDeletingOutgoing] = useState<typeof outgoings[0] | undefined>();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  // Get pay period dates
  const { startDate, endDate } = useMemo(() => getPayPeriod(), [getPayPeriod]);

  // Helper to get all occurrences of an outgoing within the pay period
  const getOutgoingOccurrencesInPayPeriod = (outgoing: Outgoing): OutgoingWithDate[] => {
    const baseDate = new Date(outgoing.dueDate);
    const occurrences: OutgoingWithDate[] = [];
    
    // For non-repeating outgoings, just get the next occurrence
    if (outgoing.recurrence === 'none') {
      const nextDate = getNextOccurrence(baseDate, outgoing.recurrence);
      
      // Only include if it falls within the pay period or is the next upcoming after the period
      if (nextDate >= startDate) {
        return [{
          ...outgoing,
          specificDate: nextDate
        }];
      }
      return [];
    }
    
    // For all recurring payments, find occurrences within the pay period
    let currentDate = getNextOccurrence(baseDate, outgoing.recurrence);
    
    // If the first occurrence is already beyond the next pay date, show it anyway
    if (currentDate > endDate) {
      return [{
        ...outgoing,
        specificDate: currentDate
      }];
    }
    
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
    // For weekly/biweekly, add multiple occurrences; for others, just add one
    let shouldAddMore = true;
    while (shouldAddMore) {
      // Add the current occurrence since it's after startDate
      occurrences.push({
        ...outgoing,
        specificDate: new Date(currentDate.getTime()),
        isRepeatedInstance: occurrences.length > 0 // Mark as repeated if not the first occurrence
      });
      
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
        // For monthly, quarterly, and yearly, we only show one occurrence per pay period
        shouldAddMore = false;
      }
    }
    
    return occurrences;
  };

  // Get all occurrences for each outgoing
  const allOutgoingOccurrences: OutgoingWithDate[] = outgoings.flatMap(outgoing => 
    getOutgoingOccurrencesInPayPeriod(outgoing)
  );

  // Filter occurrences to only include those within the current pay period
  const payPeriodOccurrences = allOutgoingOccurrences.filter(outgoing => {
    const date = outgoing.specificDate;
    return date >= startDate && date < endDate;
  });

  // Sort by date
  const sortedOccurrences = payPeriodOccurrences.sort((a, b) => 
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

  // For list view, group outgoings by account
  const outgoingsByAccount: { [accountId: string]: Outgoing[] } = {};
  
  // Group outgoings by account ID
  outgoings.forEach(outgoing => {
    if (!outgoingsByAccount[outgoing.accountId]) {
      outgoingsByAccount[outgoing.accountId] = [];
    }
    outgoingsByAccount[outgoing.accountId].push(outgoing);
  });

  // Format the next payment date for each outgoing in the list view
  const getNextPaymentDate = (outgoing: Outgoing): string => {
    const nextDate = getNextOccurrence(new Date(outgoing.dueDate), outgoing.recurrence);
    return formatDate(nextDate.toISOString());
  };

  // Get the total amount for each account
  const getAccountTotal = (accountId: string): number => {
    return outgoingsByAccount[accountId]?.reduce((sum, outgoing) => sum + outgoing.amount, 0) || 0;
  };

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

  const handlePayCycleOpen = () => {
    setIsPayCycleModalOpen(true);
  };

  const handlePayCycleClose = () => {
    setIsPayCycleModalOpen(false);
  };

  const handlePayCycleSave = (newPayCycle: PayCycle) => {
    updatePayCycle(newPayCycle);
  };

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outgoings</h1>
          <p className="text-gray-500 mt-1">Manage your regular payments and bills</p>
        </div>
        <div className="flex space-x-2">
          <div className="border border-gray-200 rounded-md flex divide-x divide-gray-200 overflow-hidden mr-2">
            <button
              className={`p-2 ${
                viewMode === 'timeline' 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              } transition-colors`}
              onClick={() => setViewMode('timeline')}
              title="Timeline View"
              aria-label="Switch to timeline view"
            >
              <Calendar size={18} />
            </button>
            <button
              className={`p-2 ${
                viewMode === 'list' 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              } transition-colors`}
              onClick={() => setViewMode('list')}
              title="List View"
              aria-label="Switch to list view"
            >
              <ListFilter size={18} />
            </button>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingOutgoing(undefined);
              setIsModalOpen(true);
            }}
          >
            Add Outgoing
          </Button>
        </div>
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <>
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
                            
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-lg font-semibold text-gray-900">
                                  {formatCurrency(outgoing.amount, currency)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {outgoing.isRepeatedInstance ? 
                                    getRecurrenceDescription(outgoing.recurrence) : 
                                    `Next due ${formatDate(outgoing.specificDate.toISOString())}`}
                                </p>
                              </div>
                              <button 
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                onClick={(e) => handleDeleteClick(e, outgoing)}
                                aria-label="Delete outgoing"
                              >
                                <Trash2 size={18} />
                              </button>
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
                <p className="text-gray-500">No outgoings found in current pay period</p>
                <p className="text-sm text-gray-400 mt-1">Click "Add Outgoing" to add one</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-6 mb-8">
          {accounts.map(account => {
            const accountOutgoings = outgoingsByAccount[account.id] || [];
            
            if (accountOutgoings.length === 0) return null;
            
            return (
              <div key={account.id}>
                <div className="flex justify-between items-center mb-3">
                  <h2 
                    className="text-lg font-semibold mb-0 border-l-4 pl-3"
                    style={{ borderColor: account.color }}
                  >
                    {account.name}
                  </h2>
                  <p className="text-md font-medium">
                    Total: {formatCurrency(getAccountTotal(account.id), currency)}
                  </p>
                </div>
                
                <div className="grid gap-2">
                  {accountOutgoings.map((outgoing) => (
                    <Card 
                      key={outgoing.id}
                      className="hover:border-indigo-100 transition-colors py-3"
                      onClick={() => handleEdit(outgoing)}
                    >
                      <div className="flex items-center">
                        <div className="flex-grow pl-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-md font-medium text-gray-900">{outgoing.name}</h3>
                            {getRecurrenceBadge(outgoing.recurrence)}
                          </div>
                          <p className="text-xs text-gray-500">
                            {getRecurrenceDescription(outgoing.recurrence)} • Next: {getNextPaymentDate(outgoing)}
                          </p>
                        </div>
                        
                        <div className="text-right flex items-center">
                          <p className="text-lg font-semibold text-gray-900 mr-4">
                            {formatCurrency(outgoing.amount, currency)}
                          </p>
                          <button 
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            onClick={(e) => handleDeleteClick(e, outgoing)}
                            aria-label="Delete outgoing"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
          
          {outgoings.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No outgoings found</p>
              <p className="text-sm text-gray-400 mt-1">Click "Add Outgoing" to add one</p>
            </div>
          )}
        </div>
      )}

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

      <Modal
        isOpen={isPayCycleModalOpen}
        onClose={handlePayCycleClose}
        title="Pay Cycle Settings"
      >
        <div className="p-4">
          <p className="mb-4 text-sm text-gray-500">
            Configure your pay cycle to see all bills due between pay periods.
          </p>
          <PayCycleSettingsForm
            onClose={handlePayCycleClose}
            initialData={payCycle}
            onSave={handlePayCycleSave}
          />
        </div>
      </Modal>
    </div>
  );
};

export default OutgoingsPage;