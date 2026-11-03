/**
 * Oracle Deck — shared types and the SPREAD_TYPES catalogue.
 * Extracted out of app/oracle.tsx so the main screen stays focused on
 * layout + state; other Oracle-related components can now import these
 * without pulling in the heavy screen file.
 */

export interface CardReading {
  card: {
    name: string;
    element: string;
    description: string;
    image_url?: string | null;
    image_base64?: string | null;
  };
  position?: string;
  interpretation: string;
}

export interface Reading {
  spread_type: string;
  cards: CardReading[];
  overall_interpretation?: string;
  timestamp: string;
  chat_history?: { role: 'user' | 'assistant'; text: string; at?: string }[];
  _id?: string;
  reading_id?: string;
}

export interface SpreadType {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  positions: string[];
  free: boolean;
  icon: string;
  image: any;
}

export const SPREAD_TYPES: SpreadType[] = [
  {
    id: 'single',
    name: 'Single Card',
    description: 'Quick guidance for a simple question',
    cardCount: 1,
    positions: ['Guidance'],
    free: true,
    icon: 'sparkles',
    image: require('../assets/images/oracle-one-card.jpg'),
  },
  {
    id: 'three-card',
    name: 'Three Card Spread',
    description: 'Past, Present, and Future insights',
    cardCount: 3,
    positions: ['Past', 'Present', 'Future'],
    free: false,
    icon: 'time',
    image: require('../assets/images/oracle-three-card.jpg'),
  },
  {
    id: 'relationship',
    name: 'Relationship Spread',
    description: 'You, Partner, and Connection dynamics',
    cardCount: 3,
    positions: ['You', 'Partner', 'Connection'],
    free: false,
    icon: 'heart',
    image: require('../assets/images/oracle-relationship.jpg'),
  },
  {
    id: 'celtic-cross',
    name: 'Celtic Cross',
    description: 'Deep dive into your situation',
    cardCount: 6,
    positions: ['Present', 'Challenge', 'Past', 'Future', 'Above', 'Below'],
    free: false,
    icon: 'compass',
    image: require('../assets/images/oracle-spiritual.jpg'),
  },
  {
    id: 'spiritual-path',
    name: 'Spiritual Path',
    description: 'Guidance for your spiritual journey',
    cardCount: 5,
    positions: ['Current State', 'Obstacle', 'Hidden Influence', 'Guidance', 'Outcome'],
    free: false,
    icon: 'planet',
    image: require('../assets/images/oracle-spiritual.jpg'),
  },
];

export const ORACLE_HERO_IMAGE =
  'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/qnwv0w54_36736.jpg';
