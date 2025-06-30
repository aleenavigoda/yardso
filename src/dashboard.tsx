import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './components/Dashboard';
import './index.css';

function DashboardPage() {
  return (
    <Dashboard 
      onBack={() => window.location.href = '/'}
      onFeedClick={() => window.location.href = '/feed.html'}
      onBrowseNetworkClick={() => window.location.href = '/browse.html'}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DashboardPage />
  </StrictMode>
);