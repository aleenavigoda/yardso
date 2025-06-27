import React from 'react';
import { Clock, Users } from 'lucide-react';

interface TimeLoggingBannerProps {
  onLogTime: () => void;
}

const TimeLoggingBanner = ({ onLogTime }: TimeLoggingBannerProps) => {
  return (
    <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm border border-amber-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-amber-100 p-3 rounded-full">
            <Users className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Just finished working with someone?</h3>
            <p className="text-gray-600 text-sm">
              Track your time and keep your professional network balanced
            </p>
          </div>
        </div>
        <button
          onClick={onLogTime}
          className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full hover:bg-gray-800 transition-all duration-200 transform hover:scale-105 shadow-lg"
        >
          <Clock size={16} />
          <span className="font-medium">Log Time</span>
        </button>
      </div>
    </div>
  );
};

export default TimeLoggingBanner;