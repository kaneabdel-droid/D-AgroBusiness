import { createClient } from '@/utils/supabase/server'
import type { ProduitOpt } from '@/components/DocumentForm'

/** Listes de sélection communes aux formulaires opérationnels. */
export async function chargerOptions() {
  const supabase = await createClient()
  const [produits, magasins, campagnes, departements, secteurs, contrats, tiers, comptesTresorerie] =
    await Promise.all([
      supabase.from('produits').select('id, code, nom, categorie, unite, taux_tva, prix_reference').eq('actif', true).order('nom'),
      supabase.from('magasins').select('id, code, nom').eq('actif', true).order('code'),
      supabase.from('campagnes').select('id, code, libelle').eq('statut', 'ouverte').order('date_debut', { ascending: false }),
      supabase.from('departements').select('id, nom').eq('actif', true).order('nom'),
      supabase.from('secteurs_projets').select('id, nom, departement_id').eq('actif', true).order('nom'),
      supabase.from('contrats_depot').select('id, code, taux_commission, tiers:fournisseur_id(nom)').eq('statut', 'actif').order('code'),
      supabase.from('tiers').select('id, code, nom, types').eq('actif', true).order('nom'),
      supabase.from('comptes_tresorerie').select('id, code, nom, type').eq('actif', true).order('code'),
    ])

  const tiersDe = (type: string) =>
    (tiers.data ?? [])
      .filter((t) => (t.types as string[]).includes(type))
      .map((t) => ({ id: t.id, label: `${t.code} — ${t.nom}` }))

  return {
    produits: (produits.data ?? []).map(
      (p): ProduitOpt => ({
        id: p.id,
        label: `${p.code} — ${p.nom}`,
        prix: p.prix_reference,
        tva: Number(p.taux_tva),
        categorie: p.categorie,
        unite: p.unite,
      })
    ),
    magasins: (magasins.data ?? []).map((m) => ({ id: m.id, label: `${m.code} — ${m.nom}` })),
    campagnes: (campagnes.data ?? []).map((c) => ({ id: c.id, label: `${c.code} — ${c.libelle}` })),
    departements: (departements.data ?? []).map((d) => ({ id: d.id, label: d.nom })),
    secteurs: (secteurs.data ?? []).map((s) => ({ id: s.id, label: s.nom, departement_id: s.departement_id })),
    contrats: (contrats.data ?? []).map((c) => {
      const f = Array.isArray(c.tiers) ? c.tiers[0] : c.tiers
      return { id: c.id, label: `${c.code} — ${f?.nom ?? ''} (${c.taux_commission} %)` }
    }),
    comptesTresorerie: (comptesTresorerie.data ?? []).map((c) => ({ id: c.id, label: `${c.code} — ${c.nom}` })),
    producteurs: tiersDe('producteur'),
    clients: tiersDe('client'),
    fournisseurs: tiersDe('fournisseur'),
    tousTiers: (tiers.data ?? []).map((t) => ({ id: t.id, label: `${t.code} — ${t.nom}` })),
  }
}
