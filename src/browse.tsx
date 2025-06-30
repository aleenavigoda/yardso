import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BrowsePage from './pages/browse';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowsePage />
  </StrictMode>
);