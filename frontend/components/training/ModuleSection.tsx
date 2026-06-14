/**
 * ModuleSection — section header (icon + title) followed by a list of
 * ModuleCards. Used for the Beginner / Intermediate / Advanced groups.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ModuleCard from './ModuleCard';
import type { Module } from './types';

interface Props {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  modules: Module[];
  isPremium: boolean;
  onModulePress: (m: Module) => void;
}

export default function ModuleSection({
  title,
  icon,
  color,
  modules,
  isPremium,
  onModulePress,
}: Props) {
  if (modules.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: color }]}>
          <Ionicons name={icon} size={20} color="#fff" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {modules.map((m) => (
        <ModuleCard
          key={m.id}
          module={m}
          isPremium={isPremium}
          onPress={onModulePress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#e9d5ff' },
});
