import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii } from '../../src/presentation/theme/tokens';
import { Card } from '../../src/presentation/components/Card';
import { Button } from '../../src/presentation/components/Button';
import { Badge } from '../../src/presentation/components/Badge';
import { ScreenHeader } from '../../src/presentation/components/ScreenHeader';
import { useAuthStore } from '../../src/presentation/stores/authStore';
import { ServiceContainer } from '../../src/services/ServiceContainer';

export default function AccountSettingsScreen() {
  const { colors } = useTheme();
  const { user, isGuest, logout } = useAuthStore();

  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const loadSyncStatus = async () => {
    try {
      const syncRepo = ServiceContainer.getInstance().getSyncRepository();
      if (syncRepo) {
        const pending = await syncRepo.getPendingOutboxItems();
        setOutboxCount(pending.length);
        const last = await syncRepo.getMetadata('last_synced_at');
        setLastSynced(last);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      const syncEngine = ServiceContainer.getInstance().getSyncEngine();
      const res = await syncEngine.sync();
      await loadSyncStatus();
      if (res.success) {
        Alert.alert('Sync Complete', `Pushed ${res.pushedCount} items, pulled ${res.pulledCount} items.`);
      } else {
        Alert.alert('Sync Notice', res.errors.join('\n') || 'Sync completed with warnings.');
      }
    } catch (err: any) {
      Alert.alert('Sync Error', err.message || 'Failed to sync with cloud.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Confirm Sign Out',
      'Your local tasks will remain safely stored on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Account & Cloud Sync" />

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Account Info Card */}
        <Card style={{ padding: spacing.md, marginBottom: spacing.md }}>
          <View style={styles.rowBetween}>
            <Text style={{ fontSize: typography.fontSize.base, fontWeight: '600', color: colors.textPrimary }}>
              Account Status
            </Text>
            <Badge
              label={isGuest ? 'Guest Mode' : 'Connected'}
            />
          </View>

          {!isGuest && user ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>Email</Text>
              <Text style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, marginBottom: spacing.sm }}>
                {user.email}
              </Text>
              {user.displayName && (
                <>
                  <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>Display Name</Text>
                  <Text style={{ fontSize: typography.fontSize.base, color: colors.textPrimary }}>
                    {user.displayName}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md }}>
                You are currently using Momentum offline in Guest Mode. Connect an account to sync tasks across devices.
              </Text>
              <Button
                title="Sign In or Create Account"
                variant="primary"
                onPress={() => router.push('/(auth)/login')}
              />
            </View>
          )}
        </Card>

        {/* Sync Status Card */}
        <Card style={{ padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ fontSize: typography.fontSize.base, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm }}>
            Cloud Sync Status
          </Text>
          <View style={styles.metricRow}>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Pending Outbox Mutations:</Text>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: '700' }}>{outboxCount}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Last Synchronized:</Text>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              {lastSynced ? new Date(lastSynced).toLocaleString() : 'Never'}
            </Text>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Button
              title={isSyncing ? 'Syncing...' : 'Sync Now'}
              variant="secondary"
              onPress={handleManualSync}
              disabled={isSyncing || isGuest}
            />
          </View>
        </Card>

        {/* Sign Out Option */}
        {!isGuest && (
          <View style={{ marginTop: spacing.lg }}>
            <Button
              title="Sign Out"
              variant="danger"
              onPress={handleLogout}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
});
