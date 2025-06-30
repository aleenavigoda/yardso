import React from 'react';
import { useNavigate } from 'react-router-dom';
import BrowseNetwork from '../components/BrowseNetwork';

interface BrowseNetworkPageProps {
  isAuthenticated: boolean;
  onSignOut: () => void;
  onPromptSignIn: () => void;
}

const BrowseNetworkPage = ({ isAuthenticated, onSignOut, onPromptSignIn }: BrowseNetworkPageProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
  };

  const handleFeedClick = () => {
    if (isAuthenticated) {
      navigate('/feed');
    } else {
      onPromptSignIn();
    }
  };

  const handleDashboardClick = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
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