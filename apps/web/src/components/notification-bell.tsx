import { Link } from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCheckIcon,
  ExternalLinkIcon,
  ListIcon,
  SparklesIcon,
  TrendingDownIcon,
  XCircleIcon,
} from 'lucide-react';
import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelative } from '@/lib/format';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/lib/queries';
import type { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICONS: Record<Notification['type'], typeof BellIcon> = {
  new_listing: SparklesIcon,
  price_drop: TrendingDownIcon,
  price_raise: TrendingDownIcon,
  listing_removed: XCircleIcon,
  fetch_failed: AlertTriangleIcon,
  digest: BellIcon,
};

/**
 * Bell with a dropdown of the latest notifications. Each row offers both ways
 * on: the filtered list inside the app, and the advert on the marketplace.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unread } = useUnreadCount();
  // Only fetched while the dropdown is open - the badge count is enough otherwise.
  const notifications = useNotifications({ pageSize: 8 }, { enabled: open });
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const items = notifications.data?.items ?? [];
  const count = unread?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Powiadomienia">
          <BellIcon />
          {count > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 text-[10px]"
            >
              {count > 99 ? '99+' : count}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Powiadomienia</span>
          {count > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheckIcon />
              Przeczytane
            </Button>
          ) : null}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.isLoading ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              Wczytywanie…
            </p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              Brak powiadomień
            </p>
          ) : (
            items.map((notification) => {
              const Icon = ICONS[notification.type];
              return (
                <div
                  key={notification.id}
                  className={cn(
                    'border-b px-3 py-2.5 last:border-0',
                    !notification.readAt && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        notification.type === 'fetch_failed'
                          ? 'text-destructive'
                          : 'text-muted-foreground',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={notification.title}>
                        {notification.title}
                      </p>
                      {notification.body ? (
                        <p className="text-muted-foreground truncate text-xs">
                          {notification.body}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {formatRelative(notification.createdAt)}
                        {notification.groupName ? ` · ${notification.groupName}` : ''}
                      </p>

                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Button
                          asChild
                          size="sm"
                          variant="secondary"
                          className="h-6 px-2 text-xs"
                        >
                          <Link
                            to="/listings"
                            search={
                              // Narrow the list to what the notification is about.
                              notification.groupId
                                ? { groupId: notification.groupId }
                                : {}
                            }
                            onClick={() => {
                              setOpen(false);
                              if (!notification.readAt) markRead.mutate([notification.id]);
                            }}
                          >
                            <ListIcon />
                            Ogłoszenia
                          </Link>
                        </Button>

                        {notification.listingUrl ? (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                          >
                            <a
                              href={notification.listingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                if (!notification.readAt) {
                                  markRead.mutate([notification.id]);
                                }
                              }}
                            >
                              <ExternalLinkIcon />
                              {notification.listingProvider ?? 'Oferta'}
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t p-1">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              Zobacz wszystkie
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
