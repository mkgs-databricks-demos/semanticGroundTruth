// client/src/main.tsx — entry point
// Session 12 · Wave 4 · Keeps StrictMode, ErrorBoundary, ResourceStatus; adds QueryClientProvider

import {
  ResourceStatusIndicator,
  ResourceStatusProvider,
} from '@databricks/appkit-ui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { createQueryClient } from './lib/api/queryClient';

const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ResourceStatusProvider>
          <ResourceStatusIndicator />
          <App />
        </ResourceStatusProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
