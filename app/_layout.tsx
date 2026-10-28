/**
 * Root layout — wraps the app with ThemeProvider, ServiceProvider,
 * initialises the database, and defines the navigation stack.
 */

import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../src/presentation/theme/ThemeContext';
import { ServiceProvider } from '../src/presentation/hooks/useServices';
import { useTheme } from '../src/presentation/theme/useTheme';
import { getDatabase } from '../src/data/database/DatabaseProvider';
import { SQLiteTaskRepository } from '../src/data/repositories/SQLiteTaskRepository';
import { SQLiteReminderRepository } from '../src/data/repositories/SQLiteReminderRepository';
import { SQLiteFocusSessionRepository } from '../src/data/repositories/SQLiteFocusSessionRepository';
import { SQLiteMissedTaskRepository } from '../src/data/repositories/SQLiteMissedTaskRepository';
import { SQLiteSyncRepository } from '../src/data/repositories/SQLiteSyncRepository';
import { NotificationService } from '../src/services/NotificationService';
import { ServiceContainer } from '../src/services/ServiceContainer';
import { LoadingState } from '../src/presentation/components/LoadingState';
import { useUIStore } from '../src/presentation/stores/uiStore';

function RootNavigator() {
  const { colors } = useTheme();

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="task/create"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="task/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="task/edit/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="settings/index"
          options={{ presentation: 'modal', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings/reminders"
          options={{ presentation: 'modal', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings/account"
          options={{ presentation: 'modal', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ai/decompose"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="(auth)/login"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ presentation: 'modal', animation: 'fade' }}
        />
      </Stack>
    </>
  );
}

function AppWithServices({ container }: { container: ServiceContainer }) {
  return (
    <ServiceProvider container={container}>
      <RootNavigator />
    </ServiceProvider>
  );
}

export default function RootLayout() {
  const [container, setContainer] = useState<ServiceContainer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await getDatabase();

        // Check versioned onboarding completion flag from app_settings
        try {
          const row = await db.getFirstAsync<{ value: string }>(
            "SELECT value FROM app_settings WHERE key = 'onboarding_version'",
          );
          if (row?.value === '1') {
            useUIStore.getState().setOnboardingComplete(true);
          }
        } catch {
          // Best effort
        }

        const taskRepo = new SQLiteTaskRepository(db);
        const reminderRepo = new SQLiteReminderRepository(db);
        const focusRepo = new SQLiteFocusSessionRepository(db);
        const missedRepo = new SQLiteMissedTaskRepository(db);
        const syncRepo = new SQLiteSyncRepository(db);
        const notifService = new NotificationService();

        const svc = new ServiceContainer({
          taskRepository: taskRepo,
          reminderRepository: reminderRepo,
          focusSessionRepository: focusRepo,
          missedTaskRepository: missedRepo,
          syncRepository: syncRepo,
          notificationService: notifService,
        });

        // Reconcile notifications and active tasks
        (async () => {
          try {
            const activeReminders = await reminderRepo.findAllActive();
            const allTasks = await taskRepo.findAll();
            await notifService.reconcileScheduledNotifications(activeReminders, allTasks);
          } catch {
            // Best effort
          }
        })();

        if (mounted) setContainer(svc);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialise database');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <ThemeProvider>
        <LoadingState message={`Error: ${error}`} />
      </ThemeProvider>
    );
  }

  if (!container) {
    return (
      <ThemeProvider>
        <LoadingState message="Starting Momentum…" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppWithServices container={container} />
    </ThemeProvider>
  );
}
