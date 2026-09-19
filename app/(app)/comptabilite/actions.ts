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
