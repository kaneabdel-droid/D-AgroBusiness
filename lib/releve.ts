/**
 * Lecture d'un relevé bancaire au format CSV (séparateur ; ou ,).
 * Colonnes reconnues (en-tête obligatoire, casse et accents ignorés) :
 *   date · libelle (ou libellé, description) · reference (facultatif) · montant (signé : + entrée, − sortie)
 *   ou bien debit et credit (dans ce cas montant = credit − debit, du point de vue du client de la banque).
 * Dates : AAAA-MM-JJ ou JJ/MM/AAAA. Nombres : 1234.56, 1 234,56 ou 1.234,56.
 */
export type LigneReleve = { date: string; libelle: string; reference?: string; montant: number }

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function lireDate(v: string): string | null {
  const s = v.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return s
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

export function lireNombre(v: string): number | null {
  let s = v.replace(/[\s  ]/g, '')
  if (s === '') return 0
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function lireReleve(texte: string): { lignes: LigneReleve[] } | { erreur: string } {
  const rows = texte.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (rows.length < 2) return { erreur: 'Le fichier ne contient aucune ligne.' }
  const sep = rows[0].split(';').length >= rows[0].split(',').length ? ';' : ','
  const entete = rows[0].split(sep).map(sansAccent)
  const col = (...noms: string[]) => entete.findIndex((c) => noms.includes(c))
  const iDate = col('date', 'date operation', 'date valeur')
  const iLib = col('libelle', 'description', 'intitule')
  const iRef = col('reference', 'ref', 'numero')
  const iMontant = col('montant', 'amount')
  const iDebit = col('debit')
  const iCredit = col('credit')
  const manquantes = [iDate < 0 && 'date', iLib < 0 && 'libelle', iMontant < 0 && (iDebit < 0 || iCredit < 0) && 'montant (ou debit et credit)'].filter(Boolean)
  if (manquantes.length) return { erreur: 'Colonnes manquantes : ' + manquantes.join(', ') }

  const lignes: LigneReleve[] = []
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i].split(sep).map((x) => x.trim().replace(/^"|"$/g, ''))
    const date = lireDate(c[iDate] ?? '')
    const montant = iMontant >= 0 ? lireNombre(c[iMontant] ?? '') : (lireNombre(c[iCredit] ?? '') ?? NaN) - (lireNombre(c[iDebit] ?? '') ?? NaN)
    if (!date || montant === null || !Number.isFinite(montant)) return { erreur: `Ligne ${i + 1} invalide (date et montant attendus).` }
    if (montant === 0) continue
    lignes.push({ date, libelle: c[iLib] ?? '', reference: iRef >= 0 ? c[iRef] || undefined : undefined, montant })
  }
  if (lignes.length === 0) return { erreur: 'Le fichier ne contient aucune ligne.' }
  return { lignes }
}
