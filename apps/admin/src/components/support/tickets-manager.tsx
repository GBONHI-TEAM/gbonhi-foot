'use client';
import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export interface Ticket {
  id: string;
  user_id: string | null;
  kind: string;
  category: string | null;
  subject: string;
  message: string;
  status: string;
  priority: string;
  response: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  reporter_name: string | null;
  reporter_avatar: string | null;
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  ouvert: { label: 'Ouvert', bg: '#FEF3C7', color: '#B45309' },
  en_cours: { label: 'En cours', bg: '#DBEAFE', color: '#1D4ED8' },
  resolu: { label: 'Résolu', bg: '#DCFCE7', color: '#15803D' },
  ferme: { label: 'Fermé', bg: '#F3F4F6', color: '#6B7280' },
};
const PRIORITY_META: Record<string, { label: string; bg: string; color: string }> = {
  basse: { label: 'Basse', bg: '#F3F4F6', color: '#6B7280' },
  normale: { label: 'Normale', bg: '#E0F2FE', color: '#0369A1' },
  haute: { label: 'Haute', bg: '#FFEDD5', color: '#C2410C' },
  critique: { label: 'Critique', bg: '#FEE2E2', color: '#B91C1C' },
};
const STATUS_ORDER = ['ouvert', 'en_cours', 'resolu', 'ferme'] as const;

function Badge({ meta }: { meta: { label: string; bg: string; color: string } }) {
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function TicketsManager({ kind, refreshKey = 0 }: { kind: 'support' | 'incident'; refreshKey?: number }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Ticket | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = `kind=${kind}${filter ? `&status=${filter}` : ''}`;
      const [list, c] = await Promise.all([
        apiFetch<Ticket[]>(`/support/tickets?${qs}`),
        apiFetch<Record<string, number>>(`/support/tickets/counts?kind=${kind}`),
      ]);
      setTickets(Array.isArray(list) ? list : []);
      setCounts(c ?? {});
    } catch {
      // Les détails techniques restent dans les logs du navigateur et de l'API.
      setError('Impossible de charger les demandes pour le moment. Vérifie la connexion puis réessaie.');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [kind, filter]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const total = STATUS_ORDER.reduce((s, k) => s + (counts[k] ?? 0), 0);

  return (
    <div className="mt-6">
      {/* Filtres par statut */}
      <div className="flex flex-wrap gap-2 mb-5">
        <FilterChip label={`Tous (${total})`} active={filter === ''} onClick={() => setFilter('')} />
        {STATUS_ORDER.map((s) => (
          <FilterChip key={s} label={`${STATUS_META[s].label} (${counts[s] ?? 0})`} active={filter === s} onClick={() => setFilter(s)} />
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#B91C1C' }}>
          {error}
        </div>
      ) : loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Chargement…</div>
      ) : tickets.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          Aucun {kind === 'incident' ? 'incident' : 'ticket'} {filter ? `« ${STATUS_META[filter]?.label} »` : ''} pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', backgroundColor: 'white' }}>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400" style={{ backgroundColor: '#F9FAFB' }}>
                <th className="px-4 py-3 font-bold">ID</th>
                <th className="px-4 py-3 font-bold">{kind === 'incident' ? 'Incident / match concerné' : 'Sujet'}</th>
                <th className="px-4 py-3 font-bold">{kind === 'incident' ? 'Rapporté par' : 'Utilisateur'}</th>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Priorité</th>
                <th className="px-4 py-3 font-bold">Statut</th>
                <th className="px-4 py-3 font-bold">Date</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} onClick={() => setSelected(t)} className="border-t cursor-pointer hover:bg-gray-50 transition" style={{ borderColor: '#F3F4F6' }}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-500">#{t.id.slice(0, 5)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800 max-w-[280px] truncate">{t.subject}</td>
                  <td className="px-4 py-3 text-gray-600">{t.reporter_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{t.category ?? '—'}</td>
                  <td className="px-4 py-3"><Badge meta={PRIORITY_META[t.priority] ?? PRIORITY_META.normale} /></td>
                  <td className="px-4 py-3"><Badge meta={STATUS_META[t.status] ?? STATUS_META.ouvert} /></td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <TicketDrawer ticket={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 h-9 rounded-lg text-sm font-semibold border transition"
      style={{ backgroundColor: active ? '#F0FDF4' : 'white', borderColor: active ? '#1E7A3A' : '#E5E7EB', color: active ? '#1E7A3A' : '#6B7280' }}
    >
      {label}
    </button>
  );
}

function TicketDrawer({ ticket, onClose, onSaved }: { ticket: Ticket; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [response, setResponse] = useState(ticket.response ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true);
    setErr('');
    try {
      await apiFetch(`/support/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, priority, response: response.trim() || undefined }),
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 h-16 border-b" style={{ borderColor: '#E5E7EB' }}>
          <h2 className="font-bold text-gray-800">Détail du ticket</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{ticket.subject}</h3>
            <p className="text-xs text-gray-400 mt-1">
              {ticket.reporter_name ?? 'Utilisateur'} · {formatDate(ticket.created_at)}{ticket.category ? ` · ${ticket.category}` : ''}
            </p>
          </div>

          <div className="rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap" style={{ backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' }}>
            {ticket.message}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-10 px-3 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }}>
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Priorité</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full h-10 px-3 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }}>
                {(['basse', 'normale', 'haute', 'critique']).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Réponse au demandeur</label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={5}
              placeholder="Écris une réponse — elle sera envoyée en notification à l'utilisateur."
              className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none" style={{ borderColor: '#E5E7EB' }}
            />
          </div>

          {err ? <p className="text-xs" style={{ color: '#B91C1C' }}>{err}</p> : null}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 h-11 rounded-lg text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50">Annuler</button>
            <button onClick={save} disabled={saving} className="flex-1 h-11 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: '#1E7A3A' }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
