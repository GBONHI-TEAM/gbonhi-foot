'use client';
import { KeyRound } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { EmptyState } from '../../../components/ui/empty-state';

export default function RolesPage() {
  return (
    <>
      <Header title="Rôles & Accès" />
      <EmptyState
        icon={KeyRound}
        title="Aucun rôle configuré pour le moment"
        message="La gestion des rôles et des permissions d'accès sera disponible ici."
      />
    </>
  );
}
