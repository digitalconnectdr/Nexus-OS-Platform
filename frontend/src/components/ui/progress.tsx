import * as React from "react"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value?: number, indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => {
    return (
        <div
            ref={ref}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
            className={cn(
                "relative h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
                className
            )}
            {...props}
        >
            <div
                className={cn(
                    "h-full w-full flex-1 bg-indigo-600 transition-all duration-500 ease-in-out dark:bg-indigo-400",
                    indicatorClassName
                )}
                style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
            />
        </div>
    )
})
Progress.displayName = "Progress"

export { Progress }
