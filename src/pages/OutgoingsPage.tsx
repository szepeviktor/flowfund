import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import OutgoingForm from '../components/Forms/OutgoingForm';
import Badge from '../components/UI/Badge';
import Select from '../components/UI/Select';
import { Calendar, Plus, Trash2, Settings, List, Clock, ListFilter, PiggyBank } from 'lucide-react';
import { formatCurrency, formatDate, getRelativeDateDescription, getNextOccurrence } from '../utils/formatters';
import { Outgoing, RecurrenceType, PayCycle } from '../types';

// Helper type for outgoings with specific date
interface OutgoingWithDate extends Outgoing {
  specificDate: Date;
  isRepeatedInstance?: boolean; // Flag to indicate this is a repeated instance within the pay period
  isPaymentPlanInstallment?: boolean; // Flag to indicate this is an installment for a payment plan
  originalOutgoingId?: string; // Reference to the original outgoing for payment plan installments
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
const getRecurrenceBadge = (recurrence: RecurrenceType, isRepeatedInstance?: boolean, isPaymentPlanInstallment?: boolean, isCustomRecurrence?: boolean, recurrenceInterval?: number, recurrenceUnit?: string): JSX.Element => {
  if (isPaymentPlanInstallment) {
    return <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-200">Installment</Badge>;
  }
  
  if (recurrence === 'none' && !isCustomRecurrence) {
    return <Badge variant="info" className="bg-purple-100 text-purple-800 border-purple-200">One-time</Badge>;
  }

  if (isCustomRecurrence && recurrenceInterval && recurrenceUnit) {
    return <Badge variant="success" className="bg-green-100 text-green-800 border-green-200">
      Custom {recurrenceInterval} {recurrenceUnit}{recurrenceInterval > 1 ? 's' : ''}
    </Badge>;
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

// Helper to check if a date is in the past
const isPastDue = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

// Special group key for expired outgoings
const EXPIRED_GROUP_KEY = "___EXPIRED___";

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
const getRecurrenceDescription = (recurrence: RecurrenceType, isCustomRecurrence?: boolean, recurrenceInterval?: number, recurrenceUnit?: string): string => {
  if (isCustomRecurrence && recurrenceInterval && recurrenceUnit) {
    return `Repeats every ${recurrenceInterval} ${recurrenceUnit}${recurrenceInterval > 1 ? 's' : ''}`;
  }
  
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

// Helper to get the badge for outgoing status (paused)
const getPausedBadge = (isPaused?: boolean): JSX.Element | null => {
  if (isPaused) {
    return <Badge variant="danger" className="bg-gray-100 text-gray-800 border-gray-200">Paused</Badge>;
  }
  return null;
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

  // Helper to get payment plan installments for an outgoing
  const getPaymentPlanInstallments = (outgoing: Outgoing): OutgoingWithDate[] => {
    // If no payment plan or not enabled, return empty array
    if (!outgoing.paymentPlan || !outgoing.paymentPlan.enabled) {
      return [];
    }

    const installments: OutgoingWithDate[] = [];
    const startDate = new Date(outgoing.paymentPlan.startDate);
    const dueDate = new Date(outgoing.dueDate);
    
    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(dueDate.getTime()) || startDate >= dueDate) {
      return [];
    }
    
    // Calculate installment amount - either use specified amount or calculate based on dates
    let currentDate = new Date(startDate);
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
    
    // Now calculate amount if not specified
    // Use the custom installmentAmount if provided, otherwise calculate it based on total amount divided by installments
    const installmentAmount = outgoing.paymentPlan.installmentAmount !== undefined ? 
      outgoing.paymentPlan.installmentAmount : 
      (totalInstallments > 0 ? Math.ceil((outgoing.amount / totalInstallments) * 100) / 100 : outgoing.amount);
      
    // Reset currentDate to re-iterate
    currentDate = new Date(startDate);
    let installmentNumber = 1;
    
    // Generate installments
    while (currentDate < dueDate) {
      // Only add installments that are within our pay period
      const payPeriodDates = getPayPeriod();
      if (currentDate >= payPeriodDates.startDate && currentDate <= payPeriodDates.endDate) {
        installments.push({
          ...outgoing,
          id: `${outgoing.id}-installment-${installmentNumber}`,
          amount: installmentAmount,
          specificDate: new Date(currentDate),
          isPaymentPlanInstallment: true,
          originalOutgoingId: outgoing.id,
          name: `${outgoing.name} (Installment ${installmentNumber}/${totalInstallments})`
        });
      }
      
      // Move to next date based on frequency
      if (outgoing.paymentPlan.frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (outgoing.paymentPlan.frequency === 'biweekly') {
        currentDate.setDate(currentDate.getDate() + 14);
      } else if (outgoing.paymentPlan.frequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      installmentNumber++;
    }
    
    return installments;
  };

  // Helper to get all occurrences of an outgoing within the pay period
  const getOutgoingOccurrencesInPayPeriod = (outgoing: Outgoing): OutgoingWithDate[] => {
    // Skip outgoings that are paused
    if (outgoing.isPaused) {
      return [];
    }
    
    // Check if this outgoing has a payment plan
    if (outgoing.paymentPlan?.enabled) {
      // Return payment plan installments instead of the regular occurrence
      return getPaymentPlanInstallments(outgoing);
    }
    
    const baseDate = new Date(outgoing.dueDate);
    const occurrences: OutgoingWithDate[] = [];
    
    // For non-repeating outgoings, just get the next occurrence
    if (outgoing.recurrence === 'none' && !outgoing.isCustomRecurrence) {
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
    let currentDate = getNextOccurrence(
      baseDate, 
      outgoing.recurrence, 
      outgoing.isCustomRecurrence ? outgoing.recurrenceInterval : undefined,
      outgoing.isCustomRecurrence ? outgoing.recurrenceUnit : undefined
    );
    
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
      if (outgoing.recurrence === 'weekly' || outgoing.recurrence === 'biweekly' || 
          (outgoing.isCustomRecurrence && outgoing.recurrenceUnit === 'week' && 
           outgoing.recurrenceInterval && outgoing.recurrenceInterval <= 2)) {
        
        // Move to next occurrence
        const nextDate = new Date(currentDate);
        
        if (outgoing.isCustomRecurrence && outgoing.recurrenceInterval && outgoing.recurrenceUnit === 'week') {
          nextDate.setDate(nextDate.getDate() + (7 * outgoing.recurrenceInterval));
        } else if (outgoing.recurrence === 'weekly') {
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
        // For monthly, quarterly, yearly, and longer intervals, we only show one occurrence per pay period
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
    const isExpired = isPastDue(outgoing.specificDate);
    const heading = isExpired ? EXPIRED_GROUP_KEY : getDateHeading(outgoing.specificDate);
    
    if (!groupedOutgoings[heading]) {
      groupedOutgoings[heading] = [];
    }
    groupedOutgoings[heading].push(outgoing);
  });

  // Sort headings to ensure Today, Tomorrow come first, then dates, with Expired at the end
  const sortedHeadings = Object.keys(groupedOutgoings).sort((a, b) => {
    // Expired section always comes last
    if (a === EXPIRED_GROUP_KEY) return 1;
    if (b === EXPIRED_GROUP_KEY) return -1;
    
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
    const nextDate = getNextOccurrence(
      new Date(outgoing.dueDate), 
      outgoing.recurrence,
      outgoing.isCustomRecurrence ? outgoing.recurrenceInterval : undefined,
      outgoing.isCustomRecurrence ? outgoing.recurrenceUnit : undefined
    );
    return formatDate(nextDate.toISOString());
  };

  // Check if an outgoing is past due (for list view)
  const isOutgoingPastDue = (outgoing: Outgoing): boolean => {
    const nextDate = getNextOccurrence(new Date(outgoing.dueDate), outgoing.recurrence);
    return isPastDue(nextDate);
  };

  // Get the total amount for each account
  const getAccountTotal = (accountId: string): number => {
    return outgoingsByAccount[accountId]?.reduce((sum, outgoing) => 
      // Only include non-paused outgoings in the total
      outgoing.isPaused ? sum : sum + outgoing.amount, 0) || 0;
  };

  const handleEdit = (outgoing: OutgoingWithDate | Outgoing) => {
    const outgoingWithDate = 'specificDate' in outgoing ? 
      outgoing : 
      { ...outgoing, specificDate: getNextOccurrence(new Date(outgoing.dueDate), outgoing.recurrence) };
      
    // If this is a payment plan installment, find the original outgoing
    if ('isPaymentPlanInstallment' in outgoingWithDate && outgoingWithDate.isPaymentPlanInstallment && outgoingWithDate.originalOutgoingId) {
      const originalOutgoing = outgoings.find(o => o.id === outgoingWithDate.originalOutgoingId);
      if (originalOutgoing) {
        setEditingOutgoing(originalOutgoing);
        setIsModalOpen(true);
      }
      return;
    }
    
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

  const handleDeleteClick = (e: React.MouseEvent, outgoing: OutgoingWithDate | Outgoing) => {
    e.stopPropagation(); // Prevent card click from triggering
    
    const outgoingWithDate = 'specificDate' in outgoing ? 
      outgoing as OutgoingWithDate : 
      { ...outgoing, specificDate: getNextOccurrence(new Date(outgoing.dueDate), outgoing.recurrence) } as OutgoingWithDate;
    
    // If this is a payment plan installment, we need to edit the original outgoing instead of deleting
    if (outgoingWithDate.isPaymentPlanInstallment && outgoingWithDate.originalOutgoingId) {
      e.stopPropagation();
      const originalOutgoing = outgoings.find(o => o.id === outgoingWithDate.originalOutgoingId);
      if (originalOutgoing) {
        setEditingOutgoing(originalOutgoing);
        setIsModalOpen(true);
      }
      return;
    }
    
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

  // Helper to ensure an outgoing object has a specificDate property
  const ensureSpecificDate = (outgoing: Outgoing): OutgoingWithDate => {
    if ('specificDate' in outgoing) {
      return outgoing as OutgoingWithDate;
    } else {
      // Add a specificDate based on the dueDate if not present
      return {
        ...outgoing,
        specificDate: getNextOccurrence(new Date(outgoing.dueDate), outgoing.recurrence)
      };
    }
  };

  // Add type guard functions to avoid linter errors
  const hasRepeatedInstance = (outgoing: any): outgoing is OutgoingWithDate & { isRepeatedInstance: boolean } => {
    return 'isRepeatedInstance' in outgoing;
  };

  const hasPaymentPlanInstallment = (outgoing: any): outgoing is OutgoingWithDate & { isPaymentPlanInstallment: boolean } => {
    return 'isPaymentPlanInstallment' in outgoing;
  };
  
  // Helper function to calculate the number of installments for a payment plan
  const calculateInstallments = (outgoing: Outgoing): number => {
    if (!outgoing.paymentPlan?.enabled) return 0;
    
    const startDate = new Date(outgoing.paymentPlan.startDate);
    const dueDate = new Date(outgoing.dueDate);
    
    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(dueDate.getTime()) || startDate >= dueDate) {
      return 0;
    }
    
    // Count total installments
    let currentDate = new Date(startDate);
    let totalInstallments = 0;
    
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
    
    return totalInstallments;
  };

  // Helper function to create badge with amount + paused status
  const getOutgoingAmountDisplay = (outgoing: Outgoing, showInstallments: boolean = false) => {
    const isPaused = outgoing.isPaused;
    const isPaymentPlan = outgoing.paymentPlan?.enabled;
    const totalInstallments = isPaymentPlan ? calculateInstallments(outgoing) : 0;
    const installmentAmount = outgoing.paymentPlan?.installmentAmount || 
      (totalInstallments > 0 ? Math.ceil((outgoing.amount / totalInstallments) * 100) / 100 : outgoing.amount);
    
    return (
      <div className="text-right">
        <p className={`text-lg font-semibold ${isPaused ? 'text-gray-400' : 'text-gray-900'}`}>
          {formatCurrency(outgoing.amount, currency)}
        </p>
        {isPaymentPlan && showInstallments && (
          <p className="text-xs text-gray-500">
            {totalInstallments} payments of {formatCurrency(installmentAmount, currency)}
          </p>
        )}
        {isPaused && (
          <p className="text-xs text-gray-400 italic">Not included in required funds</p>
        )}
      </div>
    );
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
              
              // Special handling for Expired group
              if (heading === EXPIRED_GROUP_KEY) {
                return (
                  <div key={heading} className="mt-8">
                    <h2 className="text-lg font-semibold text-gray-500 mb-3 border-l-4 border-gray-400 pl-3 flex items-center">
                      <Clock className="mr-2" size={18} />
                      Expired Outgoings
                    </h2>
                    <div className="grid gap-3">
                      {outgoings.map((outgoing, index) => {
                        const account = getAccountById(outgoing.accountId);
                        const key = `${outgoing.id}-${index}`;
                        
                        return (
                          <Card 
                            key={key}
                            className={`hover:border-indigo-100 transition-colors
                              ${outgoing.isRepeatedInstance ? 'border-l-4 border-l-gray-200' : ''}
                              ${outgoing.isPaymentPlanInstallment ? 'border-l-4 border-l-amber-300' : ''}
                              ${outgoing.isPaused ? 'opacity-60' : ''}`}
                            onClick={() => handleEdit(outgoing)}
                          >
                            <div className="flex items-center">
                              <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center mr-4"
                                style={{ backgroundColor: account?.color + '20' }}
                              >
                                {outgoing.isPaymentPlanInstallment ? (
                                  <PiggyBank size={24} style={{ color: account?.color }} />
                                ) : (
                                  <Calendar size={24} style={{ color: account?.color }} />
                                )}
                              </div>
                              
                              <div className="flex-grow">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-lg font-semibold text-gray-900">{outgoing.name}</h3>
                                  {getRecurrenceBadge(
                                    outgoing.recurrence, 
                                    hasRepeatedInstance(outgoing) ? outgoing.isRepeatedInstance : undefined, 
                                    hasPaymentPlanInstallment(outgoing) ? outgoing.isPaymentPlanInstallment : undefined, 
                                    outgoing.isCustomRecurrence, 
                                    outgoing.recurrenceInterval, 
                                    outgoing.recurrenceUnit
                                  )}
                                  {getPausedBadge(outgoing.isPaused)}
                                </div>
                                <p className="text-sm text-gray-500">
                                  {account?.name} • Due on {formatDate(outgoing.specificDate.toISOString())}
                                  
                                  {outgoing.isPaymentPlanInstallment && outgoing.originalOutgoingId && (
                                    <span> • For {outgoing.name.split(' (Installment')[0]}</span>
                                  )}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="mr-2">
                                  {getOutgoingAmountDisplay(outgoing)}
                                </div>
                                <button 
                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                  onClick={(e) => handleDeleteClick(e, outgoing)}
                                  aria-label={outgoing.isPaymentPlanInstallment ? "Edit payment plan" : "Delete outgoing"}
                                >
                                  {outgoing.isPaymentPlanInstallment ? (
                                    <Settings size={18} />
                                  ) : (
                                    <Trash2 size={18} />
                                  )}
                                </button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              
              // Regular date headings
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
                          className={`hover:border-indigo-100 transition-colors 
                            ${outgoing.isRepeatedInstance ? 'border-l-4 border-l-gray-200' : ''}
                            ${outgoing.isPaymentPlanInstallment ? 'border-l-4 border-l-amber-300' : ''}
                            ${outgoing.isPaused ? 'opacity-60' : ''}`}
                          onClick={() => handleEdit(outgoing)}
                        >
                          <div className="flex items-center">
                            <div 
                              className="w-12 h-12 rounded-full flex items-center justify-center mr-4"
                              style={{ backgroundColor: account?.color + '20' }}
                            >
                              {outgoing.isPaymentPlanInstallment ? (
                                <PiggyBank size={24} style={{ color: account?.color }} />
                              ) : (
                                <Calendar size={24} style={{ color: account?.color }} />
                              )}
                            </div>
                            
                            <div className="flex-grow">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-gray-900">{outgoing.name}</h3>
                                {getRecurrenceBadge(
                                  outgoing.recurrence, 
                                  hasRepeatedInstance(outgoing) ? outgoing.isRepeatedInstance : undefined, 
                                  hasPaymentPlanInstallment(outgoing) ? outgoing.isPaymentPlanInstallment : undefined, 
                                  outgoing.isCustomRecurrence, 
                                  outgoing.recurrenceInterval, 
                                  outgoing.recurrenceUnit
                                )}
                                {getPausedBadge(outgoing.isPaused)}
                              </div>
                              <p className="text-sm text-gray-500">
                                {account?.name} • {outgoing.isRepeatedInstance || outgoing.isPaymentPlanInstallment ? 
                                  `Due on ${formatDate(outgoing.specificDate.toISOString())}` : 
                                  getRelativeDateDescription(outgoing.dueDate, outgoing.recurrence)}
                                  
                                {outgoing.isPaymentPlanInstallment && outgoing.originalOutgoingId && (
                                  <span> • For {outgoing.name.split(' (Installment')[0]}</span>
                                )}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="mr-2">
                                {getOutgoingAmountDisplay(outgoing)}
                              </div>
                              <button 
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                onClick={(e) => handleDeleteClick(e, outgoing)}
                                aria-label={outgoing.isPaymentPlanInstallment ? "Edit payment plan" : "Delete outgoing"}
                              >
                                {outgoing.isPaymentPlanInstallment ? (
                                  <Settings size={18} />
                                ) : (
                                  <Trash2 size={18} />
                                )}
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
          {/* Regular accounts */}
          {accounts.map(account => {
            // Filter to only show non-expired outgoings
            const accountOutgoings = outgoingsByAccount[account.id]?.filter(
              outgoing => !isOutgoingPastDue(outgoing)
            ) || [];
            
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
                      className={`hover:border-indigo-100 transition-colors py-3 ${
                        outgoing.paymentPlan?.enabled ? 'border-l-4 border-l-amber-300' : ''
                      } ${outgoing.isPaused ? 'opacity-60' : ''}`}
                      onClick={() => handleEdit(outgoing)}
                    >
                      <div className="flex items-center">
                        <div className="flex-grow pl-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-md font-medium text-gray-900">{outgoing.name}</h3>
                            {getRecurrenceBadge(
                              outgoing.recurrence, 
                              hasRepeatedInstance(outgoing) ? outgoing.isRepeatedInstance : undefined, 
                              hasPaymentPlanInstallment(outgoing) ? outgoing.isPaymentPlanInstallment : undefined, 
                              outgoing.isCustomRecurrence, 
                              outgoing.recurrenceInterval, 
                              outgoing.recurrenceUnit
                            )}
                            {outgoing.paymentPlan?.enabled && (
                              <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-200">
                                Payment Plan
                              </Badge>
                            )}
                            {getPausedBadge(outgoing.isPaused)}
                          </div>
                          <p className="text-xs text-gray-500">
                            {getRecurrenceDescription(outgoing.recurrence, outgoing.isCustomRecurrence, outgoing.recurrenceInterval, outgoing.recurrenceUnit)}
                            <> • Next: {getNextPaymentDate(outgoing)}</>
                            {outgoing.paymentPlan?.enabled && (
                              <span> • Installment: {formatCurrency(outgoing.paymentPlan.installmentAmount || 
                                // Calculate installment if not specified
                                (outgoing.amount / (calculateInstallments(outgoing) || 1)), 
                                currency)}/{outgoing.paymentPlan.frequency}</span>
                            )}
                          </p>
                        </div>
                        
                        <div className="text-right flex items-center">
                          <div className="mr-2">
                            {getOutgoingAmountDisplay(outgoing)}
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
                  ))}
                </div>
              </div>
            );
          })}
          
          {/* Expired outgoings section */}
          {(() => {
            // Find all expired outgoings
            const expiredOutgoings = outgoings.filter(outgoing => isOutgoingPastDue(outgoing));
            
            if (expiredOutgoings.length === 0) return null;
            
            return (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-500 mb-3 border-l-4 border-gray-400 pl-3 flex items-center">
                  <Clock className="mr-2" size={18} />
                  Expired Outgoings
                </h2>
                
                <div className="grid gap-2">
                  {expiredOutgoings.map((outgoing) => {
                    const account = getAccountById(outgoing.accountId);
                    
                    return (
                      <Card 
                        key={outgoing.id}
                        className={`hover:border-indigo-100 transition-colors py-3 ${
                          outgoing.paymentPlan?.enabled ? 'border-l-4 border-l-amber-300' : ''
                        } ${outgoing.isPaused ? 'opacity-60' : ''}`}
                        onClick={() => handleEdit(outgoing)}
                      >
                        <div className="flex items-center">
                          <div className="flex-grow pl-2">
                            <div className="flex items-center gap-3">
                              <h3 className="text-md font-medium text-gray-900">{outgoing.name}</h3>
                              {getRecurrenceBadge(
                                outgoing.recurrence, 
                                hasRepeatedInstance(outgoing) ? outgoing.isRepeatedInstance : undefined, 
                                hasPaymentPlanInstallment(outgoing) ? outgoing.isPaymentPlanInstallment : undefined, 
                                outgoing.isCustomRecurrence, 
                                outgoing.recurrenceInterval, 
                                outgoing.recurrenceUnit
                              )}
                              {outgoing.paymentPlan?.enabled && (
                                <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-200">
                                  Payment Plan
                                </Badge>
                              )}
                              {getPausedBadge(outgoing.isPaused)}
                            </div>
                            <p className="text-xs text-gray-500">
                              {getRecurrenceDescription(outgoing.recurrence, outgoing.isCustomRecurrence, outgoing.recurrenceInterval, outgoing.recurrenceUnit)} • {account?.name}
                              {outgoing.paymentPlan?.enabled && (
                                <span> • Installment: {formatCurrency(outgoing.paymentPlan.installmentAmount || 
                                  // Calculate installment if not specified
                                  (outgoing.amount / (calculateInstallments(outgoing) || 1)), 
                                  currency)}/{outgoing.paymentPlan.frequency}</span>
                              )}
                            </p>
                          </div>
                          
                          <div className="text-right flex items-center">
                            <div className="mr-2">
                              {getOutgoingAmountDisplay(outgoing)}
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
          })()}
          
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