'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

type Resultat = { success: true } | { error: string }

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const opt = (f: FormData, k: string) => txt(f, k) || undefined
const num = (f: FormData, k: string) => {
  const v = txt(f, k)
  return v === '' ? undefined : Number(v)
}

function message(error: { code?: string; message: string }): Resultat {
  if (error.code === '23505') return { error: 'Ce lien existe déjà entre ces deux lots.' }
  if (error.code === '42501') return { error: 'Droits insuffisants pour cette opération.' }
  if (error.code === '23514') return { error: 'Valeurs invalides.' }
  return { error: error.message }
}

async function rpc(nom: string, payload: object): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(nom, { p: payload })
  if (error) return message(error)
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function creerLot(formData: FormData): Promise<Resultat> {
  return rpc('creer_lot', {
    produit_id: txt(formData, 'produit_id'),
    date: txt(formData, 'date'),
    quantite: num(formData, 'quantite'),
    origine: opt(formData, 'origine'),
    date_peremption: opt(formData, 'date_peremption'),
    observation: opt(formData, 'observation'),
  })
}

export async function ajouterControle(lotId: string, formData: FormData): Promise<Resultat> {
  return rpc('enregistrer_controle', {
    lot_id: lotId,
    date: txt(formData, 'date'),
    parametre: txt(formData, 'parametre'),
    valeur: num(formData, 'valeur'),
    minimum: opt(formData, 'minimum'),
    maximum: opt(formData, 'maximum'),
    observation: opt(formData, 'observation'),
  })
}

export async function ajouterExpedition(lotId: string, formData: FormData): Promise<Resultat> {
  return rpc('enregistrer_expedition', {
    lot_id: lotId,
    date: txt(formData, 'date'),
    quantite: num(formData, 'quantite'),
    tiers_id: opt(formData, 'tiers_id'),
    observation: opt(formData, 'observation'),
  })
}

/** Le lot courant devient l'aval (produit à partir du lot choisi) ou l'amont (a servi à produire le lot choisi). */
export async function lierLot(lotId: string, sens: 'amont' | 'aval', formData: FormData): Promise<Resultat> {
  const autre = txt(formData, 'lot_id')
  return rpc('lier_lots', {
    lot_amont_id: sens === 'amont' ? autre : lotId,
    lot_aval_id: sens === 'amont' ? lotId : autre,
    quantite: opt(formData, 'quantite'),
  })
}

export async function changerStatut(lotId: string, statut: 'libere' | 'bloque'): Promise<Resultat> {
  return rpc('changer_statut_lot', { lot_id: lotId, statut })
}
