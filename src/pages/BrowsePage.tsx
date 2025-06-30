import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import BrowseNetwork from '../components/BrowseNetwork';

const BrowsePage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth session error:', error);
      }
      
      setIsAuthenticated(!!session?.user);
      setIsInitializing(false);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setIsInitializing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.href = '/';
    }
  };

  const handlePromptSignIn = () => {
    window.location.href = '/?signin=true';
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
    <BrowseNetwork 
      onBack={() => window.location.href = '/'}
      onFeedClick={() => window.location.href = '/feed'}
      onDashboardClick={() => window.location.href = '/dashboard'}
      onSignOut={handleSignOut}
      isAuthenticated={isAuthenticated}
      onPromptSignIn={handlePromptSignIn}
    />
  );
};

export default BrowsePage;