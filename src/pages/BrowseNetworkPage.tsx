import React from 'react';
import BrowseNetwork from '../components/BrowseNetwork';

interface BrowseNetworkPageProps {
  isAuthenticated: boolean;
  onSignOut: () => void;
  onPromptSignIn: () => void;
}

const BrowseNetworkPage = ({ isAuthenticated, onSignOut, onPromptSignIn }: BrowseNetworkPageProps) => {
  const handleBack = () => {
    window.location.href = '/';
  };

  const handleFeedClick = () => {
    if (isAuthenticated) {
      window.location.href = '/feed';
    } else {
      onPromptSignIn();
    }
  };

  const handleDashboardClick = () => {
    if (isAuthenticated) {
      window.location.href = '/dashboard';
    } else {
      onPromptSignIn();
    }
  };

  return (
    <BrowseNetwork
      onBack={handleBack}
      onFeedClick={handleFeedClick}
      onDashboardClick={handleDashboardClick}
      onSignOut={onSignOut}
      isAuthenticated={isAuthenticated}
      onPromptSignIn={onPromptSignIn}
    />
  );
};

export default BrowseNetworkPage;