import React, { useState } from 'react';
import { X, Clock, User, MessageSquare, Plus, Minus } from 'lucide-react';
import type { TimeLoggingData } from '../types';

interface TimeLoggingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: (data: TimeLoggingData) => void;
}

const TimeLoggingModal = ({ isOpen, onClose, onSignUp }: TimeLoggingModalProps) => {
  const [mode, setMode] = useState<'helped' | 'wasHelped'>('helped');
  const [hours, setHours] = useState(1);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [description, setDescription] = useState('');

  const timeOptions = [0.5, 1, 1.5, 2, 3, 4, 6, 8];

  const handleSignUpToLogTime = () => {
    const timeLoggingData: TimeLoggingData = {
      mode,
      hours,
      name,
      contact,
      description
    };
    onSignUp(timeLoggingData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full relative animate-scale-in shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
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
              <Clock className="w-6 h-6 text-amber-700" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {mode === 'helped' ? 'Log time helping someone' : 'Request time back'}
            </h2>
            <p className="text-gray-600 text-sm">
              {mode === 'helped' 
                ? 'Track the professional assistance you provided'
                : 'Request time from someone who helped you'
              }
            </p>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
            <div className="text-amber-800 text-sm">
              <p className="font-medium mb-1">🎯 Sign up to unlock your workyard</p>
              <p>Time tracking helps you maintain balanced relationships and discover new collaboration opportunities.</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-2">
            <div className="flex gap-2">
              <button
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                  mode === 'helped' 
                    ? 'bg-black text-white shadow-sm' 
                    : 'bg-transparent text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setMode('helped')}
              >
                I helped someone
              </button>
              <button
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                  mode === 'wasHelped' 
                    ? 'bg-black text-white shadow-sm' 
                    : 'bg-transparent text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setMode('wasHelped')}
              >
                Someone helped me
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <User size={14} />
                {mode === 'helped' ? 'Who did you help?' : 'Who helped you?'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full p-2.5 border border-gray-200 rounded-xl mb-2 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
              />
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email or phone number"
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Clock size={14} />
                How many hours?
              </label>
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => setHours(Math.max(0.5, hours - 0.5))}
                  className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-amber-400 hover:bg-amber-50 transition-all duration-200"
                >
                  <Minus size={14} />
                </button>
                <div className="text-center">
                  <span className="text-xl font-bold text-gray-900">{hours}</span>
                  <span className="text-gray-600 ml-1 text-sm">hours</span>
                </div>
                <button
                  onClick={() => setHours(Math.min(8, hours + 0.5))}
                  className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-amber-400 hover:bg-amber-50 transition-all duration-200"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {timeOptions.map((time) => (
                  <button
                    key={time}
                    onClick={() => setHours(time)}
                    className={`px-3 py-1.5 rounded-full font-medium transition-all duration-200 text-sm ${
                      hours === time 
                        ? 'bg-black text-white shadow-md' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {time}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <MessageSquare size={14} />
                What was the work? (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  mode === 'helped'
                    ? 'e.g., Reviewed their pitch deck and gave feedback on messaging'
                    : 'e.g., They helped me debug a React component issue'
                }
                className="w-full p-2.5 border border-gray-200 rounded-xl h-20 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-sm"
              />
            </div>
          </div>

          <button 
            onClick={handleSignUpToLogTime}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            Sign up to log time
          </button>
          
          <p className="text-center text-xs text-gray-500">
            They'll get an invite to join your workyard and confirm this time entry
          </p>
        </div>
      </div>
    </div>
  );
};

export default TimeLoggingModal;