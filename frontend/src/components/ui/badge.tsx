import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
    const variants = {
        default: "border-transparent bg-indigo-600 text-white hover:bg-indigo-700",
        secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200",
        destructive: "border-transparent bg-red-600 text-white hover:bg-red-700",
        outline: "text-slate-900 border-slate-200",
    }

    return (
        <div
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                variants[variant],
                className
            )}
            {...props}
        />
    )
}

export { Badge }
