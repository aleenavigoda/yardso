import React, { useState } from 'react';
import { UserPlus, LogIn } from 'lucide-react';
import HeaderSignUpModal from './HeaderSignUpModal';
import SignInModal from './SignInModal';

interface HeaderProps {
  onSignUpSuccess?: () => void;
  onSignInSuccess?: () => void;
}

const Header = ({ onSignUpSuccess, onSignInSuccess }: HeaderProps) => {
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

  return (
    <>
      <header className="flex justify-between items-center">
        <div className="w-28">
          <div className="text-2xl font-bold text-black italic">yard</div>
        </div>
        <nav>
          <ul className="flex gap-6 items-center">
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