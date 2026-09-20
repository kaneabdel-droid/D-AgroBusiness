import type { Lang } from '@/lib/i18n'
import { estRtl } from '@/lib/i18n'

type Cellule = string | number | null | undefined

const echapper = (v: Cellule) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Impression via le navigateur (« Enregistrer au format PDF »). La bibliothèque PDF embarquée ne sait ni relier les lettres arabes
 * ni écrire de droite à gauche : le navigateur, lui, le fait nativement. Utilisé pour l'arabe.
 */
export function imprimerHtml(titre: string, corps: string, lang: Lang) {
  const w = window.open('', '_blank')
  if (!w) return false
  const dir = estRtl(lang) ? 'rtl' : 'ltr'
  w.document.write(`<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${echapper(titre)}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 16px 0 6px; }
  p { margin: 2px 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  th { background: #1e5631; color: #fff; padding: 6px; text-align: start; }
  td { border-bottom: 1px solid #ccc; padding: 5px 6px; }
  td.n, th.n { text-align: end; direction: ltr; unicode-bidi: plaintext; }
  tr.section td { background: #e6ece9; font-weight: bold; }
  .total { margin-top: 12px; font-size: 13px; } .net { font-size: 16px; font-weight: bold; }
  @media print { body { margin: 8mm; } }
</style></head><body>${corps}</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
  return true
}

/** Tableau HTML : les colonnes numériques (n) sont alignées en fin de cellule. */
export function tableauHtml(colonnes: string[], lignes: Cellule[][]) {
  const numerique = (v: Cellule) => typeof v === 'number'
  const tete = colonnes.map((c) => `<th>${echapper(c)}</th>`).join('')
  const corps = lignes
    .map((l) => `<tr>${l.map((v) => `<td${numerique(v) ? ' class="n"' : ''}>${echapper(v)}</td>`).join('')}</tr>`)
    .join('')
  return `<table><thead><tr>${tete}</tr></thead><tbody>${corps}</tbody></table>`
}

export { echapper }
