import { Loader2Icon } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator, Skeleton } from '@/components/ui/misc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  useChangePassword,
  useNotificationPreferences,
  useUpdatePreferences,
  useUpdateProfile,
} from '@/lib/queries';
import type { NotificationPreferences } from '@/lib/types';

const DIGEST_OPTIONS = [
  { value: 'instant', label: 'Natychmiast' },
  { value: 'hourly', label: 'Co godzinę' },
  { value: 'daily', label: 'Raz dziennie' },
  { value: 'weekly', label: 'Raz w tygodniu' },
  { value: 'off', label: 'Wyłączone' },
] as const;

const NONE = '__none__';

export function ProfilePage() {
  const { user, updateUser, logout } = useAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profil i ustawienia</h1>
        <p className="text-muted-foreground text-sm">
          Dane konta, hasło oraz uprawnienia powiadomień.
        </p>
      </div>

      <ProfileCard
        user={user}
        onUpdated={(patch) => updateUser(patch)}
      />
      <PasswordCard onChanged={() => void logout()} />
      <NotificationPreferencesCard />
    </div>
  );
}

function ProfileCard({
  user,
  onUpdated,
}: {
  user: ReturnType<typeof useAuth>['user'];
  onUpdated: (patch: { firstName: string; lastName: string }) => void;
}) {
  const updateProfile = useUpdateProfile();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await updateProfile.mutateAsync({ firstName, lastName });
    onUpdated({ firstName: result.firstName, lastName: result.lastName });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dane konta</CardTitle>
        <CardDescription>{user?.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Imię</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nazwisko</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? <Loader2Icon className="animate-spin" /> : null}
              Zapisz zmiany
            </Button>
            {saved ? (
              <span className="text-sm text-[var(--success)]">Zapisano</span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard({ onChanged }: { onChanged: () => void }) {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      // The API revokes every session on a password change.
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Nie udało się zmienić hasła',
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zmiana hasła</CardTitle>
        <CardDescription>
          Po zmianie hasła zostaniesz wylogowany ze wszystkich urządzeń.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Obecne hasło</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nowe hasło</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="outline" disabled={changePassword.isPending}>
            Zmień hasło
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NotificationPreferencesCard() {
  const preferences = useNotificationPreferences();
  const updatePreferences = useUpdatePreferences();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (preferences.data) setDraft(preferences.data);
  }, [preferences.data]);

  if (!draft) {
    return <Skeleton className="h-96" />;
  }

  function patch(update: Partial<NotificationPreferences>) {
    setDraft((current) => (current ? { ...current, ...update } : current));
    updatePreferences.mutate(update);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Powiadomienia</CardTitle>
        <CardDescription>
          Zdecyduj, o czym i jak chcesz być informowany.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Kanały
          </p>
          <ToggleRow
            label="W aplikacji"
            description="Dzwonek w nagłówku aplikacji"
            checked={draft.inAppEnabled}
            onChange={(v) => patch({ inAppEnabled: v })}
          />
          <ToggleRow
            label="E-mail"
            description="Podsumowania na adres konta"
            checked={draft.emailEnabled}
            onChange={(v) => patch({ emailEnabled: v })}
          />
          <ToggleRow
            label="Push w przeglądarce"
            description="Wymaga zgody przeglądarki na powiadomienia"
            checked={draft.pushEnabled}
            onChange={(v) => patch({ pushEnabled: v })}
          />
        </section>

        <Separator />

        <section className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Zdarzenia
          </p>
          <ToggleRow
            label="Nowe ogłoszenia"
            checked={draft.notifyNewListing}
            onChange={(v) => patch({ notifyNewListing: v })}
          />
          <ToggleRow
            label="Spadki cen"
            checked={draft.notifyPriceDrop}
            onChange={(v) => patch({ notifyPriceDrop: v })}
          />
          <ToggleRow
            label="Usunięte oferty"
            checked={draft.notifyListingRemoved}
            onChange={(v) => patch({ notifyListingRemoved: v })}
          />
          <ToggleRow
            label="Błędy pobierania"
            checked={draft.notifyFetchFailed}
            onChange={(v) => patch({ notifyFetchFailed: v })}
          />
        </section>

        <Separator />

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Częstotliwość podsumowań</Label>
            <Select
              value={draft.digestFrequency}
              onValueChange={(v) =>
                patch({ digestFrequency: v as NotificationPreferences['digestFrequency'] })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIGEST_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="threshold">Próg spadku ceny (%)</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={draft.priceDropThresholdPct}
              onChange={(e) =>
                setDraft({ ...draft, priceDropThresholdPct: Number(e.target.value) })
              }
              onBlur={(e) =>
                patch({ priceDropThresholdPct: Number(e.target.value) })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Cisza nocna od</Label>
            <Select
              value={draft.quietHoursStart === null ? NONE : String(draft.quietHoursStart)}
              onValueChange={(v) =>
                patch({ quietHoursStart: v === NONE ? null : Number(v) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Wyłączone</SelectItem>
                {Array.from({ length: 24 }, (_, h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cisza nocna do</Label>
            <Select
              value={draft.quietHoursEnd === null ? NONE : String(draft.quietHoursEnd)}
              onValueChange={(v) =>
                patch({ quietHoursEnd: v === NONE ? null : Number(v) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Wyłączone</SelectItem>
                {Array.from({ length: 24 }, (_, h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
