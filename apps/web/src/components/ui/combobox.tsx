import { CheckIcon, ChevronsUpDownIcon, SearchIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
}

/**
 * Searchable single-select. Plain `<Select>` is unusable for the 187-entry make
 * list, and this keeps the dependency surface to Radix Popover.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Wybierz…',
  emptyText = 'Brak wyników',
  disabled,
  clearable = true,
  className,
}: {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matching = needle
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;
    // Long lists stay responsive; the search box is how you reach the rest.
    return matching.slice(0, 200);
  }, [options, search]);

  const selected = options.find((option) => option.value === value);

  return (
    <Popover
      // `modal` gives the popover its own scroll lock. Without it a popover
      // opened inside a Dialog inherits the dialog's react-remove-scroll,
      // which swallows wheel events - the list could only be dragged by its
      // scrollbar.
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      {/*
        The clear control sits next to the trigger, not inside it. Radix opens
        the popover on pointerdown, which fires before any click handler nested
        in the trigger - an X placed there could never win the event.
      */}
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              clearable && selected && 'pr-14',
              className,
            )}
          >
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        {clearable && selected ? (
          <button
            type="button"
            aria-label="Wyczyść"
            title="Wyczyść"
            className="hover:text-destructive text-muted-foreground absolute top-1/2 right-8 -translate-y-1/2 rounded-sm p-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={() => onChange(null)}
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      <PopoverContent className="w-(--radix-popover-trigger-width) bg-secondary-background p-0">
        <div className="relative border-b-2 border-border p-2">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-4 size-3.5 -translate-y-1/2" />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Szukaj…"
            className="h-8 pl-8"
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">
              {emptyText}
            </p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setSearch('');
                }}
                className={cn(
                  'hover:bg-main hover:text-main-foreground flex w-full items-center gap-2 rounded-base px-2 py-1.5 text-left text-sm',
                  option.value === value && 'bg-main/20 font-medium',
                )}
              >
                <CheckIcon
                  className={cn(
                    'size-4 shrink-0',
                    option.value === value ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="truncate">{option.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Multi-select variant used for colours, body types and equipment. */
export function MultiCombobox({
  options,
  values,
  onChange,
  placeholder = 'Dowolne',
  className,
}: {
  options: ComboboxOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;
  }, [options, search]);

  function toggle(value: string): void {
    onChange(
      values.includes(value)
        ? values.filter((entry) => entry !== value)
        : [...values, value],
    );
  }

  const summary =
    values.length === 0
      ? placeholder
      : values.length <= 2
        ? values
            .map((v) => options.find((o) => o.value === v)?.label ?? v)
            .join(', ')
        : `Wybrano: ${values.length}`;

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-between font-normal',
              values.length > 0 && 'pr-14',
              className,
            )}
          >
            <span
              className={cn('truncate', values.length === 0 && 'text-muted-foreground')}
            >
              {summary}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        {values.length > 0 ? (
          <button
            type="button"
            aria-label="Wyczyść"
            title="Wyczyść"
            className="hover:text-destructive text-muted-foreground absolute top-1/2 right-8 -translate-y-1/2 rounded-sm p-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={() => onChange([])}
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      <PopoverContent className="w-(--radix-popover-trigger-width) bg-secondary-background p-0">
        {options.length > 8 ? (
          <div className="relative border-b-2 border-border p-2">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-4 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Szukaj…"
              className="h-8 pl-8"
            />
          </div>
        ) : null}

        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              className="hover:bg-main hover:text-main-foreground flex w-full items-center gap-2 rounded-base px-2 py-1.5 text-left text-sm"
            >
              <span
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-base border-2 border-border',
                  values.includes(option.value) &&
                    'bg-main text-main-foreground',
                )}
              >
                {values.includes(option.value) ? (
                  <CheckIcon className="size-3" />
                ) : null}
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>

        {values.length > 0 ? (
          <div className="border-t-2 border-border p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange([])}
            >
              Wyczyść ({values.length})
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
