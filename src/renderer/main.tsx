import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MiniRecorder } from './pages/MiniRecorder';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');

const route = window.location.hash.replace(/^#/, '');

createRoot(container).render(
  <React.StrictMode>
    {route === '/mini-recorder' ? <MiniRecorder /> : <App />}
  </React.StrictMode>
);
