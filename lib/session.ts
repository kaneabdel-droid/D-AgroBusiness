import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { langDe, type Lang } from '@/lib/i18n'

export type Contexte = {
  userId: string
  email: string | undefined
  nomComplet: string | null
  role: string
  organisationId: string
  organisationNom: string
  devise: string
  referentiel: string
  pays: string
  lang: Lang
}

/** Contexte de l'utilisateur connecté (une requête par rendu grâce à cache). */
export const getContexte = cache(async (): Promise<Contexte> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('utilisateurs')
    .select('nom_complet, role, actif, organisation_id, organisations(nom, devise, referentiel, pays)')
    .eq('id', user.id)
    .maybeSingle()

  if (!data || !data.actif) redirect('/login?erreur=organisation')

  const org = Array.isArray(data.organisations) ? data.organisations[0] : data.organisations
  return {
    userId: user.id,
    email: user.email,
    nomComplet: data.nom_complet,
    role: data.role,
    organisationId: data.organisation_id,
    organisationNom: org?.nom ?? '',
    devise: org?.devise ?? 'XOF',
    referentiel: org?.referentiel ?? 'SYSCOHADA',
    pays: org?.pays ?? 'SN',
    lang: langDe(org?.pays),
  }
})

export const ROLES_ECRITURE_COMPTA = ['admin', 'comptable']
