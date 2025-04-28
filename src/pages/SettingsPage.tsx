import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Select from '../components/UI/Select';
import Input from '../components/UI/Input';
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Configure your pay cycle and currency preferences</p>
        </div>
      </div>

      <Card className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pay Cycle</h2>
        <div className="space-y-4">
          <Select
            id="dayOfMonth"
            label="Day of Month"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </Select>

          <Select
            id="frequency"
            label="Frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as 'monthly' | 'biweekly' | 'weekly')}
          >
            <option value="monthly">Monthly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="weekly">Weekly</option>
          </Select>

          {(frequency === 'biweekly' || frequency === 'weekly') && (
            <Input
              type="date"
              id="lastPayDate"
              label="Last Pay Date"
              value={lastPayDate}
              onChange={(e) => setLastPayDate(e.target.value)}
              required
            />
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button onClick={handleSavePayCycle}>
              Save Pay Cycle
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Currency</h2>
        <div className="space-y-4">
          <Select
            id="currency"
            label="Currency"
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CAD">CAD ($)</option>
            <option value="AUD">AUD ($)</option>
            <option value="NZD">NZD ($)</option>
          </Select>

          <div className="flex justify-end space-x-2 pt-4">
            <Button onClick={handleSaveCurrency}>
              Save Currency
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage; 