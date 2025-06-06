import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../UI/Button';
import Select from '../UI/Select';
import Input from '../UI/Input';
import { RecurrenceType, PaymentPlan } from '../../types';
import { getCurrencySymbol } from '../../utils/formatters';

// We need to extend the RecurrenceType to include 'custom'
// Since we can't modify the imported type directly, we'll create a local extended type
type ExtendedRecurrenceType = RecurrenceType | 'custom';

// Helper function to determine if an outgoing frequency is eligible for payment plans
// based on the pay cycle frequency
const isEligibleForPaymentPlan = (outgoingFrequency: ExtendedRecurrenceType, payCycleFrequency: string, recurrenceInterval?: number, recurrenceUnit?: string): boolean => {
  // Define the frequency order (from most frequent to least frequent)
  const frequencyOrder: Record<string, number> = {
    'daily': 1,
    'weekly': 2,
    'biweekly': 3,
    'monthly': 4,
    'quarterly': 5,
    'yearly': 6,
    'none': 7, // One-time payments
    'custom': 8, // Custom recurrence - we'll handle it specially
  };
  
  // If outgoing frequency is "none" (one-time), it's eligible for payment plan
  if (outgoingFrequency === 'none') return true;
  
  // If it's a custom recurrence, evaluate based on interval and unit by converting to days
  if (outgoingFrequency === 'custom' && recurrenceInterval && recurrenceUnit) {
    // Convert the custom recurrence to days
    let customRecurrenceDays = 0;
    
    if (recurrenceUnit === 'day') {
      customRecurrenceDays = recurrenceInterval;
    } else if (recurrenceUnit === 'week') {
      customRecurrenceDays = recurrenceInterval * 7;
    } else if (recurrenceUnit === 'month') {
      customRecurrenceDays = recurrenceInterval * 30;
    } else if (recurrenceUnit === 'year') {
      customRecurrenceDays = recurrenceInterval * 365;
    }
    
    // Convert pay cycle frequency to days (approximate)
    let payCycleDays = 0;
    if (payCycleFrequency === 'daily') {
      payCycleDays = 1;
    } else if (payCycleFrequency === 'weekly') {
      payCycleDays = 7;
    } else if (payCycleFrequency === 'biweekly') {
      payCycleDays = 14;
    } else if (payCycleFrequency === 'monthly') {
      payCycleDays = 30;
    } else if (payCycleFrequency === 'quarterly') {
      payCycleDays = 90;
    } else if (payCycleFrequency === 'yearly') {
      payCycleDays = 365;
    }
    
    // Outgoing should be less frequent (more days) than pay cycle for payment plan to make sense
    return customRecurrenceDays > payCycleDays;
  }
  
  // Compare the frequencies - only allow payment plans for less frequent outgoings
  return frequencyOrder[outgoingFrequency] > frequencyOrder[payCycleFrequency];
};

// Extended interface for form data that includes custom recurrence fields
interface OutgoingFormProps {
  onClose: () => void;
  initialData?: {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    recurrence: ExtendedRecurrenceType;
    recurrenceInterval?: number;
    recurrenceUnit?: 'day' | 'week' | 'month' | 'year';
    isCustomRecurrence?: boolean;
    accountId: string;
    notes?: string;
    paymentPlan?: PaymentPlan;
    isPaused?: boolean;
  };
}

