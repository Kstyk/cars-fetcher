import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Loader2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator, Skeleton } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useChangePassword, useNotificationPreferences, useUpdatePreferences, useUpdateProfile, } from '@/lib/queries';
const DIGEST_OPTIONS = [
    { value: 'instant', label: 'Natychmiast' },
    { value: 'hourly', label: 'Co godzinę' },
    { value: 'daily', label: 'Raz dziennie' },
    { value: 'weekly', label: 'Raz w tygodniu' },
    { value: 'off', label: 'Wyłączone' },
];
const NONE = '__none__';
export function ProfilePage() {
    const { user, updateUser, logout } = useAuth();
    return (_jsxs("div", { className: "mx-auto max-w-3xl space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Profil i ustawienia" }), _jsx("p", { className: "text-muted-foreground text-sm", children: "Dane konta, has\u0142o oraz uprawnienia powiadomie\u0144." })] }), _jsx(ProfileCard, { user: user, onUpdated: (patch) => updateUser(patch) }), _jsx(PasswordCard, { onChanged: () => void logout() }), _jsx(NotificationPreferencesCard, {})] }));
}
function ProfileCard({ user, onUpdated, }) {
    const updateProfile = useUpdateProfile();
    const [firstName, setFirstName] = useState(user?.firstName ?? '');
    const [lastName, setLastName] = useState(user?.lastName ?? '');
    const [saved, setSaved] = useState(false);
    async function handleSubmit(event) {
        event.preventDefault();
        const result = await updateProfile.mutateAsync({ firstName, lastName });
        onUpdated({ firstName: result.firstName, lastName: result.lastName });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Dane konta" }), _jsx(CardDescription, { children: user?.email })] }), _jsx(CardContent, { children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "firstName", children: "Imi\u0119" }), _jsx(Input, { id: "firstName", value: firstName, onChange: (e) => setFirstName(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "lastName", children: "Nazwisko" }), _jsx(Input, { id: "lastName", value: lastName, onChange: (e) => setLastName(e.target.value) })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs(Button, { type: "submit", disabled: updateProfile.isPending, children: [updateProfile.isPending ? _jsx(Loader2Icon, { className: "animate-spin" }) : null, "Zapisz zmiany"] }), saved ? (_jsx("span", { className: "text-sm text-[var(--success)]", children: "Zapisano" })) : null] })] }) })] }));
}
function PasswordCard({ onChanged }) {
    const changePassword = useChangePassword();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState(null);
    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        try {
            await changePassword.mutateAsync({ currentPassword, newPassword });
            // The API revokes every session on a password change.
            onChanged();
        }
        catch (err) {
            setError(err instanceof ApiError ? err.message : 'Nie udało się zmienić hasła');
        }
    }
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Zmiana has\u0142a" }), _jsx(CardDescription, { children: "Po zmianie has\u0142a zostaniesz wylogowany ze wszystkich urz\u0105dze\u0144." })] }), _jsx(CardContent, { children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "currentPassword", children: "Obecne has\u0142o" }), _jsx(Input, { id: "currentPassword", type: "password", autoComplete: "current-password", required: true, value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "newPassword", children: "Nowe has\u0142o" }), _jsx(Input, { id: "newPassword", type: "password", autoComplete: "new-password", required: true, value: newPassword, onChange: (e) => setNewPassword(e.target.value) })] })] }), error ? (_jsx("p", { className: "text-destructive text-sm", role: "alert", children: error })) : null, _jsx(Button, { type: "submit", variant: "outline", disabled: changePassword.isPending, children: "Zmie\u0144 has\u0142o" })] }) })] }));
}
function NotificationPreferencesCard() {
    const preferences = useNotificationPreferences();
    const updatePreferences = useUpdatePreferences();
    const [draft, setDraft] = useState(null);
    useEffect(() => {
        if (preferences.data)
            setDraft(preferences.data);
    }, [preferences.data]);
    if (!draft) {
        return _jsx(Skeleton, { className: "h-96" });
    }
    function patch(update) {
        setDraft((current) => (current ? { ...current, ...update } : current));
        updatePreferences.mutate(update);
    }
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Powiadomienia" }), _jsx(CardDescription, { children: "Zdecyduj, o czym i jak chcesz by\u0107 informowany." })] }), _jsxs(CardContent, { className: "space-y-5", children: [_jsxs("section", { className: "space-y-3", children: [_jsx("p", { className: "text-muted-foreground text-xs font-medium tracking-wide uppercase", children: "Kana\u0142y" }), _jsx(ToggleRow, { label: "W aplikacji", description: "Dzwonek w nag\u0142\u00F3wku aplikacji", checked: draft.inAppEnabled, onChange: (v) => patch({ inAppEnabled: v }) }), _jsx(ToggleRow, { label: "E-mail", description: "Podsumowania na adres konta", checked: draft.emailEnabled, onChange: (v) => patch({ emailEnabled: v }) }), _jsx(ToggleRow, { label: "Push w przegl\u0105darce", description: "Wymaga zgody przegl\u0105darki na powiadomienia", checked: draft.pushEnabled, onChange: (v) => patch({ pushEnabled: v }) })] }), _jsx(Separator, {}), _jsxs("section", { className: "space-y-3", children: [_jsx("p", { className: "text-muted-foreground text-xs font-medium tracking-wide uppercase", children: "Zdarzenia" }), _jsx(ToggleRow, { label: "Nowe og\u0142oszenia", checked: draft.notifyNewListing, onChange: (v) => patch({ notifyNewListing: v }) }), _jsx(ToggleRow, { label: "Spadki cen", checked: draft.notifyPriceDrop, onChange: (v) => patch({ notifyPriceDrop: v }) }), _jsx(ToggleRow, { label: "Usuni\u0119te oferty", checked: draft.notifyListingRemoved, onChange: (v) => patch({ notifyListingRemoved: v }) }), _jsx(ToggleRow, { label: "B\u0142\u0119dy pobierania", checked: draft.notifyFetchFailed, onChange: (v) => patch({ notifyFetchFailed: v }) })] }), _jsx(Separator, {}), _jsxs("section", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Cz\u0119stotliwo\u015B\u0107 podsumowa\u0144" }), _jsxs(Select, { value: draft.digestFrequency, onValueChange: (v) => patch({ digestFrequency: v }), children: [_jsx(SelectTrigger, { className: "w-full", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: DIGEST_OPTIONS.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "threshold", children: "Pr\u00F3g spadku ceny (%)" }), _jsx(Input, { id: "threshold", type: "number", min: 0, max: 100, step: 0.5, value: draft.priceDropThresholdPct, onChange: (e) => setDraft({ ...draft, priceDropThresholdPct: Number(e.target.value) }), onBlur: (e) => patch({ priceDropThresholdPct: Number(e.target.value) }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Cisza nocna od" }), _jsxs(Select, { value: draft.quietHoursStart === null ? NONE : String(draft.quietHoursStart), onValueChange: (v) => patch({ quietHoursStart: v === NONE ? null : Number(v) }), children: [_jsx(SelectTrigger, { className: "w-full", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: NONE, children: "Wy\u0142\u0105czone" }), Array.from({ length: 24 }, (_, h) => (_jsxs(SelectItem, { value: String(h), children: [String(h).padStart(2, '0'), ":00"] }, h)))] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Cisza nocna do" }), _jsxs(Select, { value: draft.quietHoursEnd === null ? NONE : String(draft.quietHoursEnd), onValueChange: (v) => patch({ quietHoursEnd: v === NONE ? null : Number(v) }), children: [_jsx(SelectTrigger, { className: "w-full", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: NONE, children: "Wy\u0142\u0105czone" }), Array.from({ length: 24 }, (_, h) => (_jsxs(SelectItem, { value: String(h), children: [String(h).padStart(2, '0'), ":00"] }, h)))] })] })] })] })] })] }));
}
function ToggleRow({ label, description, checked, onChange, }) {
    return (_jsxs("div", { className: "flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: label }), description ? (_jsx("p", { className: "text-muted-foreground text-xs", children: description })) : null] }), _jsx(Switch, { checked: checked, onCheckedChange: onChange })] }));
}
