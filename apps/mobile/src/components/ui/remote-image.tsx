import { Image as ExpoImage } from 'expo-image';
import { ReactNode } from 'react';
import { ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type ContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

interface RemoteImageProps {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: ContentFit;
  accessibilityLabel?: string;
}

/**
 * Images distantes (Supabase Storage) : expo-image s'appuie sur SDWebImage / 
 * Glide, plus fiable que le composant Image de React Native avec les URLs
 * Storage sur les builds iOS/Android de l'application.
 */
export function RemoteImage({
  uri,
  style,
  contentFit = 'cover',
  accessibilityLabel,
}: RemoteImageProps) {
  if (!uri) return null;
  return (
    <ExpoImage
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={120}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

interface RemoteImageBackgroundProps {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  contentFit?: ContentFit;
  children?: ReactNode;
}

/** Équivalent d'ImageBackground pour une URL distante. */
export function RemoteImageBackground({
  uri,
  style,
  imageStyle,
  contentFit = 'cover',
  children,
}: RemoteImageBackgroundProps) {
  return (
    <View style={style}>
      {uri ? (
        <ExpoImage
          source={{ uri }}
          style={[StyleSheet.absoluteFill, imageStyle]}
          contentFit={contentFit}
          cachePolicy="memory-disk"
          transition={120}
        />
      ) : null}
      {children}
    </View>
  );
}
