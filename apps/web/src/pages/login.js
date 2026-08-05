import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useNavigate } from '@tanstack/react-router';
import { CarFrontIcon, Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('demo@cars-fetcher.local');
    const [password, setPassword] = useState('Demo1234');
    const [error, setError] = useState(null);
    const [pending, setPending] = useState(false);
    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setPending(true);
        try {
            await login(email, password);
            await navigate({ to: '/' });
        }
        catch (err) {
            setError(err instanceof ApiError ? err.message : 'Nie udało się zalogować');
        }
        finally {
            setPending(false);
        }
    }
    return (_jsx(AuthLayout, { title: "Zaloguj si\u0119", description: "Wr\u00F3\u0107 do swoich grup filtr\u00F3w i obserwowanych aut.", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email", children: "E-mail" }), _jsx(Input, { id: "email", type: "email", autoComplete: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "password", children: "Has\u0142o" }), _jsx(Input, { id: "password", type: "password", autoComplete: "current-password", required: true, value: password, onChange: (e) => setPassword(e.target.value) })] }), error ? (_jsx("p", { className: "text-destructive text-sm", role: "alert", children: error })) : null, _jsxs(Button, { type: "submit", className: "w-full", disabled: pending, children: [pending ? _jsx(Loader2Icon, { className: "animate-spin" }) : null, "Zaloguj si\u0119"] }), _jsxs("p", { className: "text-muted-foreground text-center text-sm", children: ["Nie masz konta?", ' ', _jsx(Link, { to: "/register", className: "text-primary hover:underline", children: "Zarejestruj si\u0119" })] })] }) }));
}
export function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
    });
    const [error, setError] = useState(null);
    const [pending, setPending] = useState(false);
    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setPending(true);
        try {
            await register(form);
            await navigate({ to: '/groups' });
        }
        catch (err) {
            setError(err instanceof ApiError
                ? [err.message, formatDetails(err.details)].filter(Boolean).join(': ')
                : 'Nie udało się utworzyć konta');
        }
        finally {
            setPending(false);
        }
    }
    return (_jsx(AuthLayout, { title: "Za\u0142\u00F3\u017C konto", description: "Tw\u00F3rz grupy filtr\u00F3w i dostawaj powiadomienia o nowych ofertach.", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "firstName", children: "Imi\u0119" }), _jsx(Input, { id: "firstName", required: true, value: form.firstName, onChange: (e) => setForm({ ...form, firstName: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "lastName", children: "Nazwisko" }), _jsx(Input, { id: "lastName", required: true, value: form.lastName, onChange: (e) => setForm({ ...form, lastName: e.target.value }) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email", children: "E-mail" }), _jsx(Input, { id: "email", type: "email", autoComplete: "email", required: true, value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "password", children: "Has\u0142o" }), _jsx(Input, { id: "password", type: "password", autoComplete: "new-password", required: true, value: form.password, onChange: (e) => setForm({ ...form, password: e.target.value }) }), _jsx("p", { className: "text-muted-foreground text-xs", children: "Min. 8 znak\u00F3w, wielka i ma\u0142a litera oraz cyfra." })] }), error ? (_jsx("p", { className: "text-destructive text-sm", role: "alert", children: error })) : null, _jsxs(Button, { type: "submit", className: "w-full", disabled: pending, children: [pending ? _jsx(Loader2Icon, { className: "animate-spin" }) : null, "Utw\u00F3rz konto"] }), _jsxs("p", { className: "text-muted-foreground text-center text-sm", children: ["Masz ju\u017C konto?", ' ', _jsx(Link, { to: "/login", className: "text-primary hover:underline", children: "Zaloguj si\u0119" })] })] }) }));
}
function AuthLayout({ title, description, children, }) {
    return (_jsx("div", { className: "grid min-h-dvh place-items-center px-4 py-12", children: _jsxs("div", { className: "w-full max-w-sm space-y-6", children: [_jsxs("div", { className: "flex flex-col items-center gap-3 text-center", children: [_jsx("span", { className: "bg-primary text-primary-foreground grid size-11 place-items-center rounded-xl", children: _jsx(CarFrontIcon, { className: "size-6" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold", children: "Cars Fetcher" }), _jsx("p", { className: "text-muted-foreground text-sm", children: "Agregator ofert samochodowych" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: title }), _jsx(CardDescription, { children: description })] }), _jsx(CardContent, { children: children })] })] }) }));
}
function formatDetails(details) {
    if (!Array.isArray(details))
        return '';
    return details
        .map((d) => d.message)
        .filter(Boolean)
        .join(', ');
}
