import React, { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Users, ChevronDown, X, DollarSign, Calendar, Target, CheckCircle, ExternalLink, Github, Linkedin, Twitter, Globe, Bot, UserCheck, MessageCircle, Loader2, UserPlus, LogIn, Home, BarChart3, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import ProfileModal from './ProfileModal';

interface NetworkUser {
  id: string;
  full_name: string;
  display_name: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  is_available_for_work?: boolean;
  time_balance_hours?: number;
  skills?: string[];
  hourly_rate_range?: string;
  preferred_work_types?: string[];
  profile_type: 'user' | 'agent' | 'external';
  source_platform?: string;
  source_url?: string;
  profile_url?: string;
  company?: string;
  job_title?: string;
  follower_count?: number;
  is_verified?: boolean;
  expertise_tags?: string[];
  tools_tags?: string[];
  platform?: string;
}

interface FilterState {
  serviceType: string;
  deliverableFormat: string;
  timeline: string;
  industry: string;
  timeEstimate: string;
  companyStage: string;
  profileType: string;
}

interface BrowseNetworkProps {
  onBack: () => void;
  onFeedClick: () => void;
  onDashboardClick: () => void;
  onSignOut: () => void;
  isAuthenticated?: boolean;
  onPromptSignIn?: () => void;
}

const BrowseNetwork = ({ 
  onBack, 
  onFeedClick, 
  onDashboardClick, 
  onSignOut, 
  isAuthenticated = false,
  onPromptSignIn 
}: BrowseNetworkProps) => {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<NetworkUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<NetworkUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<NetworkUser | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showBountyForm, setShowBountyForm] = useState(false);
  const [isSubmittingBounty, setIsSubmittingBounty] = useState(false);
  const [bountySubmitted, setBountySubmitted] = useState(false);
  const [bountyData, setBountyData] = useState({
    budget: '',
    description: ''
  });
  const [pagination, setPagination] = useState({
    page: 0,
    pageSize: 20,
    hasMore: true,
    totalCount: 0
  });

  // Parse search parameters from URL
  const urlSearchParams = {
    query: searchParams.get('query') || '',
    serviceType: searchParams.get('serviceType') || '',
    deliverableFormat: searchParams.get('deliverableFormat') || '',
    timeline: searchParams.get('timeline') || '',
    industry: searchParams.get('industry') || '',
    timeEstimate: searchParams.get('timeEstimate') || '',
    companyStage: searchParams.get('companyStage') || ''
  };
  
  const [filters, setFilters] = useState<FilterState>({
    serviceType: urlSearchParams.serviceType,
    deliverableFormat: urlSearchParams.deliverableFormat,
    timeline: urlSearchParams.timeline,
    industry: urlSearchParams.industry,
    timeEstimate: urlSearchParams.timeEstimate,
    companyStage: urlSearchParams.companyStage,
    profileType: ''
  });

  // Set initial search query from URL
  useEffect(() => {
    if (urlSearchParams.query) {
      setSearchQuery(urlSearchParams.query);
    }
  }, []);

  // Landing page search parameters - exact same as SearchForm
  const serviceTypes = [
    'Design Critique', 'Code Review', 'Strategy Consultation', 'Mentorship', 
    'Legal Review', 'Financial Analysis', 'Technical Consultation', 'Marketing Strategy'
  ];

  const deliverableFormats = [
    'Live Consultation', 'Written Feedback', 'Video Call', 'Documentation', 'Workshop Session'
  ];

  const timelines = [
    'Immediate', 'Within 48 hours', 'This week', 'Next week', 'Flexible'
  ];

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Education', 'Entertainment', 'Other'
  ];

  const timeEstimates = [
    '1-2 hours', 'Half day', 'Full day', 'Multiple days', 'Ongoing project'
  ];

  const companyStages = [
    'Pre-seed', 'Seed', 'Series A', 'Series B+', 'Public Company', 'Not applicable'
  ];

  const profileTypes = [
    { value: '', label: 'All profiles' },
    { value: 'user', label: 'Yard members' },
    { value: 'agent', label: 'AI agents' },
    { value: 'external', label: 'External profiles' }
  ];

  useEffect(() => {
    loadUsers(true); // Reset pagination on initial load
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchQuery, filters]);

  const loadUsers = async (reset = false) => {
    try {
      if (reset) {
        setIsLoading(true);
        setPagination(prev => ({ ...prev, page: 0, hasMore: true }));
      } else {
        setIsLoadingMore(true);
      }
      
      const currentPage = reset ? 0 : pagination.page;
      const offset = currentPage * pagination.pageSize;
      
      console.log(`🔄 Loading users - Page: ${currentPage}, Offset: ${offset}, PageSize: ${pagination.pageSize}`);
      
      // Load regular users (non-agents from profiles table)
      const { data: regularUsers, error: regularError, count: regularCount } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          display_name,
          bio,
          location,
          avatar_url,
          is_available_for_work,
          time_balance_hours,
          hourly_rate_range,
          preferred_work_types,
          is_agent
        `, { count: 'exact' })
        .eq('is_agent', false)
        .range(offset, offset + pagination.pageSize - 1);

      console.log('👥 Regular users loaded:', regularUsers?.length || 0, 'Total count:', regularCount);
      if (regularError) console.error('❌ Regular users error:', regularError);

      // Load agent profiles from agent_profiles table
      const { data: agentUsers, error: agentError, count: agentCount } = await supabase
        .from('agent_profiles')
        .select(`
          id,
          full_name,
          display_name,
          bio,
          time_balance_hours
        `, { count: 'exact' })
        .range(offset, offset + pagination.pageSize - 1);

      console.log('🤖 Agent users loaded:', agentUsers?.length || 0, 'Total count:', agentCount);
      if (agentError) console.error('❌ Agent users error:', agentError);

      // Load external profiles using the correct structure
      const { data: externalUsers, error: externalError, count: externalCount } = await supabase
        .from('external_profiles')
        .select(`
          id,
          name,
          location,
          profile_summary,
          avatar_url,
          expertise_tags,
          tools_tags,
          platform,
          profile_url
        `, { count: 'exact' })
        .not('name', 'is', null)
        .range(offset, offset + pagination.pageSize - 1);

      console.log('🌐 External users loaded:', externalUsers?.length || 0, 'Total count:', externalCount);
      if (externalError) console.error('❌ External users error:', externalError);

      // Combine and format users
      const newUsers: NetworkUser[] = [];

      // Add regular users
      if (regularUsers) {
        const formattedRegularUsers = regularUsers.map(user => ({
          ...user,
          full_name: user.full_name || user.display_name || 'Unknown User',
          display_name: user.display_name || user.full_name || 'Unknown',
          is_available_for_work: user.is_available_for_work ?? true,
          skills: getRandomSkills(),
          profile_type: 'user' as const,
        }));
        newUsers.push(...formattedRegularUsers);
        console.log('✅ Added regular users:', formattedRegularUsers.length);
      }

      // Add agent profiles
      if (agentUsers && agentUsers.length > 0) {
        const formattedAgentUsers = agentUsers.map(user => ({
          ...user,
          full_name: user.full_name || user.display_name || 'AI Agent',
          display_name: user.display_name || user.full_name || 'Agent',
          location: 'Virtual', // Mock location since column doesn't exist
          is_available_for_work: true,
          skills: getRandomSkills(),
          preferred_work_types: getRandomWorkTypes(),
          profile_type: 'agent' as const,
        }));
        newUsers.push(...formattedAgentUsers);
        console.log('✅ Added agent users:', formattedAgentUsers.length);
      } else {
        console.log('⚠️ No agent users found in database');
      }

      // Add external profiles
      if (externalUsers) {
        const formattedExternalUsers = externalUsers.map(user => ({
          id: user.id,
          full_name: user.name || 'External User',
          display_name: user.name || 'External',
          bio: user.profile_summary,
          location: user.location,
          avatar_url: user.avatar_url,
          is_available_for_work: true,
          skills: [...(user.expertise_tags || []), ...(user.tools_tags || [])],
          profile_type: 'external' as const,
          platform: user.platform,
          profile_url: user.profile_url,
          expertise_tags: user.expertise_tags,
          tools_tags: user.tools_tags,
        }));
        newUsers.push(...formattedExternalUsers);
        console.log('✅ Added external users:', formattedExternalUsers.length);
      }

      // Calculate total count and pagination info
      const totalCount = (regularCount || 0) + (agentCount || 0) + (externalCount || 0);
      const hasMore = (offset + pagination.pageSize) < totalCount;

      console.log('📊 Pagination info:', {
        currentPage,
        offset,
        pageSize: pagination.pageSize,
        newUsersLoaded: newUsers.length,
        totalCount,
        hasMore
      });

      if (reset) {
        setUsers(newUsers);
      } else {
        setUsers(prev => [...prev, ...newUsers]);
      }

      setPagination(prev => ({
        ...prev,
        page: currentPage + 1,
        hasMore,
        totalCount
      }));

    } catch (error) {
      console.error('💥 Error loading users:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMoreUsers = () => {
    if (!isLoadingMore && pagination.hasMore) {
      loadUsers(false);
    }
  };

  const getRandomSkills = () => {
    const availableSkills = [
      'JavaScript', 'React', 'Node.js', 'Python', 'UI/UX Design', 
      'Product Strategy', 'Legal Review', 'Marketing Strategy', 'Data Analysis',
      'Fundraising', 'Code Review', 'Design Critique', 'Business Development'
    ];
    const shuffled = [...availableSkills].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.floor(Math.random() * 4) + 2);
  };

  const getRandomWorkTypes = () => {
    const availableWorkTypes = [
      'consulting', 'mentoring', 'code_review', 'design_critique', 
      'strategy_session', 'legal_review', 'technical_consultation'
    ];
    const shuffled = [...availableWorkTypes].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.floor(Math.random() * 3) + 1);
  };

  const applyFilters = () => {
    let filtered = [...users];

    console.log('🔍 Applying filters to', filtered.length, 'users');
    console.log('🔍 Profile type filter:', filters.profileType);

    // Profile type filter
    if (filters.profileType) {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(user => user.profile_type === filters.profileType);
      console.log(`🔍 Profile type filter: ${beforeFilter} → ${filtered.length} (filtering for '${filters.profileType}')`);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const beforeFilter = filtered.length;
      filtered = filtered.filter(user => 
        user.full_name?.toLowerCase().includes(query) ||
        user.display_name?.toLowerCase().includes(query) ||
        user.bio?.toLowerCase().includes(query) ||
        user.skills?.some(skill => skill.toLowerCase().includes(query)) ||
        user.location?.toLowerCase().includes(query) ||
        user.platform?.toLowerCase().includes(query) ||
        user.expertise_tags?.some(tag => tag.toLowerCase().includes(query)) ||
        user.tools_tags?.some(tag => tag.toLowerCase().includes(query))
      );
      console.log(`🔍 Search filter: ${beforeFilter} → ${filtered.length} (query: '${query}')`);
    }

    // Service Type filter - map to relevant skills
    if (filters.serviceType) {
      const skillMapping: { [key: string]: string[] } = {
        'Design Critique': ['UI/UX Design', 'Design Critique', 'UI/UX', 'Design'],
        'Code Review': ['JavaScript', 'React', 'Node.js', 'Python', 'Code Review', 'Programming'],
        'Strategy Consultation': ['Product Strategy', 'Business Development', 'Strategy'],
        'Legal Review': ['Legal Review', 'Legal'],
        'Financial Analysis': ['Data Analysis', 'Fundraising', 'Finance'],
        'Technical Consultation': ['JavaScript', 'React', 'Node.js', 'Python', 'Technical'],
        'Marketing Strategy': ['Marketing Strategy', 'Marketing'],
        'Mentorship': ['Product Strategy', 'Business Development', 'Mentorship']
      };

      const relevantSkills = skillMapping[filters.serviceType] || [];
      if (relevantSkills.length > 0) {
        const beforeFilter = filtered.length;
        filtered = filtered.filter(user =>
          user.skills?.some(skill => 
            relevantSkills.some(relevantSkill => 
              skill.toLowerCase().includes(relevantSkill.toLowerCase())
            )
          ) ||
          user.expertise_tags?.some(tag => 
            relevantSkills.some(relevantSkill => 
              tag.toLowerCase().includes(relevantSkill.toLowerCase())
            )
          )
        );
        console.log(`🔍 Service type filter: ${beforeFilter} → ${filtered.length} (service: '${filters.serviceType}')`);
      }
    }

    // Industry filter - could map to user bio/background
    if (filters.industry && filters.industry !== 'Other') {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(user =>
        user.bio?.toLowerCase().includes(filters.industry.toLowerCase()) ||
        user.skills?.some(skill => 
          skill.toLowerCase().includes(filters.industry.toLowerCase())
        ) ||
        user.platform?.toLowerCase().includes(filters.industry.toLowerCase())
      );
      console.log(`🔍 Industry filter: ${beforeFilter} → ${filtered.length} (industry: '${filters.industry}')`);
    }

    // Timeline filter - could affect availability
    if (filters.timeline === 'Immediate') {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(user => user.is_available_for_work);
      console.log(`🔍 Timeline filter: ${beforeFilter} → ${filtered.length} (immediate availability)`);
    }

    console.log('🔍 Final filtered users:', filtered.length);
    console.log('🔍 Agent users in filtered results:', filtered.filter(u => u.profile_type === 'agent').length);

    setFilteredUsers(filtered);
  };

  const handleProfileClick = (user: NetworkUser) => {
    if (user.profile_type === 'external') {
      // For external profiles, open their profile URL
      if (user.profile_url) {
        window.open(user.profile_url, '_blank', 'noopener,noreferrer');
      }
    } else {
      // For regular users and agents, show the profile modal
      setSelectedProfile(user);
      setIsProfileModalOpen(true);
    }
  };

  const clearFilters = () => {
    setFilters({
      serviceType: '',
      deliverableFormat: '',
      timeline: '',
      industry: '',
      timeEstimate: '',
      companyStage: '',
      profileType: ''
    });
    setSearchQuery('');
  };

  const handleSubmitBounty = async () => {
    // Check if user is authenticated first
    if (!isAuthenticated) {
      if (onPromptSignIn) {
        onPromptSignIn();
      } else {
        alert('Please sign in to submit a bounty');
      }
      return;
    }

    if (!urlSearchParams.query && !urlSearchParams.serviceType) {
      alert('No search parameters found to create bounty');
      return;
    }

    if (!bountyData.budget) {
      alert('Please select a budget range');
      return;
    }

    setIsSubmittingBounty(true);
    
    try {
      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Create the bounty using the RPC function
      const { data: bountyId, error } = await supabase.rpc('create_bounty_from_search', {
        p_posted_by: profile.id,
        p_title: urlSearchParams.query || `${urlSearchParams.serviceType} Request`,
        p_description: urlSearchParams.query || `Looking for ${urlSearchParams.serviceType?.toLowerCase()} assistance`,
        p_service_type: urlSearchParams.serviceType || 'Design Critique',
        p_deliverable_format: urlSearchParams.deliverableFormat || 'Live Consultation',
        p_timeline: urlSearchParams.timeline || 'Immediate',
        p_industry: urlSearchParams.industry || 'Technology',
        p_time_estimate: urlSearchParams.timeEstimate || '1-2 hours',
        p_company_stage: urlSearchParams.companyStage || 'Pre-seed',
        p_budget_range: bountyData.budget,
        p_requirements: bountyData.description || null
      });

      if (error) throw error;

      setBountySubmitted(true);
      setShowBountyForm(false);
      setBountyData({ budget: '', description: '' });

      // Show success message for 3 seconds
      setTimeout(() => {
        setBountySubmitted(false);
      }, 3000);

    } catch (error) {
      console.error('Error creating bounty:', error);
      alert('Failed to submit bounty. Please try again.');
    } finally {
      setIsSubmittingBounty(false);
    }
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

  const getServiceTypeColor = (serviceType: string) => {
    const colors = {
      'Legal Review': 'bg-green-100 text-green-800',
      'Design Critique': 'bg-blue-100 text-blue-800',
      'Strategy Consultation': 'bg-purple-100 text-purple-800',
      'Technical Consultation': 'bg-orange-100 text-orange-800',
      'Marketing Strategy': 'bg-pink-100 text-pink-800'
    };
    return colors[serviceType as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getProfileTypeIcon = (profileType: string) => {
    switch (profileType) {
      case 'agent':
        return <Bot size={12} className="text-purple-600" />;
      case 'external':
        return <ExternalLink size={12} className="text-blue-600" />;
      case 'user':
        return <UserCheck size={12} className="text-green-600" />;
      default:
        return null;
    }
  };

  const getProfileTypeLabel = (profileType: string) => {
    switch (profileType) {
      case 'agent':
        return 'AI Agent';
      case 'external':
        return 'External';
      case 'user':
        return 'Member';
      default:
        return '';
    }
  };

  const getSourcePlatformIcon = (platform?: string) => {
    if (!platform) return <Globe size={12} />;
    
    switch (platform.toLowerCase()) {
      case 'github':
        return <Github size={12} />;
      case 'linkedin':
        return <Linkedin size={12} />;
      case 'twitter':
        return <Twitter size={12} />;
      case 'dribbble':
      case 'behance':
        return <Globe size={12} />;
      default:
        return <Globe size={12} />;
    }
  };

  const activeFiltersCount = 
    (filters.serviceType ? 1 : 0) +
    (filters.deliverableFormat ? 1 : 0) +
    (filters.timeline ? 1 : 0) +
    (filters.industry ? 1 : 0) +
    (filters.timeEstimate ? 1 : 0) +
    (filters.companyStage ? 1 : 0) +
    (filters.profileType ? 1 : 0);

  // Check if we have search parameters from URL
  const hasSearchParams = Object.values(urlSearchParams).some(value => value !== '');

  return (
    <div className="min-h-screen w-full bg-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-2xl font-bold text-black italic hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
            >
              yard
            </button>
          </div>
          <nav>
            <ul className="flex gap-6 items-center">
              {isAuthenticated ? (
                <>
                  <li>
                    <button 
                      onClick={onFeedClick}
                      className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
                    >
                      <Home size={16} />
                      <span className="hidden sm:inline">feed</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={onDashboardClick}
                      className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
                    >
                      <BarChart3 size={16} />
                      <span className="hidden sm:inline">dashboard</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onSignOut}
                      className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
                    >
                      <LogOut size={16} />
                      <span className="hidden sm:inline">sign out</span>
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <button 
                      onClick={onPromptSignIn}
                      className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
                    >
                      <UserPlus size={16} />
                      <span className="hidden sm:inline">sign up</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={onPromptSignIn}
                      className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
                    >
                      <LogIn size={16} />
                      <span className="hidden sm:inline">sign in</span>
                    </button>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </header>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Browse Network</h1>
          <p className="text-gray-700">
            {hasSearchParams ? 'Professionals matching your request' : 'Discover professionals in your network'}
          </p>
        </div>

        {/* Success Message */}
        {bountySubmitted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-green-800 font-medium">Bounty submitted successfully!</p>
              <p className="text-green-700 text-sm">Your work request has been posted and professionals can now apply.</p>
            </div>
          </div>
        )}

        {/* Search Parameters Summary with Bounty Option */}
        {hasSearchParams && (
          <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-200 hover:border-gray-300 transition-colors duration-200 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 break-words">
                    {urlSearchParams.query || `${urlSearchParams.serviceType} Request`}
                  </h3>
                  {urlSearchParams.serviceType && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getServiceTypeColor(urlSearchParams.serviceType)} self-start`}>
                      {urlSearchParams.serviceType}
                    </span>
                  )}
                </div>
                
                {urlSearchParams.query && (
                  <p className="text-gray-600 text-sm mb-3 break-words">
                    {urlSearchParams.query}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {urlSearchParams.timeEstimate && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Target size={14} className="flex-shrink-0" />
                  <span className="truncate">{urlSearchParams.timeEstimate}</span>
                </div>
              )}
              {urlSearchParams.timeline && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={14} className="flex-shrink-0" />
                  <span className="truncate">{urlSearchParams.timeline}</span>
                </div>
              )}
              {urlSearchParams.deliverableFormat && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Target size={14} className="flex-shrink-0" />
                  <span className="truncate">{urlSearchParams.deliverableFormat}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={14} className="flex-shrink-0" />
                <span className="truncate">Remote</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor('Your Request')} flex-shrink-0`}>
                  YR
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    Your Request
                  </div>
                  <p className="text-xs text-gray-500">Just now</p>
                </div>
              </div>
              
              {!showBountyForm ? (
                <button
                  onClick={() => setShowBountyForm(true)}
                  className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors duration-200 text-sm font-medium flex-shrink-0 ml-3 flex items-center gap-2"
                >
                  <DollarSign size={16} />
                  Submit Bounty
                </button>
              ) : (
                <div className="flex gap-2 ml-3">
                  <button
                    onClick={() => setShowBountyForm(false)}
                    className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors duration-200 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitBounty}
                    disabled={!bountyData.budget || isSubmittingBounty}
                    className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmittingBounty ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <DollarSign size={16} />
                        Submit Bounty
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Bounty Form */}
            {showBountyForm && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget Range</label>
                    <select
                      value={bountyData.budget}
                      onChange={(e) => setBountyData({ ...bountyData, budget: e.target.value })}
                      className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="">Select budget range</option>
                      <option value="$100-300">$100-300</option>
                      <option value="$300-500">$300-500</option>
                      <option value="$500-800">$500-800</option>
                      <option value="$800-1200">$800-1200</option>
                      <option value="$1200-2000">$1200-2000</option>
                      <option value="$2000-3000">$2000-3000</option>
                      <option value="$3000+">$3000+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Additional Details</label>
                    <textarea
                      value={bountyData.description}
                      onChange={(e) => setBountyData({ ...bountyData, description: e.target.value })}
                      placeholder="Any additional requirements or context..."
                      className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 h-20 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-amber-100 mb-8">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-lg border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all duration-200"
              placeholder="Search by name, skills, location..."
            />
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200"
            >
              <Filter size={16} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown size={16} className={`transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-amber-700 hover:text-amber-800 text-sm font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Profile Type</label>
                  <select
                    value={filters.profileType}
                    onChange={(e) => setFilters(prev => ({ ...prev, profileType: e.target.value }))}
                    className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {profileTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Service Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Service Type</label>
                  <select
                    value={filters.serviceType}
                    onChange={(e) => setFilters(prev => ({ ...prev, serviceType: e.target.value }))}
                    className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">All service types</option>
                    {serviceTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Timeline */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Timeline</label>
                  <select
                    value={filters.timeline}
                    onChange={(e) => setFilters(prev => ({ ...prev, timeline: e.target.value }))}
                    className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">All timelines</option>
                    {timelines.map(timeline => (
                      <option key={timeline} value={timeline}>{timeline}</option>
                    ))}
                  </select>
                </div>

                {/* Industry */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Industry</label>
                  <select
                    value={filters.industry}
                    onChange={(e) => setFilters(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">All industries</option>
                    {industries.map(industry => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-700">
            {isLoading ? 'Loading...' : `${filteredUsers.length} professionals found`}
            {!isLoading && (
              <span className="text-gray-500 text-sm ml-2">
                ({filteredUsers.filter(u => u.profile_type === 'user').length} members, {filteredUsers.filter(u => u.profile_type === 'agent').length} AI agents, {filteredUsers.filter(u => u.profile_type === 'external').length} external)
              </span>
            )}
            {pagination.totalCount > 0 && (
              <span className="text-gray-500 text-sm ml-2">
                • Total: {pagination.totalCount} in database
              </span>
            )}
          </p>
        </div>

        {/* User Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100 animate-pulse">
                <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No professionals found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
            <button
              onClick={clearFilters}
              className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors duration-200"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  onClick={() => handleProfileClick(user)}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100 hover:shadow-md hover:border-amber-200 transition-all duration-200 cursor-pointer group"
                >
                  {/* Avatar and Status */}
                  <div className="text-center mb-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-bold ${getAvatarColor(user.full_name)} mx-auto mb-3 group-hover:scale-110 transition-transform duration-200 relative`}>
                      {getInitials(user.display_name)}
                      
                      {/* Profile type indicator */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center border-2 border-white">
                        {getProfileTypeIcon(user.profile_type)}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                        {getProfileTypeIcon(user.profile_type)}
                        {getProfileTypeLabel(user.profile_type)}
                      </div>
                    </div>
                  </div>

                  {/* Name and Location */}
                  <div className="text-center mb-4">
                    <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors duration-200">
                      {user.full_name}
                    </h3>
                    
                    {user.location && (
                      <div className="flex items-center justify-center gap-1 text-gray-500 text-sm">
                        <MapPin size={12} />
                        <span className="truncate">{user.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Bio */}
                  {user.bio && (
                    <p className="text-gray-600 text-sm text-center mb-4 line-clamp-2">
                      {user.bio}
                    </p>
                  )}

                  {/* Skills */}
                  {user.skills && user.skills.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {user.skills.slice(0, 3).map((skill, index) => (
                          <span
                            key={index}
                            className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                        {user.skills.length > 3 && (
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium">
                            +{user.skills.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer info */}
                  <div className="text-center">
                    {user.profile_type === 'external' ? (
                      user.platform && (
                        <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
                          {getSourcePlatformIcon(user.platform)}
                          <span className="capitalize">{user.platform}</span>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center justify-center gap-1 text-sm text-blue-600 font-medium">
                        <MessageCircle size={12} />
                        <span>Connect</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {pagination.hasMore && !isLoading && (
              <div className="text-center mt-8">
                <button
                  onClick={loadMoreUsers}
                  disabled={isLoadingMore}
                  className="bg-black text-white px-8 py-3 rounded-xl hover:bg-gray-800 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    `Load More (${pagination.totalCount - filteredUsers.length} remaining)`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Profile Modal - only for non-external profiles */}
      {selectedProfile && selectedProfile.profile_type !== 'external' && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          profile={selectedProfile}
        />
      )}
    </div>
  );
};

export default BrowseNetwork;