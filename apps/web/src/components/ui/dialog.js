import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;
export function DialogOverlay({ className, ...props }) {
    return (_jsx(DialogPrimitive.Overlay, { "data-slot": "dialog-overlay", className: cn('fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]', 'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0', className), ...props }));
}
export function DialogContent({ className, children, ...props }) {
    return (_jsxs(DialogPortal, { children: [_jsx(DialogOverlay, {}), _jsxs(DialogPrimitive.Content, { "data-slot": "dialog-content", className: cn('bg-background fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border p-6 shadow-lg sm:max-w-lg', 'max-h-[calc(100dvh-4rem)] overflow-y-auto', 'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0', className), ...props, children: [children, _jsxs(DialogPrimitive.Close, { className: "absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none", children: [_jsx(XIcon, { className: "size-4" }), _jsx("span", { className: "sr-only", children: "Zamknij" })] })] })] }));
}
export function DialogHeader({ className, ...props }) {
    return (_jsx("div", { "data-slot": "dialog-header", className: cn('flex flex-col gap-2 text-left', className), ...props }));
}
export function DialogFooter({ className, ...props }) {
    return (_jsx("div", { "data-slot": "dialog-footer", className: cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className), ...props }));
}
export function DialogTitle({ className, ...props }) {
    return (_jsx(DialogPrimitive.Title, { className: cn('text-lg leading-none font-semibold', className), ...props }));
}
export function DialogDescription({ className, ...props }) {
    return (_jsx(DialogPrimitive.Description, { className: cn('text-muted-foreground text-sm', className), ...props }));
}
