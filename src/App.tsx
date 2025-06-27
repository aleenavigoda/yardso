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
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (info: string) => {
    console.log('DEBUG:', info);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`]);
  };

  // Clear authentication state and localStorage
  const clearAuthState = () => {
    localStorage.removeItem('userProfile');
    localStorage.removeItem('pendingTimeLog');
    setShowDashboard(false);
    setPendingTimeLog(undefined);
    setAuthError(null);
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
      addDebugInfo('Attempting to create profile from pending data');
      
      // Check for pending profile data
      const { data: pendingProfiles, error: pendingError } = await supabase
        .from('pending_profiles')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(1);

      if (pendingError) {
        addDebugInfo(`Error fetching pending profiles: ${pendingError.message}`);
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
        addDebugInfo(`Found pending profile: ${pending.id}`);
        
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
      } else {
        addDebugInfo('No pending profile found, using auth metadata');
      }

      // Create the profile
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      if (profileError) {
        addDebugInfo(`Profile creation error: ${profileError.message}`);
        throw profileError;
      }

      addDebugInfo(`Profile created: ${newProfile.id}`);

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
          addDebugInfo(`URL insertion error: ${urlError.message}`);
        } else {
          addDebugInfo(`Added ${urlInserts.length} URLs`);
        }
      }

      // Clean up pending profile
      if (pendingProfiles && pendingProfiles.length > 0) {
        await supabase
          .from('pending_profiles')
          .delete()
          .eq('id', pendingProfiles[0].id);
        addDebugInfo('Cleaned up pending profile');
      }

      return newProfile;
    } catch (error: any) {
      addDebugInfo(`Error in createProfileFromPendingData: ${error.message}`);
      throw error;
    }
  };

  const handleAuthSuccess = async (user: any) => {
    try {
      addDebugInfo(`Handling auth success for user: ${user.id}`);
      
      // Check if profile exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        addDebugInfo(`Profile fetch error: ${profileError.message}`);
        throw profileError;
      }

      let profile = existingProfile;

      if (!existingProfile) {
        addDebugInfo('No existing profile found, creating new one');
        profile = await createProfileFromPendingData(user);
      } else {
        addDebugInfo('Using existing profile');
      }

      addDebugInfo('Profile ready, setting up dashboard');
      localStorage.setItem('userProfile', JSON.stringify(profile));
      setShowDashboard(true);
      setAuthError(null);
      setIsLoading(false);
    } catch (error: any) {
      addDebugInfo(`Error in handleAuthSuccess: ${error.message}`);
      setAuthError(`Failed to set up your profile: ${error.message}`);
      clearAuthState();
      setIsLoading(false);
    }
  };

  // Create a timeout promise
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  };

  // Handle email confirmation and auth state changes
  useEffect(() => {
    const handleAuth = async () => {
      try {
        addDebugInfo('Initializing auth...');
        
        // First, check for email confirmation tokens in URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          addDebugInfo(`Auth error from URL: ${error} - ${errorDescription}`);
          setAuthError(errorDescription || 'Authentication failed');
          setIsLoading(false);
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        if (accessToken && refreshToken) {
          addDebugInfo('Found auth tokens in URL, setting session...');
          // Set the session from the URL tokens with timeout
          const sessionPromise = supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          const { data, error: sessionError } = await withTimeout(sessionPromise, 10000);
          
          if (sessionError) {
            addDebugInfo(`Error setting session: ${sessionError.message}`);
            setAuthError('Failed to confirm your email. Please try signing in.');
            setIsLoading(false);
          } else if (data.user) {
            addDebugInfo('Session set successfully');
            await handleAuthSuccess(data.user);
          } else {
            addDebugInfo('No user data after setting session');
            setAuthError('Authentication failed - no user data');
            setIsLoading(false);
          }
          
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // Check for existing session on app load with timeout
        addDebugInfo('Checking for existing session...');
        const sessionPromise = supabase.auth.getSession();
        const { data: { session }, error: sessionError } = await withTimeout(sessionPromise, 8000);
        
        if (sessionError) {
          addDebugInfo(`Session error: ${sessionError.message}`);
          if (sessionError.message.includes('timed out')) {
            setAuthError('Connection timeout. Please check your internet connection and try again.');
          } else {
            setAuthError('Session error occurred');
          }
          clearAuthState();
          setIsLoading(false);
          return;
        }
        
        if (session) {
          addDebugInfo('Found existing session');
          await handleAuthSuccess(session.user);
        } else {
          addDebugInfo('No existing session found');
          setIsLoading(false);
        }
      } catch (error: any) {
        addDebugInfo(`Auth initialization error: ${error.message}`);
        if (error.message.includes('timed out')) {
          setAuthError('Connection timeout. Please check your internet connection and try again.');
        } else {
          setAuthError(`Failed to initialize authentication: ${error.message}`);
        }
        clearAuthState();
        setIsLoading(false);
      }
    };

    handleAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      addDebugInfo(`Auth state changed: ${event} - User: ${session?.user?.id || 'none'}`);
      
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

  const handleSignUpSuccess = () => {
    setIsSignUpOpen(false);
    setPendingTimeLog(undefined);
    setShowDashboard(true);
  };

  const handleSignUpClose = () => {
    setIsSignUpOpen(false);
    // Keep the pending time log in case they want to try again
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

  const handleRetry = () => {
    setAuthError(null);
    setIsLoading(true);
    setDebugInfo([]);
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
          
          {/* Debug info for development */}
          {debugInfo.length > 0 && (
            <div className="bg-white rounded-lg p-4 text-left text-xs text-gray-600 max-h-40 overflow-y-auto mb-4">
              <div className="font-semibold mb-2">Debug Info:</div>
              {debugInfo.map((info, index) => (
                <div key={index} className="mb-1">{info}</div>
              ))}
            </div>
          )}
          
          {/* Add a skip button after 5 seconds */}
          {debugInfo.length > 2 && (
            <button
              onClick={handleSkipAuth}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              Skip Authentication
            </button>
          )}
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
            
            {/* Debug info for development */}
            {debugInfo.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 text-left text-xs text-gray-600 max-h-32 overflow-y-auto mb-4">
                <div className="font-semibold mb-2">Debug Info:</div>
                {debugInfo.map((info, index) => (
                  <div key={index} className="mb-1">{info}</div>
                ))}
              </div>
            )}
            
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

  // Show dashboard if user just signed up or signed in
  if (showDashboard) {
    return <Dashboard onBack={handleBackToHome} />;
  }

  return (
    <div className="min-h-screen w-full bg-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Header 
          onSignUpSuccess={handleHeaderSignUpSuccess}
          onSignInSuccess={handleHeaderSignInSuccess}
        />
        <main className="mt-16 md:mt-24">
          <Hero />
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