import React, { useState, useEffect } from 'react';
import { UserPlus, LogIn, LogOut, User, Home, BarChart3 } from 'lucide-react';
import HeaderSignUpModal from './HeaderSignUpModal';
import SignInModal from './SignInModal';
import { supabase } from '../lib/supabase';

interface HeaderProps {
  onSignUpSuccess?: () => void;
  onSignInSuccess?: () => void;
  showDashboard?: boolean;
  onDashboardClick?: () => void;
}

const Header = ({ onSignUpSuccess, onSignInSuccess, showDashboard, onDashboardClick }: HeaderProps) => {
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    // Check initial auth state
    const checkAuthState = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      
      if (session) {
        const profile = localStorage.getItem('userProfile');
        if (profile) {
          setUserProfile(JSON.parse(profile));
        }
      }
    };

    checkAuthState();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      
      if (session) {
        const profile = localStorage.getItem('userProfile');
        if (profile) {
          setUserProfile(JSON.parse(profile));
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignUpSuccess = () => {
    setIsSignUpOpen(false);
    onSignUpSuccess?.();
  };

  const handleSignInSuccess = () => {
    setIsSignInOpen(false);
    onSignInSuccess?.();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('userProfile');
    localStorage.removeItem('pendingTimeLog');
    setUserProfile(null);
    setIsAuthenticated(false);
  };

  return (
    <>
      <header className="flex justify-between items-center">
        <div className="w-28">
          <div className="text-2xl font-bold text-black italic">yard</div>
        </div>
        <nav>
          <ul className="flex gap-6 items-center">
            {isAuthenticated ? (
              <>
                <li>
                  <button 
                    className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
                  >
                    <Home size={16} />
                    <span className="hidden sm:inline">feed</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={onDashboardClick}
                    className={`flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200 ${
                      showDashboard ? 'bg-white bg-opacity-50' : ''
                    }`}
                  >
                    <BarChart3 size={16} />
                    <span className="hidden sm:inline">dashboard</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
                  >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">sign out</span>
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <button 
                    onClick={() => setIsSignUpOpen(true)}
                    className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
                  >
                    <UserPlus size={16} />
                    <span className="hidden sm:inline">sign up</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setIsSignInOpen(true)}
                    className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
                  >
                    <LogIn size={16} />
                    <span className="hidden sm:inline">sign in</span>
                  </button>
                </li>
              </>
            )}
          </ul>
        </nav>
      </header>

      <HeaderSignUpModal
        isOpen={isSignUpOpen}
        onClose={() => setIsSignUpOpen(false)}
        onSignUpSuccess={handleSignUpSuccess}
      />

      <SignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSignInSuccess={handleSignInSuccess}
      />
    </>
  );
};

export default Header;