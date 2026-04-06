import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { JournalEntry } from './types';
import EmptyState from './EmptyState';

interface TranscriptsTabProps {
  transcripts: JournalEntry[];
  onDelete: (id: string, type: 'transcript') => void;
}

const ELEMENT_COLORS: { [key: string]: string } = {
  'Fire': '#ef4444',
  'Water': '#3b82f6',
  'Earth': '#10b981',
  'Air': '#a855f7',
};

export const TranscriptsTab: React.FC<TranscriptsTabProps> = ({ transcripts, onDelete }) => {
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

  if (transcripts.length === 0) {
    return (
      <EmptyState
        icon="chatbubbles-outline"
        title="No transcripts saved"
        subtitle="Save your Spirit Guide chats to view them here"
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {transcripts.map((transcript) => {
        const guideName = transcript.metadata?.guide_name || 'Spirit Guide';
        const guideElement = transcript.metadata?.guide_element || '';
        const messagesCount = transcript.metadata?.messages_count || 0;
        const transcriptDate = new Date(transcript.date);
        const isExpanded = expandedIds.has(transcript.id);
        const guideColor = ELEMENT_COLORS[guideElement] || '#ec4899';

        return (
          <View key={transcript.id} style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.typeBadge, { backgroundColor: guideColor }]}>
                <Ionicons name="chatbubbles" size={14} color="#fff" />
                <Text style={styles.typeText}>Spirit Guide Chat</Text>
              </View>
              <View style={styles.headerRight}>
                <View style={styles.dateContainer}>
                  <Text style={styles.date}>{format(transcriptDate, 'MMM d, yyyy')}</Text>
                  <Text style={styles.time}>{format(transcriptDate, 'h:mm a')}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => onDelete(transcript._id || transcript.id, 'transcript')}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Guide Info */}
            <View style={styles.guideInfoRow}>
              <View style={[styles.guideElementBadge, { backgroundColor: guideColor }]}>
                <Text style={styles.guideElementIcon}>
                  {guideElement === 'Fire' ? '🔥' : guideElement === 'Water' ? '💧' : guideElement === 'Earth' ? '🌿' : '💨'}
                </Text>
                <Text style={styles.guideNameText}>{guideName}</Text>
              </View>
              <Text style={styles.messagesCountText}>{messagesCount} messages</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{transcript.title}</Text>

            {/* Content - Expandable */}
            {isExpanded ? (
              <ScrollView style={styles.transcriptScrollView} nestedScrollEnabled={true}>
                <Text style={styles.contentFull}>{transcript.content}</Text>
              </ScrollView>
            ) : (
              <Text style={styles.contentPreview} numberOfLines={4}>
                {transcript.content}
              </Text>
            )}

            {/* Expand/Collapse Button */}
            <TouchableOpacity style={styles.expandButton} onPress={() => toggleExpanded(transcript.id)}>
              <Ionicons 
                name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                size={18} 
                color="#a855f7" 
              />
              <Text style={styles.expandButtonText}>
                {isExpanded ? 'Show less' : 'Read full transcript'}
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
  guideInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  guideElementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  guideElementIcon: {
    fontSize: 14,
  },
  guideNameText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  messagesCountText: {
    color: '#9f7aea',
    fontSize: 12,
  },
  title: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  transcriptScrollView: {
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

export default TranscriptsTab;
