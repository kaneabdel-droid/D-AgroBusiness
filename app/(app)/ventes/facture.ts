'use server'

import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerEntete, type EnteteEntreprise } from '@/lib/entreprise'

export type DonneesFacture = {
  entete: EnteteEntreprise
  devise: string
  vente: { numero: string; date: string; type: string; reference: string | null; campagne: string | null; totalHt: number; totalTva: number; totalTtc: number }
  tiers: { code: string; nom: string; adresse: string | null; nif: string | null; telephone: string | null }
  lignes: { designation: string; unite: string; quantite: number; prixUnitaire: number; tauxTva: number; montantHt: number }[]
}

const un = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

/** Données d'une facture de vente (marché ou distribution) : la lecture passe par les droits de l'utilisateur (RLS). */
export async function donneesFacture(venteId: string): Promise<DonneesFacture | { error: string }> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const [{ data: v }, { data: lignes }] = await Promise.all([
    supabase
      .from('ventes')
      .select('numero, date_vente, type, reference, total_ht, total_tva, total_ttc, tiers:client_id(code, nom, adresse, nif, telephone), campagnes(code)')
      .eq('id', venteId)
      .maybeSingle(),
    supabase.from('ventes_lignes').select('quantite, prix_unitaire, taux_tva, montant_ht, produits(nom, unite)').eq('vente_id', venteId),
  ])
  if (!v) return { error: 'Facture introuvable.' }
  const tiers = un(v.tiers)
  const campagne = un(v.campagnes)
  return {
    entete: await chargerEntete(ctx.organisationId),
    devise: ctx.devise,
    vente: {
      numero: v.numero,
      date: v.date_vente,
      type: v.type,
      reference: v.reference,
      campagne: campagne?.code ?? null,
      totalHt: Number(v.total_ht),
      totalTva: Number(v.total_tva),
      totalTtc: Number(v.total_ttc),
    },
    tiers: { code: tiers?.code ?? '', nom: tiers?.nom ?? '', adresse: tiers?.adresse ?? null, nif: tiers?.nif ?? null, telephone: tiers?.telephone ?? null },
    lignes: (lignes ?? []).map((l) => {
      const p = un(l.produits)
      return {
        designation: p?.nom ?? '',
        unite: p?.unite ?? '',
        quantite: Number(l.quantite),
        prixUnitaire: Number(l.prix_unitaire),
        tauxTva: Number(l.taux_tva),
        montantHt: Number(l.montant_ht),
      }
    }),
  }
}
