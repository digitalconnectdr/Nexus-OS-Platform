"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from "@/lib/utils";

interface TooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    className?: string;
}

export const Tooltip = ({ children, content, className }: TooltipProps) => {
    const [show, setShow] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const updateCoords = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                x: rect.left + rect.width / 2,
                y: rect.top
            });
        }
    };

    useEffect(() => {
        if (show) {
            updateCoords();
            // Critical for ensuring it doesn't leave the trigger if Page scrolls
            const interval = setInterval(updateCoords, 100);
            window.addEventListener('scroll', updateCoords, true);
            window.addEventListener('resize', updateCoords);
            return () => {
                clearInterval(interval);
                window.removeEventListener('scroll', updateCoords, true);
                window.removeEventListener('resize', updateCoords);
            };
        }
    }, [show]);

    if (!mounted) return <>{children}</>;

    return (
        <div
            ref={triggerRef}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onFocus={() => setShow(true)}
            onBlur={() => setShow(false)}
            className="inline-block"
        >
            {children}
            {show && createPortal(
                <div
                    className={cn(
                        "fixed z-[9999] px-3 py-2 bg-white/95 backdrop-blur-md text-slate-900 text-[10px] font-bold rounded-lg border border-slate-200 shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-200",
                        "-translate-x-1/2 -translate-y-full mb-2 max-w-[250px] text-center leading-relaxed",
                        className
                    )}
                    style={{
                        left: coords.x,
                        top: coords.y,
                        filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.1))'
                    }}
                >
                    {content}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white/90" />
                </div>,
                document.body
            )}
        </div>
    );
};
