import React, { useState, useEffect } from 'react';
import { Clock, User, CheckCircle, XCircle, Plus, LogOut, ArrowLeft, Mail, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { TimeLoggingData, Profile } from '../types';

interface DashboardProps {
  onBack: () => void;
}

const Dashboard = ({ onBack }: DashboardProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingTimeLog, setPendingTimeLog] = useState<TimeLoggingData | null>(null);
  const [isLoggingTime, setIsLoggingTime] = useState(false);
  const [timeLogForm, setTimeLogForm] = useState({
    mode: 'helped' as 'helped' | 'wasHelped',
    hours: 1,
    name: '',
    contact: '',
    description: ''
  });

  useEffect(() => {
    // Load user profile from localStorage
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      setProfile(JSON.parse(userProfile));
    }

    // Load pending time log from localStorage
    const pendingLog = localStorage.getItem('pendingTimeLog');
    if (pendingLog) {
      const logData = JSON.parse(pendingLog);
      setPendingTimeLog(logData);
      setTimeLogForm({
        mode: logData.mode,
        hours: logData.hours,
        name: logData.name,
        contact: logData.contact,
        description: logData.description
      });
    }
  }, []);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLogTime = async () => {
    if (!profile) return;

    try {
      setIsLoggingTime(true);

      // Check if the contact is an existing user
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, email, full_name')
        .eq('email', timeLogForm.contact)
        .single();

      if (existingProfile) {
        // User exists - create direct time transaction
        const { error: transactionError } = await supabase
          .from('time_transactions')
          .insert({
            giver_id: timeLogForm.mode === 'helped' ? profile.id : existingProfile.id,
            receiver_id: timeLogForm.mode === 'helped' ? existingProfile.id : profile.id,
            hours: timeLogForm.hours,
            description: timeLogForm.description,
            logged_by: profile.id,
            status: 'pending'
          });

        if (transactionError) throw transactionError;

        alert('Time logged successfully! The other person will be notified to confirm.');
      } else {
        // User doesn't exist - create invitation and pending time log
        const { data: invitationData, error: invitationError } = await supabase
          .rpc('create_invitation_with_time_log', {
            p_inviter_profile_id: profile.id,
            p_invitee_email: isValidEmail(timeLogForm.contact) ? timeLogForm.contact : '',
            p_invitee_name: timeLogForm.name,
            p_invitee_contact: timeLogForm.contact,
            p_hours: timeLogForm.hours,
            p_description: timeLogForm.description,
            p_service_type: 'general',
            p_mode: timeLogForm.mode
          });

        if (invitationError) throw invitationError;

        alert(`Invitation sent to ${timeLogForm.name}! They'll receive an email to join Yard and confirm the time log.`);
      }

      // Clear the pending time log
      localStorage.removeItem('pendingTimeLog');
      setPendingTimeLog(null);
      setTimeLogForm({
        mode: 'helped',
        hours: 1,
        name: '',
        contact: '',
        description: ''
      });
      
    } catch (error) {
      console.error('Error logging time:', error);
      alert('Error logging time. Please try again.');
    } finally {
      setIsLoggingTime(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('userProfile');
    localStorage.removeItem('pendingTimeLog');
    onBack();
  };

  const timeOptions = [0.5, 1, 1.5, 2, 3, 4, 6, 8];

  return (
    <div className="min-h-screen w-full bg-amber-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back to Home</span>
            </button>
            <div className="text-2xl font-bold text-black italic">yard</div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </header>

        {/* Welcome Section */}
        <div className="bg-white rounded-3xl p-8 shadow-lg mb-8 border border-amber-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome to your workyard, {profile?.display_name || profile?.full_name}!
              </h1>
              <p className="text-gray-600">
                Your professional time tracking and networking hub
              </p>
            </div>
          </div>
        </div>

        {/* Pending Time Log */}
        {pendingTimeLog && (
          <div className="bg-white rounded-3xl p-8 shadow-lg mb-8 border border-amber-100">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5 text-amber-600" />
              <h2 className="font-semibold text-gray-900 text-lg">
                Complete Your Time Log
              </h2>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-200">
              <div className="text-amber-800 text-sm">
                <p className="font-medium mb-1">⏰ Ready to log your time</p>
                <p>
                  {timeLogForm.mode === 'helped' ? 'You helped' : 'You were helped by'} {timeLogForm.name} for {timeLogForm.hours} hours
                </p>
                {timeLogForm.description && (
                  <p className="mt-2 text-amber-700">"{timeLogForm.description}"</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Contact Information
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={timeLogForm.contact}
                      onChange={(e) => setTimeLogForm({ ...timeLogForm, contact: e.target.value })}
                      placeholder="Email or phone"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                    />
                    {isValidEmail(timeLogForm.contact) ? (
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    ) : (
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {isValidEmail(timeLogForm.contact) 
                      ? "We'll check if they're already on Yard or send an invitation"
                      : "Phone numbers will receive SMS invitations"
                    }
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hours
                  </label>
                  <div className="flex gap-2">
                    {timeOptions.slice(0, 4).map((time) => (
                      <button
                        key={time}
                        onClick={() => setTimeLogForm({ ...timeLogForm, hours: time })}
                        className={`px-3 py-2 rounded-xl font-medium transition-all duration-200 text-sm ${
                          timeLogForm.hours === time 
                            ? 'bg-black text-white shadow-md' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {time}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    localStorage.removeItem('pendingTimeLog');
                    setPendingTimeLog(null);
                  }}
                  className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleLogTime}
                  disabled={isLoggingTime || !timeLogForm.contact.trim() || !timeLogForm.name.trim()}
                  className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                >
                  {isLoggingTime ? (
                    <>
                      <Clock size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Log Time
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 p-2 rounded-full">
                <Plus className="w-5 h-5 text-green-700" />
              </div>
              <h3 className="font-semibold text-gray-900">Log New Time</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Track time you've spent helping someone or request time back
            </p>
            <button className="w-full bg-black text-white py-2 rounded-xl hover:bg-gray-800 transition-all duration-200">
              Start Logging
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-full">
                <User className="w-5 h-5 text-blue-700" />
              </div>
              <h3 className="font-semibold text-gray-900">Find Experts</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Search for professionals who can help with your projects
            </p>
            <button className="w-full bg-gray-100 text-gray-700 py-2 rounded-xl hover:bg-gray-200 transition-all duration-200">
              Browse Network
            </button>
          </div>
        </div>

        {/* Time Balance */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Your Time Balance</h2>
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">
              {profile?.time_balance_hours || '0.0'}
            </div>
            <div className="text-gray-600">hours</div>
            <p className="text-sm text-gray-500 mt-4">
              Your time balance updates as you log time and complete transactions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;