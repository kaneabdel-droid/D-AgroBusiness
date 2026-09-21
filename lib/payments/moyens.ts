import { createAdminClient } from '@/utils/supabase/admin'
import { chariowProduitPour, hasBictorysKeys, hasChariowKeys, hasMonerooKeys } from './config'

export type Moyen = 'wave' | 'orange' | 'carte' | 'chariow'

/** Clés présentes sur le serveur pour chaque moyen de paiement. */
export const clesPresentes: Record<Moyen, boolean> = {
  wave: hasBictorysKeys,
  orange: hasBictorysKeys,
  carte: hasMonerooKeys,
  chariow: hasChariowKeys,
}

/** Moyens activés par le super-administrateur (table paiement_moyens). En cas d'erreur de lecture, seul Chariow est proposé. */
export async function moyensActivesEnBase(): Promise<Moyen[]> {
  try {
    const { data, error } = await createAdminClient().from('paiement_moyens').select('moyen, actif')
    if (error || !data) return ['chariow']
    return data.filter((m) => m.actif).map((m) => m.moyen as Moyen)
  } catch {
    return ['chariow']
  }
}

/** Moyens réellement proposés aux clients : activés dans l'espace admin ET clés présentes. */
export async function moyensDisponibles(): Promise<Moyen[]> {
  const actifs = await moyensActivesEnBase()
  return actifs.filter((m) => clesPresentes[m])
}

/** Produit Chariow d'un niveau et d'une durée : table gérée depuis /admin/config, sinon variables d'environnement. */
export async function produitChariow(niveau: string, mois: number, montant: number): Promise<string | null> {
  try {
    const { data } = await createAdminClient().from('chariow_produits').select('product_id').eq('niveau', niveau).eq('mois', mois).maybeSingle()
    if (data?.product_id) return data.product_id
  } catch {
    // repli sur l'environnement
  }
  return chariowProduitPour(niveau, mois, montant)
}
