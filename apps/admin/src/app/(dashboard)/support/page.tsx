'use client';
import { Header } from '../../../components/layout/header';
import { TicketsManager } from '../../../components/support/tickets-manager';

export default function SupportPage() {
  return (
    <>
      <Header title="Support" />
      <p className="text-sm text-gray-500">
        Tickets et demandes d&apos;assistance des utilisateurs. Réponds, change le statut ou la priorité.
      </p>
      <TicketsManager kind="support" />
    </>
  );
}
