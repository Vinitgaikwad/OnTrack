export type ThemeId = 'joy' | 'zen' | 'midnight'

export type ThemeMeta = {
  id: ThemeId
  label: string
  tagline: string
  swatches: [string, string, string, string, string]
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'joy',
    label: 'Joy',
    tagline: 'Warm and vibrant',
    swatches: ['#FF5C39', '#E8963D', '#8B5CF6', '#EC4899', '#0EA5E9'],
  },
  {
    id: 'zen',
    label: 'Zen',
    tagline: 'Clean and focused',
    swatches: ['#4263EB', '#D9480F', '#7048E8', '#C2255C', '#0C8599'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    tagline: 'Deep and electric',
    swatches: ['#818CF8', '#FBBF24', '#A78BFA', '#F472B6', '#22D3EE'],
  },
]