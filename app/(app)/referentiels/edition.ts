'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'

// Modification et suppression des éléments des référentiels et du catalogue : réservées à l'administrateur de l'organisation.
// La base reste le garde-fou : une clé étrangère (restrict) refuse la suppression d'un élément déjà utilisé.

type Resultat = { success: true } | { error: string }

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const opt = (f: FormData, k: string) => txt(f, k) || null

function message(error: { code?: string; message: string }): Resultat {
  if (error.code === '23505') return { error: 'Ce code existe déjà.' }
  if (error.code === '23503') return { error: 'Suppression impossible : cet élément est utilisé par des opérations ou des écritures.' }
  if (error.code === '23P01') return { error: 'Cet exercice chevauche un exercice existant.' }
  if (error.code === '23514') return { error: 'Valeurs invalides (vérifiez les dates et les champs obligatoires).' }
  if (error.code === '42501') return { error: 'Droits insuffisants pour cette opération.' }
  return { error: error.message }
}

async function admin() {
  const ctx = await getContexte()
  return ctx.role === 'admin' ? ctx : null
}

const REFUS: Resultat = { error: 'Réservé à l’administrateur.' }
const INTROUVABLE: Resultat = { error: 'Élément introuvable.' }

async function mettreAJour(table: string, id: string, valeurs: Record<string, unknown>, pages: string[]): Promise<Resultat> {
  if (!(await admin())) return REFUS
  const supabase = await createClient()
  const { data, error } = await supabase.from(table).update(valeurs).eq('id', id).select('id')
  if (error) return message(error)
  if (!data || data.length === 0) return INTROUVABLE
  pages.forEach((p) => revalidatePath(p))
  return { success: true }
}

async function supprimer(table: string, id: string, pages: string[]): Promise<Resultat> {
  if (!(await admin())) return REFUS
  const supabase = await createClient()
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')
  if (error) return message(error)
  if (!data || data.length === 0) return INTROUVABLE
  pages.forEach((p) => revalidatePath(p))
  return { success: true }
}

// ---------- Référentiels ----------

export async function updateDepartement(id: string, formData: FormData): Promise<Resultat> {
  return mettreAJour('departements', id, {
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    type: txt(formData, 'type') || 'autre',
  }, ['/referentiels/departements'])
}
// Désactiver masque l'élément des listes de choix sans toucher aux écritures existantes (les états analytiques le
// montrent toujours). Désactiver un département désactive aussi ses secteurs et projets.
export async function changerActifDepartement(id: string, actif: boolean): Promise<Resultat> {
  if (!(await admin())) return REFUS
  const supabase = await createClient()
  const { data, error } = await supabase.from('departements').update({ actif }).eq('id', id).select('id')
  if (error) return message(error)
  if (!data || data.length === 0) return INTROUVABLE
  if (!actif) {
    const { error: errSecteurs } = await supabase.from('secteurs_projets').update({ actif: false }).eq('departement_id', id)
    if (errSecteurs) return message(errSecteurs)
    revalidatePath('/referentiels/secteurs')
  }
  revalidatePath('/referentiels/departements')
  return { success: true }
}

export async function deleteDepartement(id: string): Promise<Resultat> {
  return supprimer('departements', id, ['/referentiels/departements'])
}

// Le département d'un secteur n'est pas modifiable : les écritures analytiques rattachent un secteur à son département.
export async function updateSecteur(id: string, formData: FormData): Promise<Resultat> {
  const superficie = txt(formData, 'superficie_ha')
  return mettreAJour('secteurs_projets', id, {
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    nature: txt(formData, 'nature') || 'secteur',
    superficie_ha: superficie ? Number(superficie) : null,
  }, ['/referentiels/secteurs'])
}
export async function changerActifSecteur(id: string, actif: boolean): Promise<Resultat> {
  if (!(await admin())) return REFUS
  const supabase = await createClient()
  if (actif) {
    const { data: secteur } = await supabase.from('secteurs_projets').select('departements(actif)').eq('id', id).maybeSingle()
    const dep = Array.isArray(secteur?.departements) ? secteur?.departements[0] : secteur?.departements
    if (dep && dep.actif === false) return { error: 'Réactivez d’abord le département de ce secteur.' }
  }
  return mettreAJour('secteurs_projets', id, { actif }, ['/referentiels/secteurs'])
}

export async function deleteSecteur(id: string): Promise<Resultat> {
  return supprimer('secteurs_projets', id, ['/referentiels/secteurs'])
}

