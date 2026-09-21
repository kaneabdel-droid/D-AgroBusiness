import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { langDe, type Lang } from '@/lib/i18n'
import { langueChoisie } from '@/lib/i18n-server'
import { accesRh, accesUsine, estNiveau, type EtatAbonnement } from '@/lib/abonnement'

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
  abonnement: EtatAbonnement
  accesRh: boolean
  accesUsine: boolean
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
    .select('nom_complet, role, actif, organisation_id, organisations(nom, devise, referentiel, pays, niveau, essai_expire_le, abonnement_expire_le, compte_verrouille)')
    .eq('id', user.id)
    .maybeSingle()

  if (!data || !data.actif) redirect('/login?erreur=organisation')

  const org = Array.isArray(data.organisations) ? data.organisations[0] : data.organisations
  const abonnement: EtatAbonnement = {
    niveau: estNiveau(org?.niveau) ? org.niveau : 'standard',
    essaiExpireLe: new Date(org?.essai_expire_le ?? 0),
    abonnementExpireLe: org?.abonnement_expire_le ? new Date(org.abonnement_expire_le) : null,
    verrouille: Boolean(org?.compte_verrouille),
  }
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
    lang: (await langueChoisie()) ?? langDe(org?.pays),
    abonnement,
    accesRh: accesRh(abonnement),
    accesUsine: accesUsine(abonnement),
  }
})

export const ROLES_ECRITURE_COMPTA = ['admin', 'comptable']
