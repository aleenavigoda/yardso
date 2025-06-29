import React from 'react';
import { X, MessageCircle, MapPin, ExternalLink, Github, Linkedin, Twitter, Globe, Bot } from 'lucide-react';

interface ProfileData {
  id: string;
  full_name: string;
  display_name: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  is_available_for_work?: boolean;
  expertise_tags?: string[];
  tools_tags?: string[];
  skills?: string[];
  urls?: Array<{
    url: string;
    url_type: string;
  }>;
  profile_type?: 'user' | 'agent' | 'external';
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileData | null;
}

const ProfileModal = ({ isOpen, onClose, profile }: ProfileModalProps) => {
  if (!isOpen || !profile) return null;

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

  const getUrlIcon = (urlType: string) => {
    switch (urlType) {
      case 'github': return <Github size={16} />;
      case 'linkedin': return <Linkedin size={16} />;
      case 'twitter': return <Twitter size={16} />;
      default: return <Globe size={16} />;
    }
  };

  const getStatusIcon = () => {
    if (profile.profile_type === 'agent') {
      return <Bot size={16} className="text-purple-600" />;
    }
    return null;
  };

  const getStatusLabel = () => {
    if (profile.profile_type === 'agent') {
      return 'AI Agent';
    }
    if (profile.is_available_for_work !== false) {
      return 'Member';
    }
    return 'Member';
  };

  // Combine all skills/tags for display
  const allSkills = [
    ...(profile.skills || []),
    ...(profile.expertise_tags || []),
    ...(profile.tools_tags || [])
  ].filter((skill, index, array) => array.indexOf(skill) === index); // Remove duplicates

  // Mock URLs for demonstration - in a real app, this would come from profile_urls table
  const mockUrls = [
    { url: 'https://subframe.com', url_type: 'website' },
    { url: 'https://linkedin.com/in/profile', url_type: 'linkedin' },
    { url: 'https://twitter.com/profile', url_type: 'twitter' },
    { url: 'https://github.com/profile', url_type: 'github' }
  ];

  const displayUrls = profile.urls || mockUrls;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-md w-full relative animate-scale-in shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors duration-200 z-10"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>

          {/* Share button */}
          <button className="absolute right-12 top-4 text-gray-400 hover:text-gray-600 transition-colors duration-200">
            <ExternalLink size={20} />
          </button>

          {/* Profile Image and Status */}
          <div className="flex flex-col items-center text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold ${getAvatarColor(profile.full_name)} mb-4`}>
              {getInitials(profile.display_name)}
            </div>
            
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium mb-4">
              {getStatusIcon()}
              {getStatusLabel()}
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">{profile.full_name}</h2>

            {/* Message Button */}
            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 mb-6">
              <MessageCircle size={18} />
              Message
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-6">
          {/* Expertise & Tools */}
          {allSkills.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Expertise & Tools
              </h3>
              <div className="space-y-2">
                {allSkills.map((skill, index) => (
                  <div key={index} className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-sm font-medium mr-2 mb-2">
                    {skill}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Profile Summary */}
          {profile.bio && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Profile Summary
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Location */}
          {profile.location && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin size={16} />
              <span>{profile.location}</span>
            </div>
          )}

          {/* Links */}
          {displayUrls.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Links
              </h3>
              <div className="flex gap-3">
                {displayUrls.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors duration-200"
                  >
                    {getUrlIcon(link.url_type)}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;