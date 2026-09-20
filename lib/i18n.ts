import { EN } from '@/lib/i18n-en'
import { AR } from '@/lib/i18n-ar'

/**
 * Traduction de l'interface. Les textes sources sont en français et servent de clés : `t('Tableau de bord')`.
 * Une clé absente du dictionnaire anglais s'affiche telle quelle (français) — une traduction manquante ne casse jamais l'écran.
 * Marqueurs {nom} remplacés par les valeurs fournies : `t('{n} employé(s)', { n: 3 })`.
 */
export type Lang = 'fr' | 'en' | 'ar'

/** Langues de l'interface, dans l'ordre d'affichage du sélecteur (le nom de chaque langue s'écrit dans cette langue). */
export const LANGUES: { code: Lang; nom: string }[] = [
  { code: 'fr', nom: 'Français' },
  { code: 'en', nom: 'English' },
  { code: 'ar', nom: 'العربية' },
]

export const estLang = (v: string | null | undefined): v is Lang => v === 'fr' || v === 'en' || v === 'ar'

/** L'arabe s'écrit de droite à gauche. */
export const estRtl = (lang: Lang) => lang === 'ar'

/** Pays dont l'interface s'affiche en anglais par défaut (l'utilisateur peut toujours choisir sa langue). */
const PAYS_ANGLOPHONES = ['GH', 'NG', 'GM']

export function langDe(pays: string | null | undefined): Lang {
  return PAYS_ANGLOPHONES.includes((pays ?? '').toUpperCase()) ? 'en' : 'fr'
}

export type Traducteur = (texte: string, vars?: Record<string, string | number>) => string

export function creerT(lang: Lang): Traducteur {
  return (texte, vars) => {
    // Une traduction manquante retombe sur l'anglais puis sur le français : l'écran ne casse jamais.
    const resultat = lang === 'ar' ? (AR[texte] ?? EN[texte] ?? texte) : lang === 'en' ? (EN[texte] ?? texte) : texte
    return vars ? resultat.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : resultat
  }
}

/** Locale utilisée pour les nombres et les dates. */
export const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-u-nu-latn' }   // chiffres latins en arabe

/**
 * Libellés de lignes de bulletin fabriqués par la base de données (« … (part employeur) », « Impôt sur le revenu (2 parts, calcul
 * mensuel) », « TRIMF (2 personne(s)) ») : traduits en recomposant leurs éléments.
 */
export function traduireLibelle(t: Traducteur, libelle: string): string {
  const suffixe = ' (part employeur)'
  if (libelle.endsWith(suffixe)) return t(libelle.slice(0, -suffixe.length)) + ' ' + t('(part employeur)')
  const ir = libelle.match(/^Impôt sur le revenu \((.+) parts, (calcul|barème) (\w+)\)$/)
  if (ir) return t('Impôt sur le revenu') + ' (' + ir[1] + ' ' + t('parts') + ', ' + t(ir[2]) + ' ' + t(ir[3]) + ')'
  const trimf = libelle.match(/^TRIMF \((\d+) personne\(s\)\)$/)
  if (trimf) return t('TRIMF ({n} personne(s))', { n: trimf[1] })
  return t(libelle)
}
