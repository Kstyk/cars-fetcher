import { Link, useNavigate } from '@tanstack/react-router';
import { CarFrontIcon, Loader2Icon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { GoogleLoginButton } from '@/components/auth/google-login-button';
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
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const OAUTH_ERROR_MESSAGE = 'Logowanie przez Google nie powiodło się. Spróbuj ponownie.';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@cars-fetcher.local');
  const [password, setPassword] = useState('Demo1234');
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('error')
      ? OAUTH_ERROR_MESSAGE
      : null,
  );
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      await navigate({ to: '/' });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Nie udało się zalogować',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Zaloguj się"
      description="Wróć do swoich grup filtrów i obserwowanych aut."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Hasło</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Zaloguj się
        </Button>

        <GoogleLoginButton />

        <p className="text-muted-foreground text-center text-sm">
          Nie masz konta?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Zarejestruj się
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await register(form);
      await navigate({ to: '/groups' });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? [err.message, formatDetails(err.details)].filter(Boolean).join(': ')
          : 'Nie udało się utworzyć konta',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Załóż konto"
      description="Twórz grupy filtrów i dostawaj powiadomienia o nowych ofertach."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">Imię</Label>
            <Input
              id="firstName"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Nazwisko</Label>
            <Input
              id="lastName"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Hasło</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Min. 8 znaków, wielka i mała litera oraz cyfra.
          </p>
        </div>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Utwórz konto
        </Button>

        <GoogleLoginButton />

        <p className="text-muted-foreground text-center text-sm">
          Masz już konto?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Zaloguj się
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-xl">
            <CarFrontIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Cars Fetcher</h1>
            <p className="text-muted-foreground text-sm">
              Agregator ofert samochodowych
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatDetails(details: unknown): string {
  if (!Array.isArray(details)) return '';
  return details
    .map((d) => (d as { message?: string }).message)
    .filter(Boolean)
    .join(', ');
}
