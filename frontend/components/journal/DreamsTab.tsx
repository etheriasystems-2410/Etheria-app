import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { JournalEntry } from './types';
import EmptyState from './EmptyState';

interface DreamsTabProps {
  dreams: JournalEntry[];
  onDelete: (id: string, type: 'dream') => void;
}

export const DreamsTab: React.FC<DreamsTabProps> = ({ dreams, onDelete }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (dreams.length === 0) {
    return (
      <EmptyState
        icon="moon-outline"
        title="No dreams saved"
        subtitle="Interpret your dreams and save them here"
        iconColor="#6366f1"
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {dreams.map((dream) => {
        const dreamDate = new Date(dream.date);
        const isExpanded = expandedIds.has(dream.id);
        const symbols = dream.metadata?.symbols || [];
        const feelings = dream.metadata?.feelings || [];

        return (
          <View key={dream.id} style={styles.card}>
            {/* Dream Header */}
            <View style={styles.header}>
              <View style={styles.typeBadge}>
                <Ionicons name="moon" size={14} color="#fff" />
                <Text style={styles.typeText}>Dream</Text>
              </View>
              <View style={styles.headerRight}>
                <View style={styles.dateContainer}>
                  <Text style={styles.date}>{format(dreamDate, 'MMM d, yyyy')}</Text>
                  <Text style={styles.time}>{format(dreamDate, 'h:mm a')}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => onDelete(dream._id || dream.id, 'dream')}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Dream Title */}
            <Text style={styles.title}>{dream.title}</Text>

            {/* Symbols & Feelings */}
            {(symbols.length > 0 || feelings.length > 0) && (
              <View style={styles.metaContainer}>
                {symbols.length > 0 && (
                  <View style={styles.metaRow}>
                    <View style={styles.metaLabelContainer}>
                      <Ionicons name="eye" size={14} color="#a855f7" />
                      <Text style={styles.metaLabel}>Symbols:</Text>
                    </View>
                    <View style={styles.tagsContainer}>
                      {symbols.map((symbol: string, idx: number) => (
                        <View key={idx} style={styles.symbolTag}>
                          <Text style={styles.tagText}>{symbol}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {feelings.length > 0 && (
                  <View style={styles.metaRow}>
                    <View style={styles.metaLabelContainer}>
                      <Ionicons name="heart" size={14} color="#ec4899" />
                      <Text style={styles.metaLabel}>Feelings:</Text>
                    </View>
                    <View style={styles.tagsContainer}>
                      {feelings.map((feeling: string, idx: number) => (
                        <View key={idx} style={styles.feelingTag}>
                          <Text style={styles.tagText}>{feeling}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Content - Expandable */}
            {isExpanded ? (
              <ScrollView 
                style={styles.contentScrollView}
                nestedScrollEnabled={true}
              >
                <Text style={styles.contentFull}>{dream.content}</Text>
              </ScrollView>
            ) : (
              <Text style={styles.contentPreview} numberOfLines={4}>
                {dream.content}
              </Text>
            )}

            {/* Expand/Collapse Button */}
            <TouchableOpacity 
              style={styles.expandButton}
              onPress={() => toggleExpanded(dream.id)}
            >
              <Ionicons 
                name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                size={18} 
                color="#a855f7" 
              />
              <Text style={styles.expandButtonText}>
                {isExpanded ? 'Show Less' : 'View Full Interpretation'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#1a0a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
    backgroundColor: '#6366f1',
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  date: {
    color: '#c4b5fd',
    fontSize: 12,
  },
  time: {
    color: '#9f7aea',
    fontSize: 11,
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
  title: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  metaContainer: {
    backgroundColor: '#0f0321',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  metaRow: {
    gap: 8,
  },
  metaLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metaLabel: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  symbolTag: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  feelingTag: {
    backgroundColor: '#db2777',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  contentScrollView: {
    maxHeight: 300,
    backgroundColor: '#0f0321',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  contentFull: {
    color: '#c4b5fd',
    fontSize: 14,
    lineHeight: 22,
  },
  contentPreview: {
    color: '#c4b5fd',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  expandButtonText: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default DreamsTab;
