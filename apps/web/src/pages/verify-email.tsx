import { Link, useSearch } from '@tanstack/react-router';
import { CarFrontIcon, CheckCircle2Icon, Loader2Icon, XCircleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';

type Status = 'pending' | 'success' | 'error';

/** Public page: works whether the visitor is currently logged in or not. */
export function VerifyEmailPage() {
  const { token } = useSearch({ strict: false }) as { token?: string };
  const { status: authStatus, updateUser } = useAuth();
  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Brak tokenu weryfikacyjnego w linku.');
      return;
    }

    let cancelled = false;
    api
      .post<User>('/api/auth/verify-email', { token })
      .then((user) => {
        if (cancelled) return;
        setStatus('success');
        // Jeśli ta przeglądarka ma już aktywną sesję tego konta, odśwież ją od razu.
        if (authStatus === 'authenticated') updateUser(user);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Nie udało się zweryfikować e-maila');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-xl">
            <CarFrontIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Cars Fetcher</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Weryfikacja e-maila</CardTitle>
            <CardDescription>
              {status === 'pending' && 'Sprawdzam link weryfikacyjny…'}
              {status === 'success' && 'Adres e-mail został potwierdzony.'}
              {status === 'error' && (message ?? 'Link jest nieprawidłowy lub wygasł.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-4">
            {status === 'pending' && (
              <Loader2Icon className="text-muted-foreground size-10 animate-spin" />
            )}
            {status === 'success' && <CheckCircle2Icon className="text-success size-10" />}
            {status === 'error' && <XCircleIcon className="text-destructive size-10" />}

            {status !== 'pending' && (
              <Button asChild className="w-full">
                <Link to={authStatus === 'authenticated' ? '/profile' : '/login'}>
                  {authStatus === 'authenticated' ? 'Wróć do profilu' : 'Przejdź do logowania'}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
