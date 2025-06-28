import React, { useState } from 'react';
import { UserPlus, LogIn, LogOut, Home, BarChart3 } from 'lucide-react';
import HeaderSignUpModal from './HeaderSignUpModal';
import SignInModal from './SignInModal';

interface HeaderProps {
  isAuthenticated: boolean;
  userProfile: any;
  showDashboard: boolean;
  showFeed: boolean;
  onSignUpSuccess?: () => void;
  onSignInSuccess?: () => void;
  onDashboardClick?: () => void;
  onFeedClick?: () => void;
  onSignOut?: () => void;
}

const Header = ({ 
  isAuthenticated, 
  userProfile, 
  showDashboard, 
  showFeed,
  onSignUpSuccess, 
  onSignInSuccess, 
  onDashboardClick, 
  onFeedClick,
  onSignOut 
}: HeaderProps) => {
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  const handleSignUpSuccess = () => {
    setIsSignUpOpen(false);
    onSignUpSuccess?.();
  };

  const handleSignInSuccess = () => {
    setIsSignInOpen(false);
    onSignInSuccess?.();
  };

  const handleSignOut = () => {
    onSignOut?.();
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
                    onClick={onFeedClick}
                    className={`flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200 ${
                      showFeed ? 'bg-white bg-opacity-50' : ''
                    }`}
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