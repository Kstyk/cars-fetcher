import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Listing } from './types';

export const COMPARE_LIMIT = 3;

interface CompareContextValue {
  items: Listing[];
  isSelected: (id: string) => boolean;
  /** No-op past `COMPARE_LIMIT` - callers check `isFull` to disable the control instead. */
  toggle: (listing: Listing) => void;
  remove: (id: string) => void;
  clear: () => void;
  isFull: boolean;
}

const CompareContext = createContext<CompareContextValue | null>(null);

/**
 * Lives above the router (see main.tsx) so a selection made on /listings
 * survives navigating to /favorites and back - it's a comparison tray, not
 * page-local UI state.
 */
export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Listing[]>([]);

  const isSelected = useCallback(
    (id: string) => items.some((item) => item.id === id),
    [items],
  );

  const toggle = useCallback((listing: Listing) => {
    setItems((current) => {
      if (current.some((item) => item.id === listing.id)) {
        return current.filter((item) => item.id !== listing.id);
      }
      if (current.length >= COMPARE_LIMIT) return current;
      return [...current, listing];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, isSelected, toggle, remove, clear, isFull: items.length >= COMPARE_LIMIT }),
    [items, isSelected, toggle, remove, clear],
  );

  return <CompareContext value={value}>{children}</CompareContext>;
}

export function useCompare(): CompareContextValue {
  const context = use(CompareContext);
  if (!context) throw new Error('useCompare musi być użyty wewnątrz <CompareProvider>');
  return context;
}
