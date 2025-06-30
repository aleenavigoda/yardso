import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import BrowseNetwork from './components/BrowseNetwork';
import Feed from './components/Feed';
import Dashboard from './components/Dashboard';
import InviteSignUpPage from './components/InviteSignUpPage';
import { supabase } from './lib/supabase';
import type { TimeLoggingData } from './types';

function AppContent() {
  // Centralized authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();
  
  // Modal states
  const [isTimeLoggingOpen, setIsTimeLoggingOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  
  // Pending data
  const [pendingTimeLog, setPendingTimeLog] = useState<TimeLoggingData | undefined>();

  const detectUrlType = (url: string): string => {
    if (url.includes('github.com')) return 'github';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('behance.net') || url.includes('dribbble.com')) return 'portfolio';
    if (url.includes('medium.com') || url.includes('substack.com')) return 'article';
    return 'website';
  };

  const createProfileFromPendingData = async (user: any) => {
    try {
      console.log('Creating profile from pending data for:', user.email);
      
      // Check for pending profile data
      const { data: pendingProfiles, error: pendingError } = await supabase
        .from('pending_profiles')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(1);

      if (pendingError) {
        console.log('Error fetching pending profiles:', pendingError.message);
      }

      let profileData = {
        user_id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || '',
        display_name: user.user_metadata?.full_name?.split(' ')[0] || '',
      };

      let urlsToAdd: any[] = [];

      if (pendingProfiles && pendingProfiles.length > 0) {
        const pending = pendingProfiles[0];
        console.log('Found pending profile:', pending.id);
        
        profileData = {
          ...profileData,
          full_name: pending.full_name || profileData.full_name,
          display_name: pending.display_name || profileData.display_name,
        };

        if (pending.urls && Array.isArray(pending.urls)) {
          urlsToAdd = pending.urls;
        }

        // Store time logging data for later use
        if (pending.time_logging_data) {
          localStorage.setItem('pendingTimeLog', JSON.stringify(pending.time_logging_data));
        }
      }

      // Check if profile already exists
      const { data: existingProfile, error: existingError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      let newProfile;
      if (existingProfile) {
        console.log('Profile already exists:', existingProfile.id);
        newProfile = existingProfile;
        
        // Update existing profile with pending data if available
        if (pendingProfiles && pendingProfiles.length > 0) {
          const pending = pendingProfiles[0];
          const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({
              full_name: pending.full_name || existingProfile.full_name,
              display_name: pending.display_name || existingProfile.display_name,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProfile.id)
            .select()
            .single();

          if (updatedProfile && !updateError) {
            newProfile = updatedProfile;
          }
        }
      } else {
        // Create the profile
        const { data: createdProfile, error: profileError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select()
          .single();

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw profileError;
        }

        console.log('Profile created:', createdProfile.id);
        newProfile = createdProfile;
      }

      // Add URLs if any
      if (urlsToAdd.length > 0) {
        const urlInserts = urlsToAdd.map((urlData: any) => ({
          profile_id: newProfile.id,
          url: urlData.url,
          url_type: urlData.type || detectUrlType(urlData.url),
        }));

        const { error: urlError } = await supabase
          .from('profile_urls')
          .insert(urlInserts);

        if (urlError) {
          console.log('URL insertion error:', urlError.message);
        } else {
          console.log('Added URLs:', urlInserts.length);
        }
      }

      // Clean up pending profile
      if (pendingProfiles && pendingProfiles.length > 0) {
        await supabase
          .from('pending_profiles')
          .delete()
          .eq('id', pendingProfiles[0].id);
        console.log('Cleaned up pending profile');
      }

      return newProfile;
    } catch (error: any) {
      console.error('Error in createProfileFromPendingData:', error);
      throw error;
    }
  };

  const handleAuthSuccess = async (user: any) => {
    try {
      console.log('Handling auth success for user:', user.id);
      
      // First, check localStorage for existing profile
      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile);
          if (profile.user_id === user.id) {
            console.log('Using cached profile from localStorage');
            setUserProfile(profile);
            setIsAuthenticated(true);
            
            // Check for pending time log data
            const pendingTimeLogData = localStorage.getItem('pendingTimeLog');
            if (pendingTimeLogData) {
              try {
                const timeLogData = JSON.parse(pendingTimeLogData);
                setPendingTimeLog(timeLogData);
              } catch (e) {
                console.error('Error parsing pending time log data:', e);
                localStorage.removeItem('pendingTimeLog');
              }
            }
            
            return; // Exit early with cached data
          }
        } catch (e) {
          console.error('Error parsing stored profile:', e);
          localStorage.removeItem('userProfile');
        }
      }

      // If no cached profile, fetch from database
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      let profile = existingProfile;

      if (!existingProfile && profileError?.code === 'PGRST116') {
        console.log('No existing profile found, creating new one');
        try {
          profile = await createProfileFromPendingData(user);
        } catch (error) {
          console.error('Failed to create profile, using basic user data:', error);
          // Create a minimal profile object from user data
          profile = {
            id: user.id,
            user_id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || '',
            display_name: user.user_metadata?.full_name?.split(' ')[0] || 'User',
            time_balance_hours: 0
          };
        }
      } else if (profileError) {
        console.error('Profile fetch error:', profileError);
        // Create basic profile as fallback
        profile = {
          id: user.id,
          user_id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          display_name: user.user_metadata?.full_name?.split(' ')[0] || 'User',
          time_balance_hours: 0
        };
      } else {
        console.log('Using existing profile:', existingProfile.id);
      }

      // Cache the profile and set state
      localStorage.setItem('userProfile', JSON.stringify(profile));
      setUserProfile(profile);
      setIsAuthenticated(true);
      
      // Check for pending time log data
      const pendingTimeLogData = localStorage.getItem('pendingTimeLog');
      if (pendingTimeLogData) {
        try {
          const timeLogData = JSON.parse(pendingTimeLogData);
          setPendingTimeLog(timeLogData);
        } catch (e) {
          console.error('Error parsing pending time log data:', e);
          localStorage.removeItem('pendingTimeLog');
        }
      }
      
      console.log('Auth success completed successfully');
    } catch (error: any) {
      console.error('Error in handleAuthSuccess:', error);
      // Don't prevent sign-in for profile errors - create minimal profile
      const basicProfile = {
        id: user.id,
        user_id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || '',
        display_name: user.user_metadata?.full_name?.split(' ')[0] || 'User',
        time_balance_hours: 0
      };
      localStorage.setItem('userProfile', JSON.stringify(basicProfile));
      setUserProfile(basicProfile);
      setIsAuthenticated(true);
    }
  };

  const clearAuthState = () => {
    localStorage.removeItem('userProfile');
    localStorage.removeItem('pendingTimeLog');
    setPendingTimeLog(undefined);
    setIsAuthenticated(false);
    setUserProfile(null);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error: any) {
      // Check if this is the expected "session not found" error
      if (error?.message?.includes('Session from session_id claim in JWT does not exist')) {
        console.warn('Attempted to sign out with invalid session - this is expected behavior');
      } else {
        console.error('Error signing out:', error);
      }
      // Continue with clearing state even if signOut fails
    } finally {
      // Always clear auth state regardless of server response
      clearAuthState();
      // Navigate to home using React Router
      navigate('/');
    }
  };

  const handleSignInSuccess = () => {
    // Close modal immediately
    setIsSignInOpen(false);
    // Navigate to dashboard using React Router
    navigate('/dashboard');
  };

  const handleSignUpSuccess = () => {
    setIsSignUpOpen(false);
    setPendingTimeLog(undefined);
    navigate('/dashboard');
  };

  // Simplified auth initialization with shorter timeout and better error handling
  useEffect(() => {
    let isMounted = true;
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (!isMounted) return;
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('Handling auth success for user:', session.user.id);
          await handleAuthSuccess(session.user);
        } else if (event === 'SIGNED_OUT') {
          clearAuthState();
        }
      }
    );

    const initAuth = async () => {
      console.log('Starting auth initialization...');
      
      try {
        // Reduced timeout to 5 seconds to prevent long loading
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );
        
        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        if (!isMounted) return;
        
        // Handle the specific JWT session error
        if (error && error.message?.includes('Session from session_id claim in JWT does not exist')) {
          console.log('Invalid JWT session detected, clearing auth state');
          clearAuthState();
          setIsInitializing(false);
          return;
        }
        
        if (error) {
          console.error('Auth session error:', error);
          clearAuthState();
          setIsInitializing(false);
          return;
        }
        
        if (session?.user) {
          console.log('Initial session found for user:', session.user.id);
          await handleAuthSuccess(session.user);
        } else {
          clearAuthState();
        }
        
        setIsInitializing(false);
        
      } catch (error: any) {
        console.error('Auth initialization error:', error);
        if (isMounted) {
          clearAuthState();
          setIsInitializing(false);
        }
      }
    };

    // Start initialization
    initAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Show loading screen during initialization
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
    <Routes>
      <Route path="/invite/:token" element={<InviteSignUpPage />} />
      <Route 
        path="/" 
        element={
          <LandingPage 
            isAuthenticated={isAuthenticated}
            userProfile={userProfile}
            isTimeLoggingOpen={isTimeLoggingOpen}
            setIsTimeLoggingOpen={setIsTimeLoggingOpen}
            isSignUpOpen={isSignUpOpen}
            setIsSignUpOpen={setIsSignUpOpen}
            isSignInOpen={isSignInOpen}
            setIsSignInOpen={setIsSignInOpen}
            pendingTimeLog={pendingTimeLog}
            setPendingTimeLog={setPendingTimeLog}
            onAuthSuccess={handleAuthSuccess}
            onSignOut={handleSignOut}
            onSignInSuccess={handleSignInSuccess}
            onSignUpSuccess={handleSignUpSuccess}
          />
        } 
      />
      <Route 
        path="/browse" 
        element={
          <BrowseNetwork 
            onBack={() => navigate('/')}
            onFeedClick={() => navigate('/feed')}
            onDashboardClick={() => navigate('/dashboard')}
            onSignOut={handleSignOut}
            isAuthenticated={isAuthenticated}
            onPromptSignIn={() => setIsSignInOpen(true)}
          />
        } 
      />
      <Route 
        path="/feed" 
        element={
          <Feed 
            onBack={() => navigate('/')} 
            onDashboardClick={() => navigate('/dashboard')}
            onSignOut={handleSignOut}
          />
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <Dashboard 
            onBack={() => navigate('/')} 
            onFeedClick={() => navigate('/feed')}
            onBrowseNetworkClick={() => navigate('/browse')}
          />
        } 
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;