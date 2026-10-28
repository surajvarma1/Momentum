import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing, typography, radii, shadows } from '../theme/tokens';
import { Button } from './Button';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (isoDate: string) => void;
  initialDate?: string; // YYYY-MM-DD or ISO string
  title?: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function DatePickerModal({
  visible,
  onClose,
  onSelectDate,
  initialDate,
  title = 'Select Date',
}: DatePickerModalProps) {
  const { colors } = useTheme();

  // Parse initial date or default to today
  const init = initialDate ? new Date(initialDate) : new Date();
  const safeInit = isNaN(init.getTime()) ? new Date() : init;

  const [viewYear, setViewYear] = useState(safeInit.getFullYear());
  const [viewMonth, setViewMonth] = useState(safeInit.getMonth()); // 0-11
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate ? initialDate.split('T')[0] : '',
  );

  const todayStr = new Date().toISOString().split('T')[0];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayPress = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${m}-${d}`;
    setSelectedDate(dateStr);
  };

  const handleApplyPreset = (daysFromNow: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    const dateStr = target.toISOString().split('T')[0];
    setSelectedDate(dateStr);
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
  };

  const handleConfirm = () => {
    if (selectedDate) {
      // Returns YYYY-MM-DD with end-of-day time for deadlines
      onSelectDate(`${selectedDate}T23:59:59.000Z`);
    }
    onClose();
  };

  const handleClear = () => {
    setSelectedDate('');
    onSelectDate('');
    onClose();
  };

  // Generate days matrix for viewMonth
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.dialog,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close calendar">
              <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          {/* Quick presets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsRow}>
            <Pressable
              onPress={() => handleApplyPreset(0)}
              style={[styles.presetChip, { backgroundColor: colors.backgroundTertiary }]}
            >
              <Text style={[styles.presetText, { color: colors.textPrimary }]}>Today</Text>
            </Pressable>
            <Pressable
              onPress={() => handleApplyPreset(1)}
              style={[styles.presetChip, { backgroundColor: colors.backgroundTertiary }]}
            >
              <Text style={[styles.presetText, { color: colors.textPrimary }]}>Tomorrow</Text>
            </Pressable>
            <Pressable
              onPress={() => handleApplyPreset(7)}
              style={[styles.presetChip, { backgroundColor: colors.backgroundTertiary }]}
            >
              <Text style={[styles.presetText, { color: colors.textPrimary }]}>Next Week</Text>
            </Pressable>
            <Pressable
              onPress={() => handleApplyPreset(30)}
              style={[styles.presetChip, { backgroundColor: colors.backgroundTertiary }]}
            >
              <Text style={[styles.presetText, { color: colors.textPrimary }]}>In 1 Month</Text>
            </Pressable>
          </ScrollView>

          {/* Month / Year navigator */}
          <View style={styles.monthNav}>
            <Pressable onPress={handlePrevMonth} style={styles.navArrow} hitSlop={8}>
              <Text style={[styles.navArrowText, { color: colors.textPrimary }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthYearLabel, { color: colors.textPrimary }]}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={handleNextMonth} style={styles.navArrow} hitSlop={8}>
              <Text style={[styles.navArrowText, { color: colors.textPrimary }]}>›</Text>
            </Pressable>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekdayRow}>
            {DAYS_OF_WEEK.map((d) => (
              <Text key={d} style={[styles.weekdayText, { color: colors.textTertiary }]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Days grid */}
          <View style={styles.daysGrid}>
            {days.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.dayCell} />;
              }

              const m = String(viewMonth + 1).padStart(2, '0');
              const d = String(day).padStart(2, '0');
              const currentCellDate = `${viewYear}-${m}-${d}`;
              const isSelected = selectedDate === currentCellDate;
              const isToday = todayStr === currentCellDate;

              return (
                <Pressable
                  key={currentCellDate}
                  onPress={() => handleDayPress(day)}
                  style={[
                    styles.dayCell,
                    isSelected && { backgroundColor: colors.accent, borderRadius: radii.full },
                    !isSelected && isToday && {
                      borderColor: colors.accent,
                      borderWidth: 1,
                      borderRadius: radii.full,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                      isToday && !isSelected && { color: colors.accent, fontWeight: '700' },
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Button
              title="Clear"
              variant="outline"
              size="sm"
              onPress={handleClear}
            />
            <Button
              title="Set Date"
              variant="primary"
              size="sm"
              onPress={handleConfirm}
              disabled={!selectedDate}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface DatePickerFieldProps {
  label: string;
  value: string; // ISO string or YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Select deadline…',
  helperText,
  error,
}: DatePickerFieldProps) {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const formatDisplay = (raw: string): string => {
    if (!raw) return '';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw.split('T')[0];
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return raw.split('T')[0];
    }
  };

  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={[
          styles.fieldInputRow,
          {
            backgroundColor: colors.backgroundSecondary,
            borderColor: error ? colors.error : colors.border,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDisplay(value) : placeholder}`}
      >
        <Text
          style={[
            styles.fieldText,
            { color: value ? colors.textPrimary : colors.textTertiary },
          ]}
        >
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <Text style={styles.calendarFieldIcon}>📅</Text>
      </Pressable>
      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
      {helperText && !error && (
        <Text style={[styles.helperText, { color: colors.textTertiary }]}>{helperText}</Text>
      )}

      <DatePickerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialDate={value}
        onSelectDate={(newDate) => {
          onChange(newDate);
          setModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dialogTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: '600',
    padding: spacing.xs,
  },
  presetsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  presetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    marginRight: spacing.xs,
  },
  presetText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  navArrow: {
    padding: spacing.xs,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowText: {
    fontSize: 24,
    fontWeight: '700',
  },
  monthYearLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  weekdayText: {
    width: 36,
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: spacing.md,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  fieldText: {
    fontSize: typography.fontSize.base,
  },
  calendarFieldIcon: {
    fontSize: 18,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
});