export async function updateExercice(id: string, formData: FormData): Promise<Resultat> {
  if (!(await admin())) return REFUS
  const supabase = await createClient()
  const { data: actuel } = await supabase.from('exercices_comptables').select('date_debut, date_fin').eq('id', id).maybeSingle()
  if (!actuel) return INTROUVABLE
  const debut = txt(formData, 'date_debut')
  const fin = txt(formData, 'date_fin')
  if (debut !== actuel.date_debut || fin !== actuel.date_fin) {
    const { count } = await supabase.from('ecritures').select('id', { count: 'exact', head: true }).eq('exercice_id', id)
    if (count && count > 0) return { error: 'Dates non modifiables : des écritures existent déjà dans cet exercice.' }
  }
  return mettreAJour('exercices_comptables', id, { libelle: txt(formData, 'libelle'), date_debut: debut, date_fin: fin }, ['/referentiels/exercices'])
}
export async function deleteExercice(id: string): Promise<Resultat> {
  return supprimer('exercices_comptables', id, ['/referentiels/exercices'])
}

export async function updateCampagne(id: string, formData: FormData): Promise<Resultat> {
  return mettreAJour('campagnes', id, {
    code: txt(formData, 'code').toUpperCase(),
    libelle: txt(formData, 'libelle'),
    date_debut: txt(formData, 'date_debut'),
    date_fin: txt(formData, 'date_fin'),
  }, ['/referentiels/campagnes'])
}
export async function deleteCampagne(id: string): Promise<Resultat> {
  return supprimer('campagnes', id, ['/referentiels/campagnes'])
}

export async function updateTiers(id: string, formData: FormData): Promise<Resultat> {
  const types = formData.getAll('types').map(String)
  if (types.length === 0) return { error: 'Choisissez au moins un type de tiers.' }
  return mettreAJour('tiers', id, {
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    types,
    telephone: opt(formData, 'telephone'),
    email: opt(formData, 'email'),
    adresse: opt(formData, 'adresse'),
    nif: opt(formData, 'nif'),
  }, ['/referentiels/tiers'])
}
export async function deleteTiers(id: string): Promise<Resultat> {
  return supprimer('tiers', id, ['/referentiels/tiers'])
}

// Un partenaire financier reste une ligne « tiers » de type bailleur : son type ne change pas.
export async function updatePartenaireFinancier(id: string, formData: FormData): Promise<Resultat> {
  return mettreAJour('tiers', id, {
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    telephone: opt(formData, 'telephone'),
    email: opt(formData, 'email'),
    adresse: opt(formData, 'adresse'),
    nif: opt(formData, 'nif'),
  }, ['/referentiels/partenaires-financiers'])
}
export async function deletePartenaireFinancier(id: string): Promise<Resultat> {
  return supprimer('tiers', id, ['/referentiels/partenaires-financiers'])
}

// ---------- Catalogue ----------

// La catégorie et l'unité d'un produit ne changent plus dès qu'il a servi : elles déterminent les comptes utilisés
// et l'interprétation des quantités déjà enregistrées.
export async function updateProduit(id: string, formData: FormData): Promise<Resultat> {
  if (!(await admin())) return REFUS
  const supabase = await createClient()
  const { data: actuel } = await supabase.from('produits').select('categorie, unite').eq('id', id).maybeSingle()
  if (!actuel) return INTROUVABLE
  const categorie = txt(formData, 'categorie')
  const unite = txt(formData, 'unite') || 'kg'
  if (categorie !== actuel.categorie || unite !== actuel.unite) {
    const usages = await Promise.all([
      supabase.from('mouvements_stock').select('id', { count: 'exact', head: true }).eq('produit_id', id),
      supabase.from('ventes_lignes').select('id', { count: 'exact', head: true }).eq('produit_id', id),
      supabase.from('achats_lignes').select('id', { count: 'exact', head: true }).eq('produit_id', id),
      supabase.from('nomenclature_sorties').select('id', { count: 'exact', head: true }).eq('produit_id', id),
      supabase.from('nomenclatures').select('id', { count: 'exact', head: true }).eq('matiere_id', id),
    ])
    if (usages.some((u) => (u.count ?? 0) > 0)) {
      return { error: 'Catégorie et unité non modifiables : ce produit a déjà été utilisé dans des opérations.' }
    }
  }
  const prix = txt(formData, 'prix_reference')
  return mettreAJour('produits', id, {
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    categorie,
    unite,
    taux_tva: Number(txt(formData, 'taux_tva') || 0),
    prix_reference: prix ? Number(prix) : null,
  }, ['/catalogue/produits'])
}
export async function deleteProduit(id: string): Promise<Resultat> {
  return supprimer('produits', id, ['/catalogue/produits'])
}

export async function updateMagasin(id: string, formData: FormData): Promise<Resultat> {
  return mettreAJour('magasins', id, {
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    departement_id: opt(formData, 'departement_id'),
  }, ['/catalogue/magasins'])
}
export async function deleteMagasin(id: string): Promise<Resultat> {
  return supprimer('magasins', id, ['/catalogue/magasins'])
}
