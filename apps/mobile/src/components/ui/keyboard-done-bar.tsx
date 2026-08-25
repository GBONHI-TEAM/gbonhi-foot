import { InputAccessoryView, Keyboard, Platform, Pressable, Text, View } from 'react-native';

/**
 * Identifiant partagé de la barre « Terminé » iOS. Les champs (TextInput / Input)
 * qui posent `inputAccessoryViewID={KB_DONE_ID}` affichent un bouton « Terminé »
 * au-dessus du clavier — indispensable pour fermer les claviers numériques
 * (Taille, Poids, date…) qui n'ont pas de touche Retour.
 */
export const KB_DONE_ID = 'gbonhiKeyboardDone';

/**
 * À rendre une seule fois (au niveau racine). iOS uniquement : sur Android,
 * `InputAccessoryView` n'existe pas et le composant ne rend rien.
 */
export function KeyboardDoneBar() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KB_DONE_ID}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          backgroundColor: '#0F3D1E',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.12)',
        }}
      >
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10}>
          <Text style={{ color: '#F7921E', fontWeight: '700', fontSize: 16 }}>Terminé</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
