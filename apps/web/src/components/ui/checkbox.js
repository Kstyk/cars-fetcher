import { jsx as _jsx } from "react/jsx-runtime";
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
export function Checkbox({ className, ...props }) {
    return (_jsx(CheckboxPrimitive.Root, { "data-slot": "checkbox", className: cn('peer border-input size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none', 'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary', 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]', 'disabled:cursor-not-allowed disabled:opacity-50', className), ...props, children: _jsx(CheckboxPrimitive.Indicator, { className: "flex items-center justify-center text-current", children: _jsx(CheckIcon, { className: "size-3.5" }) }) }));
}
