import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import OutgoingForm from '../components/Forms/OutgoingForm';
import Badge from '../components/UI/Badge';
import { Calendar, Plus } from 'lucide-react';
import { formatCurrency, formatDate, getRelativeDateDescription, getNextOccurrence } from '../utils/formatters';

const OutgoingsPage: React.FC = () => {
  const { outgoings, getAccountById } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutgoing, setEditingOutgoing] = useState<typeof outgoings[0] | undefined>();

  const handleEdit = (outgoing: typeof outgoings[0]) => {
    setEditingOutgoing(outgoing);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setEditingOutgoing(undefined);
    setIsModalOpen(false);
  };

  // Get the next payment date for each outgoing
  const nextPayments = outgoings.map(outgoing => ({
    ...outgoing,
    nextDate: getNextOccurrence(new Date(outgoing.dueDate), outgoing.recurrence)
  }));

  // Sort by next payment date
  const sortedPayments = nextPayments.sort((a, b) => 
    a.nextDate.getTime() - b.nextDate.getTime()
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outgoings</h1>
          <p className="text-gray-500 mt-1">Manage your upcoming payments</p>
        </div>
        <Button 
          icon={<Plus size={18} />}
          onClick={() => setIsModalOpen(true)}
        >
          New Outgoing
        </Button>
      </div>

      <div className="grid gap-4">
        {sortedPayments.map((outgoing) => {
          const account = getAccountById(outgoing.accountId);
          
          return (
            <Card 
              key={outgoing.id}
              className="hover:border-indigo-100 transition-colors"
              onClick={() => handleEdit(outgoing)}
            >
              <div className="flex items-center">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mr-4"
                  style={{ backgroundColor: account?.color + '20' }}
                >
                  <Calendar size={24} style={{ color: account?.color }} />
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{outgoing.name}</h3>
                    <Badge 
                      variant={outgoing.recurrence === 'none' ? 'info' : 'primary'}
                    >
                      {outgoing.recurrence === 'none' ? 'One-time' : 'Recurring'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {account?.name} • {getRelativeDateDescription(outgoing.dueDate, outgoing.recurrence)}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(outgoing.amount)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Next due {formatDate(outgoing.nextDate.toISOString())}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

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
    </div>
  );
};

export default OutgoingsPage;