import React from 'react';
import { Home, BarChart3, LogOut } from 'lucide-react';

interface AuthenticatedHeaderProps {
  currentPage: 'feed' | 'dashboard' | 'main';
  onFeedClick: () => void;
  onDashboardClick: () => void;
  onSignOut: () => void;
  onHomeClick?: () => void;
}

const AuthenticatedHeader = ({ 
  currentPage, 
  onFeedClick, 
  onDashboardClick, 
  onSignOut,
  onHomeClick 
}: AuthenticatedHeaderProps) => {
  return (
    <header className="flex justify-between items-center mb-8">
      <div className="flex items-center gap-4">
        <button
          onClick={onHomeClick}
          className="text-2xl font-bold text-black italic hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
        >
          yard
        </button>
      </div>
      <nav>
        <ul className="flex gap-6 items-center">
          <li>
            <button 
              onClick={onFeedClick}
              className={`flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200 ${
                currentPage === 'feed' ? 'bg-white bg-opacity-50' : ''
              }`}
            >
              <Home size={16} />
              <span className="hidden sm:inline">feed</span>
            </button>
          </li>
          <li>
            <button 
              onClick={onDashboardClick}
              className={`flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200 ${
                currentPage === 'dashboard' ? 'bg-white bg-opacity-50' : ''
              }`}
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
        </ul>
      </nav>
    </header>
  );
};

export default AuthenticatedHeader;