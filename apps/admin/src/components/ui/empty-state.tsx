import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

/**
 * État vide standard GBONHI FOOT — utilisé partout où il n'y a pas encore de
 * données réelles (aucune donnée fictive n'est affichée en attendant).
 */
export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-16 flex flex-col items-center justify-center text-center">
      {Icon && (
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ backgroundColor: '#F0FDF4', color: '#1E7A3A' }}
        >
          <Icon size={26} strokeWidth={1.8} />
        </div>
      )}
      <p className="text-base font-bold text-gray-900">{title}</p>
      {message && <p className="text-sm text-gray-400 mt-1.5 max-w-md">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
