import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii } from '../../src/presentation/theme/tokens';
import { FormField } from '../../src/presentation/components/FormField';
import { Button } from '../../src/presentation/components/Button';
import { Card } from '../../src/presentation/components/Card';
import { Dialog } from '../../src/presentation/components/Dialog';
import { useAuthStore } from '../../src/presentation/stores/authStore';

export default function LoginScreen() {
  const { colors } = useTheme();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const {
    login,
    register,
    resetPassword,
    continueAsGuest,
    isLoading,
    error,
    showMergePrompt,
    confirmMerge,
    declineMerge,
    clearError,
  } = useAuthStore();

  const handleSubmit = async () => {
    clearError();
    setMessage(null);

    if (!email.trim()) {
      Alert.alert('Required Field', 'Please enter your email address.');
      return;
    }

    if (mode === 'forgot') {
      const ok = await resetPassword(email);
      if (ok) {
        setMessage('Password reset instructions sent. Please check your inbox.');
      }
      return;
    }

    if (!password) {
      Alert.alert('Required Field', 'Please enter your password.');
      return;
    }

    if (mode === 'login') {
      const success = await login(email, password);
      if (success && !showMergePrompt) {
        router.back();
      }
    } else {
      const res = await register(email, password, displayName);
      if (res.success) {
        if (res.requiresConfirmation) {
          setMessage('Account created! Please check your email to confirm your address.');
        } else if (!showMergePrompt) {
          router.back();
        }
      }
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Momentum Cloud</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            {mode === 'login'
              ? 'Sign in to sync your tasks securely across devices'
              : mode === 'register'
              ? 'Create a cloud account to enable backup and AI planning'
              : 'Reset your password'}
          </Text>
        </View>

        {/* Tab Toggle */}
        <View style={[styles.tabRow, { backgroundColor: colors.surface, borderRadius: radii.md, padding: 4 }]}>
          <Pressable
            style={[styles.tab, mode === 'login' && { backgroundColor: colors.accent }]}
            onPress={() => {
              setMode('login');
              clearError();
            }}
          >
            <Text style={[styles.tabText, { color: mode === 'login' ? '#FFFFFF' : colors.textSecondary }]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'register' && { backgroundColor: colors.accent }]}
            onPress={() => {
              setMode('register');
              clearError();
            }}
          >
            <Text style={[styles.tabText, { color: mode === 'register' ? '#FFFFFF' : colors.textSecondary }]}>
              Create Account
            </Text>
          </Pressable>
        </View>

        {error && (
          <Card style={[styles.noticeCard, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
            <Text style={{ color: colors.error, fontSize: typography.fontSize.sm }}>{error}</Text>
          </Card>
        )}

        {message && (
          <Card style={[styles.noticeCard, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <Text style={{ color: colors.success, fontSize: typography.fontSize.sm }}>{message}</Text>
          </Card>
        )}

        <View style={[styles.form, { gap: spacing.md, marginTop: spacing.md }]}>
          {mode === 'register' && (
            <FormField
              label="Display Name (Optional)"
              placeholder="e.g. Alex"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          )}

          <FormField
            label="Email Address"
            placeholder="you@domain.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {mode !== 'forgot' && (
            <FormField
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          )}

          <Button
            title={isLoading ? 'Please wait...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
            onPress={handleSubmit}
            variant="primary"
            disabled={isLoading}
          />

          {mode === 'login' && (
            <Pressable onPress={() => setMode('forgot')} style={styles.centerLink}>
              <Text style={{ color: colors.accent, fontSize: typography.fontSize.sm }}>Forgot password?</Text>
            </Pressable>
          )}

          {mode === 'forgot' && (
            <Pressable onPress={() => setMode('login')} style={styles.centerLink}>
              <Text style={{ color: colors.accent, fontSize: typography.fontSize.sm }}>Back to Sign In</Text>
            </Pressable>
          )}

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text style={{ color: colors.textSecondary, marginHorizontal: spacing.sm, fontSize: typography.fontSize.xs }}>OR</Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>

          <Button
            title="Continue as Guest (Offline Only)"
            onPress={handleGuest}
            variant="ghost"
          />
        </View>
      </ScrollView>

      {/* Explicit Local Task Merge Confirmation Dialog */}
      <Dialog
        visible={showMergePrompt}
        title="Sync Existing Local Tasks?"
        message={`You have local tasks created on this device. Would you like to upload and associate them with ${email}? If declined, your tasks will remain offline on this device.`}
        confirmLabel="Upload & Merge"
        cancelLabel="Keep Offline"
        onConfirm={async () => {
          await confirmMerge();
          router.back();
        }}
        onCancel={() => {
          declineMerge();
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  form: {},
  noticeCard: {
    padding: 12,
    marginBottom: 16,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  centerLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  line: {
    flex: 1,
    height: 1,
  },
});
