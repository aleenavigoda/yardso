import React, { useState, useEffect } from 'react';
import { Clock, User, CheckCircle, XCircle, Plus, Edit, Bell, Mail, Phone, Zap, Calendar, Users, TrendingUp, FileText, Award, ExternalLink } from 'lucide-react';
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
  is_logger: boolean;
  can_confirm: boolean;
  can_nudge: boolean;
  last_nudged_at?: string;
  nudge_count: number;
}

interface TimeActivity {
  id: string;
  type: 'logged' | 'confirmed' | 'pending';
  other_person: string;
  hours: number;
  description: string;
  created_at: string;
  status: string;
}

interface WorkBounty {
  id: string;
  title: string;
  service_type: string;
  budget_range?: string;
  applications_count: number;
  status: string;
  created_at: string;
}

interface Connection {
  id: string;
  name: string;
  avatar_url?: string;
  last_interaction: string;
  total_hours: number;
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
  const [timeActivities, setTimeActivities] = useState<TimeActivity[]>([]);
  const [workBounties, setWorkBounties] = useState<WorkBounty[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
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
    loadTimeActivities();
    loadWorkBounties();
    loadConnections();
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

  const loadTimeActivities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's profile ID
      const userProfileId = await getUserProfileId(user.id);
      
      // Get recent time transactions for this user
      const { data: transactions, error } = await supabase
        .from('time_transactions')
        .select(`
          id,
          hours,
          description,
          status,
          created_at,
          giver_id,
          receiver_id,
          giver:profiles!time_transactions_giver_id_fkey(id, full_name, display_name),
          receiver:profiles!time_transactions_receiver_id_fkey(id, full_name, display_name),
          logged_by
        `)
        .or(`giver_id.eq.${userProfileId},receiver_id.eq.${userProfileId}`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error loading time activities:', error);
        return;
      }

      // Process transactions to show the other person's name
      const activities: TimeActivity[] = await Promise.all((transactions || []).map(async (t) => {
        // Determine if current user is giver or receiver
        const isGiver = t.giver_id === userProfileId;
        
        // Get the other person's name
        let otherPerson;
        if (isGiver) {
          // If I'm the giver, the other person is the receiver
          if (t.receiver?.full_name) {
            otherPerson = t.receiver.full_name;
          } else if (t.receiver?.display_name) {
            otherPerson = t.receiver.display_name;
          } else {
            // If no profile exists, this might be a pending invitation
            // Check pending_time_logs for the invitee name
            otherPerson = await getPendingInviteeName(t.id) || 'Unknown User';
          }
        } else {
          // If I'm the receiver, the other person is the giver
          if (t.giver?.full_name) {
            otherPerson = t.giver.full_name;
          } else if (t.giver?.display_name) {
            otherPerson = t.giver.display_name;
          } else {
            // If no profile exists, this might be a pending invitation
            // Check pending_time_logs for the invitee name
            otherPerson = await getPendingInviteeName(t.id) || 'Unknown User';
          }
        }
        
        return {
          id: t.id,
          type: t.status === 'pending' ? 'pending' : (t.status === 'confirmed' ? 'confirmed' : 'logged'),
          other_person: otherPerson,
          hours: t.hours,
          description: t.description || '',
          created_at: t.created_at,
          status: t.status
        };
      }));

      setTimeActivities(activities);
    } catch (error) {
      console.error('Error loading time activities:', error);
    }
  };

  // Helper function to get invitee name from pending_time_logs
  const getPendingInviteeName = async (transactionId: string): Promise<string | null> => {
    try {
      // Since we're getting permission denied errors, let's skip this for now
      // and just return null to use the fallback 'Unknown User'
      return null;
    } catch (error) {
      console.error('Error getting invitee name:', error);
      return null;
    }
  };

  const loadWorkBounties = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userProfileId = await getUserProfileId(user.id);
      
      const { data: bounties, error } = await supabase
        .from('work_bounties')
        .select('id, title, service_type, budget_range, applications_count, status, created_at')
        .eq('posted_by', userProfileId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error loading work bounties:', error);
        return;
      }

      setWorkBounties(bounties || []);
    } catch (error) {
      console.error('Error loading work bounties:', error);
    }
  };

  const loadConnections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userProfileId = await getUserProfileId(user.id);
      
      // Get all users who have had time transactions with the current user
      const { data: transactionPartners, error } = await supabase
        .from('time_transactions')
        .select(`
          id,
          giver:profiles!time_transactions_giver_id_fkey(id, full_name, display_name, avatar_url),
          receiver:profiles!time_transactions_receiver_id_fkey(id, full_name, display_name, avatar_url),
          created_at,
          hours
        `)
        .or(`giver_id.eq.${userProfileId},receiver_id.eq.${userProfileId}`)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading transaction partners:', error);
        return;
      }

      // Process transaction partners into connections
      const connectionMap = new Map<string, Connection>();
      
      (transactionPartners || []).forEach(transaction => {
        // Determine if current user is giver or receiver
        const isGiver = transaction.giver.id === userProfileId;
        
        // Get the other person's details
        const otherPerson = isGiver ? transaction.receiver : transaction.giver;
        const otherPersonId = otherPerson.id;
        
        if (!connectionMap.has(otherPersonId)) {
          connectionMap.set(otherPersonId, {
            id: otherPersonId,
            name: otherPerson.full_name || otherPerson.display_name || 'Unknown User',
            avatar_url: otherPerson.avatar_url,
            last_interaction: transaction.created_at,
            total_hours: transaction.hours
          });
        } else {
          // Update existing connection
          const existing = connectionMap.get(otherPersonId)!;
          connectionMap.set(otherPersonId, {
            ...existing,
            total_hours: existing.total_hours + transaction.hours,
            // Update last_interaction if this transaction is more recent
            last_interaction: new Date(transaction.created_at) > new Date(existing.last_interaction) 
              ? transaction.created_at 
              : existing.last_interaction
          });
        }
      });

      // Convert map to array and sort by most recent interaction
      const connectionsList = Array.from(connectionMap.values())
        .sort((a, b) => new Date(b.last_interaction).getTime() - new Date(a.last_interaction).getTime())
        .slice(0, 3); // Take top 3

      setConnections(connectionsList);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const getUserProfileId = async (userId: string): Promise<string> => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();
    return data?.id || '';
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
        await loadTimeActivities();
        await loadConnections();
        
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

  const handleNudgeTransaction = async (transactionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: result, error } = await supabase
        .rpc('nudge_time_transaction', {
          p_transaction_id: transactionId,
          p_user_id: user.id
        });

      if (error) {
        console.error('Error sending nudge:', error);
        alert('Failed to send nudge. Please try again.');
        return;
      }

      if (result.success) {
        // Reload pending transactions to update nudge count
        await loadPendingTransactions();
        alert(result.message || 'Nudge sent successfully');
      } else {
        alert(result.error || 'Failed to send nudge');
      }
    } catch (error) {
      console.error('Error sending nudge:', error);
      alert('Failed to send nudge. Please try again.');
    }
  };

  const handleLogTime = async () => {
    if (!profile) return;

    try {
      setIsLoggingTime(true);

      // Check if the contact is an existing user
      const { data: existingProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, email, full_name')
        .eq('email', timeLogForm.contact)
        .limit(1);

      if (profileError) {
        console.error('Error checking for existing profile:', profileError);
      }

      const existingProfile = existingProfiles && existingProfiles.length > 0 ? existingProfiles[0] : null;

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
          .rpc('create_simple_invitation', {
            p_inviter_profile_id: profile.id,
            p_invitee_email: timeLogForm.contact,
            p_invitee_name: timeLogForm.name,
            p_hours: timeLogForm.hours,
            p_description: timeLogForm.description,
            p_mode: timeLogForm.mode
          });

        if (invitationError) throw invitationError;

        alert(`Invitation created for ${timeLogForm.name}! Share the invitation link with them to join Yard and confirm the time log.`);
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
      
      // Reload data
      await loadPendingTransactions();
      await loadTimeActivities();
      await loadConnections();
      
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
      const { data: existingProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, email, full_name')
        .eq('email', timeLoggingData.contact)
        .limit(1);

      if (profileError) {
        console.error('Error checking for existing profile:', profileError);
      }

      const existingProfile = existingProfiles && existingProfiles.length > 0 ? existingProfiles[0] : null;

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
        // User doesn't exist - create invitation with shareable link
        if (!isValidEmail(timeLoggingData.contact)) {
          throw new Error('Please provide a valid email address for new users');
        }

        const { data: invitationData, error: invitationError } = await supabase
          .rpc('create_simple_invitation', {
            p_inviter_profile_id: profile.id,
            p_invitee_email: timeLoggingData.contact,
            p_invitee_name: timeLoggingData.name,
            p_hours: timeLoggingData.hours,
            p_description: timeLoggingData.description,
            p_mode: timeLoggingData.mode
          });

        if (invitationError) throw invitationError;

        // Generate the invitation link
        const baseUrl = window.location.origin;
        const inviteUrl = `${baseUrl}/invite/${invitationData.invitation_token}`;
        
        // Show the invitation link to the user
        alert(`Invitation created for ${timeLoggingData.name}! Share this link with them to join Yard and confirm the time log: ${inviteUrl}`);
      }

      setIsTimeLoggingOpen(false);
      // Reload data
      await loadPendingTransactions();
      await loadTimeActivities();
      await loadConnections();
    } catch (error) {
      console.error('Error logging time:', error);
      alert('Error logging time. Please try again.');
    }
  };

  const timeOptions = [0.5, 1, 1.5, 2, 3, 4, 6, 8];

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const canNudgeAgain = (lastNudgedAt?: string) => {
    if (!lastNudgedAt) return true;
    const lastNudge = new Date(lastNudgedAt);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastNudge < oneHourAgo;
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    if (!name) return 'bg-gray-400';
    
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

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
                            {transaction.hours} hour{transaction.hours !== 1 ? 's' : ''} • {formatTimeAgo(transaction.created_at)}
                            {transaction.nudge_count > 0 && (
                              <span className="ml-2 text-amber-600">
                                • {transaction.nudge_count} nudge{transaction.nudge_count !== 1 ? 's' : ''} sent
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {transaction.description && (
                        <p className="text-gray-700 text-sm mb-3">"{transaction.description}"</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {transaction.can_confirm ? (
                      // Show confirm/dispute for recipients
                      <>
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
                      </>
                    ) : transaction.can_nudge ? (
                      // Show nudge for loggers
                      <button
                        onClick={() => handleNudgeTransaction(transaction.transaction_id)}
                        disabled={!canNudgeAgain(transaction.last_nudged_at)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!canNudgeAgain(transaction.last_nudged_at) ? 'Please wait 1 hour between nudges' : 'Send a friendly reminder'}
                      >
                        <Zap size={16} />
                        {!canNudgeAgain(transaction.last_nudged_at) ? 'Nudged recently' : 'Nudge'}
                      </button>
                    ) : null}
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
                      placeholder="Email address"
                      className="w-full pl-4 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                    />
                  </div>
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

        {/* New Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Personal Time Feed */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-full">
                  <TrendingUp className="w-5 h-5 text-purple-700" />
                </div>
                <h3 className="font-semibold text-gray-900">Recent Activity</h3>
              </div>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View all
              </button>
            </div>
            
            <div className="space-y-3">
              {timeActivities.length > 0 ? (
                timeActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.type === 'confirmed' ? 'bg-green-500' : 
                      activity.type === 'pending' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.hours}h with {activity.other_person}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.description || 'No description'} • {formatTimeAgo(activity.created_at)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      activity.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      activity.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* Time Balance Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-100 p-2 rounded-full">
                <Clock className="w-5 h-5 text-amber-700" />
              </div>
              <h3 className="font-semibold text-gray-900">Your Time Balance</h3>
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {profile?.time_balance_hours || '0.0'}
              </div>
              <div className="text-gray-600 mb-4">hours</div>
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-lg font-semibold text-green-700">+12.5</div>
                  <div className="text-xs text-green-600">Time Given</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-lg font-semibold text-blue-700">-11.5</div>
                  <div className="text-xs text-blue-600">Time Received</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Work Bounties */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-full">
                  <Award className="w-5 h-5 text-orange-700" />
                </div>
                <h3 className="font-semibold text-gray-900">Your Bounties</h3>
              </div>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View all
              </button>
            </div>
            
            <div className="space-y-3">
              {workBounties.length > 0 ? (
                workBounties.map((bounty) => (
                  <div key={bounty.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 text-sm">{bounty.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        bounty.status === 'open' ? 'bg-green-100 text-green-800' :
                        bounty.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {bounty.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{bounty.service_type}</span>
                      <span>{bounty.applications_count} applications</span>
                    </div>
                    {bounty.budget_range && (
                      <div className="mt-2 text-xs text-gray-600">
                        Budget: {bounty.budget_range}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Award className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No bounties posted</p>
                </div>
              )}
            </div>
          </div>

          {/* Connections */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-full">
                  <Users className="w-5 h-5 text-indigo-700" />
                </div>
                <h3 className="font-semibold text-gray-900">Recent Connections</h3>
              </div>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View all
              </button>
            </div>
            
            <div className="space-y-3">
              {connections.length > 0 ? (
                connections.map((connection) => (
                  <div key={connection.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(connection.name)}`}>
                      {getInitials(connection.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {connection.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {connection.total_hours}h total • {formatTimeAgo(connection.last_interaction)}
                      </p>
                    </div>
                    <button className="text-blue-600 hover:text-blue-700">
                      <ExternalLink size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No connections yet</p>
                </div>
              )}
            </div>
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