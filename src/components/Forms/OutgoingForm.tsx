import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../UI/Button';
import Select from '../UI/Select';
import Input from '../UI/Input';
import { RecurrenceType } from '../../types';

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
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submissionData = {
      ...formData,
      // Convert amount to number during submission
      amount: typeof formData.amount === 'string' ? parseFloat(formData.amount) || 0 : formData.amount,
      dueDate: new Date(formData.dueDate).toISOString(),
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