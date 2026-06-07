import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Łączenie klas Tailwind z rozwiązywaniem konfliktów.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
