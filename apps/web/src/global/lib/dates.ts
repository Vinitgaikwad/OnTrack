import { format } from 'date-fns'

export const DATE_KEY = 'yyyy-MM-dd'

export function todayKey(): string {
  return format(new Date(), DATE_KEY)
}