import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'

export type EnteteEntreprise = {
  nom: string
  nif: string | null
  rccm: string | null
  adresse: string | null
  telephone: string | null
  email: string | null
}

/** Coordonnées de l'entreprise, imprimées en en-tête des factures et des relevés de compte (Administration → Entreprise). */
export const chargerEntete = cache(async (organisationId: string): Promise<EnteteEntreprise> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organisations')
    .select('nom, nif, rccm, adresse, telephone, email')
    .eq('id', organisationId)
    .maybeSingle()
  return {
    nom: data?.nom ?? '',
    nif: data?.nif ?? null,
    rccm: data?.rccm ?? null,
    adresse: data?.adresse ?? null,
    telephone: data?.telephone ?? null,
    email: data?.email ?? null,
  }
})
