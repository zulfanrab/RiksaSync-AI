import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { UserProvider } from './context/UserContext';
import ErrorBoundary from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Aplikasi Mengalami Kesalahan Tampilan">
      <UserProvider>
        <App />
      </UserProvider>
    </ErrorBoundary>
  </StrictMode>,
);

