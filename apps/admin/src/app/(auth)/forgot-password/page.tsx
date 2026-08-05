'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '../../../lib/supabase/client';

/**
 * Demande d'un lien de définition/réinitialisation de mot de passe.
 * Envoie un e-mail Supabase qui renvoie vers /reset-password.
 */
export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    setLoading(false);
    // On affiche toujours le même message (ne révèle pas si le compte existe).
    if (err && err.status === 0) {
      setError('Service momentanément inaccessible. Réessaie dans quelques instants.');
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: '#EEF1F4' }}>
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-8 sm:p-10" style={{ boxShadow: '0 24px 60px rgba(15,23,42,0.14)' }}>
        <div className="mb-6 text-center">
          <span className="text-2xl font-black" style={{ color: '#1E7A3A' }}>GBONHI </span>
          <span className="text-2xl font-black" style={{ color: '#F7921E' }}>FOOT</span>
          <p className="mt-1 text-sm text-gray-500">Espace Administrateur</p>
        </div>

        {sent ? (
          <div className="py-4 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: '#1E7A3A' }} />
            <p className="text-sm text-gray-700">
              Si un compte est associé à <span className="font-semibold">{email}</span>, un e-mail avec un lien pour définir votre mot de passe vient d’être envoyé.
            </p>
            <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: '#1E7A3A' }}>
              <ArrowLeft size={16} /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <h2 className="mb-1.5 text-[24px] font-extrabold leading-tight text-gray-900">Mot de passe oublié</h2>
            <p className="mb-7 text-sm text-gray-500">Saisissez votre e-mail pour recevoir un lien de définition de mot de passe.</p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-gray-700">Adresse email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-[52px] w-full rounded-xl border border-gray-200 pl-11 pr-4 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-[#1E7A3A] focus:outline-none focus:ring-1 focus:ring-[#1E7A3A]"
                  />
                </div>
              </div>
              {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={loading} className="h-[52px] w-full rounded-xl text-sm font-bold text-white transition disabled:opacity-60" style={{ backgroundColor: '#F7921E' }}>
                {loading ? 'Envoi…' : 'Recevoir le lien'}
              </button>
            </form>
            <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: '#1E7A3A' }}>
              <ArrowLeft size={16} /> Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
