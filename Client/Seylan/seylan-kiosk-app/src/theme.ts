/**
 * Emojot brand theme, taken from emojot.com (Elementor global colours and
 * custom CSS): near-black canvas, white type, pink accent, neon purple and a
 * blue gradient for highlights. Typeface: Inter.
 */
export const colors = {
  background: '#010101', // --e-global-color-primary
  surface: '#141414',
  surfaceRaised: '#272727',
  surfaceTint: '#363446', // purple-grey card colour used on the site
  border: 'rgba(255,255,255,0.14)',
  text: '#FFFFFF', // --e-global-color-text
  textMuted: 'rgba(255,255,255,0.7)', // --e-global-color-87e7071
  textFaint: 'rgba(255,255,255,0.45)',
  pink: '#D83482', // --e-global-color-accent (buttons, links)
  purple: '#C332E1', // .purple highlight / chat widget primary
  violet: '#7D46EF',
  blue: '#61B7E5', // highlight gradient start
  blueDeep: '#337ABB', // highlight gradient end

  // Seylan Bank (sampled from seylan.lk: menu bar and buttons). Used for the
  // controls that sit on Seylan's Sensor and website.
  seylanRed: '#EC1C24',
  seylanRedDeep: '#C4141B',
  seylanDark: '#231E1B', // active menu tab
  seylanDarkRaised: '#3A3431',
  seylanMenuGrey: '#6A6869', // PERSONAL | BUSINESS | CORPORATE bar
  seylanInk: '#1F1F1F',
  seylanGrey: '#6B6B6B',
  seylanLine: '#E8E8E8',
  seylanSoft: '#F3F3F3',
};

/** Neon line used under the top bar and around the warning card. */
export const neonGradient = [colors.blue, colors.violet, colors.purple, colors.pink] as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
