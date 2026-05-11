import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '../../theme/tokens';

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, subtitle, icon, right, style }) => (
  <View style={[styles.container, style]}>
    <View style={styles.left}>
      {icon ? (
        <View style={styles.iconBubble}>
          <Ionicons name={icon} size={16} color={palette.gold} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
    {right}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing['2xl'],
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h3, color: palette.iceLavender },
  subtitle: { ...typography.caption, color: palette.mist, marginTop: 2 },
});

export default SectionTitle;
