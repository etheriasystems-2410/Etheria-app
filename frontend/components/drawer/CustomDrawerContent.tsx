/**
 * Custom drawer renderer that injects a stylish silver divider above the
 * `messages` (Inbox) route, separating the spiritual-content section of the
 * drawer from the social section (Inbox / Users / Community).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';

/** Routes that should sit ABOVE the silver divider (spiritual content). The
 *  rest fall below it (social / settings). Change the `dividerBeforeRoute` to
 *  move the line. */
const DIVIDER_BEFORE_ROUTE = 'messages';

export default function CustomDrawerContent(props: any) {
  const { state, descriptors, navigation } = props;
  return (
    <DrawerContentScrollView {...props}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        if (options.drawerItemStyle && options.drawerItemStyle.display === 'none') {
          return null;
        }
        const focused = state.index === index;
        const labelEl =
          typeof options.drawerLabel === 'function'
            ? options.drawerLabel({
                color: focused ? '#fff' : options.drawerInactiveTintColor || '#c0c0c0',
                focused,
              })
            : options.drawerLabel ?? options.title ?? route.name;

        return (
          <React.Fragment key={route.key}>
            {route.name === DIVIDER_BEFORE_ROUTE && (
              <View style={styles.dividerWrap}>
                <View style={styles.dividerLine} />
                <Ionicons
                  name="ellipse"
                  size={5}
                  color="#d1d5db"
                  style={styles.dividerDot}
                />
                <View style={styles.dividerLine} />
              </View>
            )}
            <DrawerItem
              label={() =>
                typeof labelEl === 'string' ? (
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: focused ? '#fff' : '#c0c0c0', fontWeight: '600' }}>
                      {labelEl}
                    </Text>
                  </View>
                ) : (
                  labelEl
                )
              }
              icon={options.drawerIcon}
              focused={focused}
              activeTintColor={'#fff'}
              inactiveTintColor={'#c0c0c0'}
              onPress={() => {
                const event = navigation.emit({
                  type: 'drawerItemPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          </React.Fragment>
        );
      })}
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
    marginHorizontal: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(192, 192, 192, 0.55)',
  },
  dividerDot: {
    marginHorizontal: 8,
    opacity: 0.85,
  },
});
