import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface CalendarTabIconProps {
  focused: boolean;
  color?: any;
}

export function CalendarTabIcon({ focused, color }: CalendarTabIconProps) {
  const { colors } = useTheme();
  const todayDate = new Date().getDate(); // 1 - 31

  const activeColor = color || colors.accent;

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: focused ? activeColor : colors.borderLight || '#888',
          backgroundColor: colors.surface,
        },
      ]}
    >
      {/* Top calendar header banner */}
      <View
        style={[
          styles.topBanner,
          { backgroundColor: focused ? activeColor : '#DC2626' },
        ]}
      >
        <View style={styles.binderPin} />
        <View style={styles.binderPin} />
      </View>

      {/* Date number */}
      <View style={styles.numberContainer}>
        <Text
          style={[
            styles.dateText,
            { color: focused ? activeColor : colors.textPrimary },
          ]}
        >
          {todayDate}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  topBanner: {
    width: '100%',
    height: 6,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  binderPin: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  numberContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
});
