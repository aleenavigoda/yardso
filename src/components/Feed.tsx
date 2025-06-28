import React, { useState, useEffect } from 'react';
import { TrendingUp, Clock, Users, ArrowUpDown, Search, MapPin, DollarSign, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AuthenticatedHeader from './AuthenticatedHeader';
import ProfileModal from './ProfileModal';

interface TimeTransaction {
  id: string;
  giver_id: string;
  receiver_id: string;
  hours: number;
  description: string;
  service_type: string;
  status: string;
  created_at: string;
  giver: {
    id: string;
    full_name: string;
    display_name: string;
  };
  receiver: {
    id: string;
    full_name: string;
    display_name: string;
  };
}

interface GroupedTransaction {
  id: string;
  giver: {
    id: string;
    full_name: string;
    display_name: string;
  };
  receivers: Array<{
    id: string;
    full_name: string;
    display_name: string;
  }>;
  hours: number;
  description: string;
  service_type: string;
  created_at: string;
  is_group: boolean;
  is_balanced?: boolean;
}

interface WorkBounty {
  id: string;
  title: string;
  description: string;
  service_type: string;
  timeline: string;
  industry: string;
  time_estimate: string;
  company_stage: string;
  budget_range?: string;
  location?: string;
  posted_by: string;
  posted_at: string;
  status: 'open' | 'in_progress' | 'completed';
  applications_count?: number;
}

interface ProfileData {
  id: string;
  full_name: string;
  display_name: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  is_available_for_work?: boolean;
}

interface FeedProps {
  onBack: () => void;
  onDashboardClick: () => void;
  onSignOut: () => void;
}

const Feed = ({ onBack, onDashboardClick, onSignOut }: FeedProps) => {
  const [activeTab, setActiveTab] = useState<'flows' | 'discover'>('flows');
  const [transactions, setTransactions] = useState<GroupedTransaction[]>([]);
  const [bounties, setBounties] = useState<WorkBounty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    if (activeTab === 'flows') {
      loadTransactions();
    } else {
      loadBounties();
    }
  }, [activeTab]);

  const handleProfileClick = (profile: { id: string; full_name: string; display_name: string }) => {
    // Mock profile data - in a real app, you'd fetch this from the database
    const mockProfileData: ProfileData = {
      id: profile.id,
      full_name: profile.full_name,
      display_name: profile.display_name,
      bio: 'Experienced professional in their field with a passion for helping others grow and succeed.',
      location: 'San Francisco, CA',
      is_available_for_work: true
    };
    
    setSelectedProfile(mockProfileData);
    setIsProfileModalOpen(true);
  };

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      // Get recent confirmed transactions from regular users
      const { data: userTransactions, error: userError } = await supabase
        .from('time_transactions')
        .select(`
          id,
          giver_id,
          receiver_id,
          hours,
          description,
          service_type,
          status,
          created_at,
          giver:profiles!time_transactions_giver_id_fkey(id, full_name, display_name),
          receiver:profiles!time_transactions_receiver_id_fkey(id, full_name, display_name)
        `)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (userError) {
        console.error('Error loading user transactions:', userError);
      }

      // Get recent transactions from agent profiles
      const { data: agentTransactions, error: agentError } = await supabase
        .from('agent_time_transactions')
        .select(`
          id,
          giver_id,
          receiver_id,
          hours,
          description,
          service_type,
          status,
          created_at,
          giver:agent_profiles!agent_time_transactions_giver_id_fkey(id, full_name, display_name),
          receiver:agent_profiles!agent_time_transactions_receiver_id_fkey(id, full_name, display_name)
        `)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(15);

      if (agentError) {
        console.error('Error loading agent transactions:', agentError);
      }

      // Combine both sets of transactions
      const allTransactions = [
        ...(userTransactions || []),
        ...(agentTransactions || [])
      ];

      // Group transactions by giver, description, and time (within 1 hour)
      const grouped = groupTransactions(allTransactions);
      
      // Check for balanced exchanges
      const withBalanceInfo = await addBalanceInfo(grouped);
      
      setTransactions(withBalanceInfo);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBounties = async () => {
    try {
      setIsLoading(true);
      
      // Load real bounties from database
      const { data: realBounties, error: bountiesError } = await supabase
        .from('work_bounties')
        .select(`
          id,
          title,
          description,
          service_type,
          timeline,
          industry,
          time_estimate,
          company_stage,
          budget_range,
          location,
          applications_count,
          created_at,
          status,
          posted_by:profiles!work_bounties_posted_by_fkey(full_name)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);

      if (bountiesError) {
        console.error('Error loading bounties:', bountiesError);
      }

      // Format bounties for display
      const formattedBounties: WorkBounty[] = (realBounties || []).map(bounty => ({
        id: bounty.id,
        title: bounty.title,
        description: bounty.description,
        service_type: bounty.service_type,
        timeline: bounty.timeline,
        industry: bounty.industry,
        time_estimate: bounty.time_estimate,
        company_stage: bounty.company_stage,
        budget_range: bounty.budget_range,
        location: bounty.location || 'Remote',
        posted_by: bounty.posted_by?.full_name || 'Anonymous',
        posted_at: bounty.created_at,
        status: bounty.status as 'open' | 'in_progress' | 'completed',
        applications_count: bounty.applications_count || 0
      }));

      // Add some mock bounties if we don't have enough real ones
      const mockBounties: WorkBounty[] = [
        {
          id: 'mock-1',
          title: 'Legal review of Series A term sheet',
          description: 'Need an experienced startup lawyer to review our Series A term sheet. Looking for someone who has worked with VCs before and can spot potential issues.',
          service_type: 'Legal Review',
          timeline: 'Within 48 hours',
          industry: 'Technology',
          time_estimate: '2-3 hours',
          company_stage: 'Series A',
          budget_range: '$500-800',
          location: 'Remote',
          posted_by: 'Sarah Chen',
          posted_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'open',
          applications_count: 3
        },
        {
          id: 'mock-2',
          title: 'UX critique on social app interface',
          description: 'Looking for a senior UX designer to provide detailed feedback on our social networking app. Need someone with experience in mobile-first design.',
          service_type: 'Design Critique',
          timeline: 'This week',
          industry: 'Technology',
          time_estimate: '1-2 hours',
          company_stage: 'Seed',
          budget_range: '$300-500',
          location: 'Remote',
          posted_by: 'Mike Rodriguez',
          posted_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          status: 'open',
          applications_count: 1
        }
      ];

      // Combine real and mock bounties
      const allBounties = [...formattedBounties, ...mockBounties];
      setBounties(allBounties);
      
    } catch (error) {
      console.error('Error loading bounties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupTransactions = (transactions: TimeTransaction[]): GroupedTransaction[] => {
    const groups: { [key: string]: GroupedTransaction } = {};

    transactions.forEach(transaction => {
      // Create a key for grouping: giver_id + description + time_window
      const timeWindow = Math.floor(new Date(transaction.created_at).getTime() / (1000 * 60 * 60)); // Hour window
      const groupKey = `${transaction.giver_id}_${transaction.description}_${timeWindow}`;

      if (groups[groupKey]) {
        // Add to existing group
        groups[groupKey].receivers.push(transaction.receiver);
        groups[groupKey].is_group = true;
      } else {
        // Create new group
        groups[groupKey] = {
          id: transaction.id,
          giver: transaction.giver,
          receivers: [transaction.receiver],
          hours: transaction.hours,
          description: transaction.description,
          service_type: transaction.service_type,
          created_at: transaction.created_at,
          is_group: false
        };
      }
    });

    return Object.values(groups).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const addBalanceInfo = async (transactions: GroupedTransaction[]): Promise<GroupedTransaction[]> => {
    // For each transaction, check if there's a reciprocal transaction within 24 hours
    const withBalance = await Promise.all(
      transactions.map(async (transaction) => {
        if (transaction.is_group) {
          return transaction; // Skip balance check for group transactions
        }

        const receiver = transaction.receivers[0];
        
        // Look for reciprocal transaction in both regular and agent transactions
        const timeRange = {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        // Check regular transactions
        const { data: reciprocalUser } = await supabase
          .from('time_transactions')
          .select('hours')
          .eq('giver_id', receiver.id)
          .eq('receiver_id', transaction.giver.id)
          .eq('status', 'confirmed')
          .gte('created_at', timeRange.start)
          .lte('created_at', timeRange.end);

        // Check agent transactions
        const { data: reciprocalAgent } = await supabase
          .from('agent_time_transactions')
          .select('hours')
          .eq('giver_id', receiver.id)
          .eq('receiver_id', transaction.giver.id)
          .eq('status', 'confirmed')
          .gte('created_at', timeRange.start)
          .lte('created_at', timeRange.end);

        const reciprocal = [...(reciprocalUser || []), ...(reciprocalAgent || [])];
        const isBalanced = reciprocal.length > 0 && 
          Math.abs(reciprocal[0].hours - transaction.hours) < 0.5;

        return {
          ...transaction,
          is_balanced: isBalanced
        };
      })
    );

    return withBalance;
  };

  const getServiceTypeColor = (serviceType: string) => {
    const colors = {
      legal: 'text-green-600',
      design: 'text-blue-600',
      analysis: 'text-purple-600',
      strategy: 'text-orange-600',
      general: 'text-gray-600'
    };
    return colors[serviceType as keyof typeof colors] || colors.general;
  };

  const getServiceTypeLabel = (serviceType: string) => {
    const labels = {
      legal: 'legal consultation',
      design: 'UX design',
      analysis: 'data analysis',
      strategy: 'strategy session',
      general: 'consultation'
    };
    return labels[serviceType as keyof typeof labels] || serviceType;
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const getBountyTypeColor = (serviceType: string) => {
    const colors = {
      'Legal Review': 'bg-green-100 text-green-800',
      'Design Critique': 'bg-blue-100 text-blue-800',
      'Strategy Consultation': 'bg-purple-100 text-purple-800',
      'Technical Consultation': 'bg-orange-100 text-orange-800',
      'Marketing Strategy': 'bg-pink-100 text-pink-800'
    };
    return colors[serviceType as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const renderTimeFlows = () => (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="flex items-start gap-3 p-4 hover:bg-gray-50 rounded-xl transition-colors duration-200">
          {/* Avatar(s) */}
          <div className="flex items-center flex-shrink-0">
            {transaction.is_group ? (
              <div className="flex -space-x-2">
                <button
                  onClick={() => handleProfileClick(transaction.giver)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(transaction.giver.full_name)} border-2 border-white hover:scale-110 transition-transform duration-200`}
                >
                  {getInitials(transaction.giver.display_name)}
                </button>
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 text-xs font-medium border-2 border-white">
                  <Users size={12} />
                </div>
                {transaction.receivers.slice(0, 2).map((receiver, index) => (
                  <button
                    key={receiver.id}
                    onClick={() => handleProfileClick(receiver)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(receiver.full_name)} border-2 border-white hover:scale-110 transition-transform duration-200`}
                  >
                    {getInitials(receiver.display_name)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  onClick={() => handleProfileClick(transaction.giver)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(transaction.giver.full_name)} hover:scale-110 transition-transform duration-200`}
                >
                  {getInitials(transaction.giver.display_name)}
                </button>
                {transaction.is_balanced && (
                  <div className="mx-2">
                    <ArrowUpDown size={16} className="text-green-600" />
                  </div>
                )}
                <button
                  onClick={() => handleProfileClick(transaction.receivers[0])}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(transaction.receivers[0].full_name)} hover:scale-110 transition-transform duration-200`}
                >
                  {getInitials(transaction.receivers[0].display_name)}
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile Layout */}
            <div className="block md:hidden">
              <div className="mb-2">
                <button
                  onClick={() => handleProfileClick(transaction.giver)}
                  className="font-medium text-gray-900 hover:text-blue-600 transition-colors duration-200"
                >
                  {transaction.giver.display_name}
                </button>
                <span className="text-gray-600 ml-1">
                  {transaction.is_group ? 'facilitated' : (transaction.is_balanced ? 'exchanged' : 'provided')}
                </span>
              </div>
              <div className="mb-2">
                <span className={`font-medium ${getServiceTypeColor(transaction.service_type)}`}>
                  {transaction.hours}h {getServiceTypeLabel(transaction.service_type)}
                </span>
              </div>
              <div className="mb-2">
                <span className="text-gray-600">
                  {transaction.is_group ? 'with' : (transaction.is_balanced ? 'with' : 'to')}
                </span>
                {transaction.is_group ? (
                  <span className="font-medium text-gray-900 ml-1">
                    {transaction.receivers.map((r, index) => (
                      <button
                        key={r.id}
                        onClick={() => handleProfileClick(r)}
                        className="hover:text-blue-600 transition-colors duration-200"
                      >
                        {r.display_name}
                        {index < transaction.receivers.length - 1 && ', '}
                      </button>
                    ))}
                    {transaction.receivers.length > 2 && ` and ${transaction.receivers.length - 2} others`}
                  </span>
                ) : (
                  <button
                    onClick={() => handleProfileClick(transaction.receivers[0])}
                    className="font-medium text-gray-900 hover:text-blue-600 transition-colors duration-200 ml-1"
                  >
                    {transaction.receivers[0].display_name}
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-500">
                <div className="mb-1">"{transaction.description}"</div>
                <div>{formatTimeAgo(transaction.created_at)}</div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:block">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <button
                  onClick={() => handleProfileClick(transaction.giver)}
                  className="font-medium text-gray-900 hover:text-blue-600 transition-colors duration-200"
                >
                  {transaction.giver.display_name}
                </button>
                <span className="text-gray-600">
                  {transaction.is_group ? 'facilitated' : (transaction.is_balanced ? 'exchanged' : 'provided')}
                </span>
                <span className={`font-medium ${getServiceTypeColor(transaction.service_type)}`}>
                  {transaction.hours}h {getServiceTypeLabel(transaction.service_type)}
                </span>
                <span className="text-gray-600">
                  {transaction.is_group ? 'with' : (transaction.is_balanced ? 'with' : 'to')}
                </span>
                {transaction.is_group ? (
                  <span className="font-medium text-gray-900">
                    {transaction.receivers.map((r, index) => (
                      <button
                        key={r.id}
                        onClick={() => handleProfileClick(r)}
                        className="hover:text-blue-600 transition-colors duration-200"
                      >
                        {r.display_name}
                        {index < transaction.receivers.length - 1 && ', '}
                      </button>
                    ))}
                    {transaction.receivers.length > 2 && ` and ${transaction.receivers.length - 2} others`}
                  </span>
                ) : (
                  <button
                    onClick={() => handleProfileClick(transaction.receivers[0])}
                    className="font-medium text-gray-900 hover:text-blue-600 transition-colors duration-200"
                  >
                    {transaction.receivers[0].display_name}
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>"{transaction.description}"</span>
                <span>•</span>
                <span>{formatTimeAgo(transaction.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex-shrink-0">
            {transaction.is_balanced && !transaction.is_group ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Balanced
              </span>
            ) : transaction.is_group ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Group
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                +{transaction.hours}h
              </span>
            )}
          </div>
        </div>
      ))}

      {transactions.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No recent time flows to show</p>
          <p className="text-gray-400 text-sm">Time transactions will appear here as they're confirmed</p>
        </div>
      )}
    </div>
  );

  const renderDiscover = () => (
    <div className="space-y-4">
      {bounties.map((bounty) => (
        <div key={bounty.id} className="bg-white rounded-xl p-4 md:p-6 border border-gray-200 hover:border-gray-300 transition-colors duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 break-words">{bounty.title}</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBountyTypeColor(bounty.service_type)} self-start`}>
                  {bounty.service_type}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-3 break-words">{bounty.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock size={14} className="flex-shrink-0" />
              <span className="truncate">{bounty.time_estimate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar size={14} className="flex-shrink-0" />
              <span className="truncate">{bounty.timeline}</span>
            </div>
            {bounty.budget_range && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <DollarSign size={14} className="flex-shrink-0" />
                <span className="truncate">{bounty.budget_range}</span>
              </div>
            )}
            {bounty.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={14} className="flex-shrink-0" />
                <span className="truncate">{bounty.location}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => handleProfileClick({ 
                  id: 'bounty-poster', 
                  full_name: bounty.posted_by, 
                  display_name: bounty.posted_by.split(' ')[0] 
                })}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(bounty.posted_by)} hover:scale-110 transition-transform duration-200 flex-shrink-0`}
              >
                {getInitials(bounty.posted_by)}
              </button>
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => handleProfileClick({ 
                    id: 'bounty-poster', 
                    full_name: bounty.posted_by, 
                    display_name: bounty.posted_by.split(' ')[0] 
                  })}
                  className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors duration-200 block truncate"
                >
                  {bounty.posted_by}
                </button>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatTimeAgo(bounty.posted_at)}</span>
                  {bounty.applications_count !== undefined && bounty.applications_count > 0 && (
                    <>
                      <span>•</span>
                      <span>{bounty.applications_count} application{bounty.applications_count !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors duration-200 text-sm font-medium flex-shrink-0 ml-3">
              Apply
            </button>
          </div>
        </div>
      ))}

      {bounties.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No open bounties available</p>
          <p className="text-gray-400 text-sm">New work opportunities will appear here</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-amber-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <AuthenticatedHeader
          currentPage="feed"
          onFeedClick={() => {}} // Already on feed
          onDashboardClick={onDashboardClick}
          onSignOut={onSignOut}
          onHomeClick={onBack}
        />

        {/* Tabs */}
        <div className="bg-white rounded-2xl p-2 mb-6 shadow-sm border border-amber-100">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('flows')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                activeTab === 'flows'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <TrendingUp size={16} />
              <span className="hidden sm:inline">Time Flows</span>
              <span className="sm:hidden">Flows</span>
            </button>
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                activeTab === 'discover'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Search size={16} />
              <span>Discover</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-3xl p-4 md:p-8 shadow-lg border border-amber-100">
          <div className="flex items-center gap-3 mb-6">
            {activeTab === 'flows' ? (
              <>
                <TrendingUp className="w-5 h-5 text-amber-600" />
                <h2 className="font-semibold text-gray-900 text-lg">Recent Time Flows</h2>
              </>
            ) : (
              <>
                <Search className="w-5 h-5 text-amber-600" />
                <h2 className="font-semibold text-gray-900 text-lg">Open Work Bounties</h2>
              </>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            activeTab === 'flows' ? renderTimeFlows() : renderDiscover()
          )}
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={selectedProfile}
      />
    </div>
  );
};

export default Feed;