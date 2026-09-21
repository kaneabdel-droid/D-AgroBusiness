'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getContexte } from '@/lib/session'
import { estDuree, estNiveau, montantAbonnement, NIVEAUX } from '@/lib/abonnement'
import { initiateBictorysPayment } from '@/lib/payments/bictorys'
import { initiateMonerooPayment } from '@/lib/payments/moneroo'
import { initiateChariowPayment } from '@/lib/payments/chariow'
import { siteUrl } from '@/lib/payments/config'
import { moyensDisponibles, produitChariow } from '@/lib/payments/moyens'

export type MoyenPaiement = 'wave' | 'orange' | 'carte' | 'chariow'
type Resultat = { ok: true; checkoutUrl: string } | { ok: false; error: string }

const PROVIDER = { wave: 'bictorys', orange: 'bictorys', carte: 'moneroo', chariow: 'chariow' } as const

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
  if (!(await moyensDisponibles()).includes(moyen)) return { ok: false, error: 'Ce moyen de paiement n’est pas encore configuré.' }

  const montant = montantAbonnement(niveau, mois)
  let produit: string | null = null
  if (moyen === 'chariow') {
    produit = await produitChariow(niveau, mois, montant)
    if (!produit) return { ok: false, error: 'Chariow n’est pas configuré pour ce montant.' }
    if (!telephone?.replace(/\D/g, '')) return { ok: false, error: 'Indiquez votre numéro de téléphone.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié' }

  const admin = createAdminClient()
  const { data: paiement, error } = await admin
    .from('abonnement_paiements')
    .insert({ organisation_id: ctx.organisationId, niveau, mois, montant, provider: PROVIDER[moyen], moyen_paiement: moyen, created_by: user.id })
    .select('id')
    .single()
  if (error || !paiement) return { ok: false, error: 'Impossible d’initier le paiement' }

  const retour = `${siteUrl}/abonnement/retour?ref=${paiement.id}`
  const description = `Abonnement D-AGROBUSINESS ${NIVEAUX[niveau].nom} — ${mois} mois`
  const base = { amount: montant, currency: 'XOF' as const, description, reference: paiement.id, returnUrl: retour, cancelUrl: retour, customerEmail: user.email ?? '', customerName: ctx.nomComplet ?? undefined, country: ctx.pays }

  const res =
    moyen === 'carte' ? await initiateMonerooPayment(base)
    : moyen === 'chariow'
      ? await initiateChariowPayment({ productId: produit!, montantAttendu: montant, reference: paiement.id, phoneLocal: telephone!, phoneCountry: ctx.pays, customerEmail: user.email ?? '', customerName: ctx.nomComplet ?? undefined, returnUrl: retour })
      : await initiateBictorysPayment({ ...base, customerPhone: telephone })

  if (!res.ok) {
    await admin.from('abonnement_paiements').update({ statut: 'failed', updated_at: new Date().toISOString() }).eq('id', paiement.id)
    return { ok: false, error: res.error }
  }
  await admin.from('abonnement_paiements').update({ provider_reference: res.providerTransactionId }).eq('id', paiement.id)
  return { ok: true, checkoutUrl: res.checkoutUrl }
}
