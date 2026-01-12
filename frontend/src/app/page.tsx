'use client';

import React, { useEffect, useState } from 'react';
import DashboardRealTime from '@/components/DashboardRealTime';
import OperationalStats from '@/components/dashboard/OperationalStats';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <p className="text-gray-500 font-medium">Iniciando sistema...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 text-gray-900 font-sans min-h-screen p-8 space-y-8">
      <DashboardRealTime />
      <div className="max-w-7xl mx-auto">
        <OperationalStats />
      </div>
    </div>
  );
}
