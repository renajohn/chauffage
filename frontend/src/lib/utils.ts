import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTemp(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return `${value.toFixed(1)}°C`
}

export function formatHours(hours: number): string {
  if (!hours) return '0h'
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k h`
  return `${Math.round(hours)}h`
}

export function formatEnergy(kwh: number): string {
  if (!kwh) return '0 kWh'
  if (kwh >= 1000) return `${(kwh / 1000).toFixed(1)} MWh`
  return `${Math.round(kwh)} kWh`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

export function tempColor(temp: number): string {
  if (temp <= 0) return 'text-blue-600'
  if (temp <= 10) return 'text-blue-400'
  if (temp <= 20) return 'text-yellow-500'
  if (temp <= 35) return 'text-orange-500'
  return 'text-red-500'
}
