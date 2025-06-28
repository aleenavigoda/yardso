import React, { useState, useEffect } from 'react';
import { Clock, User, CheckCircle, XCircle, Plus, Edit, Bell, Mail, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SignOutModal from './SignOutModal';
import EditProfileModal from './EditProfileModal';
import TimeLoggingModal from './TimeLoggingModal';
import AuthenticatedHeader from './AuthenticatedHeader';
import type { TimeLoggingData, Profile, ProfileUrl } from '../types';

interface PendingTransaction {
  transaction_id: string;
  other_person_name: string;
  hours: number;
  description: string;
  mode: string;
  created_at: string;
  is_giver: boolean;
}

interface DashboardProps {
  onBack: () => void;
  onFeedClick: () => void;
  onBrowseNetworkClick: () => void;
}

const Dashboard = ({ onBack, onFeedClick, onBrowseNetworkClick }: DashboardProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileUrls, setProfileUrls] = useState<ProfileUrl[]>([]);
  const [pendingTimeLog, setPendingTimeLog] = useState<TimeLoggingData | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isLoggingTime, setIsLoggingTime] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isTimeLoggingOpen, setIsTimeLoggingOpen] = useState(false);
  const [timeLogForm, setTimeLogForm] = useState({
    mode: 'helped' as 'helped' | 'wasHelped',
    hours: 1,
    name: '',
    contact: '',
    description: ''
  });

  useEffect(() => {
    loadProfileData();
    loadPendingTransactions();
  }, []);

  const loadProfileData = async () => {
    // Load user profile from localStorage
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      const profileData = JSON.parse(userProfile);
      setProfile(profileData);
      
      // Load profile URLs from database
      const { data: urls } = await supabase
        .from('profile_urls')
        .select('*')
        .eq('profile_id', profileData.id)
        .order('created_at', { ascending: true });
      
      if (urls) {
        setProfileUrls(urls);
      }
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
  };

  const loadPendingTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: transactions, error } = await supabase
        .rpc('get_pending_time_transactions', { p_user_id: user.id });

      if (error) {
        console.error('Error loading pending transactions:', error);
        return;
      }

      setPendingTransactions(transactions || []);
    } catch (error) {
      console.error('Error loading pending transactions:', error);
    }
  };

  const handleTransactionAction = async (transactionId: string, action: 'confirmed' | 'disputed', disputeReason?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: result, error } = await supabase
        .rpc('update_time_transaction_status', {
          p_transaction_id: transactionId,
          p_user_id: user.id,
          p_status: action,
          p_dispute_reason: disputeReason || null
        });

      if (error) {
        console.error('Error updating transaction:', error);
        alert('Failed to update transaction. Please try again.');
        return;
      }

      if (result.success) {
        // Reload pending transactions
        await loadPendingTransactions();
        
        // Reload profile to get updated time balance
        const { data: updatedProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (updatedProfile) {
          setProfile(updatedProfile);
          localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        }

        alert(result.message || `Transaction ${action} successfully`);
      } else {
        alert(result.error || 'Failed to update transaction');
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction. Please try again.');
    }
  };

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
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('userProfile');
      localStorage.removeItem('pendingTimeLog');
      setIsSignOutModalOpen(false);
      onBack();
    } catch (error) {
      console.error('Error signing out:', error);
      // Still close modal and redirect even if signOut fails
      setIsSignOutModalOpen(false);
      onBack();
    }
  };

  const handleProfileUpdate = async () => {
    // Reload profile data after update
    if (profile) {
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single();
      
      if (updatedProfile) {
        setProfile(updatedProfile);
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      }
      
      // Reload URLs
      const { data: urls } = await supabase
        .from('profile_urls')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: true });
      
      if (urls) {
        setProfileUrls(urls);
      }
    }
  };

  const handleTimeLoggingDirect = async (timeLoggingData: TimeLoggingData) => {
    if (!profile) return;

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
            giver_id: timeLoggingData.mode === 'helped' ? profile.id : existingProfile.id,
            receiver_id: timeLoggingData.mode === 'helped' ? existingProfile.id : profile.id,
            hours: timeLoggingData.hours,
            description: timeLoggingData.description,
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
      // Reload pending transactions to show any new ones
      await loadPendingTransactions();
    } catch (error) {
      console.error('Error logging time:', error);
      alert('Error logging time. Please try again.');
    }
  };

  const timeOptions = [0.5, 1, 1.5, 2, 3, 4, 6, 8];

  return (
    <div className="min-h-screen w-full bg-amber-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <AuthenticatedHeader
          currentPage="dashboard"
          onFeedClick={onFeedClick}
          onDashboardClick={() => {}} // Already on dashboard
          onSignOut={() => setIsSignOutModalOpen(true)}
          onHomeClick={onBack}
        />

        {/* Welcome Section */}
        <div className="bg-white rounded-3xl p-8 shadow-lg mb-8 border border-amber-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
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
            <button
              onClick={() => setIsEditProfileOpen(true)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-lg transition-all duration-200"
            >
              <Edit size={16} />
              <span className="hidden sm:inline">Edit Profile</span>
            </button>
          </div>

          {/* Profile Info */}
          {(profile?.bio || profileUrls.length > 0) && (
            <div className="border-t border-gray-100 pt-4">
              {profile?.bio && (
                <p className="text-gray-700 mb-3">{profile.bio}</p>
              )}
              {profile?.location && (
                <p className="text-gray-600 text-sm mb-3">📍 {profile.location}</p>
              )}
              {profileUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profileUrls.map((profileUrl) => (
                    <a
                      key={profileUrl.id}
                      href={profileUrl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-all duration-200"
                    >
                      {profileUrl.url_type === 'github' && '🔗'}
                      {profileUrl.url_type === 'linkedin' && '💼'}
                      {profileUrl.url_type === 'twitter' && '🐦'}
                      {profileUrl.url_type === 'portfolio' && '🎨'}
                      {profileUrl.url_type === 'article' && '📝'}
                      {profileUrl.url_type === 'website' && '🌐'}
                      {profileUrl.url_type.charAt(0).toUpperCase() + profileUrl.url_type.slice(1)}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pending Time Transactions */}
        {pendingTransactions.length > 0 && (
          <div className="bg-white rounded-3xl p-8 shadow-lg mb-8 border border-amber-100">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-amber-600" />
              <h2 className="font-semibold text-gray-900 text-lg">
                Pending Time Confirmations
              </h2>
            </div>

            <div className="space-y-4">
              {pendingTransactions.map((transaction) => (
                <div key={transaction.transaction_id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center">
                          <Clock className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {transaction.mode === 'helped' 
                              ? `You helped ${transaction.other_person_name}`
                              : `${transaction.other_person_name} helped you`
                            }
                          </p>
                          <p className="text-sm text-gray-600">
                            {transaction.hours} hour{transaction.hours !== 1 ? 's' : ''} • {new Date(transaction.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {transaction.description && (
                        <p className="text-gray-700 text-sm mb-3">"{transaction.description}"</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleTransactionAction(transaction.transaction_id, 'confirmed')}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm"
                    >
                      <CheckCircle size={16} />
                      Confirm
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Please provide a reason for disputing this time entry:');
                        if (reason) {
                          handleTransactionAction(transaction.transaction_id, 'disputed', reason);
                        }
                      }}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm"
                    >
                      <XCircle size={16} />
                      Dispute
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                      className="w-full pl-4 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                    />
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
            <button 
              onClick={() => setIsTimeLoggingOpen(true)}
              className="w-full bg-black text-white py-2 rounded-xl hover:bg-gray-800 transition-all duration-200"
            >
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
            <button 
              onClick={onBrowseNetworkClick}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded-xl hover:bg-gray-200 transition-all duration-200"
            >
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

      {/* Sign Out Modal */}
      <SignOutModal
        isOpen={isSignOutModalOpen}
        onClose={() => setIsSignOutModalOpen(false)}
        onConfirm={handleSignOut}
        userName={profile?.display_name || profile?.full_name}
      />

      {/* Edit Profile Modal */}
      {profile && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          profile={profile}
          profileUrls={profileUrls}
          onProfileUpdate={handleProfileUpdate}
        />
      )}

      {/* Time Logging Modal */}
      <TimeLoggingModal
        isOpen={isTimeLoggingOpen}
        onClose={() => setIsTimeLoggingOpen(false)}
        onLogTime={handleTimeLoggingDirect}
        isAuthenticated={true}
      />
    </div>
  );
};

export default Dashboard;