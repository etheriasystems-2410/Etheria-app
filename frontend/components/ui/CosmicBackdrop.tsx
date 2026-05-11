/**
 * CosmicBackdrop - The shared mystical background used app-wide.
 * Provides the cosmic purple gradient + drifting mist that defines the visual identity.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Mist from './Mist';

interface CosmicBackdropProps {
  intensity?: 'soft' | 'medium' | 'strong';
  mistCount?: number;
  style?: StyleProp<ViewStyle>;
}

export const CosmicBackdrop: React.FC<CosmicBackdropProps> = ({
  intensity = 'soft',
  mistCount = 6,
  style,
}) => (
  <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
    <LinearGradient colors={['#1a0033', '#0d0015', '#000000']} style={StyleSheet.absoluteFill} />
    <Mist count={mistCount} intensity={intensity} />
  </View>
);

export default CosmicBackdrop;
