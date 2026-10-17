import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function GET() {
  return NextResponse.json({ status: 'online', service: 'd-agrobusiness-sync', timestamp: Date.now() })
}

export async function POST(req: NextRequest) {
  try {
    const contexte = await getContexte()
    if (!contexte || !contexte.organisationId) {
      return NextResponse.json({ success: false, error: 'Session non authentifiée' }, { status: 401 })
    }

    const body = await req.json()
    const { actionType, payload } = body
    const supabase = await createClient()

    if (actionType === 'operation_champ') {
      const { parcelle_id, type_operation, date_operation, observations, intrants } = payload

      const { data, error } = await supabase
        .from('operations_champ')
        .insert({
          organisation_id: contexte.organisationId,
          parcelle_id,
          type_operation: type_operation || 'semis',
          date_operation: date_operation || new Date().toISOString().split('T')[0],
          observations: observations ? `${observations} [Sync Hors-Ligne]` : '[Sync Hors-Ligne]',
        })
        .select()
        .single()

      if (error) throw error

      revalidatePath('/production/operations')
      revalidatePath('/')
      return NextResponse.json({ success: true, id: data.id })
    }

    if (actionType === 'recolte') {
      const { parcelle_id, culture, quantite_kg, date_recolte } = payload

      const { data, error } = await supabase
        .from('recoltes')
        .insert({
          organisation_id: contexte.organisationId,
          parcelle_id,
          culture: culture || 'Récolte',
          quantite_kg: Number(quantite_kg) || 0,
          date_recolte: date_recolte || new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

      if (error) throw error

      revalidatePath('/production/recoltes')
      revalidatePath('/')
      return NextResponse.json({ success: true, id: data.id })
    }

    if (actionType === 'depense' || actionType === 'depense_caisse') {
      const { motif, montant, compte_id, categorie } = payload

      const { data, error } = await supabase
        .from('depenses')
        .insert({
          organisation_id: contexte.organisationId,
          motif: motif || 'Dépense exploitation',
          montant: Number(montant) || 0,
          compte_id: compte_id || null,
          categorie: categorie || 'exploitation',
          date_depense: new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

      if (error) throw error

      revalidatePath('/tresorerie')
      revalidatePath('/')
      return NextResponse.json({ success: true, id: data.id })
    }

    return NextResponse.json({ success: false, error: `Action inconnue: ${actionType}` }, { status: 400 })
  } catch (error: any) {
    console.error('Erreur sync offline agrobusiness:', error)
    return NextResponse.json({ success: false, error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
