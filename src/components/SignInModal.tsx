import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, Loader2, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInSuccess: () => void;
}

const SignInModal = ({ isOpen, onClose, onSignInSuccess }: SignInModalProps) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      console.log('Attempting sign in for:', formData.email);
      
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        
        // Handle specific error cases
        if (authError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in.');
        } else if (authError.message.includes('Too many requests')) {
          setError('Too many sign-in attempts. Please wait a few minutes and try again.');
        } else {
          setError(authError.message || 'Sign in failed. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      console.log('Auth successful, user ID:', authData.user?.id);

      if (authData.user && authData.session) {
        // Reset form
        setFormData({ email: '', password: '' });
        setError('');
        setIsLoading(false);
        
        // Close modal and trigger success callback immediately
        console.log('Sign in successful, closing modal');
        onClose();
        onSignInSuccess();
      } else {
        setError('Sign in failed. Please try again.');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({ email: '', password: '' });
      setError('');
      onClose();
    }
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError('');
    } else {
      // Reset loading state when modal closes
      setIsLoading(false);
      setFormData({ email: '', password: '' });
      setError('');
    }
  }, [isOpen]);

  // Listen for auth state changes to handle successful sign-in
  useEffect(() => {
    if (!isOpen) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && isLoading) {
        console.log('Auth state change detected: SIGNED_IN');
        
        // Reset form and close modal
        setFormData({ email: '', password: '' });
        setError('');
        setIsLoading(false);
        
        onClose();
        onSignInSuccess();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isOpen, isLoading, onClose, onSignInSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full relative animate-scale-in shadow-2xl">
        <button
          onClick={handleClose}
          disabled={isLoading}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div className="space-y-6">
          <div className="text-center">
            <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <LogIn className="w-6 h-6 text-amber-700" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-600 text-sm">
              Sign in to your workyard
            </p>
          </div>

          {error && (
            <div className="bg-red-50 rounded-xl p-3 border border-red-200">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Mail size={14} />
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Lock size={14} />
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Your password"
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !formData.email.trim() || !formData.password.trim()}
              className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="text-center">
            <button 
              onClick={() => setError('Password reset functionality coming soon!')}
              disabled={isLoading}
              className="text-amber-700 hover:text-amber-800 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Forgot your password?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInModal;