import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  id: string;
  name: string;
  isPremium: boolean;
  background: string;
  backgroundGradient: string[];
  cardBackground: string;
  cardBackgroundAlt: string;
  sectionBackground: string;
  accent: string;
  accentLight: string;
  accentDark: string;
}

export const THEMES: Record<string, ThemeColors> = {
  mystic_purple: {
    id: 'mystic_purple',
    name: 'Mystic Purple',
    isPremium: false,
    background: '#0d0015',
    backgroundGradient: ['#1a0033', '#0d0015', '#000000'],
    cardBackground: '#1a0033',
    cardBackgroundAlt: '#2d1b4e',
    sectionBackground: '#1a0a2e',
    accent: '#7c3aed',
    accentLight: '#a855f7',
    accentDark: '#5b21b6',
  },
  ocean_blue: {
    id: 'ocean_blue',
    name: 'Ocean Blue',
    isPremium: true,
    background: '#001520',
    backgroundGradient: ['#002233', '#001520', '#000a10'],
    cardBackground: '#002a40',
    cardBackgroundAlt: '#003d5c',
    sectionBackground: '#001a2e',
    accent: '#0ea5e9',
    accentLight: '#38bdf8',
    accentDark: '#0369a1',
  },
  forest_green: {
    id: 'forest_green',
    name: 'Forest Green',
    isPremium: true,
    background: '#001510',
    backgroundGradient: ['#002a1f', '#001510', '#000a08'],
    cardBackground: '#003326',
    cardBackgroundAlt: '#004d3a',
    sectionBackground: '#001f18',
    accent: '#10b981',
    accentLight: '#34d399',
    accentDark: '#059669',
  },
  sunset_orange: {
    id: 'sunset_orange',
    name: 'Sunset Orange',
    isPremium: true,
    background: '#1a0a00',
    backgroundGradient: ['#331500', '#1a0a00', '#0d0500'],
    cardBackground: '#3d1f00',
    cardBackgroundAlt: '#5c2f00',
    sectionBackground: '#2e1400',
    accent: '#f97316',
    accentLight: '#fb923c',
    accentDark: '#ea580c',
  },
  midnight_black: {
    id: 'midnight_black',
    name: 'Midnight Black',
    isPremium: true,
    background: '#000000',
    backgroundGradient: ['#1a1a1a', '#0d0d0d', '#000000'],
    cardBackground: '#1a1a1a',
    cardBackgroundAlt: '#2d2d2d',
    sectionBackground: '#141414',
    accent: '#6366f1',
    accentLight: '#818cf8',
    accentDark: '#4f46e5',
  },
  rose_gold: {
    id: 'rose_gold',
    name: 'Rose Gold',
    isPremium: true,
    background: '#1a0a10',
    backgroundGradient: ['#33141f', '#1a0a10', '#0d0508'],
    cardBackground: '#3d1a28',
    cardBackgroundAlt: '#5c2a3d',
    sectionBackground: '#2e1420',
    accent: '#ec4899',
    accentLight: '#f472b6',
    accentDark: '#db2777',
  },
};

interface ThemeContextType {
  theme: ThemeColors;
  themeName: string;
  setTheme: (themeId: string) => Promise<void>;
  availableThemes: ThemeColors[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@etheria_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<string>('mystic_purple');

  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && THEMES[savedTheme]) {
        setThemeName(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (themeId: string) => {
    if (THEMES[themeId]) {
      setThemeName(themeId);
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, themeId);
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    }
  };

  const theme = THEMES[themeName] || THEMES.mystic_purple;
  const availableThemes = Object.values(THEMES);

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
