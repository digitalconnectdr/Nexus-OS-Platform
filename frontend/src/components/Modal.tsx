'use client';

import { ReactNode, useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-2xl" }: ModalProps) {
    // Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Container */}
            <div className={`relative bg-white dark:bg-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full ${maxWidth} max-h-[95vh] overflow-hidden flex flex-col border border-white/20 dark:border-slate-800 rounded-lg scale-100 animate-in fade-in zoom-in-95 duration-150`}>
                {/* Header: Nexus OS Premium Style */}
                <div className="h-16 bg-[#001741] dark:bg-slate-950 flex items-center justify-between px-8 shrink-0 border-b border-white/10 dark:border-slate-800">
                    <div className="flex-1 text-white">{title}</div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                        aria-label="Cerrar"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body: ERP Pro Style */}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-sans">
                    {children}
                </div>
            </div>
        </div>
    );
}
