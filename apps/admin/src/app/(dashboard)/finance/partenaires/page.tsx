'use client';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../../../components/layout/header';
import { apiFetch } from '../../../../lib/api';
import { FinanceTabs } from '../finance-tabs';

interface PartnerRow {
  partnerId: string;
  partnerName: string;
  terrains: string[];
  amountOwed: number;
  transactions: number;
  status: string;
}

const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
const STATUSES = ['À payer', 'Payé', 'En litige'];

export default function PartenairesAPayerPage() {
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('Tous');

  useEffect(() => {
    apiFetch<PartnerRow[]>('/finance/partners')
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoaded(true));
  }, []);

  const filtered = useMemo(
    () => (statusFilter === 'Tous' ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );
  const total = filtered.reduce((s, r) => s + r.amountOwed, 0);

  return (
    <>
      <Header title="Finance" />
      <FinanceTabs />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {['Tous', ...STATUSES].map((s) => {
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-4 py-1.5 rounded-full text-sm font-medium border transition"
              style={{ backgroundColor: active ? '#F7921E' : 'white', color: active ? 'white' : '#374151', borderColor: active ? '#F7921E' : '#E5E7EB' }}>
              {s}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-5 py-3 font-semibold">Partenaire</th>
              <th className="px-5 py-3 font-semibold">Terrains</th>
              <th className="px-5 py-3 font-semibold text-center">Transactions</th>
              <th className="px-5 py-3 font-semibold text-right">Montant dû</th>
              <th className="px-5 py-3 font-semibold text-center">Statut</th>
            </tr>
          </thead>
          <tbody>
            {!loaded ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Aucun partenaire à payer.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.partnerId} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-gray-900">{r.partnerName}</td>
                  <td className="px-5 py-3 text-gray-600">{r.terrains.join(', ') || '—'}</td>
                  <td className="px-5 py-3 text-center text-gray-600">{r.transactions}</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">{fcfa(r.amountOwed)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(247,146,30,0.12)', color: '#B45309' }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-100 bg-gray-50">
                <td className="px-5 py-3 font-bold text-gray-900" colSpan={3}>Total à reverser</td>
                <td className="px-5 py-3 text-right font-black text-gray-900">{fcfa(total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
