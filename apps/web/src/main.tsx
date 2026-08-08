import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { CompareProvider } from '@/lib/compare';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { router } from '@/router';

/** Toasts follow the app theme instead of guessing from the OS. */
function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster position="bottom-right" richColors theme={resolved} />;
}
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Auth and validation failures will not fix themselves on a retry.
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Nie znaleziono elementu #root');

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CompareProvider>
            <RouterProvider router={router} />
            <ThemedToaster />
          </CompareProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
