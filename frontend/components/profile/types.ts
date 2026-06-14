/**
 * Shared Profile type used across the profile screen and its sub-cards.
 *
 * Extracted from `app/profile/[id].tsx` so each subcomponent can import the
 * same shape without redefining or relying on `any`.
 */
export interface ProfileStats {
  modules_completed: number;
  current_streak: number;
  longest_streak: number;
  total_cards_drawn: number;
  journal_entries: number;
  days_as_member: number;
}

export interface Profile {
  user_id: string;
  name: string;
  picture?: string;
  bio?: string;                                       // "About Me"
  birthday?: string;
  location?: string;
  favorite_guide?: string;
  psychic_interests?: string[];

  // Lifestyle
  hobbies?: string;
  favorite_things?: string;
  dislikes?: string;
  other_details?: string;

  // The Path I Walk
  path_walked?: string;
  in_coven?: boolean;
  coven_name?: string;
  deities_followed?: string;

  // Psychic disclosures
  family_has_psychic_talent?: boolean;
  family_psychic_details?: string;
  self_has_psychic_talent?: boolean;
  self_psychic_details?: string;

  // Story
  why_etheria?: string;

  // Progress visibility + stats
  show_progress?: boolean;
  stats?: ProfileStats;

  created_at?: string;
  is_admin?: boolean;
  is_premium?: boolean;
  email?: string;
  circle_relationship?:
    | 'none'
    | 'in_circle'
    | 'invite_pending_out'
    | 'invite_pending_in';
}

/** Setter signature used by every editable sub-card. */
export type ProfileSetter = React.Dispatch<React.SetStateAction<Profile | null>>;
