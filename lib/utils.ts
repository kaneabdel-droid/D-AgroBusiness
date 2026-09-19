import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { LOCALES, type Lang } from '@/lib/i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMontant(valeur: number | string | null | undefined, devise = 'XOF', lang: Lang = 'fr') {
  const n = Number(valeur ?? 0)
  const decimales = devise === 'XOF' ? 0 : 2
  return `${n.toLocaleString(LOCALES[lang], {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })} ${devise}`
}

export function formatDate(iso: string | null | undefined, lang: Lang = 'fr') {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(LOCALES[lang])
}
