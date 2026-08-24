import * as SeparatorPrimitive from '@radix-ui/react-separator';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/*
 * Skeleton/Tabs/Textarea used to live here too - they now come from
 * neobrutalism.dev's registry (components/ui/skeleton.tsx, tabs.tsx,
 * textarea.tsx). Separator and EmptyState stay here: neither has a
 * neobrutalism registry equivalent, so they're hand-restyled instead.
 */

/* -------------------------------- Separator -------------------------------- */

export function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        // Thickened from the old 1px hairline (h-px/w-px) - it would
        // disappear next to the 2px borders everywhere else now.
        'bg-border shrink-0 data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-0.5',
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------- EmptyState -------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-base border-2 border-dashed border-border px-6 py-16 text-center">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-md text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
