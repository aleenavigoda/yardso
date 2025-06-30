import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import SearchForm from '../components/SearchForm';
import ExampleQueries from '../components/ExampleQueries';
import Footer from '../components/Footer';
import TimeLoggingBanner from '../components/TimeLoggingBanner';
import TimeLoggingModal from '../components/TimeLoggingModal';
import SignUpModal from '../components/SignUpModal';
import SignInModal from '../components/SignInModal';
import { supabase } from '../lib/supabase';
import type { TimeLoggingData } from '../types';

const LandingPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isTimeLoggingOpen, setIsTimeLoggingOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [pendingTimeLog, setPendingTimeLog] = useState<TimeLoggingData | undefined>();
  const [searchValue, setSearchValue] = useState('');

  // Check URL parameters for auto-opening modals
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signin') === 'true') {
      setIsSignInOpen(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth session error:', error);
        setIsInitializing(false);
        return;
      }
      
      if (session?.user) {
        await handleAuthSuccess(session.user);
      }
      
      setIsInitializing(false);
    } catch (error) {
      console.error('Auth initialization error:', error);
      setIsInitializing(false);
    }
  };

  const handleAuthSuccess = async (user: any) => {
    try {
      // Get or create profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error handling auth success:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      setUserProfile(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleTimeLoggingSignUp = (timeLoggingData: TimeLoggingData) => {
    setPendingTimeLog(timeLoggingData);
    setIsTimeLoggingOpen(false);
    setIsSignUpOpen(true);
  };

  const handleSignUpSuccess = () => {
    setIsSignUpOpen(false);
    setPendingTimeLog(undefined);
    window.location.href = '/dashboard';
  };

  const handleSignInSuccess = () => {
    setIsSignInOpen(false);
    window.location.href = '/dashboard';
  };

  const handleSubmitRequest = (searchParams: any) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) params.append(key, value as string);
    });
    window.location.href = `/browse?${params.toString()}`;
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen w-full bg-amber-200 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-black italic mb-4">yard</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
          <div className="text-sm text-gray-600 mt-4">Loading your workyard...</div>
        </div>
      </div>
    );
  }

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
          onDashboardClick={() => window.location.href = '/dashboard'}
          onFeedClick={() => window.location.href = '/feed'}
          onSignOut={handleSignOut}
        />
        <main className="mt-16 md:mt-24">
          {!isAuthenticated && <Hero />}
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

export default LandingPage;