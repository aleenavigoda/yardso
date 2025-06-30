import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, User, Mail, Lock, Loader2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InvitationData {
  id: string;
  inviter_name: string;
  invitee_name: string;
  invitee_email: string;
  hours: number;
  mode: string;
  description?: string;
  expires_at: string;
  status: string;
}

const InviteSignUpPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (token) {
      loadInvitation();
    } else {
      setError('No invitation token provided');
      setIsLoading(false);
    }
  }, [token]);

  const loadInvitation = async () => {
    try {
      setIsLoading(true);
      console.log('Loading invitation with token:', token);
      
      // First, let's debug what we can find about this token
      const { data: debugResult, error: debugError } = await supabase
        .rpc('get_invitation_by_token', { p_token: token });

      console.log('Debug result:', debugResult);
      setDebugInfo(debugResult);

      if (debugError) {
        console.error('Debug error:', debugError);
      }

      // Fetch invitation details using the token
      const { data: invitationData, error } = await supabase
        .from('invitations')
        .select(`
          id,
          full_name,
          email,
          status,
          expires_at,
          inviter:profiles!invitations_inviter_id_fkey(full_name, display_name)
        `)
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      console.log('Invitation data:', invitationData);
      console.log('Invitation error:', error);

      if (error || !invitationData) {
        // Try to get more info about this token
        const { data: allInvitations } = await supabase
          .from('invitations')
          .select('id, email, status, expires_at, token')
          .eq('token', token);

        console.log('All invitations with this token:', allInvitations);

        if (allInvitations && allInvitations.length > 0) {
          const inv = allInvitations[0];
          if (inv.status !== 'pending') {
            setError(`This invitation has already been ${inv.status}`);
          } else if (new Date(inv.expires_at) < new Date()) {
            setError('This invitation has expired');
          } else {
            setError('Unable to load invitation details');
          }
        } else {
          setError('Invalid invitation link');
        }
        return;
      }

      // Check if invitation has expired
      if (new Date(invitationData.expires_at) < new Date()) {
        setError('This invitation has expired');
        return;
      }

      // Get pending time log details
      const { data: pendingTimeLog } = await supabase
        .from('pending_time_logs')
        .select('hours, description, mode')
        .eq('invitation_id', invitationData.id)
        .single();

      console.log('Pending time log:', pendingTimeLog);

      setInvitation({
        id: invitationData.id,
        inviter_name: invitationData.inviter?.full_name || invitationData.inviter?.display_name || 'Someone',
        invitee_name: invitationData.full_name,
        invitee_email: invitationData.email,
        hours: pendingTimeLog?.hours || 1,
        mode: pendingTimeLog?.mode || 'helped',
        description: pendingTimeLog?.description,
        expires_at: invitationData.expires_at,
        status: invitationData.status
      });

    } catch (error) {
      console.error('Error loading invitation:', error);
      setError('Failed to load invitation details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invitation) return;
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSigningUp(true);
    setError('');

    try {
      console.log('Signing up user:', invitation.invitee_email);
      
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.invitee_email,
        password: formData.password,
        options: {
          data: {
            full_name: invitation.invitee_name
          }
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      console.log('User created successfully:', authData.user.id);

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('Error updating invitation status:', updateError);
      }

      // The user will be automatically signed in and redirected to dashboard
      // The pending time log will be converted automatically by the database trigger
      
      alert('Account created successfully! Welcome to Yard!');
      navigate('/');

    } catch (error: any) {
      console.error('Sign up error:', error);
      setError(error.message || 'Failed to create account');
    } finally {
      setIsSigningUp(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-amber-200 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-black italic mb-4">yard</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
          <div className="text-sm text-gray-600 mt-4">Loading invitation...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full bg-amber-200 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center">
          <div className="text-2xl font-bold text-black italic mb-6">yard</div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200 mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="text-red-800 font-medium">{error}</p>
          </div>
          
          {/* Debug information for development */}
          {debugInfo && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6 text-left">
              <h4 className="font-medium text-gray-900 mb-2">Debug Info:</h4>
              <pre className="text-xs text-gray-600 overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
          
          <button
            onClick={() => navigate('/')}
            className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors duration-200"
          >
            Go to Yard
          </button>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  const actionText = invitation.mode === 'helped' ? 'helped you' : 'you helped them';

  return (
    <div className="min-h-screen w-full bg-amber-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-black italic mb-6">yard</div>
          <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're invited to Yard!</h1>
          <p className="text-gray-600 text-sm">
            Join the professional time tracking and networking platform
          </p>
        </div>

        {/* Invitation Details */}
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 mb-6">
          <div className="text-amber-800 text-sm">
            <p className="font-medium mb-2">⏰ Time Log Waiting for You</p>
            <p className="mb-1">
              <strong>{invitation.inviter_name}</strong> wants to track{' '}
              <strong>{invitation.hours} hour{invitation.hours !== 1 ? 's' : ''}</strong>{' '}
              where {actionText}
            </p>
            {invitation.description && (
              <p className="text-amber-700 text-xs mt-2 italic">
                "{invitation.description}"
              </p>
            )}
          </div>
        </div>

        {/* Sign Up Form */}
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <User size={14} />
              Full Name
            </label>
            <input
              type="text"
              value={invitation.invitee_name}
              disabled
              className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600 text-sm"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Mail size={14} />
              Email
            </label>
            <input
              type="email"
              value={invitation.invitee_email}
              disabled
              className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600 text-sm"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Lock size={14} />
              Create Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Create a secure password"
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
              required
              minLength={6}
              disabled={isSigningUp}
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
              disabled={isSigningUp}
            />
          </div>

          {error && (
            <div className="bg-red-50 rounded-xl p-3 border border-red-200">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSigningUp || !formData.password || !formData.confirmPassword}
            className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {isSigningUp ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating your account...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Join Yard & Confirm Time
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          By joining, you agree to our terms of service and privacy policy
        </p>
      </div>
    </div>
  );
};

export default InviteSignUpPage;