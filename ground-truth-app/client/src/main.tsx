// client/src/main.tsx — entry point
// Session 16 · Wave 0 · Adds ThemeProvider (next-themes) and MotionConfig (framer-motion)

import {
  ResourceStatusIndicator,
  ResourceStatusProvider,
} from '@databricks/appkit-ui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from 'next-themes';
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
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="sgt-theme"
        disableTransitionOnChange
      >
        <MotionConfig reducedMotion="user">
          <QueryClientProvider client={queryClient}>
            <ResourceStatusProvider>
              <ResourceStatusIndicator />
              <App />
            </ResourceStatusProvider>
          </QueryClientProvider>
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
