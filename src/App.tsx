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
import Feed from './components/Feed';
import { supabase } from './lib/supabase';
import type { TimeLoggingData } from './types';

function App() {
  const [searchValue, setSearchValue] = useState('');
  const [isTimeLoggingOpen, setIsTimeLoggingOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [pendingTimeLog, setPendingTimeLog] = useState<TimeLoggingData | undefined>();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

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
      
      // Check if profile exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
        // Don't throw - continue with basic auth
        console.log('Continuing with basic auth despite profile error');
      }

      let profile = existingProfile;

      if (!existingProfile) {
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
      } else {
        console.log('Using existing profile:', existingProfile.id);
        
        // Check for pending time log data even if profile exists
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
      }

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
      // Don't prevent sign-in for profile errors
      console.log('Auth success had errors but continuing...');
    }
  };

  // Simplified auth initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for email confirmation tokens in URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          console.log('Found auth tokens in URL, setting session...');
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (!error && data.user) {
            await handleAuthSuccess(data.user);
          }
          
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Check if we have profile in localStorage first
          const storedProfile = localStorage.getItem('userProfile');
          if (storedProfile) {
            try {
              const profile = JSON.parse(storedProfile);
              setUserProfile(profile);
              setIsAuthenticated(true);
              console.log('Loaded profile from localStorage');
              
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
            } catch (e) {
              localStorage.removeItem('userProfile');
              await handleAuthSuccess(session.user);
            }
          } else {
            await handleAuthSuccess(session.user);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Don't show error to user, just continue
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session) {
        await handleAuthSuccess(session.user);
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('userProfile');
        localStorage.removeItem('pendingTimeLog');
        setShowDashboard(false);
        setShowFeed(false);
        setPendingTimeLog(undefined);
        setIsAuthenticated(false);
        setUserProfile(null);
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
    setShowFeed(false);
  };

  const handleHeaderSignUpSuccess = () => {
    setShowDashboard(true);
  };

  const handleHeaderSignInSuccess = () => {
    setShowDashboard(true);
  };

  const handleDashboardClick = () => {
    setShowDashboard(true);
    setShowFeed(false);
  };

  const handleFeedClick = () => {
    setShowFeed(true);
    setShowDashboard(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Show feed if user is authenticated and wants to see it
  if (showFeed && isAuthenticated) {
    return <Feed onBack={handleBackToHome} />;
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
          showFeed={showFeed}
          onSignUpSuccess={handleHeaderSignUpSuccess}
          onSignInSuccess={handleHeaderSignInSuccess}
          onDashboardClick={handleDashboardClick}
          onFeedClick={handleFeedClick}
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