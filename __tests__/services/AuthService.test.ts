import { SupabaseAuthService } from '../../src/services/auth/SupabaseAuthService';
import { SecureAuthStorage } from '../../src/services/auth/SecureAuthStorage';

describe('SupabaseAuthService and Secure Storage', () => {
  let authService: SupabaseAuthService;

  beforeEach(() => {
    authService = new SupabaseAuthService();
  });

  describe('Guest Mode and Offline Usage', () => {
    it('defaults to guest mode', () => {
      expect(authService.isGuest()).toBe(true);
    });

    it('can toggle guest mode', () => {
      authService.setGuest(false);
      expect(authService.isGuest()).toBe(false);
      authService.setGuest(true);
      expect(authService.isGuest()).toBe(true);
    });

    it('returns null session when in guest mode without credentials', async () => {
      const session = await authService.getSession();
      expect(session).toBeNull();
    });
  });

  describe('SecureAuthStorage Adapter', () => {
    it('stores and retrieves items securely', async () => {
      await SecureAuthStorage.setItem('test_token', 'jwt_secret_12345');
      const retrieved = await SecureAuthStorage.getItem('test_token');
      expect(retrieved).toBe('jwt_secret_12345');
    });

    it('removes stored items', async () => {
      await SecureAuthStorage.setItem('remove_me', 'temp_value');
      await SecureAuthStorage.removeItem('remove_me');
      const retrieved = await SecureAuthStorage.getItem('remove_me');
      expect(retrieved).toBeNull();
    });

    it('returns null for non-existent keys', async () => {
      const retrieved = await SecureAuthStorage.getItem('non_existent_key_xyz');
      expect(retrieved).toBeNull();
    });
  });

  describe('Sign In / Sign Up Offline Mock', () => {
    it('successfully registers an account in offline fallback mode', async () => {
      const result = await authService.signUp('dev@momentum.test', 'Password123!', 'Dev User');
      expect(result.user).not.toBeNull();
      expect(result.user?.email).toBe('dev@momentum.test');
      expect(authService.isGuest()).toBe(false);
    });

    it('successfully signs in and signs out', async () => {
      const { session, user } = await authService.signIn('dev@momentum.test', 'Password123!');
      expect(session.accessToken).toBeDefined();
      expect(user.email).toBe('dev@momentum.test');
      expect(authService.isGuest()).toBe(false);

      await authService.signOut();
      expect(authService.isGuest()).toBe(true);
    });
  });
});
