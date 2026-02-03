'use client';

import React, { useEffect, useState } from 'react';
import DashboardRealTime from '@/components/DashboardRealTime';
import OperationalStats from '@/components/dashboard/OperationalStats';

import LoadingState from '@/components/ui/LoadingState';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <LoadingState message="Iniciando sistema..." fullScreen={true} />;
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
