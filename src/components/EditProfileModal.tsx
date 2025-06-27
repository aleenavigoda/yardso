import React, { useState, useEffect } from 'react';
import { X, User, MapPin, Link, Save, Loader2, ExternalLink, Github, Linkedin, Twitter, Globe, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile, ProfileUrl } from '../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  profileUrls: ProfileUrl[];
  onProfileUpdate: () => void;
}

const EditProfileModal = ({ isOpen, onClose, profile, profileUrls, onProfileUpdate }: EditProfileModalProps) => {
  const [formData, setFormData] = useState({
    bio: profile.bio || '',
    location: profile.location || '',
    urls: ['', '', '', '', '']
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Initialize form with existing data
      const urlsArray = ['', '', '', '', ''];
      profileUrls.forEach((profileUrl, index) => {
        if (index < 5) {
          urlsArray[index] = profileUrl.url;
        }
      });
      
      setFormData({
        bio: profile.bio || '',
        location: profile.location || '',
        urls: urlsArray
      });
      setError('');
    }
  }, [isOpen, profile, profileUrls]);

  const detectUrlType = (url: string): string => {
    if (url.includes('github.com')) return 'github';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('behance.net') || url.includes('dribbble.com')) return 'portfolio';
    if (url.includes('medium.com') || url.includes('substack.com')) return 'article';
    return 'website';
  };

  const getUrlIcon = (urlType: string) => {
    switch (urlType) {
      case 'github': return <Github size={16} />;
      case 'linkedin': return <Linkedin size={16} />;
      case 'twitter': return <Twitter size={16} />;
      default: return <Globe size={16} />;
    }
  };

  const getUrlLabel = (urlType: string) => {
    switch (urlType) {
      case 'github': return 'GitHub';
      case 'linkedin': return 'LinkedIn';
      case 'twitter': return 'Twitter';
      case 'portfolio': return 'Portfolio';
      case 'article': return 'Article';
      case 'website': return 'Website';
      default: return 'Link';
    }
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...formData.urls];
    newUrls[index] = value;
    setFormData({ ...formData, urls: newUrls });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          bio: formData.bio.trim() || null,
          location: formData.location.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // Delete existing URLs
      const { error: deleteError } = await supabase
        .from('profile_urls')
        .delete()
        .eq('profile_id', profile.id);

      if (deleteError) throw deleteError;

      // Add new URLs
      const validUrls = formData.urls.filter(url => url.trim() !== '');
      if (validUrls.length > 0) {
        const urlInserts = validUrls.map(url => ({
          profile_id: profile.id,
          url: url.trim(),
          url_type: detectUrlType(url.trim()),
        }));

        const { error: urlError } = await supabase
          .from('profile_urls')
          .insert(urlInserts);

        if (urlError) throw urlError;
      }

      onProfileUpdate();
      onClose();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'An error occurred while updating your profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Edit Your Profile</h2>
            <p className="text-gray-600 text-sm">
              Update your bio, location, and links
            </p>
          </div>

          {error && (
            <div className="bg-red-50 rounded-xl p-3 border border-red-200">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <User size={14} />
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell people about yourself and what you do..."
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm h-24 resize-none"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.bio.length}/500 characters
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <MapPin size={14} />
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City, Country"
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Link size={14} />
                Links (up to 5)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Add links to your GitHub, portfolio, articles, or projects
              </p>
              <div className="space-y-2">
                {formData.urls.map((url, index) => (
                  <div key={index} className="relative">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      placeholder={`Link ${index + 1} (optional)`}
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
                    />
                    {url && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        {getUrlIcon(detectUrlType(url))}
                        <span className="text-xs text-gray-500">
                          {getUrlLabel(detectUrlType(url))}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-black hover:bg-gray-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;