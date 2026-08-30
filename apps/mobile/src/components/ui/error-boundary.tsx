import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface Props { children: React.ReactNode }
interface State { error: Error | null }

/**
 * Garde-fou global : intercepte les erreurs de rendu React et affiche un écran
 * de récupération au lieu de fermer l'application. Un bouton « Réessayer »
 * remonte l'arbre proprement.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Trace en console (visible dans les logs de dev / crash reporting).
    console.error('AppErrorBoundary a intercepté une erreur :', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0D1F0D', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>⚽</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
            Oups, un souci est survenu
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
            L&apos;écran a rencontré une erreur. Tu peux réessayer sans fermer l&apos;application.
          </Text>
          <Pressable
            onPress={this.reset}
            style={{ marginTop: 24, backgroundColor: '#F7921E', paddingHorizontal: 28, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Réessayer</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
