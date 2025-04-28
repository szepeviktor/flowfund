import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../UI/Button';
import Select from '../UI/Select';
import Input from '../UI/Input';
import { RecurrenceType, PaymentPlan } from '../../types';

interface OutgoingFormProps {
  onClose: () => void;
  initialData?: {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    recurrence: RecurrenceType;
    accountId: string;
    notes?: string;
    paymentPlan?: PaymentPlan;
  };
}

const OutgoingForm: React.FC<OutgoingFormProps> = ({ onClose, initialData }) => {
  const { accounts, addOutgoing, updateOutgoing } = useAppContext();
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    amount: initialData ? initialData.amount : '',
    dueDate: initialData?.dueDate?.split('T')[0] || new Date().toISOString().split('T')[0],
    recurrence: initialData?.recurrence || 'monthly' as RecurrenceType,
    accountId: initialData?.accountId || accounts[0]?.id || '',
    notes: initialData?.notes || '',
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
  });

  const [showPaymentPlan, setShowPaymentPlan] = useState(initialData?.paymentPlan?.enabled || false);

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
  }, [formData.amount, formData.dueDate, formData.paymentPlan.startDate, formData.paymentPlan.frequency, showPaymentPlan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submissionData = {
      ...formData,
      // Convert amount to number during submission
      amount: typeof formData.amount === 'string' ? parseFloat(formData.amount) || 0 : formData.amount,
      dueDate: new Date(formData.dueDate).toISOString(),
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
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
        onChange={(e) => setFormData({ ...formData, recurrence: e.target.value as RecurrenceType })}
      >
        <option value="none">One-time</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Bi-weekly</option>
        <option value="monthly">Monthly</option>
        <option value="quarterly">Quarterly</option>
        <option value="yearly">Yearly</option>
      </Select>

      <Select
        id="accountId"
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

      <div>
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

      {/* Payment Plan Section */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-4">
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
          <div className="space-y-4 pl-2 border-l-2 border-indigo-100">
            <p className="text-sm text-gray-500">
              Set up a payment plan to save for this expense over time.
            </p>
            
            <Input
              type="date"
              id="startDate"
              label="Start Saving From"
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
              label="Saving Frequency"
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
                  <span className="font-medium">${suggestedInstallment.toFixed(2)}</span> each
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  From {new Date(formData.paymentPlan.startDate).toLocaleDateString()}&nbsp;to&nbsp;{new Date(formData.dueDate).toLocaleDateString()}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Installment Amount (Optional)
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
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
                  With this amount, you'll save ${(formData.paymentPlan.installmentAmount * totalInstallments).toFixed(2)} in total ({totalInstallments} installments)
                </p>
              )}
            </div>
          </div>
        )}
      </div>

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