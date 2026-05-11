/**
 * Etheria Design Tokens
 *
 * Centralised tokens for typography, spacing, shadows, radii and the
 * mystical-gold accent that complements the cosmic-purple palette
 * already defined in ThemeContext.
 */

export const palette = {
  // Cosmic purples (kept from existing palette)
  voidBlack: '#0d0015',
  deepCosmos: '#1a0033',
  nebula: '#2d1b4e',
  amethyst: '#7c3aed',
  amethystLight: '#a855f7',
  lavender: '#b794f6',
  mist: '#c4b5fd',
  iceLavender: '#e9d5ff',

  // Mystical accents
  gold: '#fbbf24',
  goldLight: '#fcd34d',
  goldDeep: '#d97706',
  starWhite: '#ffffff',
  starDim: 'rgba(255,255,255,0.6)',

  // Semantic
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#0ea5e9',

  // Surface overlays (for glass effects)
  glassFill: 'rgba(255, 255, 255, 0.05)',
  glassFillStrong: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(183, 148, 246, 0.25)',
  glassBorderStrong: 'rgba(183, 148, 246, 0.45)',
  goldBorder: 'rgba(251, 191, 36, 0.4)',
};

/** 8pt-based spacing scale */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
  '6xl': 72,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  pill: 999,
};

export const typography = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  bodyLg: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
};

/** Soft purple glow used on cards and elevated surfaces. */
export const shadows = {
  glow: {
    shadowColor: palette.amethyst,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  glowSoft: {
    shadowColor: palette.amethyst,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  glowGold: {
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const gradients = {
  cosmos: ['#1a0033', '#0d0015', '#000000'] as const,
  amethyst: ['#7c3aed', '#5b21b6'] as const,
  amethystHero: ['#a855f7', '#7c3aed', '#3b0764'] as const,
  goldFlare: ['#fcd34d', '#fbbf24', '#d97706'] as const,
  glass: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)'] as const,
  glassPurple: ['rgba(168,85,247,0.22)', 'rgba(124,58,237,0.04)'] as const,
  border: ['#a855f7', '#fbbf24', '#a855f7'] as const,
};

export const theme = { palette, spacing, radii, typography, shadows, gradients };
export default theme;
