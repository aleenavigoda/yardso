import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Determine which page to render based on the current path
const path = window.location.pathname;

async function renderPage() {
  if (path === '/feed') {
    const { default: FeedPage } = await import('./pages/FeedPage');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <FeedPage />
      </StrictMode>
    );
  } else if (path === '/dashboard') {
    const { default: DashboardPage } = await import('./pages/DashboardPage');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <DashboardPage />
      </StrictMode>
    );
  } else if (path === '/browse') {
    const { default: BrowsePage } = await import('./pages/BrowsePage');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <BrowsePage />
      </StrictMode>
    );
  } else if (path.startsWith('/invite/')) {
    const { default: InvitePage } = await import('./pages/InvitePage');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <InvitePage />
      </StrictMode>
    );
  } else {
    // Default to landing page
    const { default: LandingPage } = await import('./pages/LandingPage');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <LandingPage />
      </StrictMode>
    );
  }
}

renderPage();