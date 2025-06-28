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
  const [isInitializing, setIsInitializing] = useState(true);

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
    setShowDashboard(false);
    setShowFeed(false);
    setPendingTimeLog(undefined);
    setIsAuthenticated(false);
    setUserProfile(null);
  };

  // Fixed auth initialization with better error handling
  useEffect(() => {
    let isMounted = true;
    
    const initAuth = async () => {
      try {
        console.log('Starting auth initialization...');
        
        // Set up auth state listener first
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Auth state changed:', event);
            
            if (!isMounted) return;
            
            if (event === 'SIGNED_IN' && session?.user) {
              console.log('Handling auth success for user:', session.user.id);
              try {
                await handleAuthSuccess(session.user);
              } catch (error) {
                console.error('Auth state change handler failed:', error);
              }
            } else if (event === 'SIGNED_OUT') {
              clearAuthState();
            }
          }
        );

        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        // Handle the specific JWT session error
        if (error && error.message?.includes('Session from session_id claim in JWT does not exist')) {
          console.log('Invalid JWT session detected, clearing auth state');
          // Clear the invalid session and let user sign in fresh
          await supabase.auth.signOut();
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
          try {
            await handleAuthSuccess(session.user);
          } catch (error) {
            console.error('Initial auth success handler failed:', error);
          }
        } else {
          clearAuthState();
        }
        
        setIsInitializing(false);
        console.log('Auth initialization complete');

        // Cleanup function
        return () => {
          subscription.unsubscribe();
        };
        
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMounted) {
          clearAuthState();
          setIsInitializing(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
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
    try {
      await supabase.auth.signOut();
      clearAuthState();
    } catch (error) {
      console.error('Error signing out:', error);
      // Still clear state even if signOut fails
      clearAuthState();
    }
  };

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="min-h-screen w-full bg-amber-200 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-black italic mb-4">yard</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
          <div className="mt-4 text-sm text-gray-700">
            Initializing...
          </div>
        </div>
      </div>
    );
  }

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