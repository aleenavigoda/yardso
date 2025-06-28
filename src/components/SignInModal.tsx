import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, Loader2, LogIn, AlertCircle } from 'lucide-react';
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
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'failed'>('checking');

  // Test Supabase connection
  const testConnection = async () => {
    try {
      setConnectionStatus('checking');
      console.log('Testing Supabase connection...');
      
      // Check if environment variables are available
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Missing environment variables:', { 
          hasUrl: !!supabaseUrl, 
          hasKey: !!supabaseAnonKey 
        });
        setConnectionStatus('failed');
        setError('Configuration error: Missing Supabase credentials. Please check your environment variables.');
        return false;
      }

      console.log('Environment variables found, testing connection to:', supabaseUrl);

      // Test with a simple query and shorter timeout
      const { data, error: testError } = await Promise.race([
        supabase.from('profiles').select('count').limit(1),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection test timeout')), 5000)
        )
      ]) as any;

      if (testError) {
        console.error('Supabase connection test failed:', testError);
        setConnectionStatus('failed');
        setError(`Connection failed: ${testError.message}. Please check your Supabase configuration.`);
        return false;
      }

      console.log('Supabase connection test successful');
      setConnectionStatus('connected');
      setError('');
      return true;
    } catch (err: any) {
      console.error('Connection test error:', err);
      setConnectionStatus('failed');
      if (err.message.includes('timeout')) {
        setError('Unable to connect to authentication service. Please check your internet connection and Supabase configuration.');
      } else {
        setError(`Connection error: ${err.message}`);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // First test connection if not already connected
      if (connectionStatus !== 'connected') {
        const isConnected = await testConnection();
        if (!isConnected) {
          setIsLoading(false);
          return;
        }
      }

      console.log('Attempting sign in for:', formData.email);
      
      // Reduce timeout to 10 seconds and add better error handling
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign in request timed out after 10 seconds')), 10000)
      );

      // Sign in with Supabase Auth
      const signInPromise = supabase.auth.signInWithPassword({
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
      });

      const { data: authData, error: authError } = await Promise.race([
        signInPromise,
        timeoutPromise
      ]) as any;

      if (authError) {
        console.error('Auth error:', authError);
        
        // Handle specific error cases with more helpful messages
        if (authError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in.');
        } else if (authError.message.includes('Too many requests')) {
          setError('Too many sign-in attempts. Please wait a few minutes and try again.');
        } else if (authError.message.includes('timeout') || authError.message.includes('network')) {
          setError('Connection timeout. Please check your internet connection and try again.');
        } else if (authError.message.includes('fetch')) {
          setError('Network error. Please check your connection and Supabase configuration.');
        } else {
          setError(`Authentication error: ${authError.message}`);
        }
        return;
      }

      console.log('Auth successful, user ID:', authData.user?.id);

      if (authData.user && authData.session) {
        // Reset form
        setFormData({ email: '', password: '' });
        setError('');
        
        // Close modal and trigger success callback
        console.log('Sign in successful, closing modal');
        onClose();
        onSignInSuccess();
      } else {
        setError('Sign in failed: No user session created. Please try again.');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      if (err.message.includes('timeout')) {
        setError('Sign in timed out. This may indicate a connection issue with the authentication service. Please check your internet connection and try again.');
      } else if (err.message.includes('fetch') || err.message.includes('network')) {
        setError('Network error. Please check your internet connection and Supabase configuration.');
      } else {
        setError(`Unexpected error: ${err.message}. Please try again or contact support.`);
      }
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

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setError('');
      setConnectionStatus('checking');
      // Test connection when modal opens
      testConnection();
    } else {
      // Reset all state when modal closes
      setIsLoading(false);
      setFormData({ email: '', password: '' });
      setError('');
      setConnectionStatus('checking');
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

          {/* Connection Status Indicator */}
          {connectionStatus === 'checking' && (
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <p className="text-blue-800 text-sm">Connecting to authentication service...</p>
              </div>
            </div>
          )}

          {connectionStatus === 'failed' && (
            <div className="bg-red-50 rounded-xl p-3 border border-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-600" />
                <p className="text-red-800 text-sm">Connection failed</p>
              </div>
            </div>
          )}

          {connectionStatus === 'connected' && !error && (
            <div className="bg-green-50 rounded-xl p-3 border border-green-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-green-800 text-sm">Connected to authentication service</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 rounded-xl p-3 border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
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
                disabled={isLoading || connectionStatus === 'failed'}
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
                disabled={isLoading || connectionStatus === 'failed'}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={
                isLoading || 
                connectionStatus === 'failed' || 
                connectionStatus === 'checking' ||
                !formData.email.trim() || 
                !formData.password.trim()
              }
              className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : connectionStatus === 'checking' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {connectionStatus === 'connected' && (
            <div className="text-center">
              <button 
                onClick={() => setError('Password reset functionality coming soon!')}
                disabled={isLoading}
                className="text-amber-700 hover:text-amber-800 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Forgot your password?
              </button>
            </div>
          )}

          {/* Retry connection button for failed connections */}
          {connectionStatus === 'failed' && (
            <div className="text-center">
              <button 
                onClick={testConnection}
                disabled={isLoading}
                className="text-blue-700 hover:text-blue-800 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-400 text-center space-y-1">
              <div>Debug: Check browser console for detailed logs</div>
              <div>Connection: {connectionStatus}</div>
              <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing'}</div>
              <div>Anon Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignInModal;