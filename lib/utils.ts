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

/**
 * Montant formaté pour un export ou une impression PDF : séparateur de milliers par une espace normale et
 * séparateur décimal explicite (virgule ou point), jamais l'espace insécable que produit `toLocaleString` —
 * jsPDF (police Helvetica standard) ne sait pas l'afficher et laisse un caractère manquant. Par défaut, montant
 * entier (0 décimale), le standard des documents comptables en francs CFA.
 */
export function formatMontantExport(valeur: number | string | null | undefined, decimales = 0, virgule = true): string {
  const n = Number(valeur ?? 0)
  const signe = n < 0 ? '-' : ''
  const [entier, frac] = Math.abs(n).toFixed(decimales).split('.')
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return signe + groupes + (frac ? (virgule ? ',' : '.') + frac : '')
}
