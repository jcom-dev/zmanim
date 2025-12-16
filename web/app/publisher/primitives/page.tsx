'use client';

import { PrimitivesTable } from '@/components/shared/PrimitivesTable';

export default function PublisherPrimitivesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <PrimitivesTable />
      </div>
    </div>
  );
}
