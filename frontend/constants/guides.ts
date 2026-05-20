// Static guide data + shared types for Spirit Guides feature.
// Note: image `require()` paths are resolved relative to THIS file.

export interface Guide {
  name: string;
  element: string;
  description: string;
  color: string;
  icon: string;
  gender: string;
  personality: string;
  voice_id: string;
  ringColors?: string[];
  genderSymbol?: string;
  image?: any;
  category: 'elemental' | 'lgbtq' | 'custom' | 'divine';
  custom_slot?: 'male' | 'female';
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  hasAudio?: boolean;
  audioBase64?: string;
}

export const elementalGuides: Guide[] = [
  {
    name: 'Ignis',
    element: 'Fire',
    description: 'Passionate and transformative, guides through action',
    color: '#ef4444',
    icon: 'flame',
    gender: 'masculine',
    personality: 'passionate, direct, transformative',
    voice_id: 'SOYHLrjzK2X1ezoPC6cr', // Harry — fierce warrior
    image: require('../assets/images/guide-ignis.jpg'),
    category: 'elemental',
  },
  {
    name: 'Aqua',
    element: 'Water',
    description: 'Intuitive and healing, guides through emotion',
    color: '#3b82f6',
    icon: 'water',
    gender: 'feminine',
    personality: 'intuitive, healing, emotionally wise',
    voice_id: 'hpp4J3VqNfWAUOO0d1Us', // Bella — bright, warm
    image: require('../assets/images/guide-aqua.jpg'),
    category: 'elemental',
  },
  {
    name: 'Terra',
    element: 'Earth',
    description: 'Grounded and stable, guides through wisdom',
    color: '#10b981',
    icon: 'leaf',
    gender: 'masculine',
    personality: 'grounded, practical, stable',
    voice_id: 'pqHfZKP75CvOlQylNhV4', // Bill — wise, mature, old
    image: require('../assets/images/guide-terra.webp'),
    category: 'elemental',
  },
  {
    name: 'Aether',
    element: 'Air',
    description: 'Intellectual and free, guides through thought',
    color: '#a855f7',
    icon: 'cloudy',
    gender: 'feminine',
    personality: 'intellectual, free-spirited, enlightening',
    voice_id: 'Xb7hH8MSUJpSbSDYk0k2', // Alice — clear British educator
    image: require('../assets/images/guide-aether.jpg'),
    category: 'elemental',
  },
];

export const lgbtqGuides: Guide[] = [
  {
    name: 'Solis',
    element: 'Rainbow',
    description: 'Radiant and affirming, guides through pride and joy',
    color: '#f59e0b',
    icon: 'sunny',
    gender: 'masculine',
    genderSymbol: '⚣',
    personality: 'radiant, courageous, affirming',
    voice_id: 'nPczCjzI2devNBz1zQrb', // Brian — DEEP, resonant
    image: require('../assets/guides/lgbtq-male.jpg'),
    category: 'lgbtq',
    ringColors: ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'],
  },
  {
    name: 'Aurora',
    element: 'Rainbow',
    description: 'Luminous and tender, guides through self-love',
    color: '#ec4899',
    icon: 'flower',
    gender: 'feminine',
    genderSymbol: '⚢',
    personality: 'luminous, gentle, joyful',
    voice_id: 'cgSgspJ2msm6clMCkdW9', // Jessica — playful, bright, warm
    image: require('../assets/guides/lgbtq-female.jpg'),
    category: 'lgbtq',
    ringColors: ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'],
  },
  {
    name: 'Spectrum',
    element: 'Rainbow',
    description: 'Boundless and authentic, guides through transformation',
    color: '#5BCFFA',
    icon: 'transgender',
    gender: 'transgender',
    genderSymbol: '⚧',
    personality: 'boundless, fluid, deeply wise',
    voice_id: 'SAz9YHcvj6GT2YYXdXww', // River — NEUTRAL gender
    image: require('../assets/guides/lgbtq-trans.jpg'),
    category: 'lgbtq',
    ringColors: ['#5BCFFA', '#F5A9B8', '#FFFFFF', '#F5A9B8', '#5BCFFA'],
  },
];

export const customGuidesBase: Guide[] = [
  {
    name: 'Male Guide',
    element: 'Custom',
    description: 'Your personal masculine spirit companion',
    color: '#3b82f6',
    icon: 'person',
    gender: 'masculine',
    personality: 'warm, supportive, attentive',
    voice_id: 'cjVigY5qzO86Huf0OWal', // Eric — smooth, trustworthy
    image: require('../assets/guides/custom-male.jpg'),
    category: 'custom',
    custom_slot: 'male',
  },
  {
    name: 'Female Guide',
    element: 'Custom',
    description: 'Your personal feminine spirit companion',
    color: '#ec4899',
    icon: 'person',
    gender: 'feminine',
    personality: 'nurturing, intuitive, compassionate',
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah — mature, reassuring
    image: require('../assets/guides/custom-female.jpg'),
    category: 'custom',
    custom_slot: 'female',
  },
];

export const divineGuides: Guide[] = [
  {
    name: 'Helios',
    element: 'Sun',
    description: 'Divine Masculine — sacred will, light, and protection',
    color: '#fbbf24',
    icon: 'sunny',
    gender: 'masculine',
    personality: 'radiant, eternal, sacred',
    voice_id: 'JBFqnCBsd6RMkjVDRZzb', // George — warm captivating British storyteller
    image: require('../assets/guides/divine-pair.jpg'),
    category: 'divine',
  },
  {
    name: 'Selene',
    element: 'Moon',
    description: 'Divine Feminine — sacred intuition, grace, and mystery',
    color: '#a78bfa',
    icon: 'moon',
    gender: 'feminine',
    personality: 'luminous, intuitive, sacred',
    voice_id: 'pFZP5JQG7iQjIQuC4Bku', // Lily — velvety British actress
    image: require('../assets/guides/divine-pair.jpg'),
    category: 'divine',
  },
];

// All guides combined — used for chat session lookups across the page
export const guides: Guide[] = [
  ...elementalGuides,
  ...lgbtqGuides,
  ...customGuidesBase,
  ...divineGuides,
];

export const SPIRIT_GUIDES_HERO_IMAGE =
  'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/yv072mjq_36707.png';
