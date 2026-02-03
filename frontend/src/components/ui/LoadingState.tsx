'use client';

import { CpuChipIcon } from '@heroicons/react/24/solid';

interface LoadingStateProps {
    message?: string;
    fullScreen?: boolean;
}

export default function LoadingState({ message = 'SINCRONIZANDO...', fullScreen = false }: LoadingStateProps) {
    const containerClasses = fullScreen
        ? "fixed inset-0 z-[999] bg-white flex flex-col items-center justify-center"
        : "w-full py-20 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200";

    return (
        <div className={containerClasses}>
            <div className="flex flex-col items-center gap-6">
                {/* Logo Section with Pulse Animation */}
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-600/20 rounded-2xl animate-ping opacity-40"></div>
                    <div className="relative bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/30 scale-100 ring-4 ring-blue-50">
                        <CpuChipIcon className="w-9 h-9 text-white animate-pulse" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="flex flex-col items-center gap-2">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter">NEXUS OS</h1>
                    <div className="flex flex-col items-center gap-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] text-center max-w-xs leading-relaxed">
                            {message}
                        </p>

                        {/* Jumping Dots Animation */}
                        <div className="flex gap-1.5">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Context Message (Optional - if fullScreen) */}
            {fullScreen && (
                <div className="absolute bottom-10">
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Enterprise Cloud Stack • v2.0.4</p>
                </div>
            )}
        </div>
    );
}
