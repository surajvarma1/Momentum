/**
 * Edit Task screen — load existing task into useTaskForm and save modifications.
 */

import React, { useEffect } from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../src/presentation/theme/useTheme';
import { spacing, typography, radii } from '../../../src/presentation/theme/tokens';
import { useTaskForm } from '../../../src/presentation/hooks/useTaskForm';
import { useServices } from '../../../src/presentation/hooks/useServices';
import { FormField } from '../../../src/presentation/components/FormField';
import { PriorityPicker } from '../../../src/presentation/components/PriorityPicker';
import { EnergyPicker } from '../../../src/presentation/components/EnergyPicker';
import { Button } from '../../../src/presentation/components/Button';
import { Card } from '../../../src/presentation/components/Card';
import { LoadingState } from '../../../src/presentation/components/LoadingState';
import { ScreenHeader } from '../../../src/presentation/components/ScreenHeader';
import { DatePickerField } from '../../../src/presentation/components/DatePickerModal';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const services = useServices();

  const {
    form,
    errors,
    submitting,
    updateField,
    addTag,
    removeTag,
    submit,
    loadTask,
  } = useTaskForm(id);

  const [loadingInitial, setLoadingInitial] = React.useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      try {
        const existing = await services.taskRepository.findById(id);
        if (existing && mounted) {
          loadTask(existing);
        }
      } catch {
        // Handled
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, services, loadTask]);

  const handleSave = async () => {
    const updated = await submit();
    if (updated) {
      router.back();
    }
  };

  if (loadingInitial) {
    return <LoadingState message="Loading task for editing…" />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Edit Task" />

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
          placeholder="Task title"
          value={form.title}
          onChangeText={(v) => updateField('title', v)}
          error={errors.title}
          maxLength={500}
        />

        {/* Description */}
        <FormField
          label="Description"
          placeholder="Additional context…"
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

        {/* Save Changes */}
        <View style={styles.submitContainer}>
          <Button
            title="Save Changes"
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
  submitContainer: {
    marginTop: spacing.lg,
  },
});
