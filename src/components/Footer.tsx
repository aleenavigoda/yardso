import React, { useState } from 'react';
import { Info, ExternalLink, X } from 'lucide-react';

const Footer = () => {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <>
      <footer className="mt-20 pb-8">
        <div className="flex justify-center">
          <button
            onClick={() => setIsAboutOpen(true)}
            className="flex items-center gap-2 text-gray-700 hover:text-black transition-colors duration-200 hover:underline"
          >
            <Info size={16} />
            about yard
          </button>
        </div>
      </footer>

      {isAboutOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full relative animate-scale-in">
            <button
              onClick={() => setIsAboutOpen(false)}
              className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900">About Yard</h3>
              <p className="text-gray-700 leading-relaxed">
                Yard is the social network CRM for professionals who merge work with play. 
                Where time becomes currency and expertise flows freely through your network.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Yard is incubated by{' '}
                <a
                  href="https://publics.world"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1 hover:underline"
                >
                  The Publics
                  <ExternalLink size={14} />
                </a>
                , a social strategy studio building internet-native public goods infrastructures.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;