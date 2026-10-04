'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getContexte } from '@/lib/session'
import { estDuree, estNiveau, montantAbonnement, NIVEAUX } from '@/lib/abonnement'
import { initiateBictorysPayment } from '@/lib/payments/bictorys'
import { initiateMonerooPayment } from '@/lib/payments/moneroo'
import { initiateChariowPayment } from '@/lib/payments/chariow'
import { initiateMaketouPayment } from '@/lib/payments/maketou'
import { siteUrl } from '@/lib/payments/config'
import { moyensDisponibles, produitChariow } from '@/lib/payments/moyens'

export type MoyenPaiement = 'wave' | 'carte' | 'chariow' | 'maketou'
type Resultat = { ok: true; checkoutUrl: string } | { ok: false; error: string }

const PROVIDER = { wave: 'bictorys', carte: 'moneroo', chariow: 'chariow', maketou: 'maketou' } as const

/** Crée un paiement en attente puis renvoie l'adresse de la page de paiement du prestataire. Le montant est toujours recalculé côté serveur. */
export async function initierPaiement(niveau: string, mois: number, moyen: MoyenPaiement, telephone?: string): Promise<Resultat> {
  const ctx = await getContexte()
  if (!['admin', 'direction'].includes(ctx.role)) return { ok: false, error: 'Droits insuffisants pour cette opération.' }
  if (!estNiveau(niveau) || !estDuree(mois) || !(moyen in PROVIDER)) return { ok: false, error: 'Offre inconnue' }

  const e = ctx.abonnement
  const paye = e.abonnementExpireLe && e.abonnementExpireLe > new Date()
  if (paye && e.niveau !== niveau) {
    return { ok: false, error: 'Changement de niveau impossible pendant un abonnement payé : il sera possible à son échéance.' }
  }
  // Anti double paiement (1/2) : le même niveau ne se renouvelle qu'à l'approche de l'échéance — payer plus tôt est presque
  // toujours un double paiement involontaire (fausse les ventes, oblige à rembourser).
  if (paye && e.abonnementExpireLe) {
    const ouverture = new Date(e.abonnementExpireLe.getTime() - FENETRE_RENOUVELLEMENT_JOURS * 86_400_000)
    if (ouverture > new Date()) {
      // dates chiffrées (jj/mm/aaaa) : lisibles dans les trois langues, le message est traduit par motif (cf. lib/i18n.ts)
      return { ok: false, error: `Votre abonnement est déjà payé jusqu’au ${dateCourte(e.abonnementExpireLe)}. Le renouvellement sera possible à partir du ${dateCourte(ouverture)}.` }
    }
  }
  if (!(await moyensDisponibles()).includes(moyen)) return { ok: false, error: 'Ce moyen de paiement n’est pas encore configuré.' }

  const montant = montantAbonnement(niveau, mois)
  let produit: string | null = null
  if (moyen === 'chariow') {
    produit = await produitChariow(niveau, mois, montant)
    if (!produit) return { ok: false, error: 'Chariow n’est pas configuré pour ce montant.' }
    if (!telephone?.replace(/\\D/g, '')) return { ok: false, error: 'Indiquez votre numéro de téléphone.' }
  } else if (moyen === 'maketou') {
    const admin = createAdminClient()
    const { data: mProd } = await admin.from('maketou_produits').select('product_id').eq('niveau', niveau).eq('mois', mois).maybeSingle()
    produit = mProd?.product_id || process.env[\`MAKETOU_PRODUCT_\${niveau.toUpperCase()}_\${mois}\`] || null
    if (!produit) return { ok: false, error: 'Maketou n’est pas configuré pour cette offre.' }
    if (!telephone?.replace(/\\D/g, '')) return { ok: false, error: 'Indiquez votre numéro de téléphone.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié' }

  // Anti double paiement (2/2) : relancer la même offre renvoie vers le paiement déjà ouvert (double clic, second onglet...).
  const offre = { niveau, mois, moyen, montant }
  const reutilisable = await paiementEnCoursReutilisable(ctx.organisationId, offre)
  if (reutilisable) return reutilisable

  const admin = createAdminClient()
  const { data: paiement, error } = await admin
    .from('abonnement_paiements')
    .insert({ organisation_id: ctx.organisationId, niveau, mois, montant, provider: PROVIDER[moyen], moyen_paiement: moyen, created_by: user.id })
    .select('id')
    .single()
  if (error || !paiement) {
    // 23505 = index unique « un paiement en cours par organisation » : une requête concurrente vient d'en créer un.
    if (error?.code === '23505') {
      const concurrent = await paiementEnCoursReutilisable(ctx.organisationId, offre)
      if (concurrent) return concurrent
      return { ok: false, error: 'Un paiement est déjà en cours. Patientez quelques secondes puis réessayez.' }
    }
    return { ok: false, error: 'Impossible d’initier le paiement' }
  }

  const retour = `${siteUrl}/abonnement/retour?ref=${paiement.id}`
  const description = `Abonnement D-AGROBUSINESS ${NIVEAUX[niveau].nom} — ${mois} mois`
  const base = { amount: montant, currency: 'XOF' as const, description, reference: paiement.id, returnUrl: retour, cancelUrl: retour, customerEmail: user.email ?? '', customerName: ctx.nomComplet ?? undefined, country: ctx.pays }

  const res =
    moyen === 'carte' ? await initiateMonerooPayment(base)
    : moyen === 'chariow'
      ? await initiateChariowPayment({ productId: produit!, montantAttendu: montant, reference: paiement.id, phoneLocal: telephone!, phoneCountry: ctx.pays, customerEmail: user.email ?? '', customerName: ctx.nomComplet ?? undefined, returnUrl: retour })
    : moyen === 'maketou'
      ? await initiateMaketouPayment({ productId: produit!, montantAttendu: montant, reference: paiement.id, phoneLocal: telephone!, countryCode: ctx.pays, customerEmail: user.email ?? '', customerName: ctx.nomComplet ?? undefined, returnUrl: retour })
      : await initiateBictorysPayment({ ...base, customerPhone: telephone })

  if (!res.ok) {
    await admin.from('abonnement_paiements').update({ statut: 'failed', updated_at: new Date().toISOString() }).eq('id', paiement.id)
    return { ok: false, error: res.error }
  }
  await admin.from('abonnement_paiements').update({ provider_reference: res.providerTransactionId, checkout_url: res.checkoutUrl }).eq('id', paiement.id)
  return { ok: true, checkoutUrl: res.checkoutUrl }
}

const FENETRE_RENOUVELLEMENT_JOURS = 15
// Au-delà, une page de paiement prestataire est considérée expirée : on en ouvre une nouvelle.
const DUREE_REUTILISATION_MS = 30 * 60 * 1000

const dateCourte = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })

/**
 * Paiement en ligne en cours de l'organisation (au plus un, cf. migration 42) : même offre et encore récent → renvoyé tel quel ;
 * sinon marqué abandonné (il reste 'pending' : payé plus tard, il sera traité et marqué doublon si besoin) pour en créer un neuf.
 */
async function paiementEnCoursReutilisable(
  organisationId: string,
  offre: { niveau: string; mois: number; moyen: MoyenPaiement; montant: number }
): Promise<Resultat | null> {
  const admin = createAdminClient()
  const { data: enCours } = await admin
    .from('abonnement_paiements')
    .select('id, niveau, mois, moyen_paiement, montant, checkout_url, created_at')
    .eq('organisation_id', organisationId)
    .eq('statut', 'pending')
    .is('abandonne_le', null)
    .neq('provider', 'manuel')
    .maybeSingle()
  if (!enCours) return null

  const memeOffre =
    enCours.niveau === offre.niveau && enCours.mois === offre.mois && enCours.moyen_paiement === offre.moyen && Number(enCours.montant) === offre.montant
  const recent = Date.now() - new Date(enCours.created_at).getTime() < DUREE_REUTILISATION_MS
  if (memeOffre && recent && enCours.checkout_url) return { ok: true, checkoutUrl: enCours.checkout_url }

  await admin.from('abonnement_paiements').update({ abandonne_le: new Date().toISOString() }).eq('id', enCours.id)
  return null
}
