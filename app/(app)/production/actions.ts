'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'

type Resultat = { success: true } | { error: string }

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const opt = (f: FormData, k: string) => txt(f, k) || undefined
const num = (f: FormData, k: string) => {
  const v = txt(f, k)
  return v === '' ? undefined : Number(v)
}

function message(error: { code?: string; message: string }): Resultat {
  if (error.code === '23505') return { error: 'Existe déjà (code, ou production déjà ouverte pour ce secteur et cette campagne).' }
  if (error.code === '42501') return { error: 'Droits insuffisants pour cette opération.' }
  if (error.code === '23514') return { error: 'Valeurs invalides.' }
  return { error: error.message }
}

const rafraichir = () => revalidatePath('/', 'layout')

async function rpc(nom: string, payload: object): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(nom, { p: payload })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function addProduction(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('productions').insert({
    organisation_id: ctx.organisationId,
    code: txt(formData, 'code').toUpperCase(),
    secteur_id: txt(formData, 'secteur_id'),
    campagne_id: txt(formData, 'campagne_id'),
    produit_id: txt(formData, 'produit_id'),
    superficie_ha: num(formData, 'superficie_ha') ?? null,
    date_semis: opt(formData, 'date_semis') ?? null,
    date_recolte_prevue: opt(formData, 'date_recolte_prevue') ?? null,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function consommerIntrants(productionId: string, formData: FormData): Promise<Resultat> {
  return rpc('consommer_intrants_production', {
    production_id: productionId,
    date: txt(formData, 'date'),
    magasin_id: txt(formData, 'magasin_id'),
    lignes: [{ produit_id: txt(formData, 'produit_id'), quantite: num(formData, 'quantite') }],
  })
}

export async function enregistrerRecolte(productionId: string, formData: FormData): Promise<Resultat> {
  return rpc('enregistrer_recolte', {
    production_id: productionId,
    date: txt(formData, 'date'),
    magasin_id: txt(formData, 'magasin_id'),
    produit_id: txt(formData, 'produit_id'),
    quantite: num(formData, 'quantite'),
    valeur_totale: opt(formData, 'valeur_totale'),
    observation: opt(formData, 'observation'),
  })
}

export async function addNomenclature(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()

  const sorties: { produit_id: string; rendement_pct: number; principal: boolean }[] = []
  for (let i = 1; i <= 4; i++) {
    const produit = txt(formData, `produit_${i}`)
    const rendement = num(formData, `rendement_${i}`)
    if (!produit && rendement === undefined) continue
    if (!produit || !rendement) return { error: `Sortie ${i} : indiquez le produit et son rendement.` }
    sorties.push({ produit_id: produit, rendement_pct: rendement, principal: i === 1 })
  }
  if (sorties.length === 0) return { error: 'Indiquez au moins un produit de sortie.' }
  if (new Set(sorties.map((s) => s.produit_id)).size !== sorties.length) {
    return { error: 'Un même produit ne peut apparaître qu’une fois.' }
  }
  const total = sorties.reduce((s, x) => s + x.rendement_pct, 0)
  if (total > 100) return { error: `La somme des rendements (${total} %) dépasse 100 %.` }

  const { data, error } = await supabase
    .from('nomenclatures')
    .insert({
      organisation_id: ctx.organisationId,
      code: txt(formData, 'code').toUpperCase(),
      libelle: txt(formData, 'libelle'),
      matiere_id: txt(formData, 'matiere_id'),
    })
    .select('id')
    .single()
  if (error) return message(error)

  const res = await supabase
    .from('nomenclature_sorties')
    .insert(sorties.map((s) => ({ ...s, organisation_id: ctx.organisationId, nomenclature_id: data.id })))
  if (res.error) {
    await supabase.from('nomenclatures').delete().eq('id', data.id)
    return message(res.error)
  }
  rafraichir()
  return { success: true }
}

export async function lancerTransformation(payload: object): Promise<Resultat> {
  return rpc('lancer_transformation', payload)
}
