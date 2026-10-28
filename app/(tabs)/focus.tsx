/**
 * Focus Arena — live timestamp-driven Pomodoro engine, task linking,
 * state machine controls, break mode, and supportive accountability.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
} from 'react-native';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii, shadows } from '../../src/presentation/theme/tokens';
import { Button } from '../../src/presentation/components/Button';
import { Card } from '../../src/presentation/components/Card';
import { Badge } from '../../src/presentation/components/Badge';
import { useFocusArena } from '../../src/presentation/hooks/useFocusArena';
import { useTasks } from '../../src/presentation/hooks/useTasks';
import { FocusState } from '../../src/domain/focus/FocusSession';

export default function FocusScreen() {
  const { colors } = useTheme();
  const {
    session,
    state,
    formattedRemaining,
    formattedElapsed,
    progressPercent,
    isFocusing,
    isPaused,
    isBreak,
    interruptionPrompt,
    startSession,
    pauseSession,
    resumeSession,
    startBreak,
    completeSession,
    cancelSession,
    confirmInterruption,
  } = useFocusArena();

  const { tasks } = useTasks({ status: ['PENDING', 'IN_PROGRESS'] });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [interruptionReason, setInterruptionReason] = useState('');

  const linkedTask = tasks.find((t) => t.id === (session?.taskId || selectedTaskId));

  const getStateBadge = () => {
    switch (state) {
      case FocusState.FOCUSING:
        return <Badge label="FOCUSING" color={{ bg: '#4338CA', text: '#FFFFFF' }} size="md" />;
      case FocusState.PAUSED:
        return <Badge label="PAUSED" color={{ bg: '#D97706', text: '#FFFFFF' }} size="md" />;
      case FocusState.BREAK:
        return <Badge label="RECOVERY BREAK" color={{ bg: '#059669', text: '#FFFFFF' }} size="md" />;
      case FocusState.COMPLETED:
        return <Badge label="COMPLETED" color={{ bg: '#16A34A', text: '#FFFFFF' }} size="md" />;
      default:
        return <Badge label="READY" color={{ bg: colors.surface, text: colors.textSecondary }} size="md" />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Focus Arena
            </Text>
            {getStateBadge()}
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Continuous focus tracking with timestamp-based interruption resilience.
          </Text>
        </View>

        {/* Linked Task Selector */}
        <Card style={styles.taskCard}>
          <Text style={[styles.taskLabel, { color: colors.textSecondary }]}>
            FOCUS TARGET TASK
          </Text>
          <Pressable
            onPress={() => setShowTaskPicker(true)}
            disabled={isFocusing || isPaused || isBreak}
            style={styles.taskPickerTrigger}
            accessibilityRole="button"
            accessibilityLabel="Select target task"
          >
            <Text
              style={[
                styles.taskTitle,
                { color: linkedTask ? colors.textPrimary : colors.textTertiary },
              ]}
              numberOfLines={1}
            >
              {linkedTask ? `🎯 ${linkedTask.title}` : 'Tap to link a task for this session…'}
            </Text>
            {(!isFocusing && !isPaused && !isBreak) && (
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Change</Text>
            )}
          </Pressable>
        </Card>

        {/* Big Circular Timer Display */}
        <View
          style={[
            styles.timerCircle,
            {
              borderColor: isBreak ? colors.success : isPaused ? colors.warning : colors.accent,
              backgroundColor: colors.surface,
              ...shadows.lg,
            },
          ]}
        >
          <Text
            style={[
              styles.timerDigits,
              {
                color: isBreak ? colors.success : isPaused ? colors.warning : colors.textPrimary,
              },
            ]}
          >
            {isBreak ? formattedElapsed : formattedRemaining}
          </Text>
          <Text style={[styles.timerSublabel, { color: colors.textSecondary }]}>
            {isBreak ? 'Break Time' : isPaused ? 'Paused' : `${progressPercent}% Complete`}
          </Text>
        </View>

        {/* Control Buttons based on State Machine */}
        <View style={styles.controlsRow}>
          {state === FocusState.IDLE || state === FocusState.COMPLETED || state === FocusState.CANCELLED ? (
            <Button
              title="Start Focus Session"
              onPress={() => startSession(selectedTaskId)}
              size="lg"
              fullWidth
            />
          ) : isFocusing ? (
            <View style={styles.actionGrid}>
              <View style={styles.halfBtn}>
                <Button title="Pause" onPress={pauseSession} variant="secondary" size="lg" fullWidth />
              </View>
              <View style={styles.halfBtn}>
                <Button title="Take Break" onPress={startBreak} variant="outline" size="lg" fullWidth />
              </View>
              <View style={styles.fullBtn}>
                <Button title="Done Early" onPress={completeSession} variant="primary" size="md" fullWidth />
              </View>
              <View style={styles.fullBtn}>
                <Button title="Cancel Session" onPress={() => cancelSession('User stopped')} variant="ghost" size="sm" fullWidth />
              </View>
            </View>
          ) : isPaused ? (
            <View style={styles.actionGrid}>
              <View style={styles.halfBtn}>
                <Button title="Resume" onPress={resumeSession} variant="primary" size="lg" fullWidth />
              </View>
              <View style={styles.halfBtn}>
                <Button title="End & Save" onPress={completeSession} variant="secondary" size="lg" fullWidth />
              </View>
              <View style={styles.fullBtn}>
                <Button title="Cancel Session" onPress={() => cancelSession('Abandoned during pause')} variant="ghost" size="sm" fullWidth />
              </View>
            </View>
          ) : isBreak ? (
            <View style={styles.actionGrid}>
              <View style={styles.halfBtn}>
                <Button title="Resume Focus" onPress={() => startSession(selectedTaskId)} variant="primary" size="lg" fullWidth />
              </View>
              <View style={styles.halfBtn}>
                <Button title="Finish Session" onPress={completeSession} variant="secondary" size="lg" fullWidth />
              </View>
            </View>
          ) : null}
        </View>

        {/* Session Invariants & Explainer */}
        <Card style={styles.explainerCard}>
          <Text style={[styles.explainerTitle, { color: colors.textPrimary }]}>
            🛡️ Timestamp Integrity Invariants
          </Text>
          <Text style={[styles.explainerBody, { color: colors.textSecondary }]}>
            • Elapsed time is derived strictly from real-world timestamps.{'\n'}
            • Process restarts and backgrounding never corrupt active duration.{'\n'}
            • You are never penalized for switching apps or answering calls.
          </Text>
        </Card>
      </ScrollView>

      {/* Task Picker Modal */}
      <Modal visible={showTaskPicker} animationType="slide" transparent onRequestClose={() => setShowTaskPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowTaskPicker(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Select Target Task
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <Pressable
                onPress={() => {
                  setSelectedTaskId(null);
                  setShowTaskPicker(false);
                }}
                style={[styles.taskOption, { borderBottomColor: colors.borderLight }]}
              >
                <Text style={{ color: colors.textSecondary }}>None (Unlinked Session)</Text>
              </Pressable>
              {tasks.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setSelectedTaskId(t.id);
                    setShowTaskPicker(false);
                  }}
                  style={[styles.taskOption, { borderBottomColor: colors.borderLight }]}
                >
                  <Text style={[styles.taskOptionTitle, { color: colors.textPrimary }]}>
                    {t.title}
                  </Text>
                  <Badge label={t.priority} size="sm" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Supportive Interruption Check Modal */}
      <Modal
        visible={interruptionPrompt?.visible ?? false}
        animationType="fade"
        transparent
        onRequestClose={() => confirmInterruption(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.interruptionCard, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.interruptionTitle, { color: colors.textPrimary }]}>
              💭 Interruption Check
            </Text>
            <Text style={[styles.interruptionBody, { color: colors.textSecondary }]}>
              We noticed you stepped away for {interruptionPrompt?.awayDurationSeconds ?? 0}s.
              Did an interruption pull your attention away from your task?
            </Text>
            <TextInput
              style={[
                styles.reasonInput,
                {
                  backgroundColor: colors.backgroundTertiary,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Optional: What interrupted you? (e.g. phone call)"
              placeholderTextColor={colors.textTertiary}
              value={interruptionReason}
              onChangeText={setInterruptionReason}
            />
            <View style={styles.interruptionActions}>
              <View style={{ flex: 1 }}>
                <Button
                  title="No, Still Focused"
                  onPress={() => confirmInterruption(false)}
                  variant="outline"
                  size="md"
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Log Interruption"
                  onPress={() => confirmInterruption(true, interruptionReason)}
                  variant="secondary"
                  size="md"
                  fullWidth
                />
              </View>
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 80,
  },
  header: {
    marginBottom: spacing.base,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
  },
  taskCard: {
    marginBottom: spacing.base,
  },
  taskLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  taskPickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  taskTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    flex: 1,
    marginRight: spacing.sm,
  },
  timerCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 6,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  timerDigits: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tight,
  },
  timerSublabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  controlsRow: {
    marginBottom: spacing.xl,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  halfBtn: {
    width: '48%',
  },
  fullBtn: {
    width: '100%',
  },
  explainerCard: {
    marginTop: spacing.sm,
  },
  explainerTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  explainerBody: {
    fontSize: typography.fontSize.xs,
    lineHeight: typography.fontSize.xs * typography.lineHeight.normal,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.base,
  },
  taskOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taskOptionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    flex: 1,
    marginRight: spacing.sm,
  },
  interruptionCard: {
    margin: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii.xl,
  },
  interruptionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  interruptionBody: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
    marginBottom: spacing.md,
  },
  reasonInput: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.base,
  },
  interruptionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
