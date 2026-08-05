import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function Input({ className, type, ...props }) {
    return (_jsx("input", { type: type, "data-slot": "input", className: cn('flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none', 'file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium', 'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground', 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]', 'disabled:cursor-not-allowed disabled:opacity-50', 'aria-invalid:border-destructive aria-invalid:ring-destructive/20', className), ...props }));
}
