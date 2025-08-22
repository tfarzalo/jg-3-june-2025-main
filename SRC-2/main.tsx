import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  // Temporarily remove StrictMode to help with re-rendering issues
  // <StrictMode>
    <App />
  // </StrictMode>
);