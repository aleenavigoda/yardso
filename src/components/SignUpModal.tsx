import React, { useState } from 'react';
import { X, User, Mail, Link, Loader2, Lock, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { TimeLoggingData } from '../types';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeLoggingData?: TimeLoggingData;
  onSignUpSuccess: () => void;
}

const SignUpModal = ({ isOpen, onClose, timeLoggingData, onSignUpSuccess }: SignUpModalProps) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    urls: ['', '', '', '', '']
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...formData.urls];
    newUrls[index] = value;
    setFormData({ ...formData, urls: newUrls });
  };

  const detectUrlType = (url: string): string => {
    if (url.includes('github.com')) return 'github';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('behance.net') || url.includes('dribbble.com')) return 'portfolio';
    if (url.includes('medium.com') || url.includes('substack.com')) return 'article';
    return 'website';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Starting sign up process...');
      
      // First, store the profile data in pending_profiles table
      const validUrls = formData.urls.filter(url => url.trim() !== '');
      const urlsData = validUrls.map(url => ({
        url: url.trim(),
        type: detectUrlType(url.trim())
      }));

      console.log('Preparing pending profile data:', {
        email: formData.email,
        full_name: formData.fullName,
        display_name: formData.fullName.split(' ')[0],
        urls: urlsData,
        time_logging_data: timeLoggingData
      });

      const { error: pendingError } = await supabase
        .from('pending_profiles')
        .insert({
          email: formData.email,
          full_name: formData.fullName,
          display_name: formData.fullName.split(' ')[0],
          urls: urlsData,
          time_logging_data: timeLoggingData || null
        });

      if (pendingError) {
        console.error('Error storing pending profile:', pendingError);
        throw new Error(`Failed to store profile data: ${pendingError.message}`);
      }

      console.log('Pending profile stored successfully');

      // Now sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          }
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      console.log('Auth data:', authData);

      // Check if email confirmation is required
      if (authData.user && !authData.session) {
        console.log('Email confirmation required');
        setShowConfirmation(true);
      } else if (authData.user && authData.session) {
        console.log('User signed in immediately');
        // User is immediately signed in (email confirmation disabled)
        // Profile will be created by trigger with pending data
        onSignUpSuccess();
      } else {
        throw new Error('No user data returned from sign up');
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || 'An error occurred during sign up');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  if (showConfirmation) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full relative animate-scale-in shadow-2xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>

          <div className="text-center space-y-4">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              We've sent a confirmation link to <strong>{formData.email}</strong>. 
              Click the link in your email to activate your account and access your dashboard.
            </p>
            {timeLoggingData && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-amber-800 text-sm">
                  <strong>⏰ Your time log is saved!</strong><br />
                  {timeLoggingData.hours} hours with {timeLoggingData.name} will be available in your dashboard after email confirmation.
                </p>
              </div>
            )}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-blue-800 text-sm">
                <strong>Tip:</strong> Check your spam folder if you don't see the email within a few minutes.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-xl font-semibold transition-all duration-200"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full relative animate-scale-in shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors duration-200 z-10"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div className="space-y-6">
          <div className="text-center">
            <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <User className="w-6 h-6 text-amber-700" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Join your workyard</h2>
            <p className="text-gray-600 text-sm">
              Create your profile to start tracking time and building your professional network
            </p>
          </div>

          {timeLoggingData && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
              <div className="text-amber-800 text-sm">
                <p className="font-medium mb-1">⏰ Your time log is ready</p>
                <p>
                  {timeLoggingData.hours} hours with {timeLoggingData.name} will be logged after signup
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 rounded-xl p-3 border border-red-200">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <User size={14} />
                Full Name
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Your full name"
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                required
              />
            </div>

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
                placeholder="Create a password"
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Lock size={14} />
                Confirm Password
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Link size={14} />
                What you're working on (up to 5 links)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Add links to your GitHub, portfolio, articles, or projects
              </p>
              <div className="space-y-2">
                {formData.urls.map((url, index) => (
                  <input
                    key={index}
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder={`Link ${index + 1} (optional)`}
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating your account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500">
            By signing up, you agree to our terms of service and privacy policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUpModal;