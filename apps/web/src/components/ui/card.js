import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function Card({ className, ...props }) {
    return (_jsx("div", { "data-slot": "card", className: cn('bg-card text-card-foreground flex flex-col rounded-xl border shadow-sm', className), ...props }));
}
export function CardHeader({ className, ...props }) {
    return (_jsx("div", { "data-slot": "card-header", className: cn('flex flex-col gap-1.5 px-6 pt-6', className), ...props }));
}
export function CardTitle({ className, ...props }) {
    return (_jsx("div", { "data-slot": "card-title", className: cn('leading-none font-semibold', className), ...props }));
}
export function CardDescription({ className, ...props }) {
    return (_jsx("div", { "data-slot": "card-description", className: cn('text-muted-foreground text-sm', className), ...props }));
}
export function CardContent({ className, ...props }) {
    return (_jsx("div", { "data-slot": "card-content", className: cn('px-6 py-6', className), ...props }));
}
export function CardFooter({ className, ...props }) {
    return (_jsx("div", { "data-slot": "card-footer", className: cn('flex items-center px-6 pb-6', className), ...props }));
}
