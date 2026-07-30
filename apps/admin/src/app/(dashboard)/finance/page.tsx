'use client';
import { useEffect, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';
import { FinanceTabs } from './finance-tabs';

interface Summary {
  ca: number;
  commission: number;
  reverse: number;
  transactions: number;
  costs: number;
  marge: number;
}

const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-2xl font-black mt-1" style={{ color: color ?? '#111827' }}>{value}</p>
    </div>
  );
}

export default function FinancePage() {
  const [s, setS] = useState<Summary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch<Summary>('/finance/summary')
      .then(setS)
      .catch(() => setS(null))
      .finally(() => setLoaded(true));
  }, []);

  const v = (n?: number) => (loaded && s ? fcfa(n ?? 0) : '—');

  return (
    <>
      <Header title="Finance" />
      <FinanceTabs />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Chiffre d'affaires (CA)" value={v(s?.ca)} />
        <KpiCard label="Commission GBONHI (10%)" value={v(s?.commission)} color="#F7921E" />
        <KpiCard label="Reversé partenaires" value={v(s?.reverse)} color="#1E7A3A" />
        <KpiCard label="Coûts déclarés" value={v(s?.costs)} color="#DC2626" />
        <KpiCard label="Marge nette" value={v(s?.marge)} color={s && s.marge >= 0 ? '#1E7A3A' : '#DC2626'} />
        <KpiCard label="Transactions" value={loaded && s ? s.transactions.toLocaleString('fr-FR') : '—'} />
      </div>

      <p className="text-xs text-gray-400 mt-4">
        CA = somme des réservations · Commission = part GBONHI · Reversé = part partenaire ·
        Marge nette = Commission − Coûts déclarés.
      </p>
    </>
  );
}
