/**
 * Hamburger button shown in the screen header — opens the side drawer.
 * Uses the bespoke Etheria menu icon (mystic eye).
 */
import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerActions } from '@react-navigation/native';

export const ETHERIA_MENU_ICON =
  'https://customer-assets.emergentagent.com/job_a75d84fa-0948-4f28-9189-c803d31a5037/artifacts/x7m8d3fn_8196.png';

interface Props {
  navigation: any;
}

export default function MenuButton({ navigation }: Props) {
  return (
    <TouchableOpacity
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={styles.button}
      hitSlop={8}
      activeOpacity={0.7}
    >
      <Image source={{ uri: ETHERIA_MENU_ICON }} style={styles.image} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: 12,
    width: 38,
    height: 38,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
