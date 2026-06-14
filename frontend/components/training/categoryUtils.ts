/**
 * Visual helpers for module category badges.
 * Extracted from `app/training.tsx`.
 */
import type { Module } from './types';

export function getCategoryColor(category: Module['category'] | string): string {
  switch (category) {
    case 'beginner':
      return '#10b981';
    case 'intermediate':
      return '#f59e0b';
    case 'advanced':
      return '#ef4444';
    default:
      return '#8b5cf6';
  }
}

export function getCategoryIcon(category: Module['category'] | string): string {
  switch (category) {
    case 'beginner':
      return 'leaf';
    case 'intermediate':
      return 'flame';
    case 'advanced':
      return 'star';
    default:
      return 'school';
  }
}
