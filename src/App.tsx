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
        console.log('Creating new profile for user');
        // Create profile if it doesn't exist (for email confirmation flow)
        const userData = user.user_metadata || {};
        
        const { data: newProfile, error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email,
            full_name: userData.full_name || '',
            display_name: userData.full_name?.split(' ')[0] || '',
          })
          .select()
          .single();

        if (createProfileError) {
          console.error('Profile creation error:', createProfileError);
          throw createProfileError;
        }

        profile = newProfile;

        // Add URLs if provided
        if (userData.urls && userData.urls.length > 0) {
          const urlInserts = userData.urls.map((url: string) => ({
            profile_id: profile.id,
            url: url.trim(),
            url_type: detectUrlType(url.trim()),
          }));

          const { error: urlError } = await supabase
            .from('profile_urls')
            .insert(urlInserts);

          if (urlError) {
            console.error('URL insertion error:', urlError);
            // Don't throw here, URLs are optional
          }
        }
      }

      console.log('Profile ready:', profile);
      localStorage.setItem('userProfile', JSON.stringify(profile));
      setShowDashboard(true);
      setAuthError(null);
    } catch (error) {
      console.error('Error handling auth success:', error);
      setAuthError('Failed to set up your profile. Please try signing in again.');
      clearAuthState();
    }
  };

  // Handle email confirmation and auth state changes
  useEffect(() => {
    const handleAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // First, check for email confirmation tokens in URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          console.error('Auth error from URL:', error, errorDescription);
          setAuthError(errorDescription || 'Authentication failed');
          setIsLoading(false);
          // Clean up the URL
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
            console.error('Error setting session:', sessionError);
            setAuthError('Failed to confirm your email. Please try signing in.');
          } else if (data.user) {
            console.log('Session set successfully');
            await handleAuthSuccess(data.user);
          }
          
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsLoading(false);
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
          await handleAuthSuccess(session.user);
        } else {
          console.log('No existing session found');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthError('Failed to initialize authentication');
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    handleAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session) {
        await handleAuthSuccess(session.user);
      } else if (event === 'SIGNED_OUT') {
        clearAuthState();
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
    window.location.reload();
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-amber-200 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-black italic mb-2">yard</div>
          <div className="text-gray-700">Loading...</div>
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
                onClick={() => {
                  setAuthError(null);
                  clearAuthState();
                }}
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