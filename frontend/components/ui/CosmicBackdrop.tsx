/**
 * CosmicBackdrop — shared mystical background used app-wide.
 *
 * Two usage modes:
 *
 *   1. As a sibling layer (no children) — original usage:
 *
 *        <View style={{flex: 1}}>
 *          <CosmicBackdrop />
 *          <YourContent />
 *        </View>
 *
 *   2. As a wrapper around content — newer usage:
 *
 *        <CosmicBackdrop>
 *          <YourContent />
 *        </CosmicBackdrop>
 *
 *      In wrapper mode the gradient + mist render behind, and children render
 *      on top with normal pointer events restored.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Mist from './Mist';

interface CosmicBackdropProps {
  intensity?: 'soft' | 'medium' | 'strong';
  mistCount?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export const CosmicBackdrop: React.FC<CosmicBackdropProps> = ({
  intensity = 'soft',
  mistCount = 6,
  style,
  children,
}) => {
  // Sibling mode (no children) — keep the original absolute-fill behavior.
  if (!children) {
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
        <LinearGradient
          colors={['#1a0033', '#0d0015', '#000000']}
          style={StyleSheet.absoluteFill}
        />
        <Mist count={mistCount} intensity={intensity} />
      </View>
    );
  }

  // Wrapper mode — content sits ABOVE the gradient with normal touches.
  return (
    <View style={[styles.wrapper, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['#1a0033', '#0d0015', '#000000']}
          style={StyleSheet.absoluteFill}
        />
        <Mist count={mistCount} intensity={intensity} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  content: { flex: 1 },
});

export default CosmicBackdrop;
