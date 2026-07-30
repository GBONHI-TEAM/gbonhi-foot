'use client';
import { useState } from 'react';
import { Header } from '../../../components/layout/header';
import { Phone, MessageCircle, Mail, ChevronRight, Plus, LifeBuoy } from 'lucide-react';

const FAQ = [
  "Comment fonctionne le statut d'ouverture de mon terrain ?",
  'Quand sont reversés mes revenus ?',
  'Que se passe-t-il pour un match de League ?',
];

const FILTRES = ['7 derniers jours', 'Ce mois', '3 mois', 'Toutes'];

export default function SupportPage() {
  const [filtre, setFiltre] = useState('Ce mois');

  return (
    <>
      <Header title="Support & Assistance" subtitle="Nous sommes là pour vous aider" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne gauche */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 text-[14px] mb-4">Nous contacter</h2>
            <div className="space-y-2.5">
              <button className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold text-white" style={{ backgroundColor: '#1A3D2B' }}>
                <Phone size={15} /> Appeler GBONHI FOOT
              </button>
              <button className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold text-white" style={{ backgroundColor: '#25D366' }}>
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
                <Mail size={15} className="text-gray-400" /> support@gbonhifoot.com
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 text-[14px] mb-2">FAQ rapide</h2>
            <div className="divide-y divide-gray-100">
              {FAQ.map((q) => (
                <button key={q} className="w-full flex items-center justify-between py-3 text-left hover:text-gray-900">
                  <span className="text-[13px] text-gray-600">{q}</span>
                  <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900 text-[14px]">Mes demandes</h2>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white" style={{ backgroundColor: '#1A3D2B' }}>
              <Plus size={13} /> Nouvelle demande
            </button>
          </div>
          <div className="flex items-center gap-1.5 my-3 flex-wrap">
            {FILTRES.map((f) => (
              <button
                key={f}
                onClick={() => setFiltre(f)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
                style={{
                  backgroundColor: filtre === f ? '#F0FDF4' : 'white',
                  color: filtre === f ? '#065F46' : '#6B7280',
                  borderColor: filtre === f ? '#A7F3D0' : '#E5E7EB',
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center justify-center text-center py-12">
            <LifeBuoy size={26} className="text-gray-300 mb-3" />
            <p className="text-[13px] font-medium text-gray-500">Aucune demande pour le moment</p>
            <p className="text-[12px] text-gray-400 mt-1 max-w-xs">Vos demandes de support apparaîtront ici une fois créées.</p>
          </div>
        </div>
      </div>
    </>
  );
}
