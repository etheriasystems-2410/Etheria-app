/**
 * useBottomSafePad — returns a bottom padding value that includes the
 * device's home-indicator / gesture-nav inset PLUS a generous buffer so
 * ScrollView content never gets clipped by the phone's system UI.
 *
 * Usage:
 *   const pad = useBottomSafePad();
 *   <ScrollView contentContainerStyle={{ paddingBottom: pad }}>
 *
 * Optional `extra` (default 40) lets a screen add more breathing room —
 * useful when a floating "Save" button sits above the fold.
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useBottomSafePad(extra: number = 40): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + extra;
}
