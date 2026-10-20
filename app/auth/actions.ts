'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { siteUrl } from '@/lib/payments/config'
import { pageSuivante } from '@/lib/suite'
import { resoudreAuthEmail } from '@/lib/auth-identifier'

export type LoginActionResult = {
  success?: string
  error?: string
  redirectUrl?: string
  userContext?: {
    userId: string
    nomComplet?: string | null
    identifiant: string
    telephone?: string | null
    email?: string | null
    role: string
    organisationId: string
    organisationNom: string
    gieId?: string
    gieNom?: string
    devise?: string
    permissions?: any
  }
}

export async function signIn(formData: FormData): Promise<LoginActionResult> {
  const t = creerT(await langueNavigateur())
  const rawInput = String(formData.get('email') ?? formData.get('identifier') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!rawInput) return { error: t('Veuillez renseigner votre identifiant, téléphone ou e-mail.') }
  if (!password) return { error: t('Veuillez saisir votre mot de passe.') }

  let resolvedEmail = rawInput
  try {
    const adminSupabase = createAdminClient()
    const resolved = await resoudreAuthEmail(rawInput, adminSupabase)
    resolvedEmail = resolved.email
  } catch {
    resolvedEmail = rawInput
  }

  const supabase = await createClient()
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  })

  if (error || !signInData?.user) {
    return { error: t('Email, identifiant ou mot de passe incorrect.') }
  }

  let userContext: LoginActionResult['userContext']
  try {
    const { data: userProfile } = await supabase
      .from('utilisateurs')
      .select('id, identifiant, telephone, nom_complet, role, organisation_id, organisations(nom, devise)')
      .eq('id', signInData.user.id)
      .maybeSingle()

    if (userProfile) {
      const org = Array.isArray(userProfile.organisations) ? userProfile.organisations[0] : userProfile.organisations
      userContext = {
        userId: userProfile.id,
        nomComplet: userProfile.nom_complet || null,
        identifiant: userProfile.identifiant || rawInput,
        telephone: userProfile.telephone || null,
        email: signInData.user.email || null,
        role: userProfile.role || 'collaborateur',
        organisationId: userProfile.organisation_id,
        organisationNom: org?.nom || 'Mon Entreprise',
        gieId: userProfile.organisation_id,
        gieNom: org?.nom || 'Mon Entreprise',
        devise: org?.devise || 'FCFA',
      }
    }
  } catch (err) {
    console.warn('Erreur récupération profil utilisateur pour cache hors-ligne D-AGROBUSINESS:', err)
  }

  return {
    success: t('Connexion réussie !'),
    redirectUrl: pageSuivante(formData.get('suite')) ?? '/',
    userContext,
  }
}

export async function signUp(formData: FormData) {
  const t = creerT(await langueNavigateur())
  const organisation = String(formData.get('organisation') ?? '').trim()
  const nomComplet = String(formData.get('nom_complet') ?? '').trim()
  const pays = String(formData.get('pays') ?? 'SN')
  const password = String(formData.get('password') ?? '')
  // Inscription depuis une carte de tarifs : la page de paiement du niveau choisi s'ouvre juste après (ou après la confirmation
  // de l'adresse email). Une personne invitée rejoint une organisation existante : elle n'a rien à payer.
  const suite = organisation ? pageSuivante(formData.get('suite')) : null

  const email = String(formData.get('email') ?? '').trim()
  if (!nomComplet) return { error: t('Tous les champs sont obligatoires.') }
  if (password.length < 8) return { error: t('Le mot de passe doit contenir au moins 8 caractères.') }

  const supabase = await createClient()
  // sans nom d'entreprise, la personne rejoint l'organisation qui l'a invitée : une invitation doit l'attendre
  if (!organisation) {
    const { data: invitee } = await supabase.rpc('invitation_en_attente', { p_email: email })
    if (!invitee) return { error: t('Aucune invitation en attente pour cette adresse : indiquez le nom de votre entreprise pour créer un compte.') }
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: organisation ? { organisation_nom: organisation, nom_complet: nomComplet, pays } : { nom_complet: nomComplet },
      // Le lien de confirmation passe par /auth/callback, qui ouvre la session puis la page suivante (paiement le cas échéant).
      emailRedirectTo: `${siteUrl}/auth/callback?suite=${encodeURIComponent(suite ?? '/')}`,
    },
  })
  if (error) return { error: error.message }

  // Confirmation d'email activée : pas de session immédiate.
  if (!data.session) {
    return {
      success: suite
        ? t('Compte créé. Vérifiez votre boîte mail : le lien de confirmation vous mènera au paiement de votre abonnement.')
        : t('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.'),
    }
  }
  redirect(suite ?? '/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/bienvenue')
}
