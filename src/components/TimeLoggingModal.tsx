import React, { useState } from 'react';
import { X, Clock, User, MessageSquare, Plus, Minus, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { TimeLoggingData } from '../types';

interface TimeLoggingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: (data: TimeLoggingData) => void;
  onLogTime?: (data: TimeLoggingData) => void;
  isAuthenticated?: boolean;
}

const TimeLoggingModal = ({ isOpen, onClose, onSignUp, onLogTime, isAuthenticated = false }: TimeLoggingModalProps) => {
  const [mode, setMode] = useState<'helped' | 'wasHelped'>('helped');
  const [hours, setHours] = useState(1);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [description, setDescription] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const timeOptions = [0.5, 1, 1.5, 2, 3, 4, 6, 8];

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidPhone = (phone: string) => {
    return /^[\+]?[1-9][\d]{0,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''));
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      // If not authenticated, trigger signup flow
      const timeLoggingData: TimeLoggingData = {
        mode,
        hours,
        name,
        contact,
        description
      };
      onSignUp(timeLoggingData);
      return;
    }

    // If authenticated, handle the time logging
    setIsLogging(true);
    setSuccessMessage('');

    try {
      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, display_name')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Check if the contact is an existing user by email
      let existingProfile = null;
      if (isValidEmail(contact)) {
        const { data: existingProfiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, user_id, email, full_name, display_name')
          .eq('email', contact)
          .limit(1);
        
        if (profileError) {
          console.error('Error checking for existing profile:', profileError);
        }

        existingProfile = existingProfiles && existingProfiles.length > 0 ? existingProfiles[0] : null;
      }

      if (existingProfile) {
        // User exists - create direct time transaction
        const { error: transactionError } = await supabase
          .from('time_transactions')
          .insert({
            giver_id: mode === 'helped' ? profile.id : existingProfile.id,
            receiver_id: mode === 'helped' ? existingProfile.id : profile.id,
            hours: hours,
            description: description || null,
            service_type: 'general',
            logged_by: profile.id,
            status: 'pending'
          });

        if (transactionError) throw transactionError;

        setSuccessMessage(`Time logged successfully! ${existingProfile.full_name || existingProfile.display_name} will receive a notification to confirm.`);
      } else {
        // User doesn't exist - create invitation and pending time log
        if (!isValidEmail(contact)) {
          throw new Error('Please provide a valid email address for new users');
        }

        console.log('Creating invitation for new user:', contact);

        // Use the RPC function to create invitation and pending time log
        const { data: invitationData, error: invitationError } = await supabase
          .rpc('create_invitation_with_time_log', {
            p_inviter_profile_id: profile.id,
            p_invitee_email: contact,
            p_invitee_name: name,
            p_invitee_contact: contact,
            p_hours: hours,
            p_description: description || null,
            p_service_type: 'general',
            p_mode: mode
          });

        if (invitationError) {
          console.error('RPC error:', invitationError);
          throw invitationError;
        }

        if (!invitationData.success) {
          console.error('RPC returned error:', invitationData.error);
          throw new Error(invitationData.error || 'Failed to create invitation');
        }

        console.log('Invitation created successfully:', invitationData);

        // Now send the actual email using our edge function
        try {
          console.log('Calling send-invitation-email function...');
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-invitation-email', {
            body: {
              invitee_email: contact,
              invitee_name: name,
              inviter_name: profile.full_name || profile.display_name || 'A Yard member',
              hours: hours,
              mode: mode,
              invitation_token: invitationData.invitation_token
            }
          });

          if (emailError) {
            console.error('Email sending error:', emailError);
            // Don't throw here - the invitation was created successfully
            console.warn('Invitation created but email failed to send:', emailError);
            setSuccessMessage(`Invitation created for ${name}! However, there was an issue sending the email. Please contact them directly with this link: ${window.location.origin}/invite/${invitationData.invitation_token}`);
          } else {
            console.log('Email sent successfully:', emailResult);
            if (emailResult.success) {
              setSuccessMessage(`Invitation sent to ${name}! They'll receive an email to join Yard and confirm the ${hours} hour${hours !== 1 ? 's' : ''} of ${mode === 'helped' ? 'help you provided' : 'help they provided'}.`);
            } else {
              setSuccessMessage(`Invitation created for ${name}! ${emailResult.message || 'Email sending may have failed, but the invitation is ready.'}`);
            }
          }
        } catch (emailError) {
          console.error('Email function error:', emailError);
          // Don't throw here - the invitation was created successfully
          setSuccessMessage(`Invitation created for ${name}! There was an issue with email delivery, but you can share this link directly: ${window.location.origin}/invite/${invitationData.invitation_token}`);
        }
      }

      // Reset form
      setMode('helped');
      setHours(1);
      setName('');
      setContact('');
      setDescription('');

      // Close modal after showing success message
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 5000);

    } catch (error: any) {
      console.error('Error logging time:', error);
      setSuccessMessage('');
      
      // Show user-friendly error messages
      if (error.message.includes('email')) {
        alert('Please provide a valid email address for new users.');
      } else if (error.message.includes('User not found')) {
        alert('Unable to find your profile. Please try signing out and back in.');
      } else {
        alert('Error logging time. Please try again.');
      }
    } finally {
      setIsLogging(false);
    }
  };

  const resetForm = () => {
    setMode('helped');
    setHours(1);
    setName('');
    setContact('');
    setDescription('');
    setSuccessMessage('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isFormValid = name.trim() !== '' && contact.trim() !== '' && (isValidEmail(contact) || (!isAuthenticated && isValidPhone(contact)));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full relative animate-scale-in shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors duration-200 z-10"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div className="space-y-6">
          <div className="text-center">
            <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-amber-700" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {mode === 'helped' ? 'Log time helping someone' : 'Request time back'}
            </h2>
            <p className="text-gray-600 text-sm">
              {mode === 'helped' 
                ? 'Track the professional assistance you provided'
                : 'Request time from someone who helped you'
              }
            </p>
          </div>

          {!isAuthenticated && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
              <div className="text-amber-800 text-sm">
                <p className="font-medium mb-1">🎯 Sign up to unlock your workyard</p>
                <p>Time tracking helps you maintain balanced relationships and discover new collaboration opportunities.</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-green-800 text-sm font-medium mb-1">Success!</p>
                  <p className="text-green-700 text-sm">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-2">
            <div className="flex gap-2">
              <button
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                  mode === 'helped' 
                    ? 'bg-black text-white shadow-sm' 
                    : 'bg-transparent text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setMode('helped')}
                disabled={isLogging}
              >
                I helped someone
              </button>
              <button
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                  mode === 'wasHelped' 
                    ? 'bg-black text-white shadow-sm' 
                    : 'bg-transparent text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setMode('wasHelped')}
                disabled={isLogging}
              >
                Someone helped me
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <User size={14} />
                {mode === 'helped' ? 'Who did you help?' : 'Who helped you?'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full p-2.5 border border-gray-200 rounded-xl mb-2 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                disabled={isLogging}
              />
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={isAuthenticated ? "Email address" : "Email or phone number"}
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                disabled={isLogging}
              />
              <p className="text-xs text-gray-500 mt-1">
                {isAuthenticated ? (
                  isValidEmail(contact) 
                    ? "We'll check if they're on Yard or send them an invitation email"
                    : "Please enter a valid email address"
                ) : (
                  isValidEmail(contact) 
                    ? "They'll receive an email invitation to join Yard and confirm"
                    : isValidPhone(contact)
                    ? "They'll receive an SMS invitation to join Yard and confirm"
                    : "Enter a valid email address or phone number"
                )}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Clock size={14} />
                How many hours?
              </label>
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => setHours(Math.max(0.5, hours - 0.5))}
                  disabled={isLogging}
                  className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-amber-400 hover:bg-amber-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus size={14} />
                </button>
                <div className="text-center">
                  <span className="text-xl font-bold text-gray-900">{hours}</span>
                  <span className="text-gray-600 ml-1 text-sm">hours</span>
                </div>
                <button
                  onClick={() => setHours(Math.min(8, hours + 0.5))}
                  disabled={isLogging}
                  className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-amber-400 hover:bg-amber-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {timeOptions.map((time) => (
                  <button
                    key={time}
                    onClick={() => setHours(time)}
                    disabled={isLogging}
                    className={`px-3 py-1.5 rounded-full font-medium transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                      hours === time 
                        ? 'bg-black text-white shadow-md' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {time}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <MessageSquare size={14} />
                What was the work? (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  mode === 'helped'
                    ? 'e.g., Reviewed their pitch deck and gave feedback on messaging'
                    : 'e.g., They helped me debug a React component issue'
                }
                className="w-full p-2.5 border border-gray-200 rounded-xl h-20 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                disabled={isLogging}
              />
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={!isFormValid || isLogging}
            className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {isLogging ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : isAuthenticated ? (
              <>
                <CheckCircle size={16} />
                Log Time
              </>
            ) : (
              'Sign up to log time'
            )}
          </button>
          
          <p className="text-center text-xs text-gray-500">
            {isAuthenticated 
              ? "They'll get notified to confirm this time entry"
              : "They'll get an invite to join your workyard and confirm this time entry"
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default TimeLoggingModal;