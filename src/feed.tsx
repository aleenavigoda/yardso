import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Feed from './components/Feed';
import './index.css';

function FeedPage() {
  return (
    <Feed 
      onBack={() => window.location.href = '/'}
      onDashboardClick={() => window.location.href = '/dashboard.html'}
      onSignOut={async () => {
        const { supabase } = await import('./lib/supabase');
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
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeedPage />
  </StrictMode>
);