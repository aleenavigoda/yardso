import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import FeedPage from './pages/feed';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeedPage />
  </StrictMode>
);