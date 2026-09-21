'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { refuserSiNonAdmin } from '@/lib/admin/garde'
import { estDuree, estNiveau } from '@/lib/abonnement'

type Resultat = { success: true } | { error: string }
const MOYENS = ['wave', 'orange', 'carte', 'chariow']

/** Active ou désactive un moyen de paiement pour les clients (il faut aussi que ses clés soient présentes sur le serveur). */
export async function basculerMoyen(moyen: string, actif: boolean): Promise<Resultat> {
  const refus = await refuserSiNonAdmin()
  if (refus) return { error: refus }
  if (!MOYENS.includes(moyen)) return { error: 'Moyen de paiement inconnu' }
  const { error } = await createAdminClient().from('paiement_moyens').update({ actif, updated_at: new Date().toISOString() }).eq('moyen', moyen)
  if (error) return { error: error.message }
  revalidatePath('/admin/config')
  revalidatePath('/abonnement')
  return { success: true }
}

/** Associe un produit Chariow à un niveau et une durée ; un identifiant vide supprime l'association. */
export async function enregistrerProduitChariow(niveau: string, mois: number, productId: string): Promise<Resultat> {
  const refus = await refuserSiNonAdmin()
  if (refus) return { error: refus }
  if (!estNiveau(niveau) || !estDuree(mois)) return { error: 'Offre inconnue' }
  const admin = createAdminClient()
  const id = productId.trim()
  const { error } = id
    ? await admin.from('chariow_produits').upsert({ niveau, mois, product_id: id, updated_at: new Date().toISOString() })
    : await admin.from('chariow_produits').delete().eq('niveau', niveau).eq('mois', mois)
  if (error) return { error: error.message }
  revalidatePath('/admin/config')
  return { success: true }
}
