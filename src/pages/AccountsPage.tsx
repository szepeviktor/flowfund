import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import AccountForm from '../components/Forms/AccountForm';
import { PiggyBank, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

const AccountsPage: React.FC = () => {
  const { accounts, getOutgoingsForAccount, deleteAccount } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<typeof accounts[0] | undefined>();

  const handleEdit = (account: typeof accounts[0]) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setEditingAccount(undefined);
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 mt-1">Manage your payment accounts</p>
        </div>
        <Button 
          variant="primary"
          size="sm"
          icon={<Plus size={16} />}
          onClick={() => setIsModalOpen(true)}
        >
          New Account
        </Button>
      </div>

      <div className="grid gap-3 mb-8">
        {accounts.map((account) => {
          const outgoings = getOutgoingsForAccount(account.id);
          const totalOutgoings = outgoings.reduce((sum, outgoing) => sum + outgoing.amount, 0);
          const hasOutgoings = outgoings.length > 0;
          
          return (
            <Card 
              key={account.id}
              className="hover:border-indigo-100 transition-colors py-3"
              onClick={() => handleEdit(account)}
            >
              <div className="flex items-center">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                  style={{ backgroundColor: account.color + '20' }}
                >
                  <PiggyBank size={20} style={{ color: account.color }} />
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    <h3 className="text-md font-medium text-gray-900">{account.name}</h3>
                  </div>
                  {account.description && (
                    <p className="text-xs text-gray-500">{account.description}</p>
                  )}
                </div>
                
                <div className="flex items-center">
                  <div className="text-right mr-4">
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(totalOutgoings)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {outgoings.length} outgoing{outgoings.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button 
                    className={`p-2 rounded-full transition-colors ${
                      hasOutgoings 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!hasOutgoings) {
                        deleteAccount(account.id);
                      }
                    }}
                    disabled={hasOutgoings}
                    aria-label={hasOutgoings ? "Cannot delete account with outgoings" : "Delete account"}
                    title={hasOutgoings ? "Cannot delete account with outgoings" : "Delete account"}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
        
        {accounts.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No accounts found</p>
            <p className="text-sm text-gray-400 mt-1">Click "New Account" to add one</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleClose}
        title={editingAccount ? 'Edit Account' : 'New Account'}
      >
        <AccountForm
          onClose={handleClose}
          initialData={editingAccount}
        />
      </Modal>
    </div>
  );
};

export default AccountsPage;