import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { Toaster } from 'react-hot-toast';

import App from './App';
import './index.css';

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

// Dynamic.xyz environment ID from .env
const DYNAMIC_ENVIRONMENT_ID = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID || '38eabbc2-00d5-4d3b-8cc1-1167ad367914';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENVIRONMENT_ID,
        walletConnectors: [EthereumWalletConnectors],
        events: {
          onAuthSuccess: (args: any) => {
            console.log('🔐 Auth success:', args);
          },
          onLogout: () => {
            console.log('👋 User logged out');
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1a1a24',
                color: '#fff',
                border: '1px solid #2e2e3c',
                fontFamily: 'Rajdhani, sans-serif',
              },
              success: {
                iconTheme: {
                  primary: '#00ff00',
                  secondary: '#1a1a24',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ff0044',
                  secondary: '#1a1a24',
                },
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </DynamicContextProvider>
  </React.StrictMode>
);
