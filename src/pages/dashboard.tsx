import React from 'react';
import Dashboard from '../components/Dashboard';

function DashboardPage() {
  return (
    <Dashboard 
      onBack={() => window.location.href = '/'}
      onFeedClick={() => window.location.href = '/feed.html'}
      onBrowseNetworkClick={() => window.location.href = '/browse.html'}
    />
  );
}

export default DashboardPage;