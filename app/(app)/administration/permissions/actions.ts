'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import type { Matrice } from '@/lib/permissions'

type Resultat = { success: true } | { error: string }

/** L'écriture est de toute façon bloquée par la policy RLS (admin seul) : la vérification ici évite un aller-retour inutile. */
export async function enregistrerPermissions(matrice: Matrice): Promise<Resultat> {
  const ctx = await getContexte()
  if (ctx.role !== 'admin') return { error: 'Droits insuffisants pour cette opération.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('parametres_permissions')
    .upsert({ organisation_id: ctx.organisationId, matrice, updated_par: ctx.userId, updated_at: new Date().toISOString() })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
