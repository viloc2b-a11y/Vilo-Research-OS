import React from 'react';
import Link from 'next/link';

export default async function ScientificEventsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scientific Events</h1>
          <p className="text-muted-foreground mt-2">
            Manage physician education, webinars, and sponsor meetings. Connected to Contact Runtime.
          </p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
        <h3 className="text-lg font-medium text-gray-900">Events MVP Available</h3>
        <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
          The Scientific Events engine uses the Contact Runtime architecture. 
          UI implementation is deferred pending design integration with the existing Operations shell.
        </p>
        <div className="mt-6">
          <Link href="/crm" className="text-sm font-medium text-blue-600 hover:text-blue-500">
            &larr; Back to CRM
          </Link>
        </div>
      </div>
    </div>
  );
}
