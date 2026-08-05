import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { router } from '@/router';
import './styles.css';
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
                // Auth and validation failures will not fix themselves on a retry.
                if (error instanceof ApiError && error.status < 500)
                    return false;
                return failureCount < 2;
            },
        },
    },
});
const rootElement = document.getElementById('root');
if (!rootElement)
    throw new Error('Nie znaleziono elementu #root');
createRoot(rootElement).render(_jsx(StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsxs(AuthProvider, { children: [_jsx(RouterProvider, { router: router }), _jsx(Toaster, { position: "bottom-right", richColors: true })] }) }) }));
