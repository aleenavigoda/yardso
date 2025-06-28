import React, { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Clock, Star, Users, ChevronDown, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AuthenticatedHeader from './AuthenticatedHeader';
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
}

interface SearchParams {
  query?: string;
  serviceType?: string;
  deliverableFormat?: string;
  timeline?: string;
  industry?: string;
  timeEstimate?: string;
  companyStage?: string;
}

interface FilterState {
  serviceType: string;
  deliverableFormat: string;
  timeline: string;
  industry: string;
  timeEstimate: string;
  companyStage: string;
}

interface BrowseNetworkProps {
  onBack: () => void;
  onFeedClick: () => void;
  onDashboardClick: () => void;
  onSignOut: () => void;
  searchParams?: SearchParams;
}

const BrowseNetwork = ({ onBack, onFeedClick, onDashboardClick, onSignOut, searchParams }: BrowseNetworkProps) => {
  const [users, setUsers] = useState<NetworkUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<NetworkUser[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams?.query || '');
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<NetworkUser | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    serviceType: searchParams?.serviceType || '',
    deliverableFormat: searchParams?.deliverableFormat || '',
    timeline: searchParams?.timeline || '',
    industry: searchParams?.industry || '',
    timeEstimate: searchParams?.timeEstimate || '',
    companyStage: searchParams?.companyStage || ''
  });

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

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchQuery, filters]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      // Load both regular users and agent profiles
      const { data: regularUsers, error: regularError } = await supabase
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
          preferred_work_types
        `)
        .eq('is_agent', false)
        .limit(20);

      const { data: agentUsers, error: agentError } = await supabase
        .from('agent_profiles')
        .select(`
          id,
          full_name,
          display_name,
          bio,
          location,
          time_balance_hours
        `)
        .limit(10);

      if (regularError) console.error('Error loading regular users:', regularError);
      if (agentError) console.error('Error loading agent users:', agentError);

      // Combine and format users
      const allUsers: NetworkUser[] = [
        ...(regularUsers || []).map(user => ({
          ...user,
          is_available_for_work: user.is_available_for_work ?? true,
          skills: getRandomSkills(), // Mock skills for demo
        })),
        ...(agentUsers || []).map(user => ({
          ...user,
          is_available_for_work: true,
          skills: getRandomSkills(), // Mock skills for demo
          preferred_work_types: getRandomWorkTypes(), // Mock work types for demo
        }))
      ];

      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
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

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.full_name?.toLowerCase().includes(query) ||
        user.display_name?.toLowerCase().includes(query) ||
        user.bio?.toLowerCase().includes(query) ||
        user.skills?.some(skill => skill.toLowerCase().includes(query)) ||
        user.location?.toLowerCase().includes(query)
      );
    }

    // Service Type filter - map to relevant skills
    if (filters.serviceType) {
      const skillMapping: { [key: string]: string[] } = {
        'Design Critique': ['UI/UX Design', 'Design Critique'],
        'Code Review': ['JavaScript', 'React', 'Node.js', 'Python', 'Code Review'],
        'Strategy Consultation': ['Product Strategy', 'Business Development'],
        'Legal Review': ['Legal Review'],
        'Financial Analysis': ['Data Analysis', 'Fundraising'],
        'Technical Consultation': ['JavaScript', 'React', 'Node.js', 'Python'],
        'Marketing Strategy': ['Marketing Strategy'],
        'Mentorship': ['Product Strategy', 'Business Development']
      };

      const relevantSkills = skillMapping[filters.serviceType] || [];
      if (relevantSkills.length > 0) {
        filtered = filtered.filter(user =>
          user.skills?.some(skill => 
            relevantSkills.some(relevantSkill => 
              skill.toLowerCase().includes(relevantSkill.toLowerCase())
            )
          )
        );
      }
    }

    // Industry filter - could map to user bio/background
    if (filters.industry && filters.industry !== 'Other') {
      filtered = filtered.filter(user =>
        user.bio?.toLowerCase().includes(filters.industry.toLowerCase()) ||
        user.skills?.some(skill => 
          skill.toLowerCase().includes(filters.industry.toLowerCase())
        )
      );
    }

    // Timeline filter - could affect availability
    if (filters.timeline === 'Immediate') {
      filtered = filtered.filter(user => user.is_available_for_work);
    }

    setFilteredUsers(filtered);
  };

  const handleProfileClick = (user: NetworkUser) => {
    setSelectedProfile(user);
    setIsProfileModalOpen(true);
  };

  const clearFilters = () => {
    setFilters({
      serviceType: '',
      deliverableFormat: '',
      timeline: '',
      industry: '',
      timeEstimate: '',
      companyStage: ''
    });
    setSearchQuery('');
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

  const getTimeBalanceColor = (balance: number) => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const activeFiltersCount = 
    (filters.serviceType ? 1 : 0) +
    (filters.deliverableFormat ? 1 : 0) +
    (filters.timeline ? 1 : 0) +
    (filters.industry ? 1 : 0) +
    (filters.timeEstimate ? 1 : 0) +
    (filters.companyStage ? 1 : 0);

  return (
    <div className="min-h-screen w-full bg-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <AuthenticatedHeader
          currentPage="main"
          onFeedClick={onFeedClick}
          onDashboardClick={onDashboardClick}
          onSignOut={onSignOut}
          onHomeClick={onBack}
        />

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Browse Network</h1>
          <p className="text-gray-700">
            {searchParams ? 'Professionals matching your request' : 'Discover professionals in your network'}
          </p>
        </div>

        {/* Search Parameters Summary (if coming from landing page) */}
        {searchParams && (
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-amber-100 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Your Request</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {searchParams.serviceType && (
                <div>
                  <span className="text-gray-500">Service Type:</span>
                  <span className="ml-2 font-medium">{searchParams.serviceType}</span>
                </div>
              )}
              {searchParams.deliverableFormat && (
                <div>
                  <span className="text-gray-500">Format:</span>
                  <span className="ml-2 font-medium">{searchParams.deliverableFormat}</span>
                </div>
              )}
              {searchParams.timeline && (
                <div>
                  <span className="text-gray-500">Timeline:</span>
                  <span className="ml-2 font-medium">{searchParams.timeline}</span>
                </div>
              )}
              {searchParams.industry && (
                <div>
                  <span className="text-gray-500">Industry:</span>
                  <span className="ml-2 font-medium">{searchParams.industry}</span>
                </div>
              )}
              {searchParams.timeEstimate && (
                <div>
                  <span className="text-gray-500">Time Estimate:</span>
                  <span className="ml-2 font-medium">{searchParams.timeEstimate}</span>
                </div>
              )}
              {searchParams.companyStage && (
                <div>
                  <span className="text-gray-500">Company Stage:</span>
                  <span className="ml-2 font-medium">{searchParams.companyStage}</span>
                </div>
              )}
            </div>
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

                {/* Deliverable Format */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Deliverable Format</label>
                  <select
                    value={filters.deliverableFormat}
                    onChange={(e) => setFilters(prev => ({ ...prev, deliverableFormat: e.target.value }))}
                    className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">All formats</option>
                    {deliverableFormats.map(format => (
                      <option key={format} value={format}>{format}</option>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Time Estimate */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Time Estimate</label>
                  <select
                    value={filters.timeEstimate}
                    onChange={(e) => setFilters(prev => ({ ...prev, timeEstimate: e.target.value }))}
                    className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">All time estimates</option>
                    {timeEstimates.map(estimate => (
                      <option key={estimate} value={estimate}>{estimate}</option>
                    ))}
                  </select>
                </div>

                {/* Company Stage */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Company Stage</label>
                  <select
                    value={filters.companyStage}
                    onChange={(e) => setFilters(prev => ({ ...prev, companyStage: e.target.value }))}
                    className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">All company stages</option>
                    {companyStages.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredUsers.map(user => (
              <div
                key={user.id}
                onClick={() => handleProfileClick(user)}
                className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100 hover:shadow-md hover:border-amber-200 transition-all duration-200 cursor-pointer group"
              >
                {/* Avatar and Status */}
                <div className="text-center mb-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-bold ${getAvatarColor(user.full_name)} mx-auto mb-3 group-hover:scale-110 transition-transform duration-200`}>
                    {getInitials(user.display_name)}
                  </div>
                  
                  {user.is_available_for_work && (
                    <div className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      Available
                    </div>
                  )}
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

                {/* Time Balance */}
                {user.time_balance_hours !== undefined && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm">
                      <Clock size={12} />
                      <span className={`font-medium ${getTimeBalanceColor(user.time_balance_hours)}`}>
                        {user.time_balance_hours > 0 ? '+' : ''}{user.time_balance_hours}h
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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

export default BrowseNetwork;