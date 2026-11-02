'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

type Resultat = { success: true } | { error: string }

export type LigneSaisie = {
  compte_id: string
  tiers_id?: string
  libelle?: string
  debit: number
  credit: number
  departement_id?: string
  secteur_id?: string
  campagne_id?: string
}

export type EcritureSaisie = {
  journal_id: string
  date: string
  libelle: string
  reference?: string
  lignes: LigneSaisie[]
}

// Les contrôles métier (équilibre, exercice ouvert, imputation analytique, immutabilité)
// sont appliqués par la base ; on relaie simplement son message à l'utilisateur.
function messageBase(msg: string) {
  return msg.replace(/^.*?(Écriture|Aucun exercice|L'exercice|Imputation|Le secteur|Une |Cette |Droits|Journal|Compte)/, '$1')
}

export async function saisirEcriture(e: EcritureSaisie): Promise<Resultat> {
  if (!e.journal_id || !e.date || !e.libelle.trim()) {
    return { error: 'Journal, date et libellé sont obligatoires.' }
  }
  const lignes = e.lignes.filter((l) => l.compte_id && (l.debit > 0 || l.credit > 0))
  const supabase = await createClient()
  const { error } = await supabase.rpc('enregistrer_ecriture', {
    p_journal_id: e.journal_id,
    p_date: e.date,
    p_libelle: e.libelle.trim(),
    p_reference: e.reference?.trim() || null,
    p_lignes: lignes,
  })
  if (error) return { error: messageBase(error.message) }
  revalidatePath('/comptabilite', 'layout')
  return { success: true }
}



export async function contrepasserEcriture(id: string, motif: string): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('contrepasser_ecriture', {
    p_ecriture_id: id,
    p_date: new Date().toISOString().slice(0, 10),
    p_motif: motif.trim() || null,
  })
  if (error) return { error: messageBase(error.message) }
  revalidatePath('/comptabilite', 'layout')
  return { success: true }
}

export type ImportEcriturePayload = {
  journal: string
  date_ecriture: string
  numero_piece?: string
  libelle: string
  lignes: Array<{
    compte: string
    libelle?: string
    debit: number
    credit: number
  }>
}

export async function importerEcrituresBatch(ecritures: ImportEcriturePayload[]) {
  if (!ecritures || ecritures.length === 0) return { error: 'Aucune écriture à importer' }

  const supabase = await createClient()

  // 1. Charger les journaux actifs
  const { data: journaux } = await supabase
    .from('journaux')
    .select('id, code, type, libelle')
    .eq('actif', true)

  // 2. Charger les comptes comptables existants
  const { data: comptes } = await supabase
    .from('comptes_comptables')
    .select('id, numero, libelle')
    .eq('actif', true)

  const defaultJournal = journaux?.find((j) => j.type === 'operations_diverses' || j.code === 'OD') || journaux?.[0]
  if (!defaultJournal) return { error: 'Aucun journal comptable configuré' }

  let countImportees = 0

  for (const ec of ecritures) {
    const jCode = (ec.journal || '').trim().toLowerCase()
    const targetJournal =
      journaux?.find(
        (j) =>
          j.code.toLowerCase() === jCode ||
          j.type.toLowerCase() === jCode ||
          j.libelle.toLowerCase().includes(jCode)
      ) || defaultJournal

    const lignesSaisies: LigneSaisie[] = []

    for (const l of ec.lignes) {
      const cleanCompte = (l.compte || '').replace(/[^0-9]/g, '')
      let matchedCompte = comptes?.find((c) => c.numero === cleanCompte)

      if (!matchedCompte && cleanCompte.length > 2) {
        matchedCompte = comptes?.find((c) => cleanCompte.startsWith(c.numero) || c.numero.startsWith(cleanCompte.slice(0, 3)))
      }

      if (!matchedCompte && comptes && comptes.length > 0) {
        matchedCompte = comptes[0]
      }

      if (matchedCompte) {
        lignesSaisies.push({
          compte_id: matchedCompte.id,
          libelle: (l.libelle || ec.libelle || '').trim(),
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })
      }
    }

    if (lignesSaisies.length < 2) continue

    const res = await saisirEcriture({
      journal_id: targetJournal.id,
      date: ec.date_ecriture || new Date().toISOString().slice(0, 10),
      libelle: (ec.libelle || 'Écriture importée').trim(),
      reference: ec.numero_piece?.trim() || undefined,
      lignes: lignesSaisies,
    })

    if ('success' in res && res.success) {
      countImportees++
    }
  }

  revalidatePath('/comptabilite', 'layout')
  return { success: true, count: countImportees }
}



