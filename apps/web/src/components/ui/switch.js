import { jsx as _jsx } from "react/jsx-runtime";
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';
export function Switch({ className, ...props }) {
    return (_jsx(SwitchPrimitive.Root, { "data-slot": "switch", className: cn('peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none', 'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input', 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]', 'disabled:cursor-not-allowed disabled:opacity-50', className), ...props, children: _jsx(SwitchPrimitive.Thumb, { className: cn('bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform', 'data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0') }) }));
}
