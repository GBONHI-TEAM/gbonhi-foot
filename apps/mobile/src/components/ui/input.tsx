import { TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  error?: boolean;
}

export function Input({ error, style, ...props }: InputProps) {
  return (
    <View
      className={`h-14 rounded-input border px-4 justify-center ${
        error ? 'border-red-500 bg-red-500/10' : 'border-white/20 bg-white/[0.08]'
      }`}
    >
      <TextInput
        className="text-white text-base flex-1"
        placeholderTextColor="rgba(255,255,255,0.45)"
        style={style}
        {...props}
      />
    </View>
  );
}
