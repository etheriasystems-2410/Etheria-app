/**
 * Shared types for Journal components
 */

export interface JournalEntry {
  id: string;
  _id?: string;
  title: string;
  content: string;
  category: string;
  date: string;
  created_at?: string;
  mood?: string;
  entry_type?: 'manual' | 'oracle' | 'spirit_guide' | 'training' | 'training_completion' | 'transcript' | 'dream';
  metadata?: {
    spread_type?: string;
    question?: string;
    cards?: any[];
    guide_name?: string;
    guide_element?: string;
    messages_count?: number;
    lesson_id?: string;
    module_name?: string;
    astral_level?: number;
    astral_title?: string;
  };
}

export interface TrainingProgress {
  total_lessons: number;
  completed_lessons: number;
  modules: {
    name: string;
    category: string;
    total: number;
    completed: number;
  }[];
}

export interface JournalStatus {
  is_premium: boolean;
  weekly_limit: number | null;
  entries_this_week: number;
  entries_remaining: number | null;
  unlimited: boolean;
  week_resets?: string;
}

export interface JournalCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export const JOURNAL_CATEGORIES: JournalCategory[] = [
  { id: 'meditation', label: 'Meditation', icon: 'fitness', color: '#8b5cf6' },
  { id: 'psychic', label: 'Psychic Training', icon: 'school', color: '#3b82f6' },
  { id: 'divination', label: 'Oracle Reading', icon: 'sparkles', color: '#db2777' },
  { id: 'spirit_guide', label: 'Spirit Guide', icon: 'chatbubbles', color: '#ec4899' },
  { id: 'general', label: 'General', icon: 'book', color: '#10b981' },
];

export type JournalTabType = 'entries' | 'readings' | 'transcripts' | 'dreams' | 'progress';
