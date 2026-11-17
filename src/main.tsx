import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Block benign HMR / Web Socket console indicators to keep the logs completely professional and quiet
if (typeof window !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: any[]) => {
    const errorMsg = args.map(arg => String(arg)).join(' ');
    if (
      errorMsg.includes('failed to connect') || 
      errorMsg.includes('WebSocket') || 
      errorMsg.includes('websocket') ||
      errorMsg.includes('HMR')
    ) {
      return; // Ignore benign HMR alerts
    }
    originalError(...args);
  };

  console.warn = (...args: any[]) => {
    const warnMsg = args.map(arg => String(arg)).join(' ');
    if (
      warnMsg.includes('failed to connect') || 
      warnMsg.includes('WebSocket') || 
      warnMsg.includes('websocket') ||
      warnMsg.includes('HMR')
    ) {
      return; // Ignore benign HMR alerts
    }
    originalWarn(...args);
  };

  // Prevent HMR WebSocket exceptions from bubbling up and generating unhandled rejections or error screens
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason ? (reason.message || String(reason)) : '';
    if (
      msg.includes('WebSocket') ||
      msg.includes('websocket') ||
      msg.includes('closed without opened') ||
      msg.includes('ws://') ||
      msg.includes('wss://')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('WebSocket') ||
      msg.includes('websocket') ||
      msg.includes('closed without opened') ||
      msg.includes('ws://') ||
      msg.includes('wss://')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
