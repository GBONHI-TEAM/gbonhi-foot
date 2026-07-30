'use client';
import { Header } from '../../../components/layout/header';
import { TicketsManager } from '../../../components/support/tickets-manager';

export default function IncidentsPage() {
  return (
    <>
      <Header title="Incidents" />
      <p className="text-sm text-gray-500">
        Incidents signalés sur les matchs ou les terrains. Traite, priorise et réponds aux signalements.
      </p>
      <TicketsManager kind="incident" />
    </>
  );
}
