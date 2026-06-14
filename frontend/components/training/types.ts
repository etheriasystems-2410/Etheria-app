/**
 * Shared types for the Training feature.
 * Extracted from `app/training.tsx`.
 */

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: number;
  category: 'beginner' | 'intermediate' | 'advanced';
  free: boolean;
}

export interface Lesson {
  id: number;
  title: string;
  content: string;
  meditation?: {
    title: string;
    duration: number;
    script: string;
  };
}
