import * as PopoverPrimitive from '@radix-ui/react-popover';
import { CheckIcon, ChevronsUpDownIcon, SearchIcon, XIcon } from 'lucide-react';
import { useMemo, useState, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground z-50 w-72 rounded-md border p-0 shadow-md outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

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
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected?.label ?? placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {clearable && selected ? (
              <XIcon
                className="hover:text-destructive size-3.5 opacity-60"
                role="button"
                aria-label="Wyczyść"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(null);
                }}
              />
            ) : null}
            <ChevronsUpDownIcon className="size-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width)">
        <div className="relative border-b p-2">
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
                  'hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                  option.value === value && 'bg-accent/60',
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
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('w-full justify-between font-normal', className)}
        >
          <span
            className={cn('truncate', values.length === 0 && 'text-muted-foreground')}
          >
            {summary}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width)">
        {options.length > 8 ? (
          <div className="relative border-b p-2">
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
              className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
            >
              <span
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-[4px] border',
                  values.includes(option.value) &&
                    'bg-primary border-primary text-primary-foreground',
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
          <div className="border-t p-1">
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
