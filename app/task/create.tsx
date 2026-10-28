/**
 * Create Task screen — complete form for new tasks with subtasks,
 * tags, deadline, priority, energy level, and validation.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii, touchTargets } from '../../src/presentation/theme/tokens';
import { useTaskForm } from '../../src/presentation/hooks/useTaskForm';
import { FormField } from '../../src/presentation/components/FormField';
import { PriorityPicker } from '../../src/presentation/components/PriorityPicker';
import { EnergyPicker } from '../../src/presentation/components/EnergyPicker';
import { Button } from '../../src/presentation/components/Button';
import { Card } from '../../src/presentation/components/Card';
import { ScreenHeader } from '../../src/presentation/components/ScreenHeader';
import { DatePickerField } from '../../src/presentation/components/DatePickerModal';

export default function CreateTaskScreen() {
  const { colors } = useTheme();
  const {
    form,
    errors,
    submitting,
    updateField,
    addTag,
    removeTag,
    addSubtask,
    removeSubtask,
    submit,
  } = useTaskForm();

  const handleSave = async () => {
    const created = await submit();
    if (created) {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="New Task" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {errors.general && (
          <View style={[styles.generalError, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
            <Text style={[styles.generalErrorText, { color: colors.error }]}>
              {errors.general}
            </Text>
          </View>
        )}

        {/* Title */}
        <FormField
          label="Title"
          required
          placeholder="e.g. Finalize Q4 architecture review"
          value={form.title}
          onChangeText={(v) => updateField('title', v)}
          error={errors.title}
          maxLength={500}
        />

        {/* Description */}
        <FormField
          label="Description"
          placeholder="Additional context, links, or criteria…"
          value={form.description}
          onChangeText={(v) => updateField('description', v)}
          error={errors.description}
          multiline
          maxLength={5000}
        />

        {/* Priority & Energy Pickers */}
        <Card style={styles.cardSection}>
          <PriorityPicker
            value={form.priority}
            onChange={(p) => updateField('priority', p)}
          />
        </Card>

        <Card style={styles.cardSection}>
          <EnergyPicker
            value={form.energyLevel}
            onChange={(e) => updateField('energyLevel', e)}
          />
        </Card>

        {/* Duration & Deadline */}
        <View style={styles.row}>
          <View style={styles.flexHalf}>
            <FormField
              label="Duration (mins)"
              placeholder="30"
              keyboardType="numeric"
              value={form.estimatedDurationMinutes}
              onChangeText={(v) => updateField('estimatedDurationMinutes', v)}
              error={errors.estimatedDurationMinutes}
            />
          </View>
          <View style={styles.flexHalf}>
            <DatePickerField
              label="Deadline"
              placeholder="Pick deadline…"
              value={form.deadline}
              onChange={(v) => updateField('deadline', v)}
              error={errors.deadline}
            />
          </View>
        </View>

        {/* Tags */}
        <Card style={styles.cardSection}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Tags ({form.tags.length}/20)
          </Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[
                styles.inlineInput,
                {
                  backgroundColor: colors.backgroundTertiary,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Add tag and press +"
              placeholderTextColor={colors.textTertiary}
              value={form.tagInput}
              onChangeText={(v) => updateField('tagInput', v)}
              onSubmitEditing={addTag}
            />
            <Button title="+" onPress={addTag} size="sm" />
          </View>
          <View style={styles.tagChips}>
            {form.tags.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => removeTag(tag)}
                style={[styles.tagChip, { backgroundColor: colors.accentSurface }]}
                accessibilityLabel={`Remove tag ${tag}`}
              >
                <Text style={[styles.tagText, { color: colors.accent }]}>
                  {tag} ✕
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Subtasks */}
        <Card style={styles.cardSection}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Subtasks ({form.subtasks.length}/100)
          </Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[
                styles.inlineInput,
                {
                  backgroundColor: colors.backgroundTertiary,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Add actionable subtask…"
              placeholderTextColor={colors.textTertiary}
              value={form.subtaskInput}
              onChangeText={(v) => updateField('subtaskInput', v)}
              onSubmitEditing={addSubtask}
            />
            <Button title="Add" onPress={addSubtask} size="sm" />
          </View>
          {form.subtasks.map((st, idx) => (
            <View key={idx} style={[styles.subtaskRow, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.subtaskTitle, { color: colors.textPrimary }]}>
                • {st.title}
              </Text>
              <Pressable
                onPress={() => removeSubtask(idx)}
                hitSlop={8}
                accessibilityLabel={`Delete subtask ${st.title}`}
              >
                <Text style={{ color: colors.error }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </Card>

        {/* Submit */}
        <View style={styles.submitContainer}>
          <Button
            title="Create Task"
            onPress={handleSave}
            loading={submitting}
            size="lg"
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 60,
  },
  generalError: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  generalErrorText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  cardSection: {
    marginBottom: spacing.base,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flexHalf: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  inlineInput: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
  },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  subtaskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subtaskTitle: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  submitContainer: {
    marginTop: spacing.lg,
  },
});
