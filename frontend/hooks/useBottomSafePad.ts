/**
 * useBottomSafePad — returns a bottom padding value that includes the
 * device's home-indicator / gesture-nav inset PLUS a generous buffer so
 * ScrollView content never gets clipped by the phone's system UI.
 *
 * Usage:
 *   const pad = useBottomSafePad();
 *   <ScrollView contentContainerStyle={{ paddingBottom: pad }}>
 *
 * Optional `extra` (default 96) lets a screen add more breathing room —
 * useful when a floating "Save" button sits above the fold. The default
 * is intentionally generous so content clears iOS home indicators,
 * Android gesture bars, and any floating tab / action UI.
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useBottomSafePad(extra: number = 96): number {
  const insets = useSafeAreaInsets();
  // Guarantee a minimum inset of 16 for devices that report 0
  // (older Android or web preview) so content still clears the edge.
  const bottomInset = Math.max(insets.bottom, 16);
  return bottomInset + extra;
}
