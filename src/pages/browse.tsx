import React, { useState, useEffect } from 'react';
import BrowseNetwork from '../components/BrowseNetwork';

interface SearchParams {
  query?: string;
  serviceType?: string;
  deliverableFormat?: string;
  timeline?: string;
  industry?: string;
  timeEstimate?: string;
  companyStage?: string;
}

function BrowsePage() {
  const [searchParams, setSearchParams] = useState<SearchParams | undefined>();

  useEffect(() => {
    // Get search params from localStorage if they exist
    const storedParams = localStorage.getItem('browseNetworkParams');
    if (storedParams) {
      try {
        const params = JSON.parse(storedParams);
        setSearchParams(params);
        // Clear the stored params after using them
        localStorage.removeItem('browseNetworkParams');
      } catch (error) {
        console.error('Error parsing stored search params:', error);
      }
    }
  }, []);

  return (
    <BrowseNetwork 
      onBack={() => window.location.href = '/'}
      onFeedClick={() => window.location.href = '/feed.html'}
      onDashboardClick={() => window.location.href = '/dashboard.html'}
      onSignOut={async () => {
        const { supabase } = await import('../lib/supabase');
        try {
          await supabase.auth.signOut();
          localStorage.removeItem('userProfile');
          localStorage.removeItem('pendingTimeLog');
          window.location.href = '/';
        } catch (error) {
          console.error('Error signing out:', error);
          localStorage.removeItem('userProfile');
          localStorage.removeItem('pendingTimeLog');
          window.location.href = '/';
        }
      }}
      searchParams={searchParams}
    />
  );
}

export default BrowsePage;