import { Pressable, Text, ActivityIndicator } from 'react-native';
import type { PressableProps } from 'react-native';

interface ButtonProps extends PressableProps {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function Button({ label, loading, variant = 'primary', disabled, ...props }: ButtonProps) {
  const bgClass =
    variant === 'primary'
      ? 'bg-accent'
      : variant === 'secondary'
        ? 'bg-primary'
        : 'border border-white/40 bg-transparent';

  return (
    <Pressable
      className={`h-[52px] items-center justify-center rounded-btn ${bgClass} ${disabled || loading ? 'opacity-50' : 'active:opacity-80'}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-white text-base font-semibold">{label}</Text>
      )}
    </Pressable>
  );
}
