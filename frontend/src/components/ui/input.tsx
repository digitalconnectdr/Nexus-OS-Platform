import * as React from "react"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className="flex h-9 w-full rounded-md border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 dark:placeholder:text-slate-500 text-gray-950 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5790AB] dark:focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
