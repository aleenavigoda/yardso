import React, { useState } from 'react';
import { Search, ChevronDown, Sparkles } from 'lucide-react';

interface SearchFormProps {
  searchValue: string;
  setSearchValue: (value: string) => void;
}

const SearchForm = ({ searchValue, setSearchValue }: SearchFormProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGetConnected = () => {
    if (searchValue.trim()) {
      setIsExpanded(true);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg mb-8 border border-amber-100">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-5 h-5 text-amber-600" />
        <h2 className="font-semibold text-gray-900 text-sm tracking-wide uppercase border-b border-gray-200 pb-2 flex-1">
          Find a Workmate
        </h2>
      </div>
      
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all duration-200"
          placeholder="What are you working on?"
        />
      </div>

      {isExpanded && (
        <div className="space-y-6 mt-6 border-t border-gray-100 pt-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Service Type
              </label>
              <select className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200">
                <option>Design Critique</option>
                <option>Code Review</option>
                <option>Strategy Consultation</option>
                <option>Mentorship</option>
                <option>Legal Review</option>
                <option>Financial Analysis</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Deliverable Format
              </label>
              <select className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200">
                <option>Live Consultation</option>
                <option>Written Feedback</option>
                <option>Video Call</option>
                <option>Documentation</option>
                <option>Workshop Session</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Timeline</label>
              <select className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200">
                <option>Immediate</option>
                <option>Within 48 hours</option>
                <option>This week</option>
                <option>Next week</option>
                <option>Flexible</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Industry</label>
              <select className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200">
                <option>Technology</option>
                <option>Healthcare</option>
                <option>Finance</option>
                <option>Education</option>
                <option>Entertainment</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Time Estimate
              </label>
              <select className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200">
                <option>1-2 hours</option>
                <option>Half day</option>
                <option>Full day</option>
                <option>Multiple days</option>
                <option>Ongoing project</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Company Stage
              </label>
              <select className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200">
                <option>Pre-seed</option>
                <option>Seed</option>
                <option>Series A</option>
                <option>Series B+</option>
                <option>Public Company</option>
                <option>Not applicable</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <button className="bg-black text-white px-8 py-3 rounded-full hover:bg-gray-800 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium">
              Submit Request
            </button>
          </div>
        </div>
      )}

      {!isExpanded && (
        <div className="flex justify-end">
          <button
            onClick={handleGetConnected}
            className="bg-black text-white px-8 py-3 rounded-full hover:bg-gray-800 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium flex items-center gap-2"
          >
            Get Connected
            <ChevronDown size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchForm;