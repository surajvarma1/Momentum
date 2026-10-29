import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii } from '../../src/presentation/theme/tokens';
import { FormField } from '../../src/presentation/components/FormField';
import { Button } from '../../src/presentation/components/Button';
import { Card } from '../../src/presentation/components/Card';
import { Badge } from '../../src/presentation/components/Badge';
import { ScreenHeader } from '../../src/presentation/components/ScreenHeader';
import { DatePickerField, DatePickerModal } from '../../src/presentation/components/DatePickerModal';
import { ServiceContainer } from '../../src/services/ServiceContainer';
import { useUIStore } from '../../src/presentation/stores/uiStore';
import { GoalDecompositionProposal } from '../../src/domain/ai/AIDecomposerTypes';

interface DurationSelectorProps {
  hours: number;
  minutes: number;
  onChange: (hours: number, minutes: number) => void;
}

function DurationSelector({ hours, minutes, onChange }: DurationSelectorProps) {
  const { colors } = useTheme();

  const presets = [
    { label: '00:25', sub: '25m', h: 0, m: 25 },
    { label: '00:45', sub: '45m', h: 0, m: 45 },
    { label: '01:00', sub: '1h', h: 1, m: 0 },
    { label: '01:30', sub: '1.5h', h: 1, m: 30 },
    { label: '02:00', sub: '2h', h: 2, m: 0 },
  ];

  const adjustHours = (delta: number) => {
    const nextH = Math.min(8, Math.max(0, hours + delta));
    let nextM = minutes;
    if (nextH === 0 && nextM < 15) nextM = 15;
    if (nextH === 8) nextM = 0;
    onChange(nextH, nextM);
  };

  const adjustMinutes = (delta: number) => {
    let nextM = minutes + delta;
    let nextH = hours;
    if (nextM >= 60) {
      if (nextH < 8) {
        nextH += 1;
        nextM = 0;
      } else {
        nextM = 55;
      }
    } else if (nextM < 0) {
      if (nextH > 0) {
        nextH -= 1;
        nextM = 55;
      } else {
        nextM = 15;
      }
    }
    if (nextH === 0 && nextM < 15) nextM = 15;
    if (nextH === 8) nextM = 0;
    onChange(nextH, nextM);
  };

  const totalMinutes = hours * 60 + minutes;

  return (
    <View style={styles.durationSection}>
      <View style={styles.durationHeaderRow}>
        <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
          Preferred Daily Focus Duration
        </Text>
        <Text style={{ fontSize: typography.fontSize.xs, color: colors.accent, fontWeight: '700' }}>
          ⏱️ {totalMinutes} min/day
        </Text>
      </View>

      <Card style={[styles.durationCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.digitalDisplay}>
          {/* Hours Stepper */}
          <View style={styles.unitBlock}>
            <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>HOURS</Text>
            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => adjustHours(-1)}
                disabled={hours === 0 && minutes <= 15}
                style={({ pressed }) => [
                  styles.stepBtn,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  (hours === 0 && minutes <= 15) && { opacity: 0.4 },
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Decrease hours"
              >
                <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>−</Text>
              </Pressable>
              <Text style={[styles.timeDigit, { color: colors.textPrimary }]}>
                {String(hours).padStart(2, '0')}
              </Text>
              <Pressable
                onPress={() => adjustHours(1)}
                disabled={hours >= 8}
                style={({ pressed }) => [
                  styles.stepBtn,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  hours >= 8 && { opacity: 0.4 },
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Increase hours"
              >
                <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>+</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.timeColon, { color: colors.accent }]}>:</Text>

          {/* Minutes Stepper */}
          <View style={styles.unitBlock}>
            <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>MINUTES</Text>
            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => adjustMinutes(-5)}
                disabled={hours === 0 && minutes <= 15}
                style={({ pressed }) => [
                  styles.stepBtn,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  (hours === 0 && minutes <= 15) && { opacity: 0.4 },
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Decrease minutes"
              >
                <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>−</Text>
              </Pressable>
              <Text style={[styles.timeDigit, { color: colors.textPrimary }]}>
                {String(minutes).padStart(2, '0')}
              </Text>
              <Pressable
                onPress={() => adjustMinutes(5)}
                disabled={hours >= 8}
                style={({ pressed }) => [
                  styles.stepBtn,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  hours >= 8 && { opacity: 0.4 },
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Increase minutes"
              >
                <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Quick Presets Row */}
        <View style={styles.presetsRow}>
          {presets.map((p) => {
            const isSelected = hours === p.h && minutes === p.m;
            return (
              <Pressable
                key={p.label}
                onPress={() => onChange(p.h, p.m)}
                style={[
                  styles.presetChip,
                  {
                    borderColor: isSelected ? colors.accent : colors.border,
                    backgroundColor: isSelected ? colors.accent + '25' : colors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    {
                      color: isSelected ? colors.accent : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

export default function AIDecomposeScreen() {
  const { colors } = useTheme();

  // Step state: 'input' | 'loading' | 'review' | 'success'
  const [step, setStep] = useState<'input' | 'loading' | 'review' | 'success'>('input');
  const [createdCount, setCreatedCount] = useState(0);

  // Input fields
  const [goalDescription, setGoalDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [screenLoadedAt] = useState(() => Date.now());

  // Proposal result & selection
  const [proposal, setProposal] = useState<GoalDecompositionProposal | null>(null);
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<Set<number>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Task deadline editing modal
  const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);

  // Guarantee reviewing requires an active proposal; otherwise fallback to input
  React.useEffect(() => {
    if (step === 'review' && !proposal) {
      setStep('input');
    }
  }, [step, proposal]);

  // Natural language timeline detector
  const detectedDays = React.useMemo(() => {
    const text = goalDescription.toLowerCase();
    const dayMatch = text.match(/(?:in|for|within)?\s*(\d+)\s*(?:days?|day)/i);
    const weekMatch = text.match(/(?:in|for|within)?\s*(\d+)\s*(?:weeks?|week)/i);
    const monthMatch = text.match(/(?:in|for|within)?\s*(\d+)\s*(?:months?|month)/i);

    if (dayMatch && dayMatch[1]) return parseInt(dayMatch[1], 10);
    if (weekMatch && weekMatch[1]) return parseInt(weekMatch[1], 10) * 7;
    if (monthMatch && monthMatch[1]) return parseInt(monthMatch[1], 10) * 30;
    return null;
  }, [goalDescription]);

  const handleSelectAll = () => {
    if (!proposal) return;
    if (selectedTaskIndices.size === proposal.proposedTasks.length) {
      setSelectedTaskIndices(new Set());
    } else {
      setSelectedTaskIndices(new Set(proposal.proposedTasks.map((_, i) => i)));
    }
  };

  const handleGenerate = async () => {
    if (goalDescription.trim().length < 5) {
      setError('Please enter a goal description with at least 5 characters.');
      return;
    }

    try {
      setError(null);
      setStep('loading');

      const container = ServiceContainer.getInstance();
      const totalMinutes = durationHours * 60 + durationMinutes;

      let effectiveDeadline = deadline.trim();
      if (!effectiveDeadline && detectedDays) {
        const target = new Date();
        target.setDate(target.getDate() + detectedDays);
        target.setHours(23, 59, 59, 0);
        effectiveDeadline = target.toISOString();
      }

      const result = await container.decomposeGoal.execute({
        goalDescription: goalDescription.trim(),
        deadline: effectiveDeadline || undefined,
        preferredSessionMinutes: Math.min(480, Math.max(15, totalMinutes)),
        includeExistingCommitments: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        provider: 'auto',
      });

      setProposal(result);
      const allIndices = new Set(result.proposedTasks.map((_, i) => i));
      setSelectedTaskIndices(allIndices);
      setStep('review');
    } catch (err: any) {
      console.error('[AIDecompose] Generation error:', err);
      setError(err.message || 'Failed to decompose goal. Please try again.');
      setStep('input');
    }
  };

  const toggleTaskSelection = (index: number) => {
    const next = new Set(selectedTaskIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedTaskIndices(next);
  };

  const handleBackToPrevious = () => {
    if (step === 'review') {
      setStep('input');
    } else if (step === 'success') {
      router.replace('/(tabs)/tasks');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/tasks');
    }
  };

  const handleApplyApproved = async () => {
    if (!proposal || isApplying) return;

    const approvedTasks = proposal.proposedTasks.filter((_, idx) =>
      selectedTaskIndices.has(idx),
    );

    if (approvedTasks.length === 0) {
      setError('Please select at least one task to create.');
      return;
    }

    try {
      setIsApplying(true);
      setError(null);
      const container = ServiceContainer.getInstance();
      await container.applyGoalProposal.execute(approvedTasks);

      // Reactive update for tasks list and today's schedule
      useUIStore.getState().incrementTasksRevision();
      useUIStore.getState().setActiveFilter('all');

      setCreatedCount(approvedTasks.length);
      setStep('success');
      useUIStore.getState().showSnackbar(`Successfully created ${approvedTasks.length} tasks!`, 'success');
    } catch (err: any) {
      console.error('[AIDecompose] Task creation error:', err);
      setError(err.message || 'Failed to create tasks. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard Proposal',
      'Are you sure? No tasks will be created and your proposed plan will be dismissed.',
      [
        { text: 'Keep Reviewing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setProposal(null);
            setStep('input');
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="AI Goal Decomposer" onBack={handleBackToPrevious} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {/* Header Title */}
        <View style={{ marginBottom: spacing.lg }}>
          <View style={styles.titleRow}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>Decompose Goals into Action</Text>
          </View>
          <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs }}>
            Formulate progressive milestones and day-by-day execution tasks using advanced AI.
          </Text>
        </View>

        {error && (
          <Card style={[styles.errorCard, { backgroundColor: colors.error + '20', borderColor: colors.error, marginBottom: spacing.md }]}>
            <Text style={{ fontSize: typography.fontSize.xs, color: colors.error, fontWeight: '600' }}>{error}</Text>
          </Card>
        )}

        {/* STEP 1: INPUT FORM */}
        {step === 'input' && (
          <View style={{ gap: spacing.md }}>
            <FormField
              label="Goal Description"
              placeholder="e.g. Build my body at home in 30 days, or learn Angular in 10 days"
              value={goalDescription}
              onChangeText={setGoalDescription}
              multiline
              numberOfLines={4}
            />

            {detectedDays && !deadline && (
              <Pressable
                onPress={() => {
                  const target = new Date();
                  target.setDate(target.getDate() + detectedDays);
                  target.setHours(23, 59, 59, 0);
                  setDeadline(target.toISOString());
                }}
                style={[styles.detectedPill, { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
              >
                <Text style={{ fontSize: typography.fontSize.xs, color: colors.accent, fontWeight: '600' }}>
                  ⚡ Auto-detected {detectedDays}-day timeline. Tap to apply deadline ({new Date(screenLoadedAt + detectedDays * 86400000).toLocaleDateString()})
                </Text>
              </Pressable>
            )}

            <DatePickerField
              label="Target Deadline"
              placeholder="Select target deadline from calendar…"
              value={deadline}
              onChange={setDeadline}
              helperText="Optional target date to calibrate daily roadmap"
            />

            {/* HH:MM Duration Selector */}
            <DurationSelector
              hours={durationHours}
              minutes={durationMinutes}
              onChange={(h, m) => {
                setDurationHours(h);
                setDurationMinutes(m);
              }}
            />

            <View style={{ marginTop: spacing.md }}>
              <Button
                title="Decompose Goal into Tasks"
                variant="primary"
                onPress={handleGenerate}
              />
            </View>
          </View>
        )}

        {/* STEP 2: LOADING */}
        {step === 'loading' && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingTitle, { color: colors.textPrimary, marginTop: spacing.md }]}>
              Generating Structured Daily Roadmap...
            </Text>
            <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }}>
              Consulting specialized domain persona and calibrating sequential deliverables.
            </Text>
          </View>
        )}

        {/* STEP 3: REVIEW PROPOSAL */}
        {step === 'review' && proposal && (
          <View style={{ gap: spacing.md }}>
            {/* Goal Summary */}
            <Card style={{ padding: spacing.md }}>
              <View style={styles.planHeaderRow}>
                <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, fontWeight: '700' }}>
                  PLAN SUMMARY
                </Text>
                <Badge
                  label="AI Execution Plan"
                  color={{ bg: colors.surface, text: colors.accent }}
                  size="sm"
                />
              </View>
              <Text style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, marginTop: 4, fontWeight: '600' }}>
                {proposal.goalSummary}
              </Text>
            </Card>

            {/* Milestones */}
            {proposal.milestones.length > 0 && (
              <Card style={{ padding: spacing.md }}>
                <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginBottom: 8, fontWeight: '700' }}>
                  MILESTONES ({proposal.milestones.length})
                </Text>
                {proposal.milestones.map((m) => (
                  <View key={m.id} style={{ marginBottom: 6 }}>
                    <Text style={{ fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.accent }}>
                      {m.order}. {m.title}
                    </Text>
                    {m.description && (
                      <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
                        {m.description}
                      </Text>
                    )}
                  </View>
                ))}
              </Card>
            )}

            {/* Proposed Tasks Checklist */}
            <View>
              <View style={styles.tasksHeaderRow}>
                <View>
                  <Text style={{ fontSize: typography.fontSize.base, fontWeight: '700', color: colors.textPrimary }}>
                    Daily Action Roadmap
                  </Text>
                  <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                    Selected: {selectedTaskIndices.size} of {proposal.proposedTasks.length} daily tasks
                  </Text>
                </View>
                <Pressable
                  onPress={handleSelectAll}
                  style={[styles.selectAllBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: typography.fontSize.xs, color: colors.accent, fontWeight: '600' }}>
                    {selectedTaskIndices.size === proposal.proposedTasks.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </Pressable>
              </View>

              {proposal.proposedTasks.map((t, idx) => {
                const isSelected = selectedTaskIndices.has(idx);
                return (
                  <Pressable
                    key={idx}
                    onPress={() => toggleTaskSelection(idx)}
                  >
                    <Card
                      style={[
                        styles.taskCard,
                        {
                          borderColor: isSelected ? colors.accent : colors.border,
                          backgroundColor: isSelected ? colors.surface : colors.background,
                          padding: spacing.md,
                          marginBottom: spacing.sm,
                        },
                      ]}
                    >
                      <View style={styles.taskCardHeader}>
                        <View style={[styles.checkbox, isSelected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text style={[styles.taskTitle, { color: colors.textPrimary }]}>
                            {t.title}
                          </Text>
                          {t.description ? (
                            <Text style={[styles.taskDesc, { color: colors.textSecondary }]}>
                              {t.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.metaRow}>
                        <Badge label={t.priority} />
                        <Badge label={`${t.estimatedDurationMinutes}m`} />
                        {t.suggestedDeadline ? (
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              setEditingTaskIdx(idx);
                            }}
                            hitSlop={6}
                          >
                            <Badge label={`📅 ${t.suggestedDeadline.split('T')[0]}`} />
                          </Pressable>
                        ) : null}
                        {t.subtasks && t.subtasks.length > 0 && (
                          <Badge label={`${t.subtasks.length} subtasks`} />
                        )}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>

            {/* Assumptions */}
            {proposal.assumptions.length > 0 && (
              <Card style={{ padding: spacing.md }}>
                <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginBottom: 4, fontWeight: '700' }}>
                  KEY ASSUMPTIONS
                </Text>
                {proposal.assumptions.map((a, i) => (
                  <Text key={i} style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
                    • {a}
                  </Text>
                ))}
              </Card>
            )}

            {/* Review Action Buttons */}
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                title={isApplying ? 'Creating Tasks...' : `Approve & Create ${selectedTaskIndices.size} Tasks`}
                variant="primary"
                onPress={handleApplyApproved}
                disabled={isApplying || selectedTaskIndices.size === 0}
              />
              <Button
                title="Discard Proposal"
                variant="ghost"
                onPress={handleDiscard}
                disabled={isApplying}
              />
            </View>
          </View>
        )}

        {/* STEP 4: SUCCESS CONFIRMATION */}
        {step === 'success' && (
          <View style={styles.centerContainer}>
            <View style={[styles.successBadgeCircle, { backgroundColor: colors.accent + '20' }]}>
              <Text style={{ fontSize: 44 }}>🎉</Text>
            </View>
            <Text style={[styles.loadingTitle, { color: colors.textPrimary, marginTop: spacing.md }]}>
              Tasks Created Successfully!
            </Text>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }}>
              Added {createdCount} daily roadmap tasks to your workspace.
            </Text>
            <View style={[styles.infoBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ fontSize: typography.fontSize.xs, color: colors.accent, fontWeight: '600', textAlign: 'center' }}>
                ⭐ Day 1 task is ready on your Today screen!
              </Text>
              <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                All sequential deliverables and subtasks are available in Tasks.
              </Text>
            </View>
            <View style={{ marginTop: spacing.lg, width: '100%', maxWidth: 300, gap: spacing.sm }}>
              <Button
                title="View Today's Tasks"
                variant="primary"
                onPress={() => router.replace('/(tabs)/today')}
              />
              <Button
                title="View All Tasks"
                variant="secondary"
                onPress={() => router.replace('/(tabs)/tasks')}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {editingTaskIdx !== null && proposal && (
        <DatePickerModal
          visible={true}
          title="Change Task Deadline"
          initialDate={proposal.proposedTasks[editingTaskIdx]?.suggestedDeadline || undefined}
          onClose={() => setEditingTaskIdx(null)}
          onSelectDate={(newDate) => {
            const updated = [...proposal.proposedTasks];
            updated[editingTaskIdx] = {
              ...updated[editingTaskIdx],
              suggestedDeadline: newDate || null,
            };
            setProposal({ ...proposal, proposedTasks: updated });
            setEditingTaskIdx(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heading: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
  },
  errorCard: {
    padding: spacing.md,
    borderRadius: radii.md,
  },
  detectedPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  durationSection: {
    gap: spacing.xs,
  },
  durationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  durationCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  digitalDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  unitBlock: {
    alignItems: 'center',
  },
  unitLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  timeDigit: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'center',
  },
  timeColon: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  presetChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: typography.fontSize.xs,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
  },
  loadingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tasksHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectAllBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  taskCard: {
    borderWidth: 1,
    borderRadius: radii.md,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  taskTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  taskDesc: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  successBadgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    width: '100%',
    maxWidth: 320,
  },
});
