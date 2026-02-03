'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // Prevent hydration mismatch
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="w-8 h-8" />;

    return (
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-lg transition-all ${theme === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                title="Modo Claro"
            >
                <Sun className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'bg-slate-900 text-yellow-400 shadow-sm' : 'text-gray-400 hover:text-slate-300'}`}
                title="Modo Oscuro"
            >
                <Moon className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded-lg transition-all ${theme === 'system' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`}
                title="Sistema"
            >
                <Monitor className="w-4 h-4" />
            </button>
        </div>
    );
}
