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

  // Clear authentication state and localStorage
  const clearAuthState = () => {
    localStorage.removeItem('userProfile');
    localStorage.removeItem('pendingTimeLog');
    setShowDashboard(false);
    setPendingTimeLog(undefined);
  };

  // Handle email confirmation and auth state changes
  useEffect(() => {
    const handleAuth = async () => {
      try {
        // Handle email confirmation from URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          // Set the session from the URL tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('Error setting session:', error);
          } else if (data.user) {
            await handleAuthSuccess(data.user);
            // Clean up the URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
          }
        }

        // Check for existing session on app load
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          clearAuthState();
          return;
        }
        
        if (session) {
          await handleAuthSuccess(session.user);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    handleAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await handleAuthSuccess(session.user);
      } else if (event === 'SIGNED_OUT') {
        clearAuthState();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthSuccess = async (user: any) => {
    try {
      // Check if profile exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (!existingProfile) {
        // Create profile if it doesn't exist (for email confirmation flow)
        const userData = user.user_metadata || {};
        
        const { error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email,
            full_name: userData.full_name || '',
            display_name: userData.full_name?.split(' ')[0] || '',
          });

        if (createProfileError) throw createProfileError;

        // Get the created profile
        const { data: newProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError) throw fetchError;

        // Add URLs if provided
        if (userData.urls && userData.urls.length > 0) {
          const urlInserts = userData.urls.map((url: string) => ({
            profile_id: newProfile.id,
            url: url.trim(),
            url_type: detectUrlType(url.trim()),
          }));

          await supabase.from('profile_urls').insert(urlInserts);
        }

        localStorage.setItem('userProfile', JSON.stringify(newProfile));
      } else {
        localStorage.setItem('userProfile', JSON.stringify(existingProfile));
      }

      setShowDashboard(true);
    } catch (error) {
      console.error('Error handling auth success:', error);
      clearAuthState();
    }
  };

  const detectUrlType = (url: string): string => {
    if (url.includes('github.com')) return 'github';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('behance.net') || url.includes('dribbble.com')) return 'portfolio';
    if (url.includes('medium.com') || url.includes('substack.com')) return 'article';
    return 'website';
  };

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