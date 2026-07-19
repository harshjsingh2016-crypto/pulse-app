// Design system tokens — warm notebook aesthetic
export const Colors = {
  // Core palette
  ink: '#1C1612',
  paper: '#F5F0E8',
  paperWarm: '#EAE2D0',
  paperRuled: '#E6DFD0',
  ruledLine: '#D4CBB8',

  // Accent (leather/tan)
  accent: '#7C5C38',
  accentWarm: '#A0724A',
  accentLight: '#C4956A',

  // Semantic
  sage: '#4A7C5C',      // done / success
  vermilion: '#B85450', // critical / error
  amber: '#C4956A',     // warning (shares tan)
  blue: '#3A5C82',      // info

  // Text
  textBody: '#2C2418',
  textMid: '#6B5C44',
  textFaint: '#9C8C74',
  textMargin: '#B8A890',
  border: '#C8BCA8',

  // Dark mode surfaces
  darkBg: '#1C1612',
  darkSurface: '#2A2018',
  darkText: '#F0E8D8',
} as const;

export const DarkColors = {
  ink: '#F0E8D8',
  paper: '#1C1612',
  paperWarm: '#2A2018',
  paperRuled: '#33271C',
  ruledLine: '#3D2E1E',
  accent: '#C4956A',
  accentWarm: '#A0724A',
  accentLight: '#D4A87A',
  sage: '#5A9C6C',
  vermilion: '#C86460',
  amber: '#C4956A',
  blue: '#5A7CA2',
  textBody: '#F0E8D8',
  textMid: '#C4B49A',
  textFaint: '#8C7C64',
  textMargin: '#6C5C44',
  border: '#3D2E1E',
  darkBg: '#1C1612',
  darkSurface: '#2A2018',
  darkText: '#F0E8D8',
} as const;

export const Typography = {
  // Font families
  display: 'Lora_600SemiBold',
  displayItalic: 'Lora_400Regular_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',

  // Font sizes
  size: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 36,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
    loose: 2,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 100,
} as const;
