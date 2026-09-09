export type ThemeId = 'fun' | 'mild' | 'crazy' | 'night'

export type ThemeMeta = {
  id: ThemeId
  label: string
  tagline: string
  swatches: [string, string, string, string, string]
  emoji: string
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'fun',
    label: 'Fun',
    tagline: 'Playful and warm',
    swatches: ['#FF6B35', '#FFB347', '#7C3AED', '#EC4899', '#06B6D4'],
    emoji: '🎉',
  },
  {
    id: 'mild',
    label: 'Mild',
    tagline: 'Calm and focused',
    swatches: ['#6366F1', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6'],
    emoji: '🍃',
  },
  {
    id: 'crazy',
    label: 'Crazy',
    tagline: 'Bold and electric',
    swatches: ['#A3E635', '#FACC15', '#F43F5E', '#8B5CF6', '#06B6D4'],
    emoji: '⚡',
  },
  {
    id: 'night',
    label: 'Night',
    tagline: 'Deep and sleek',
    swatches: ['#818CF8', '#FBBF24', '#F472B6', '#34D399', '#22D3EE'],
    emoji: '🌙',
  },
]
