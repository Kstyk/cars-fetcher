import { jsx as _jsx } from "react/jsx-runtime";
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export function DropdownMenuContent({ className, sideOffset = 4, ...props }) {
    return (_jsx(DropdownMenuPrimitive.Portal, { children: _jsx(DropdownMenuPrimitive.Content, { "data-slot": "dropdown-menu-content", sideOffset: sideOffset, className: cn('bg-popover text-popover-foreground z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-md', 'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0', className), ...props }) }));
}
export function DropdownMenuItem({ className, variant = 'default', ...props }) {
    return (_jsx(DropdownMenuPrimitive.Item, { "data-slot": "dropdown-menu-item", "data-variant": variant, className: cn("focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4", 'data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10', className), ...props }));
}
export function DropdownMenuLabel({ className, ...props }) {
    return (_jsx(DropdownMenuPrimitive.Label, { className: cn('px-2 py-1.5 text-sm font-medium', className), ...props }));
}
export function DropdownMenuSeparator({ className, ...props }) {
    return (_jsx(DropdownMenuPrimitive.Separator, { className: cn('bg-border -mx-1 my-1 h-px', className), ...props }));
}
