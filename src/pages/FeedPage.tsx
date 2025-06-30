import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Feed from '../components/Feed';

const FeedPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session?.user) {
        window.location.href = '/';
        return;
      }
      
      setIsAuthenticated(true);
      setIsInitializing(false);
    } catch (error) {
      console.error('Auth check error:', error);
      window.location.href = '/';
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
    <Feed 
      onBack={() => window.location.href = '/'} 
      onDashboardClick={() => window.location.href = '/dashboard'}
      onSignOut={handleSignOut}
    />
  );
};

export default FeedPage;