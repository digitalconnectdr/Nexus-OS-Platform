'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * Logs errors and displays a fallback UI
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console (in production, send to error tracking service)
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({
            error,
            errorInfo
        });

        // TODO: Send to error tracking service (e.g., Sentry)
        // logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                        {/* Error Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="bg-red-100 p-4 rounded-full">
                                <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>

                        {/* Error Message */}
                        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                            Algo salió mal
                        </h2>
                        <p className="text-sm text-gray-600 text-center mb-6">
                            Lo sentimos, ocurrió un error inesperado. Por favor intenta nuevamente.
                        </p>

                        {/* Error Details (Development Only) */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-xs font-bold text-red-900 mb-2">Error Details:</p>
                                <p className="text-xs text-red-700 font-mono break-all">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <details className="mt-2">
                                        <summary className="text-xs text-red-600 cursor-pointer font-semibold">
                                            Stack Trace
                                        </summary>
                                        <pre className="text-xs text-red-600 mt-2 overflow-auto max-h-40 whitespace-pre-wrap">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleReset}
                                className="w-full bg-gray-900 hover:bg-black text-white py-3 px-6 rounded-lg text-sm font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95"
                            >
                                Intentar Nuevamente
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-lg text-sm font-bold uppercase tracking-wider transition-all"
                            >
                                Ir al Inicio
                            </button>
                        </div>

                        {/* Support Link */}
                        <p className="text-xs text-gray-500 text-center mt-6">
                            Si el problema persiste, contacta a{' '}
                            <a href="mailto:soporte@nexusos.com" className="text-blue-600 hover:underline font-semibold">
                                soporte técnico
                            </a>
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
