import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import SearchForm from './components/SearchForm';
import ExampleQueries from './components/ExampleQueries';
import Footer from './components/Footer';
import TimeLoggingBanner from './components/TimeLoggingBanner';
import TimeLoggingModal from './components/TimeLoggingModal';
import SignUpModal from './components/SignUpModal';
import Dashboard from './components/Dashboard';
import { supabase } from './lib/supabase';
import type { TimeLoggingData } from './types';

function App() {
  const [searchValue, setSearchValue] = useState('');
  const [isTimeLoggingOpen, setIsTimeLoggingOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [pendingTimeLog, setPendingTimeLog] = useState<TimeLoggingData | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Clear authentication state and localStorage
  const clearAuthState = () => {
    localStorage.removeItem('userProfile');
    localStorage.removeItem('pendingTimeLog');
    setShowDashboard(false);
    setPendingTimeLog(undefined);
    setAuthError(null);
    setIsAuthenticated(false);
    setUserProfile(null);
  };

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

      // Create the profile
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }

      console.log('Profile created:', newProfile.id);

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
      
      // Check if profile exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
        throw profileError;
      }

      let profile = existingProfile;

      if (!existingProfile) {
        console.log('No existing profile found, creating new one');
        profile = await createProfileFromPendingData(user);
      } else {
        console.log('Using existing profile:', existingProfile.id);
      }

      localStorage.setItem('userProfile', JSON.stringify(profile));
      setUserProfile(profile);
      setIsAuthenticated(true);
      setShowDashboard(true);
      setAuthError(null);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Error in handleAuthSuccess:', error);
      setAuthError(`Failed to set up your profile: ${error.message}`);
      clearAuthState();
      setIsLoading(false);
    }
  };

  // Handle email confirmation and auth state changes
  useEffect(() => {
    const handleAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // Check for email confirmation tokens in URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          console.log('Auth error from URL:', error, errorDescription);
          setAuthError(errorDescription || 'Authentication failed');
          setIsLoading(false);
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        if (accessToken && refreshToken) {
          console.log('Found auth tokens in URL, setting session...');
          // Set the session from the URL tokens
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (sessionError) {
            console.error('Session error:', sessionError);
            setAuthError('Failed to confirm your email. Please try signing in.');
            setIsLoading(false);
          } else if (data.user) {
            console.log('Session set successfully');
            await handleAuthSuccess(data.user);
          } else {
            console.log('No user data after setting session');
            setAuthError('Authentication failed - no user data');
            setIsLoading(false);
          }
          
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // Check for existing session on app load
        console.log('Checking for existing session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setAuthError('Session error occurred');
          clearAuthState();
          setIsLoading(false);
          return;
        }
        
        if (session) {
          console.log('Found existing session');
          // Also check if we have profile in localStorage
          const storedProfile = localStorage.getItem('userProfile');
          if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            setUserProfile(profile);
            setIsAuthenticated(true);
            setIsLoading(false);
          } else {
            await handleAuthSuccess(session.user);
          }
        } else {
          console.log('No existing session found');
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('Auth initialization error:', error);
        setAuthError(`Failed to initialize authentication: ${error.message}`);
        clearAuthState();
        setIsLoading(false);
      }
    };

    handleAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id || 'no user');
      
      if (event === 'SIGNED_IN' && session) {
        await handleAuthSuccess(session.user);
      } else if (event === 'SIGNED_OUT') {
        clearAuthState();
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleTimeLoggingSignUp = (timeLoggingData: TimeLoggingData) => {
    setPendingTimeLog(timeLoggingData);
    setIsTimeLoggingOpen(false);
    setIsSignUpOpen(true);
  };

  const handleTimeLoggingDirect = async (timeLoggingData: TimeLoggingData) => {
    if (!userProfile) return;

    try {
      const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      // Check if the contact is an existing user
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, email, full_name')
        .eq('email', timeLoggingData.contact)
        .single();

      if (existingProfile) {
        // User exists - create direct time transaction
        const { error: transactionError } = await supabase
          .from('time_transactions')
          .insert({
            giver_id: timeLoggingData.mode === 'helped' ? userProfile.id : existingProfile.id,
            receiver_id: timeLoggingData.mode === 'helped' ? existingProfile.id : userProfile.id,
            hours: timeLoggingData.hours,
            description: timeLoggingData.description,
            logged_by: userProfile.id,
            status: 'pending'
          });

        if (transactionError) throw transactionError;

        alert('Time logged successfully! The other person will be notified to confirm.');
      } else {
        // User doesn't exist - create invitation and pending time log
        const { data: invitationData, error: invitationError } = await supabase
          .rpc('create_invitation_with_time_log', {
            p_inviter_profile_id: userProfile.id,
            p_invitee_email: isValidEmail(timeLoggingData.contact) ? timeLoggingData.contact : '',
            p_invitee_name: timeLoggingData.name,
            p_invitee_contact: timeLoggingData.contact,
            p_hours: timeLoggingData.hours,
            p_description: timeLoggingData.description,
            p_service_type: 'general',
            p_mode: timeLoggingData.mode
          });

        if (invitationError) throw invitationError;

        alert(`Invitation sent to ${timeLoggingData.name}! They'll receive an email to join Yard and confirm the time log.`);
      }

      setIsTimeLoggingOpen(false);
    } catch (error) {
      console.error('Error logging time:', error);
      alert('Error logging time. Please try again.');
    }
  };

  const handleSignUpSuccess = () => {
    setIsSignUpOpen(false);
    setPendingTimeLog(undefined);
    setShowDashboard(true);
  };

  const handleSignUpClose = () => {
    setIsSignUpOpen(false);
  };

  const handleBackToHome = () => {
    setShowDashboard(false);
  };

  const handleHeaderSignUpSuccess = () => {
    setShowDashboard(true);
  };

  const handleHeaderSignInSuccess = () => {
    setShowDashboard(true);
  };

  const handleDashboardClick = () => {
    setShowDashboard(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearAuthState();
  };

  const handleRetry = () => {
    setAuthError(null);
    setIsLoading(true);
    window.location.reload();
  };

  const handleSkipAuth = () => {
    setAuthError(null);
    clearAuthState();
    setIsLoading(false);
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-amber-200 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-2xl font-bold text-black italic mb-2">yard</div>
          <div className="text-gray-700 mb-4">Loading...</div>
          
          <button
            onClick={handleSkipAuth}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Skip Authentication
          </button>
        </div>
      </div>
    );
  }

  // Show error state if auth failed
  if (authError) {
    return (
      <div className="min-h-screen w-full bg-amber-200 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-2xl font-bold text-black italic mb-4">yard</div>
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Authentication Error</h2>
            <p className="text-gray-600 text-sm mb-4">{authError}</p>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleSkipAuth}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Continue as Guest
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show dashboard if user is authenticated and wants to see it
  if (showDashboard && isAuthenticated) {
    return <Dashboard onBack={handleBackToHome} />;
  }

  return (
    <div className="min-h-screen w-full bg-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Header 
          isAuthenticated={isAuthenticated}
          userProfile={userProfile}
          showDashboard={showDashboard}
          onSignUpSuccess={handleHeaderSignUpSuccess}
          onSignInSuccess={handleHeaderSignInSuccess}
          onDashboardClick={handleDashboardClick}
          onSignOut={handleSignOut}
        />
        <main className="mt-16 md:mt-24">
          {/* Only show Hero section if not authenticated */}
          {!isAuthenticated && <Hero />}
          
          {/* Show time logging banner for both authenticated and non-authenticated users */}
          <TimeLoggingBanner onLogTime={() => setIsTimeLoggingOpen(true)} />
          
          <SearchForm
            searchValue={searchValue}
            setSearchValue={setSearchValue}
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
        onClose={handleSignUpClose}
        timeLoggingData={pendingTimeLog}
        onSignUpSuccess={handleSignUpSuccess}
      />
    </div>
  );
}

export default App;