import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;
export function SelectTrigger({ className, size = 'default', children, ...props }) {
    return (_jsxs(SelectPrimitive.Trigger, { "data-slot": "select-trigger", "data-size": size, className: cn("border-input flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg:not([class*='size-'])]:size-4", 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]', 'disabled:cursor-not-allowed disabled:opacity-50', 'data-[placeholder]:text-muted-foreground *:data-[slot=select-value]:line-clamp-1', className), ...props, children: [children, _jsx(SelectPrimitive.Icon, { asChild: true, children: _jsx(ChevronDownIcon, { className: "size-4 opacity-50" }) })] }));
}
export function SelectContent({ className, children, position = 'popper', ...props }) {
    return (_jsx(SelectPrimitive.Portal, { children: _jsxs(SelectPrimitive.Content, { "data-slot": "select-content", className: cn('bg-popover text-popover-foreground relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border shadow-md', 'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', position === 'popper' &&
                'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1', className), position: position, ...props, children: [_jsx(SelectPrimitive.ScrollUpButton, { className: "flex cursor-default items-center justify-center py-1", children: _jsx(ChevronUpIcon, { className: "size-4" }) }), _jsx(SelectPrimitive.Viewport, { className: cn('p-1', position === 'popper' &&
                        'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1'), children: children }), _jsx(SelectPrimitive.ScrollDownButton, { className: "flex cursor-default items-center justify-center py-1", children: _jsx(ChevronDownIcon, { className: "size-4" }) })] }) }));
}
export function SelectItem({ className, children, ...props }) {
    return (_jsxs(SelectPrimitive.Item, { "data-slot": "select-item", className: cn("focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4", className), ...props, children: [_jsx("span", { className: "absolute right-2 flex size-3.5 items-center justify-center", children: _jsx(SelectPrimitive.ItemIndicator, { children: _jsx(CheckIcon, { className: "size-4" }) }) }), _jsx(SelectPrimitive.ItemText, { children: children })] }));
}
export function SelectLabel({ className, ...props }) {
    return (_jsx(SelectPrimitive.Label, { className: cn('text-muted-foreground px-2 py-1.5 text-xs', className), ...props }));
}
export function SelectSeparator({ className, ...props }) {
    return (_jsx(SelectPrimitive.Separator, { className: cn('bg-border pointer-events-none -mx-1 my-1 h-px', className), ...props }));
}
