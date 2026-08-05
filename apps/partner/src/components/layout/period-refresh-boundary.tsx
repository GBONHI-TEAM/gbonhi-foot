'use client';

import { useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';

/** Remonte la page lorsque l'utilisateur applique une nouvelle période. */
export function PeriodRefreshBoundary({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const key = `${params.get('from') ?? ''}-${params.get('to') ?? ''}`;
  return <div key={key}>{children}</div>;
}
