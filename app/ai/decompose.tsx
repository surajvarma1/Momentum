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
import {
  GoalDecompositionProposal,
} from '../../src/domain/ai/AIDecomposerTypes';

type ProviderChoice = 'auto' | 'openrouter' | 'gemini' | 'nvidia' | 'bytez';

export default function AIDecomposeScreen() {
  const { colors } = useTheme();

  // Step state: 'input' | 'loading' | 'review' | 'success'
  const [step, setStep] = useState<'input' | 'loading' | 'review' | 'success'>('input');
  const [createdCount, setCreatedCount] = useState(0);

  // Input fields
  const [goalDescription, setGoalDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [sessionDuration, setSessionDuration] = useState('25');
  const [selectedProvider, setSelectedProvider] = useState<ProviderChoice>('auto');
  const [screenLoadedAt] = useState(() => Date.now());

  // Proposal result & selection
  const [proposal, setProposal] = useState<GoalDecompositionProposal | null>(null);
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<Set<number>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Task deadline editing modal
  const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);

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
      Alert.alert('Invalid Goal', 'Please enter a goal description with at least 5 characters.');
      return;
    }

    try {
      setError(null);
      setStep('loading');

      const container = ServiceContainer.getInstance();
      const parsedDuration = parseInt(sessionDuration, 10) || 25;

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
        preferredSessionMinutes: Math.min(240, Math.max(15, parsedDuration)),
        includeExistingCommitments: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        provider: selectedProvider,
      });

      setProposal(result);
      // Select all proposed tasks by default
      const allIndices = new Set(result.proposedTasks.map((_, i) => i));
      setSelectedTaskIndices(allIndices);
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to decompose goal. Please check your AI API key in .env or switch provider.');
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
      Alert.alert('No Tasks Selected', 'Please select at least one task to create, or discard the proposal.');
      return;
    }

    try {
      setIsApplying(true);
      const container = ServiceContainer.getInstance();
      await container.applyGoalProposal.execute(approvedTasks);
      useUIStore.getState().incrementTasksRevision();
      useUIStore.getState().setActiveFilter('all');
      setCreatedCount(approvedTasks.length);
      setProposal(null);
      setStep('success');
      useUIStore.getState().showSnackbar(`Successfully added ${approvedTasks.length} tasks!`, 'success');
      setTimeout(() => {
        router.replace('/(tabs)/tasks');
      }, 1400);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save generated tasks.');
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
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/tasks');
          },
        },
      ],
    );
  };

  const PROVIDER_OPTIONS: { id: ProviderChoice; label: string; badge: string }[] = [
    { id: 'auto', label: 'Auto', badge: 'Smart' },
    { id: 'openrouter', label: 'OpenRouter', badge: 'Free' },
    { id: 'gemini', label: 'Gemini', badge: 'Fast' },
    { id: 'nvidia', label: 'NVIDIA NIM', badge: 'Pro' },
    { id: 'bytez', label: 'Bytez', badge: 'API' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="AI Goal Decomposer" onBack={handleBackToPrevious} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Header Title */}
        <View style={{ marginBottom: spacing.md }}>
          <View style={styles.titleRow}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>Decompose Goals into Action</Text>
          </View>
          <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs }}>
            Formulate progressive milestones and day-by-day execution tasks using advanced AI.
          </Text>
        </View>

        {/* Provider Selector Chips */}
        <View style={{ marginBottom: spacing.md }}>
          <Text style={{ fontSize: typography.fontSize.xs, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>
            AI ENGINE PROVIDER
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providerScroll}>
            {PROVIDER_OPTIONS.map((p) => {
              const active = selectedProvider === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedProvider(p.id)}
                  style={[
                    styles.providerChip,
                    {
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active ? colors.surface : colors.background,
                    },
                  ]}
                >
                  <Text style={[styles.providerLabel, { color: active ? colors.accent : colors.textPrimary }]}>
                    {p.label}
                  </Text>
                  <View style={[styles.providerBadge, { backgroundColor: active ? colors.accent + '25' : colors.surface }]}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: active ? colors.accent : colors.textTertiary }}>
                      {p.badge}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
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
              placeholder="e.g. Build my body in home in 30 days, or develop a mobile app in 14 days"
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

            <FormField
              label="Preferred Focus Duration (Minutes)"
              placeholder="25"
              value={sessionDuration}
              onChangeText={setSessionDuration}
              keyboardType="number-pad"
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
                {proposal.providerUsed && (
                  <Badge
                    label={proposal.providerUsed}
                    color={{ bg: colors.surface, text: colors.accent }}
                    size="sm"
                  />
                )}
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
                          {isSelected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                        </View>
                        <Text
                          style={[
                            styles.taskTitle,
                            {
                              flex: 1,
                              marginLeft: spacing.sm,
                              color: isSelected ? colors.textPrimary : colors.textSecondary,
                            },
                          ]}
                        >
                          {t.title}
                        </Text>
                      </View>

                      {t.description && (
                        <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 4, marginLeft: 28 }}>
                          {t.description}
                        </Text>
                      )}

                      <View style={[styles.badgeRow, { marginLeft: 28, marginTop: 8 }]}>
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
              <Text style={{ fontSize: 44 }}>✅</Text>
            </View>
            <Text style={[styles.loadingTitle, { color: colors.textPrimary, marginTop: spacing.md }]}>
              Tasks Created Successfully!
            </Text>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }}>
              Added {createdCount} daily roadmap tasks to your task list.
            </Text>
            <Text style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginTop: spacing.xs, textAlign: 'center' }}>
              Navigating to your Tasks screen...
            </Text>
            <View style={{ marginTop: spacing.lg, width: '100%', maxWidth: 240 }}>
              <Button
                title="View Tasks Now"
                variant="primary"
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
    gap: 8,
  },
  heading: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
  },
  providerScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    borderWidth: 1.5,
    gap: 6,
  },
  providerLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  providerBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detectedPill: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
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
  centerContainer: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  successBadgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  taskCard: {
    borderWidth: 1.5,
    borderRadius: radii.md,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: '#777',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  errorCard: {
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