const OutgoingForm: React.FC<OutgoingFormProps> = ({ onClose, initialData }) => {
  const { accounts, addOutgoing, updateOutgoing, payCycle, currency } = useAppContext();
  
  // Get the currency symbol
  const currencySymbol = getCurrencySymbol(currency);
  
  // When loading an existing outgoing, check if it has custom recurrence fields
  const isExistingCustomRecurrence = initialData?.isCustomRecurrence && 
    initialData.recurrenceInterval !== undefined && 
    initialData.recurrenceUnit !== undefined;
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    amount: initialData ? initialData.amount : '',
    dueDate: initialData?.dueDate?.split('T')[0] || new Date().toISOString().split('T')[0],
    // If the initialData has isCustomRecurrence flag, set recurrence to 'custom'
    recurrence: isExistingCustomRecurrence 
      ? 'custom' as ExtendedRecurrenceType 
      : initialData?.recurrence || 'monthly' as ExtendedRecurrenceType,
    recurrenceInterval: initialData?.recurrenceInterval || 1,
    recurrenceUnit: initialData?.recurrenceUnit || 'week' as 'day' | 'week' | 'month' | 'year',
    accountId: initialData?.accountId || accounts[0]?.id || '',
    notes: initialData?.notes || '',
    isPaused: initialData?.isPaused || false,
    paymentPlan: initialData?.paymentPlan ? {
      ...initialData.paymentPlan,
      // Ensure startDate is properly formatted for the date input (YYYY-MM-DD)
      startDate: initialData.paymentPlan.startDate?.split('T')[0] || new Date().toISOString().split('T')[0]
    } : {
      enabled: false,
      startDate: new Date().toISOString().split('T')[0],
      frequency: 'monthly' as PaymentPlan['frequency'],
      installmentAmount: undefined
    },
    _recurrenceIntervalEmpty: false,
  });

  // Check if the current outgoing frequency is eligible for payment plans
  const isPlanEligible = isEligibleForPaymentPlan(formData.recurrence, payCycle.frequency, formData.recurrenceInterval, formData.recurrenceUnit);
  
  // Only show payment plan option if eligible
  const [showPaymentPlan, setShowPaymentPlan] = useState(
    isPlanEligible && (initialData?.paymentPlan?.enabled || false)
  );
  
  // Reset payment plan when frequency changes
  useEffect(() => {
    if (!isPlanEligible && showPaymentPlan) {
      setShowPaymentPlan(false);
    }
  }, [isPlanEligible, showPaymentPlan]);

  // Calculate suggested installment amount
  const [suggestedInstallment, setSuggestedInstallment] = useState<number | null>(null);
  const [totalInstallments, setTotalInstallments] = useState<number>(0);
  
  useEffect(() => {
    if (showPaymentPlan && formData.amount && formData.dueDate && formData.paymentPlan.startDate) {
      const amount = typeof formData.amount === 'string' ? parseFloat(formData.amount) : formData.amount;
      const startDate = new Date(formData.paymentPlan.startDate);
      const dueDate = new Date(formData.dueDate);
      
      // Ensure dates are valid
      if (isNaN(startDate.getTime()) || isNaN(dueDate.getTime()) || startDate >= dueDate) {
        setSuggestedInstallment(amount);
        setTotalInstallments(1);
        return;
      }
      
      // Calculate number of installments based on frequency and dates
      let installments = 0;
      let currentDate = new Date(startDate);
      
      while (currentDate < dueDate) {
        installments++;
        if (formData.paymentPlan.frequency === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (formData.paymentPlan.frequency === 'biweekly') {
          currentDate.setDate(currentDate.getDate() + 14);
        } else if (formData.paymentPlan.frequency === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
      
      // Adjust installments based on outgoing frequency if it's custom
      // For custom recurrences, we want to ensure the payment plan makes sense
      if (formData.recurrence === 'custom' && formData.recurrenceInterval && formData.recurrenceUnit) {
        // Get the outgoing frequency in days (approximate)
        let outgoingFrequencyInDays = 30; // default to monthly
        
        if (formData.recurrenceUnit === 'day') {
          outgoingFrequencyInDays = formData.recurrenceInterval;
        } else if (formData.recurrenceUnit === 'week') {
          outgoingFrequencyInDays = formData.recurrenceInterval * 7;
        } else if (formData.recurrenceUnit === 'month') {
          outgoingFrequencyInDays = formData.recurrenceInterval * 30;
        } else if (formData.recurrenceUnit === 'year') {
          outgoingFrequencyInDays = formData.recurrenceInterval * 365;
        }
        
        // Get payment plan frequency in days (approximate)
        let paymentFrequencyInDays = 30; // default to monthly
        
        if (formData.paymentPlan.frequency === 'weekly') {
          paymentFrequencyInDays = 7;
        } else if (formData.paymentPlan.frequency === 'biweekly') {
          paymentFrequencyInDays = 14;
        } else if (formData.paymentPlan.frequency === 'monthly') {
          paymentFrequencyInDays = 30;
        }
        
        // If outgoing is more frequent than payment plan, adjust installments
        if (outgoingFrequencyInDays < paymentFrequencyInDays) {
          const ratio = Math.ceil(paymentFrequencyInDays / outgoingFrequencyInDays);
          installments = Math.max(installments, Math.ceil(installments / ratio));
        }
      }
      
      // Calculate suggested installment amount (round to 2 decimal places)
      if (installments > 0) {
        // Calculate amount per installment (round up to nearest cent)
        setSuggestedInstallment(Math.ceil((amount / installments) * 100) / 100);
        setTotalInstallments(installments);
      } else {
        // If there's no valid installment period, just set to total amount
        setSuggestedInstallment(amount);
        setTotalInstallments(1);
      }
    } else {
      setSuggestedInstallment(null);
      setTotalInstallments(0);
    }
  }, [formData.amount, formData.dueDate, formData.paymentPlan.startDate, formData.paymentPlan.frequency, formData.recurrence, formData.recurrenceInterval, formData.recurrenceUnit, showPaymentPlan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create a submission-ready data object
    const submissionData = {
      ...formData,
      // Convert amount to number during submission
      amount: typeof formData.amount === 'string' ? parseFloat(formData.amount) || 0 : formData.amount,
      dueDate: new Date(formData.dueDate).toISOString(),
      // For custom recurrence, we'll keep the actual recurrence fields
      // but mark with a flag that it's custom
      recurrence: formData.recurrence === 'custom' 
        ? (formData.recurrenceUnit === 'week' && formData.recurrenceInterval === 1 ? 'weekly' : 
           formData.recurrenceUnit === 'month' && formData.recurrenceInterval === 1 ? 'monthly' :
           formData.recurrenceUnit === 'week' && formData.recurrenceInterval === 2 ? 'biweekly' :
           formData.recurrenceUnit === 'month' && formData.recurrenceInterval === 3 ? 'quarterly' :
           formData.recurrenceUnit === 'year' && formData.recurrenceInterval === 1 ? 'yearly' : 'monthly') as RecurrenceType 
        : formData.recurrence as RecurrenceType,
      // Include the custom recurrence fields if it's a custom recurrence
      recurrenceInterval: formData.recurrence === 'custom' ? formData.recurrenceInterval : undefined,
      recurrenceUnit: formData.recurrence === 'custom' ? formData.recurrenceUnit : undefined,
      // Flag to indicate this is a custom recurrence
      isCustomRecurrence: formData.recurrence === 'custom',
      // Include the paused state
      isPaused: formData.isPaused,
      // Only include payment plan if enabled
      paymentPlan: showPaymentPlan ? {
        ...formData.paymentPlan,
        enabled: true,
        startDate: new Date(formData.paymentPlan.startDate).toISOString(),
        // Only use the custom amount if explicitly set, otherwise keep it undefined
        // The installment calculator in OutgoingsPage will handle calculating the amount if undefined
        installmentAmount: formData.paymentPlan.installmentAmount !== undefined ? 
          formData.paymentPlan.installmentAmount : undefined
      } : undefined
    };
    
    if (initialData) {
      updateOutgoing({
        ...initialData,
        ...submissionData,
      });
    } else {
      addOutgoing(submissionData);
    }
    
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Outgoing Name
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
          Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{currencySymbol}</span>
          <input
            type="number"
            id="amount"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="block w-full pl-8 pr-4 py-2 rounded-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
            min="0"
            step="0.01"
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <Input
        type="date"
        id="dueDate"
        label="Due Date"
        value={formData.dueDate}
        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
        required
      />

      <Select
        id="recurrence"
        label="Recurrence"
        value={formData.recurrence}
        onChange={(e) => {
          const newRecurrence = e.target.value as ExtendedRecurrenceType;
          // Check if the new recurrence is eligible for payment plans
          const newIsEligible = isEligibleForPaymentPlan(newRecurrence, payCycle.frequency, formData.recurrenceInterval, formData.recurrenceUnit);
          
          setFormData({ 
            ...formData, 
            recurrence: newRecurrence,
            // Reset payment plan if changing to ineligible frequency
            paymentPlan: !newIsEligible ? {
              ...formData.paymentPlan,
              enabled: false
            } : formData.paymentPlan
          });
          
          // Update payment plan visibility
          if (!newIsEligible) {
            setShowPaymentPlan(false);
          }
        }}
      >
        <option value="none">One-time</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Bi-weekly</option>
        <option value="monthly">Monthly</option>
        <option value="quarterly">Quarterly</option>
        <option value="yearly">Yearly</option>
        <option value="custom">Custom</option>
      </Select>

      {/* Custom Recurrence Options */}
      {formData.recurrence === 'custom' && (
        <div className="bg-gray-50 p-4 rounded-md space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-1/3">
              <label htmlFor="recurrenceInterval" className="block text-sm font-medium text-gray-700 mb-1">
                Every
              </label>
              <input
                type="number"
                id="recurrenceInterval"
                value={formData._recurrenceIntervalEmpty ? '' : formData.recurrenceInterval}
                onChange={(e) => {
                  const value = e.target.value;
                  // Check if the value is empty first, then convert to number or use 1 as fallback
                  if (value === '') {
                    // For temporary empty state, use 1 in the state but don't display it
                    // This keeps the state typed as a number but allows editing
                    setFormData({
                      ...formData,
                      recurrenceInterval: 1,
                      // Add a flag to track that the field is being cleared
                      _recurrenceIntervalEmpty: true
                    });
                  } else {
                    setFormData({
                      ...formData,
                      recurrenceInterval: parseInt(value) || 1,
                      _recurrenceIntervalEmpty: false
                    });
                  }
                }}
                onBlur={() => {
                  // When the user leaves the field, make sure we have a valid value
                  // Reset the empty state flag
                  if (formData._recurrenceIntervalEmpty) {
                    setFormData({
                      ...formData,
                      _recurrenceIntervalEmpty: false
                    });
                  }
                }}
                // Use the actual input's value instead of the state
                // This allows the field to appear empty while being edited
                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                min="1"
                required
              />
            </div>
            <div className="w-2/3">
              <Select
                id="recurrenceUnit"
                label="Unit"
                value={formData.recurrenceUnit}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  recurrenceUnit: e.target.value as 'day' | 'week' | 'month' | 'year'
                })}
                required
              >
                <option value="day">Day(s)</option>
                <option value="week">Week(s)</option>
                <option value="month">Month(s)</option>
                <option value="year">Year(s)</option>
              </Select>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            This will repeat every {formData._recurrenceIntervalEmpty ? '' : formData.recurrenceInterval || 1} {formData.recurrenceUnit}
            {(!formData._recurrenceIntervalEmpty && formData.recurrenceInterval !== 1) ? 's' : ''} starting from the due date.
          </p>
        </div>
      )}

      <Select
        id="account"
        label="Account"
        value={formData.accountId}
        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
        required
      >
        <option value="" disabled>Select an account</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </Select>

      <div className="mb-4">
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          Notes (Optional)
        </label>
        <textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
          rows={3}
        />
      </div>

      {/* Pause toggle switch */}
      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Pause Outgoing</h3>
          <p className="text-sm text-gray-500">Temporarily exclude from required funds calculation</p>
        </div>
        <button 
          type="button" 
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${formData.isPaused ? 'bg-indigo-600' : 'bg-gray-200'}`}
          onClick={() => setFormData({ ...formData, isPaused: !formData.isPaused })}
        >
          <span className="sr-only">Toggle paused</span>
          <span 
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.isPaused ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>

      {/* Payment Plan Section - Only show if frequency is eligible */}
      {isPlanEligible && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-medium text-gray-900">Payment Plan</h3>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enablePaymentPlan"
                checked={showPaymentPlan}
                onChange={(e) => setShowPaymentPlan(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="enablePaymentPlan" className="ml-2 block text-sm text-gray-700">
                Enable Payment Plan
              </label>
            </div>
          </div>

          {showPaymentPlan && (
            <div className="bg-gray-50 rounded-md p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Set up a payment plan to spread this expense over multiple installments.
              </p>
              
              <Input
                type="date"
                id="startDate"
                label="Start Paying From"
                value={formData.paymentPlan.startDate}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  paymentPlan: {
                    ...formData.paymentPlan,
                    startDate: e.target.value,
                    // Clear any manual amount when dates change to recalculate
                    installmentAmount: undefined
                  }
                })}
                required
              />

              <Select
                id="frequency"
                label="Payment Frequency"
                value={formData.paymentPlan.frequency}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  paymentPlan: {
                    ...formData.paymentPlan,
                    frequency: e.target.value as PaymentPlan['frequency'],
                    // Clear any manual amount when frequency changes to recalculate
                    installmentAmount: undefined
                  }
                })}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </Select>

              {/* Calculated payment plan summary */}
              {suggestedInstallment && totalInstallments > 0 && (
                <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                  <h4 className="text-sm font-medium text-blue-800 mb-1">Payment Plan Summary</h4>
                  <p className="text-sm text-blue-700">
                    {totalInstallments} {formData.paymentPlan.frequency} {totalInstallments === 1 ? 'payment' : 'payments'} of{' '}
                    <span className="font-medium">{currencySymbol}{suggestedInstallment.toFixed(2)}</span> each
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    From {new Date(formData.paymentPlan.startDate).toLocaleDateString()}&nbsp;to&nbsp;{new Date(formData.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Payment Amount (Optional)
                  </label>
                  {formData.paymentPlan.installmentAmount && (
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        paymentPlan: {
                          ...formData.paymentPlan,
                          installmentAmount: undefined
                        }
                      })}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Reset to calculated
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{currencySymbol}</span>
                  <input
                    type="number"
                    value={formData.paymentPlan.installmentAmount || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      paymentPlan: {
                        ...formData.paymentPlan,
                        installmentAmount: e.target.value ? parseFloat(e.target.value) : undefined
                      }
                    })}
                    className="block w-full pl-8 pr-4 py-2 rounded-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    min="0"
                    step="0.01"
                    placeholder={suggestedInstallment ? suggestedInstallment.toFixed(2) : "Calculated automatically"}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use the calculated amount based on dates and frequency
                </p>
                {formData.paymentPlan.installmentAmount && (
                  <p className="text-xs text-amber-600 mt-1">
                    With this amount, you'll pay {currencySymbol}{(formData.paymentPlan.installmentAmount * totalInstallments).toFixed(2)} in total ({totalInstallments} installments)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">
          {initialData ? 'Update Outgoing' : 'Create Outgoing'}
        </Button>
      </div>
    </form>
  );
};

export default OutgoingForm;