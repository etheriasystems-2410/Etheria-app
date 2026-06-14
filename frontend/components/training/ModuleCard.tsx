/**
 * ModuleCard — single tile for a training module with category badge,
 * description, lesson count + free/locked status.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import SubscriptionOnlyBanner from '../SubscriptionOnlyBanner';
import { getCategoryColor, getCategoryIcon } from './categoryUtils';
import type { Module } from './types';

interface Props {
  module: Module;
  isPremium: boolean;
  onPress: (m: Module) => void;
}

export default function ModuleCard({ module, isPremium, onPress }: Props) {
  const isLocked = !module.free && !isPremium;
  const categoryColor = getCategoryColor(module.category);

  return (
    <TouchableOpacity
      style={[styles.moduleCard, isLocked && styles.lockedCard]}
      onPress={() => onPress(module)}
      activeOpacity={0.8}
    >
      <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
        <Ionicons
          name={getCategoryIcon(module.category) as any}
          size={14}
          color="#fff"
        />
        <Text style={styles.categoryText}>{module.category}</Text>
      </View>

      <Text style={styles.moduleTitle}>{module.title}</Text>
      <Text style={styles.moduleDescription}>{module.description}</Text>

      <View style={styles.moduleFooter}>
        <View style={styles.lessonCount}>
          <Ionicons name="book-outline" size={16} color="#9f7aea" />
          <Text style={styles.lessonCountText}>{module.lessons} lessons</Text>
        </View>

        {isLocked ? (
          <SubscriptionOnlyBanner variant="badge" />
        ) : (
          <View style={styles.freeBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text style={styles.freeText}>{module.free ? 'Free' : 'Unlocked'}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  moduleCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  lockedCard: { opacity: 0.7 },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
    gap: 4,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 6,
  },
  moduleDescription: {
    fontSize: 14,
    color: '#9f7aea',
    lineHeight: 20,
    marginBottom: 12,
  },
  moduleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lessonCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lessonCountText: { color: '#9f7aea', fontSize: 13 },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  freeText: { color: '#10b981', fontSize: 12, fontWeight: '600' },
});
