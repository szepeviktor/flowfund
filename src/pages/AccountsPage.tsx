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
          icon={<Plus size={18} />}
          onClick={() => setIsModalOpen(true)}
        >
          New Account
        </Button>
      </div>

      <div className="grid gap-6 mb-8">
        {accounts.map((account) => {
          const outgoings = getOutgoingsForAccount(account.id);
          const totalOutgoings = outgoings.reduce((sum, outgoing) => sum + outgoing.amount, 0);
          
          return (
            <Card 
              key={account.id}
              className="hover:border-indigo-100 transition-colors"
            >
              <div className="flex items-start">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mr-4"
                  style={{ backgroundColor: account.color + '20' }}
                >
                  <PiggyBank size={24} style={{ color: account.color }} />
                </div>
                
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                  {account.description && (
                    <p className="text-sm text-gray-500 mt-1">{account.description}</p>
                  )}
                  
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">Total Outgoings</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(totalOutgoings)}
                      </p>
                      <p className="text-sm text-gray-500">
                        ({outgoings.length} outgoing{outgoings.length !== 1 ? 's' : ''})
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(account)}
                  >
                    Edit
                  </Button>
                  {outgoings.length === 0 && (
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => deleteAccount(account.id)}
                      icon={<Trash2 size={16} />}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
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