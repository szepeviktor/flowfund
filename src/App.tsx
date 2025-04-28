import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import MainLayout from './components/Layout/MainLayout';
import AccountsPage from './pages/AccountsPage';
import OutgoingsPage from './pages/OutgoingsPage';
import AllocationPage from './pages/AllocationPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<AllocationPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="outgoings" element={<OutgoingsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;