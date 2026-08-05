import {
  AlertTriangleIcon,
  BellIcon,
  CheckCheckIcon,
  SparklesIcon,
  TrendingDownIcon,
  XCircleIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { formatRelative } from '@/lib/format';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/lib/queries';
import type { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICONS: Record<Notification['type'], React.ReactNode> = {
  new_listing: <SparklesIcon />,
  price_drop: <TrendingDownIcon />,
  price_raise: <TrendingDownIcon className="rotate-180" />,
  listing_removed: <XCircleIcon />,
  fetch_failed: <AlertTriangleIcon />,
  digest: <BellIcon />,
};

export function NotificationsPage() {
  const notifications = useNotifications({ pageSize: 50 });
  const markAllRead = useMarkAllRead();
  const markRead = useMarkRead();

  const hasUnread = notifications.data?.items.some((n) => !n.readAt) ?? false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Powiadomienia</h1>
          <p className="text-muted-foreground text-sm">
            Nowe oferty, spadki cen i błędy pobierania.
          </p>
        </div>
        {hasUnread ? (
          <Button
            variant="outline"
            size="sm"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheckIcon />
            Oznacz wszystkie jako przeczytane
          </Button>
        ) : null}
      </div>

      {notifications.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : notifications.data && notifications.data.items.length > 0 ? (
        <div className="space-y-2">
          {notifications.data.items.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                'transition-colors',
                !notification.readAt && 'border-primary/40 bg-primary/5',
              )}
            >
              <CardContent className="flex items-start gap-4 py-4">
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-lg [&>svg]:size-4',
                    notification.type === 'fetch_failed'
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-secondary text-secondary-foreground',
                  )}
                >
                  {ICONS[notification.type]}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{notification.title}</p>
                    {!notification.readAt ? (
                      <Badge variant="default" className="text-[10px]">
                        Nowe
                      </Badge>
                    ) : null}
                  </div>
                  {notification.body ? (
                    <p className="text-muted-foreground text-sm">
                      {notification.body}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {formatRelative(notification.createdAt)}
                  </p>
                </div>

                {!notification.readAt ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markRead.mutate([notification.id])}
                  >
                    Przeczytane
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BellIcon className="size-8" />}
          title="Brak powiadomień"
          description="Gdy pojawią się nowe oferty lub spadną ceny, znajdziesz je tutaj."
        />
      )}
    </div>
  );
}
