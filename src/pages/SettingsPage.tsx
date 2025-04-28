import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import { formatDate } from '../utils/formatters';

const SettingsPage: React.FC = () => {
  const { 
    payCycle,
    updatePayCycle,
    currency,
    updateCurrency
  } = useAppContext();

  const [dayOfMonth, setDayOfMonth] = useState(payCycle.dayOfMonth.toString());
  const [frequency, setFrequency] = useState(payCycle.frequency);
  const [lastPayDate, setLastPayDate] = useState(payCycle.lastPayDate || new Date().toISOString().split('T')[0]);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);

  const handleSavePayCycle = () => {
    updatePayCycle({
      dayOfMonth: parseInt(dayOfMonth, 10),
      frequency,
      lastPayDate
    });
  };

  const handleSaveCurrency = () => {
    updateCurrency(selectedCurrency);
  };

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-2">
          Configure your pay cycle and currency preferences
        </p>
      </div>

      <Card className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pay Cycle</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Day of Month
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'monthly' | 'biweekly')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="biweekly">Bi-weekly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Pay Date
            </label>
            <input
              type="date"
              value={lastPayDate}
              onChange={(e) => setLastPayDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <Button onClick={handleSavePayCycle}>
            Save Pay Cycle
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Currency</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD ($)</option>
              <option value="AUD">AUD ($)</option>
              <option value="NZD">NZD ($)</option>
            </select>
          </div>

          <Button onClick={handleSaveCurrency}>
            Save Currency
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage; 