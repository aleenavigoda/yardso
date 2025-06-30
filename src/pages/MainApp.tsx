import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Hero from '../components/Hero';
import SearchForm from '../components/SearchForm';
import ExampleQueries from '../components/ExampleQueries';
import Footer from '../components/Footer';
import TimeLoggingBanner from '../components/TimeLoggingBanner';
import TimeLoggingModal from '../components/TimeLoggingModal';
import SignUpModal from '../components/SignUpModal';
import SignInModal from '../components/SignInModal';
import type { TimeLoggingData } from '../types';

interface MainAppProps {
  isAuthenticated: boolean;
  userProfile: any;
  isTimeLoggingOpen: boolean;
  setIsTimeLoggingOpen: (open: boolean) => void;
  isSignUpOpen: boolean;
  setIsSignUpOpen: (open: boolean) => void;
  isSignInOpen: boolean;
  setIsSignInOpen: (open: boolean) => void;
  pendingTimeLog?: TimeLoggingData;
  setPendingTimeLog: (data: TimeLoggingData | undefined) => void;
  onAuthSuccess: (user: any) => void;
  onSignOut: () => void;
}

const MainApp = ({
  isAuthenticated,
  userProfile,
  isTimeLoggingOpen,
  setIsTimeLoggingOpen,
  isSignUpOpen,
  setIsSignUpOpen,
  isSignInOpen,
  setIsSignInOpen,
  pendingTimeLog,
  setPendingTimeLog,
  onAuthSuccess,
  onSignOut
}: MainAppProps) => {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = React.useState('');

  const handleTimeLoggingSignUp = (timeLoggingData: TimeLoggingData) => {
    setPendingTimeLog(timeLoggingData);
    setIsTimeLoggingOpen(false);
    setIsSignUpOpen(true);
  };

  const handleTimeLoggingDirect = async (timeLoggingData: TimeLoggingData) => {
    // This would be handled by the time logging modal
    setIsTimeLoggingOpen(false);
  };

  const handleSignUpSuccess = () => {
    setIsSignUpOpen(false);
    setPendingTimeLog(undefined);
    navigate('/dashboard');
  };

  const handleSignInSuccess = () => {
    setIsSignInOpen(false);
    navigate('/dashboard');
  };

  const handleSubmitRequest = (searchParams: any) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) params.append(key, value as string);
    });
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <div className="min-h-screen w-full bg-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Header 
          isAuthenticated={isAuthenticated}
          userProfile={userProfile}
          showDashboard={false}
          showFeed={false}
          onSignUpSuccess={() => setIsSignUpOpen(true)}
          onSignInSuccess={() => setIsSignInOpen(true)}
          onDashboardClick={() => navigate('/dashboard')}
          onFeedClick={() => navigate('/feed')}
          onSignOut={onSignOut}
        />
        <main className="mt-16 md:mt-24">
          {/* Only show Hero section if not authenticated */}
          {!isAuthenticated && <Hero />}
          
          {/* Show time logging banner for both authenticated and non-authenticated users */}
          <TimeLoggingBanner onLogTime={() => setIsTimeLoggingOpen(true)} />
          
          <SearchForm
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            onSubmitRequest={handleSubmitRequest}
          />
          <ExampleQueries setSearchValue={setSearchValue} />
        </main>
        <Footer />
      </div>
      
      <TimeLoggingModal
        isOpen={isTimeLoggingOpen}
        onClose={() => setIsTimeLoggingOpen(false)}
        onSignUp={handleTimeLoggingSignUp}
        onLogTime={handleTimeLoggingDirect}
        isAuthenticated={isAuthenticated}
      />
      
      <SignUpModal
        isOpen={isSignUpOpen}
        onClose={() => setIsSignUpOpen(false)}
        timeLoggingData={pendingTimeLog}
        onSignUpSuccess={handleSignUpSuccess}
      />

      <SignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSignInSuccess={handleSignInSuccess}
      />
    </div>
  );
};

export default MainApp;