import React from 'react';
import FundingSummary from '../components/Dashboard/FundingSummary';
import UpcomingOutgoings from '../components/Dashboard/UpcomingOutgoings';
import AccountsOverview from '../components/Dashboard/AccountsOverview';

const Dashboard: React.FC = () => {
  return (
    <div>
      <FundingSummary />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingOutgoings />
        <AccountsOverview />
      </div>
    </div>
  );
};

export default Dashboard