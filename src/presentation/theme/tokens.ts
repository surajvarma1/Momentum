/**
 * Design tokens for Beast Mode.
 * Centralized color, typography, spacing, and layout definitions.
 * Charcoal/ink surfaces with restrained violet/indigo accent.
 */

// ── Color Palette ──────────────────────────────────────────────

export const palette = {
  // Neutrals (charcoal/ink)
  white: '#FFFFFF',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#E8E8ED',
  gray300: '#D1D1D6',
  gray400: '#AEAEB2',
  gray500: '#8E8E93',
  gray600: '#636366',
  gray700: '#48484A',
  gray800: '#2C2C2E',
  gray850: '#1E1E20',
  gray900: '#1C1C1E',
  gray950: '#141416',
  black: '#000000',

  // Violet/Indigo accent (restrained)
  indigo50: '#EEF2FF',
  indigo100: '#E0E7FF',
  indigo200: '#C7D2FE',
  indigo300: '#A5B4FC',
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',
  indigo800: '#3730A3',
  indigo900: '#312E81',

  // Semantic colors
  success: '#34C759',
  successDark: '#30D158',
  warning: '#FF9F0A',
  warningDark: '#FFD60A',
  error: '#FF3B30',
  errorDark: '#FF453A',
  info: '#5AC8FA',
  infoDark: '#64D2FF',
} as const;

// ── Theme Definitions ──────────────────────────────────────────

export interface ThemeColors {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceElevated: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Accent
  accent: string;
  accentLight: string;
  accentDark: string;
  accentSurface: string;

  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;

  // Borders & dividers
  border: string;
  borderLight: string;
  divider: string;

  // Tab bar
  tabBar: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;

  // Status bar
  statusBar: 'light' | 'dark';
}

export const lightColors: ThemeColors = {
  background: palette.gray50,
  backgroundSecondary: palette.white,
  backgroundTertiary: palette.gray100,
  surface: palette.white,
  surfaceElevated: palette.white,

  textPrimary: palette.gray900,
  textSecondary: palette.gray600,
  textTertiary: palette.gray400,
  textInverse: palette.white,

  accent: palette.indigo600,
  accentLight: palette.indigo100,
  accentDark: palette.indigo800,
  accentSurface: palette.indigo50,

  success: palette.success,
  warning: palette.warning,
  error: palette.error,
  info: palette.info,

  border: palette.gray200,
  borderLight: palette.gray100,
  divider: palette.gray200,

  tabBar: palette.white,
  tabBarBorder: palette.gray200,
  tabActive: palette.indigo600,
  tabInactive: palette.gray400,

  statusBar: 'dark',
};

export const darkColors: ThemeColors = {
  background: palette.gray950,
  backgroundSecondary: palette.gray900,
  backgroundTertiary: palette.gray850,
  surface: palette.gray850,
  surfaceElevated: palette.gray800,

  textPrimary: palette.gray100,
  textSecondary: palette.gray400,
  textTertiary: palette.gray600,
  textInverse: palette.gray900,

  accent: palette.indigo400,
  accentLight: palette.indigo900,
  accentDark: palette.indigo300,
  accentSurface: '#1a1a2e',

  success: palette.successDark,
  warning: palette.warningDark,
  error: palette.errorDark,
  info: palette.infoDark,

  border: palette.gray700,
  borderLight: palette.gray800,
  divider: palette.gray800,

  tabBar: palette.gray900,
  tabBarBorder: palette.gray800,
  tabActive: palette.indigo400,
  tabInactive: palette.gray600,

  statusBar: 'light',
};

// ── Typography ─────────────────────────────────────────────────

export const typography = {
  // Font families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },

  // Font sizes (accessible: minimum 12px, body 16px)
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Font weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
} as const;

// ── Spacing Scale ──────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

// ── Border Radius ──────────────────────────────────────────────

export const radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
} as const;

// ── Shadows ────────────────────────────────────────────────────

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

// ── Animation ──────────────────────────────────────────────────

export const animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// ── Touch Targets ──────────────────────────────────────────────

export const touchTargets = {
  /** Minimum touch target size per Android Material guidelines: 48dp */
  minimum: 48,
  /** Comfortable touch target: 56dp */
  comfortable: 56,
} as const;

// ── Priority Colors ────────────────────────────────────────────

export const priorityColors = {
  light: {
    LOW: { bg: palette.gray100, text: palette.gray600, border: palette.gray300 },
    MEDIUM: { bg: palette.indigo50, text: palette.indigo600, border: palette.indigo200 },
    HIGH: { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
    IMPORTANT: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  },
  dark: {
    LOW: { bg: palette.gray800, text: palette.gray400, border: palette.gray700 },
    MEDIUM: { bg: '#1a1a2e', text: palette.indigo400, border: palette.indigo900 },
    HIGH: { bg: '#1c1410', text: '#FB923C', border: '#7C2D12' },
    IMPORTANT: { bg: '#1c1414', text: '#F87171', border: '#7F1D1D' },
  },
} as const;

// ── Status Colors ──────────────────────────────────────────────

export const statusColors = {
  light: {
    PENDING: { bg: palette.gray100, text: palette.gray600 },
    IN_PROGRESS: { bg: palette.indigo50, text: palette.indigo600 },
    COMPLETED: { bg: '#F0FDF4', text: '#16A34A' },
    CANCELLED: { bg: palette.gray100, text: palette.gray400 },
  },
  dark: {
    PENDING: { bg: palette.gray800, text: palette.gray400 },
    IN_PROGRESS: { bg: '#1a1a2e', text: palette.indigo400 },
    COMPLETED: { bg: '#052e16', text: '#4ADE80' },
    CANCELLED: { bg: palette.gray800, text: palette.gray600 },
  },
} as const;

// ── Energy Colors ──────────────────────────────────────────────

export const energyColors = {
  light: {
    LOW: { bg: '#F0FDF4', text: '#16A34A' },
    MEDIUM: { bg: '#FFFBEB', text: '#D97706' },
    HIGH: { bg: '#FEF2F2', text: '#DC2626' },
  },
  dark: {
    LOW: { bg: '#052e16', text: '#4ADE80' },
    MEDIUM: { bg: '#1c1a10', text: '#FBBF24' },
    HIGH: { bg: '#1c1414', text: '#F87171' },
  },
} as const;
