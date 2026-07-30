'use client';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Header } from '../../../../components/layout/header';
import { apiFetch } from '../../../../lib/api';
import { FinanceTabs } from '../finance-tabs';

interface Cost {
  id: string;
  label: string;
  category: string;
  amount: number;
  incurred_on: string;
}

const CATEGORIES = ['MARKETING', 'SALAIRES', 'INFRASTRUCTURE', 'LOGISTIQUE', 'AUTRE'];
const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

export default function DeclarerCoutsPage() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const d = await apiFetch<Cost[]>('/finance/costs');
      setCosts(Array.isArray(d) ? d : []);
    } catch {
      setCosts([]);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    setError('');
    const amt = parseInt(amount, 10);
    if (!label.trim() || Number.isNaN(amt) || amt < 0) {
      setError('Renseigne un libellé et un montant valide.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/finance/costs', {
        method: 'POST',
        body: JSON.stringify({ label: label.trim(), category, amount: amt, incurred_on: date }),
      });
      setLabel(''); setAmount('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setCosts((c) => c.filter((x) => x.id !== id));
    try { await apiFetch(`/finance/costs/${id}`, { method: 'DELETE' }); } catch { load(); }
  }

  const total = costs.reduce((s, c) => s + c.amount, 0);

  return (
    <>
      <Header title="Finance" />
      <FinanceTabs />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-fit">
          <h2 className="font-bold text-gray-900 mb-4">Déclarer un coût</h2>
          <label className="block text-sm text-gray-600 mb-1">Libellé</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Campagne Facebook"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-3 text-sm" />
          <label className="block text-sm text-gray-600 mb-1">Catégorie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-3 text-sm bg-white">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="block text-sm text-gray-600 mb-1">Montant (FCFA)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="50000"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-3 text-sm" />
          <label className="block text-sm text-gray-600 mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-4 text-sm" />
          {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}
          <button onClick={submit} disabled={saving}
            className="w-full rounded-lg py-2.5 font-semibold text-white transition disabled:opacity-60"
            style={{ backgroundColor: '#1E7A3A' }}>
            {saving ? 'Enregistrement…' : 'Ajouter le coût'}
          </button>
        </div>

        {/* Liste */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Coûts déclarés</h2>
            <span className="text-sm font-bold text-red-600">{fcfa(total)}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Libellé</th>
                <th className="px-5 py-3 font-semibold">Catégorie</th>
                <th className="px-5 py-3 font-semibold text-right">Montant</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Chargement…</td></tr>
              ) : costs.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Aucun coût déclaré.</td></tr>
              ) : (
                costs.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-600">{c.incurred_on}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{c.label}</td>
                    <td className="px-5 py-3 text-gray-600">{c.category}</td>
                    <td className="px-5 py-3 text-right font-bold text-gray-900">{fcfa(c.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-600 transition" aria-label="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
