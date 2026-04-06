import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { JournalEntry } from './types';
import EmptyState from './EmptyState';

interface ReadingsTabProps {
  readings: JournalEntry[];
  onDelete: (id: string, type: 'reading') => void;
}

export const ReadingsTab: React.FC<ReadingsTabProps> = ({ readings, onDelete }) => {
  if (readings.length === 0) {
    return (
      <EmptyState
        icon="sparkles-outline"
        title="No oracle readings saved"
        subtitle="Your saved oracle readings will appear here"
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {readings.map((reading) => {
        const readingType = reading.entry_type === 'oracle' ? 'Oracle Reading' : 
                          reading.entry_type === 'spirit_guide' ? 'Spirit Guide Chat' : 'Divination';
        const readingIcon = reading.entry_type === 'oracle' ? 'sparkles' : 
                          reading.entry_type === 'spirit_guide' ? 'chatbubbles' : 'sparkles';
        const readingColor = reading.entry_type === 'oracle' ? '#db2777' : 
                           reading.entry_type === 'spirit_guide' ? '#ec4899' : '#a855f7';
        const spreadType = reading.metadata?.spread_type || '';
        const questionAsked = reading.metadata?.question || '';
        const readingDate = new Date(reading.date);

        return (
          <View key={reading.id} style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.typeBadge, { backgroundColor: readingColor }]}>
                <Ionicons name={readingIcon as any} size={14} color="#fff" />
                <Text style={styles.typeText}>{readingType}</Text>
              </View>
              <View style={styles.headerRight}>
                <View style={styles.dateContainer}>
                  <Text style={styles.date}>{format(readingDate, 'MMM d, yyyy')}</Text>
                  <Text style={styles.time}>{format(readingDate, 'h:mm a')}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => onDelete(reading._id || reading.id, 'reading')}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Spread Type */}
            {spreadType && (
              <View style={styles.spreadRow}>
                <Ionicons name="layers" size={14} color="#a855f7" />
                <Text style={styles.spreadText}>{spreadType}</Text>
              </View>
            )}

            {/* Question */}
            {questionAsked && (
              <View style={styles.questionContainer}>
                <View style={styles.questionHeader}>
                  <Ionicons name="help-circle" size={16} color="#fbbf24" />
                  <Text style={styles.questionLabel}>Question/Wisdom Sought:</Text>
                </View>
                <Text style={styles.questionText}>{questionAsked}</Text>
              </View>
            )}

            {/* Title */}
            <Text style={styles.title}>{reading.title}</Text>

            {/* Cards Preview */}
            {reading.metadata?.cards && reading.metadata.cards.length > 0 && (
              <View style={styles.cardsPreview}>
                {reading.metadata.cards.slice(0, 3).map((card: any, idx: number) => (
                  <View key={idx} style={styles.cardItem}>
                    <Text style={styles.cardPosition}>{card.position}</Text>
                    <Text style={styles.cardName}>{card.card_name}</Text>
                  </View>
                ))}
                {reading.metadata.cards.length > 3 && (
                  <Text style={styles.moreCards}>+{reading.metadata.cards.length - 3} more</Text>
                )}
              </View>
            )}

            {/* Content Preview */}
            <Text style={styles.contentPreview} numberOfLines={4}>
              {reading.content}
            </Text>
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
  spreadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  spreadText: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '500',
  },
  questionContainer: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#fbbf24',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  questionLabel: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  questionText: {
    color: '#e9d5ff',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  title: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  cardsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  cardItem: {
    backgroundColor: '#2d1b4e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardPosition: {
    color: '#9f7aea',
    fontSize: 10,
    marginBottom: 2,
  },
  cardName: {
    color: '#e9d5ff',
    fontSize: 12,
    fontWeight: '500',
  },
  moreCards: {
    color: '#9f7aea',
    fontSize: 12,
    alignSelf: 'center',
    marginLeft: 4,
  },
  contentPreview: {
    color: '#c4b5fd',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ReadingsTab;
