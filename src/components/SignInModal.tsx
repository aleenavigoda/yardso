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

  // Add timeout protection
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        setIsLoading(false);
        setError('Sign in is taking too long. Please try again.');
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

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
        return;
      }

      console.log('Auth successful, user ID:', authData.user?.id);

      if (authData.user) {
        // Get the user's profile - it should exist if they're signing in
        console.log('Fetching profile for user:', authData.user.id);
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authData.user.id)
          .single();

        if (profileError) {
          console.error('Profile error:', profileError);
          if (profileError.code === 'PGRST116') {
            // Profile doesn't exist - this shouldn't happen for existing users
            setError('Profile not found. Please contact support or try signing up again.');
          } else {
            setError('Failed to load your profile. Please try again.');
          }
          return;
        }

        console.log('Profile found:', profile);

        // Store user profile for dashboard
        localStorage.setItem('userProfile', JSON.stringify(profile));
        
        // Reset form
        setFormData({ email: '', password: '' });
        
        // Close modal and trigger success
        onClose();
        onSignInSuccess();
      } else {
        setError('No user data returned from sign in. Please try again.');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
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

  // Reset loading state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setError('');
    }
  }, [isOpen]);

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

          {/* Emergency reset button when stuck */}
          {isLoading && (
            <div className="text-center">
              <button
                onClick={() => {
                  setIsLoading(false);
                  setError('Sign in cancelled. Please try again.');
                }}
                className="text-gray-500 hover:text-gray-700 text-sm underline"
              >
                Cancel sign in
              </button>
            </div>
          )}

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