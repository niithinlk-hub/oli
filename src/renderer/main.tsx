import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MiniRecorder } from './pages/MiniRecorder';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');

const route = window.location.hash.replace(/^#/, '');

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      {route === '/mini-recorder' ? <MiniRecorder /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
