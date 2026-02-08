'use client';

import { RocketLaunchIcon, BeakerIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface WipProps {
    title: string;
    description?: string;
    moduleName?: string;
    backUrl?: string;
}

export default function WipState({
    title,
    description = "Este módulo está actualmente en fase de desarrollo activo. Pronto estará disponible en la plataforma.",
    moduleName = "MÓDULO EN CONSTRUCCIÓN",
    backUrl = "/"
}: WipProps) {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="relative mb-8 group">
                <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-1000 animate-pulse"></div>
                <div className="relative w-32 h-32 bg-white rounded-3xl border-4 border-blue-50 flex items-center justify-center shadow-xl">
                    <RocketLaunchIcon className="w-16 h-16 text-blue-600 animate-bounce [animation-duration:3s]" />
                    <WrenchScrewdriverIcon className="w-8 h-8 text-slate-400 absolute bottom-4 right-4 animate-spin [animation-duration:10s]" />
                </div>
            </div>

            <div className="max-w-md space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 mb-2">
                    <BeakerIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                        {moduleName}
                    </span>
                </div>

                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {title}
                </h1>

                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    {description}
                </p>

                <div className="pt-6">
                    <Link
                        href={backUrl}
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 hover:scale-105 transition-all shadow-lg shadow-slate-900/10"
                    >
                        Volver al Inicio
                    </Link>
                </div>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span>Arquitectura</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span>Diseño UI</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span>Desarrollo</span>
                </div>
            </div>
        </div>
    );
}
