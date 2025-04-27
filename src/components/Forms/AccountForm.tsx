import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../UI/Button';

interface AccountFormProps {
  onClose: () => void;
  initialData?: {
    id: string;
    name: string;
    description?: string;
    color: string;
  };
}

const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#EF4444', // Red
  '#EC4899', // Pink
];

const AccountForm: React.FC<AccountFormProps> = ({ onClose, initialData }) => {
  const { addAccount, updateAccount } = useAppContext();
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    color: initialData?.color || COLORS[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (initialData) {
      updateAccount({
        ...initialData,
        ...formData,
      });
    } else {
      addAccount({
        name: formData.name,
        description: formData.description,
        color: formData.color,
      });
    }
    
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Account Name
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
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description (Optional)
        </label>
        <input
          type="text"
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color
        </label>
        <div className="flex gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`w-8 h-8 rounded-full ${formData.color === color ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setFormData({ ...formData, color })}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">
          {initialData ? 'Update Account' : 'Create Account'}
        </Button>
      </div>
    </form>
  );
};

export default AccountForm;