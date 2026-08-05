'use client';

import { useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';

/** Remonte la page quand la période change afin de relancer ses requêtes GET. */
export function PeriodRefreshBoundary({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const key = `${params.get('from') ?? ''}-${params.get('to') ?? ''}`;
  return <div key={key}>{children}</div>;
}
