// Test component to verify Error Boundary works
// Add this to any page temporarily to test

'use client';

import { useState } from 'react';

export default function ErrorBoundaryTest() {
    const [shouldError, setShouldError] = useState(false);

    if (shouldError) {
        throw new Error('🧪 Test Error: Error Boundary is working!');
    }

    return (
        <div className="p-8 max-w-md mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                    🧪 Error Boundary Test
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                    Click the button below to trigger an error and test the Error Boundary.
                </p>
                <button
                    onClick={() => setShouldError(true)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg text-sm font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95"
                >
                    🔥 Trigger Error
                </button>
                <p className="text-xs text-gray-500 mt-4">
                    After clicking, you should see a friendly error page with "Algo salió mal"
                </p>
            </div>
        </div>
    );
}
