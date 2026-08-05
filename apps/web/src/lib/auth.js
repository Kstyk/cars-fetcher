import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, use, useCallback, useEffect, useMemo, useState, } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAccessToken, setUnauthorizedHandler } from './api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState('loading');
    const queryClient = useQueryClient();
    // Restore the session on boot: the refresh cookie outlives the access token.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const me = await api.get('/api/auth/me');
                if (!cancelled) {
                    setUser(me);
                    setStatus('authenticated');
                }
            }
            catch {
                if (!cancelled) {
                    setUser(null);
                    setStatus('anonymous');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        setUnauthorizedHandler(() => {
            setUser(null);
            setStatus('anonymous');
            queryClient.clear();
        });
    }, [queryClient]);
    const login = useCallback(async (email, password) => {
        const result = await api.post('/api/auth/login', {
            email,
            password,
        });
        setAccessToken(result.accessToken);
        setUser(result.user);
        setStatus('authenticated');
    }, []);
    const register = useCallback(async (input) => {
        const result = await api.post('/api/auth/register', input);
        setAccessToken(result.accessToken);
        setUser(result.user);
        setStatus('authenticated');
    }, []);
    const logout = useCallback(async () => {
        try {
            await api.post('/api/auth/logout');
        }
        finally {
            setAccessToken(null);
            setUser(null);
            setStatus('anonymous');
            queryClient.clear();
        }
    }, [queryClient]);
    const updateUser = useCallback((patch) => {
        setUser((current) => (current ? { ...current, ...patch } : current));
    }, []);
    const value = useMemo(() => ({ user, status, login, register, logout, updateUser }), [user, status, login, register, logout, updateUser]);
    return _jsx(AuthContext, { value: value, children: children });
}
export function useAuth() {
    const context = use(AuthContext);
    if (!context)
        throw new Error('useAuth musi być użyty wewnątrz <AuthProvider>');
    return context;
}
