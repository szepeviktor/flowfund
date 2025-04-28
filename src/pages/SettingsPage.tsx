import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Select from '../components/UI/Select';
import Input from '../components/UI/Input';
import { formatDate } from '../utils/formatters';
import { ArrowDownToLine, ArrowUpFromLine, AlertCircle } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { 
    payCycle,
    updatePayCycle,
    currency,
    updateCurrency,
    accounts,
    outgoings,
    fundSources,
    allocations
  } = useAppContext();

  const [frequency, setFrequency] = useState(payCycle.frequency);
  const [dayOfMonth, setDayOfMonth] = useState(payCycle.dayOfMonth.toString());
  const [dayOfWeek, setDayOfWeek] = useState<number>(
    payCycle.lastPayDate 
      ? new Date(payCycle.lastPayDate).getDay() 
      : new Date().getDay()
  );
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSavePayCycle = () => {
    // Calculate a reference date for weekly/fortnightly based on selected day of week
    let lastPayDate = '';
    
    if (frequency === 'weekly' || frequency === 'biweekly') {
      const today = new Date();
      const currentDayOfWeek = today.getDay();
      const daysToSubtract = (currentDayOfWeek - dayOfWeek + 7) % 7;
      
      // Get the most recent occurrence of the selected day of week
      const referenceDateObj = new Date();
      referenceDateObj.setDate(today.getDate() - daysToSubtract);
      
      // If today is the selected day, use today
      if (daysToSubtract === 0) {
        referenceDateObj.setTime(today.getTime());
      }
      
      lastPayDate = referenceDateObj.toISOString().split('T')[0];
    }
    
    updatePayCycle({
      dayOfMonth: parseInt(dayOfMonth, 10),
      frequency,
      lastPayDate
    });
  };

  const handleSaveCurrency = () => {
    updateCurrency(selectedCurrency);
  };

  const exportData = () => {
    // Collect all app data from localStorage
    const STORAGE_KEYS = {
      ACCOUNTS: 'flowfund_accounts',
      OUTGOINGS: 'flowfund_outgoings',
      AVAILABLE_FUNDS: 'flowfund_available_funds',
      FUND_SOURCES: 'flowfund_fund_sources',
      ALLOCATIONS: 'flowfund_allocations',
      PAY_CYCLE: 'flowfund_pay_cycle',
      CURRENCY: 'currency'
    };

    const exportData = {
      accounts: JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCOUNTS) || '[]'),
      outgoings: JSON.parse(localStorage.getItem(STORAGE_KEYS.OUTGOINGS) || '[]'),
      availableFunds: JSON.parse(localStorage.getItem(STORAGE_KEYS.AVAILABLE_FUNDS) || '0'),
      fundSources: JSON.parse(localStorage.getItem(STORAGE_KEYS.FUND_SOURCES) || '[]'),
      allocations: JSON.parse(localStorage.getItem(STORAGE_KEYS.ALLOCATIONS) || '[]'),
      payCycle: JSON.parse(localStorage.getItem(STORAGE_KEYS.PAY_CYCLE) || '{"dayOfMonth":28,"frequency":"monthly"}'),
      currency: localStorage.getItem(STORAGE_KEYS.CURRENCY) || 'USD',
      exportedAt: new Date().toISOString()
    };

    // Create a JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    // Create a download link
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowfund-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    // Trigger file input click
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(false);
    
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        
        // Validate the data structure
        if (!importedData || typeof importedData !== 'object') {
          throw new Error('Invalid data format');
        }
        
        // Set all the data to localStorage
        const STORAGE_KEYS = {
          ACCOUNTS: 'flowfund_accounts',
          OUTGOINGS: 'flowfund_outgoings',
          AVAILABLE_FUNDS: 'flowfund_available_funds',
          FUND_SOURCES: 'flowfund_fund_sources',
          ALLOCATIONS: 'flowfund_allocations',
          PAY_CYCLE: 'flowfund_pay_cycle',
          CURRENCY: 'currency'
        };
        
        if (Array.isArray(importedData.accounts)) {
          localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(importedData.accounts));
        }
        
        if (Array.isArray(importedData.outgoings)) {
          localStorage.setItem(STORAGE_KEYS.OUTGOINGS, JSON.stringify(importedData.outgoings));
        }
        
        if (importedData.availableFunds !== undefined) {
          localStorage.setItem(STORAGE_KEYS.AVAILABLE_FUNDS, JSON.stringify(importedData.availableFunds));
        }
        
        if (Array.isArray(importedData.fundSources)) {
          localStorage.setItem(STORAGE_KEYS.FUND_SOURCES, JSON.stringify(importedData.fundSources));
        }
        
        if (Array.isArray(importedData.allocations)) {
          localStorage.setItem(STORAGE_KEYS.ALLOCATIONS, JSON.stringify(importedData.allocations));
        }
        
        if (importedData.payCycle) {
          localStorage.setItem(STORAGE_KEYS.PAY_CYCLE, JSON.stringify(importedData.payCycle));
        }
        
        if (importedData.currency) {
          localStorage.setItem(STORAGE_KEYS.CURRENCY, importedData.currency);
        }
        
        setImportSuccess(true);
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Add a small delay and refresh the page to load new data
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
      } catch (error) {
        console.error('Import error:', error);
        setImportError('Failed to import data. Please check your file format.');
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    
    reader.readAsText(file);
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
            id="frequency"
            label="Pay Frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as 'monthly' | 'biweekly' | 'weekly')}
          >
            <option value="monthly">Monthly</option>
            <option value="biweekly">Fortnightly</option>
            <option value="weekly">Weekly</option>
          </Select>

          {frequency === 'monthly' && (
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
          )}

          {(frequency === 'biweekly' || frequency === 'weekly') && (
            <Select
              id="dayOfWeek"
              label="Day of Week"
              value={dayOfWeek.toString()}
              onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
            >
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
            </Select>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button onClick={handleSavePayCycle}>
              Save Pay Cycle
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mb-8">
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

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Export your data to a file or import from a previously exported file.
            This includes all your accounts, outgoings, fund sources, and settings.
          </p>
          
          {importError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start mb-4">
              <AlertCircle className="text-red-500 mr-2 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-700">{importError}</p>
            </div>
          )}
          
          {importSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
              <p className="text-sm text-green-700">Data imported successfully! Reloading page...</p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row sm:gap-4 pt-2">
            <Button 
              variant="outline" 
              className="mb-2 sm:mb-0 flex items-center justify-center" 
              onClick={exportData}
            >
              <ArrowDownToLine size={16} className="mr-2" />
              Export Data
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-center justify-center" 
              onClick={handleImportClick}
            >
              <ArrowUpFromLine size={16} className="mr-2" />
              Import Data
            </Button>
            
            {/* Hidden file input for import */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".json"
              onChange={handleImportFile}
            />
          </div>
          
          <p className="text-xs text-gray-400 mt-2">
            Note: Importing data will overwrite your current settings and require a page reload.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage; 