'use server'

import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function importerDonneesAgro(
  typeId: 'produits' | 'tiers' | 'employes',
  records: any[]
): Promise<{ succes: number; erreurs: number; details: string[] }> {
  try {
    const ctx = await getContexte()
    const supabase = await createClient()

    const organisationId = ctx.organisationId
    let succes = 0
    let erreurs = 0
    const details: string[] = []

    if (!records || !Array.isArray(records) || records.length === 0) {
      return { succes: 0, erreurs: 0, details: ['Aucun enregistrement valide à importer.'] }
    }

    if (typeId === 'produits') {
      const categoriesValides = ['intrant', 'semence', 'produit_agricole', 'produit_fini', 'sous_produit', 'service']

      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const nom = (r.nom || '').toString().trim()
        let code = (r.code || '').toString().trim()

        if (!nom) {
          erreurs++
          details.push(`Ligne ${i + 1} : Le nom du produit est obligatoire.`)
          continue
        }

        if (!code) {
          code = nom.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) + '-' + (i + 1)
        }

        let categorie = (r.categorie || 'produit_agricole').toString().toLowerCase().trim()
        if (!categoriesValides.includes(categorie)) categorie = 'produit_agricole'

        const unite = (r.unite || 'kg').toString().trim()
        const prixRef = r.prix_reference ? parseFloat(r.prix_reference) : null
        const tauxTva = r.taux_tva ? parseFloat(r.taux_tva) : 0

        const { error } = await supabase.from('produits').upsert(
          {
            organisation_id: organisationId,
            code,
            nom,
            categorie,
            unite,
            prix_reference: isNaN(prixRef as number) ? null : prixRef,
            taux_tva: isNaN(tauxTva) ? 0 : tauxTva,
            actif: true
          },
          { onConflict: 'organisation_id,code' }
        )

        if (error) {
          erreurs++
          details.push(`Ligne ${i + 1} (${nom}) : ${error.message}`)
        } else {
          succes++
        }
      }

      revalidatePath('/catalogue/produits')
      revalidatePath('/stocks')
    } else if (typeId === 'tiers') {
      const typesTiersValides = ['producteur', 'fournisseur', 'client', 'bailleur']

      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const nom = (r.nom || '').toString().trim()
        let code = (r.code || '').toString().trim()

        if (!nom) {
          erreurs++
          details.push(`Ligne ${i + 1} : Le nom du tiers est obligatoire.`)
          continue
        }

        if (!code) {
          code = 'T-' + nom.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + '-' + (i + 1)
        }

        const typesBruts = (r.types || r.type || 'fournisseur').toString().split(/[,;]/).map((t: string) => t.trim().toLowerCase())
        const types = typesBruts.filter((t: string) => typesTiersValides.includes(t))
        if (types.length === 0) types.push('fournisseur')

        const telephone = (r.telephone || '').toString().trim() || null
        const email = (r.email || '').toString().trim() || null
        const adresse = (r.adresse || '').toString().trim() || null
        const nif = (r.nif || '').toString().trim() || null

        const { error } = await supabase.from('tiers').upsert(
          {
            organisation_id: organisationId,
            code,
            nom,
            types,
            telephone,
            email,
            adresse,
            nif,
            actif: true
          },
          { onConflict: 'organisation_id,code' }
        )

        if (error) {
          erreurs++
          details.push(`Ligne ${i + 1} (${nom}) : ${error.message}`)
        } else {
          succes++
        }
      }

      revalidatePath('/referentiels/tiers')
    } else if (typeId === 'employes') {
      // Récupérer un département par défaut
      const { data: depts } = await supabase
        .from('departements')
        .select('id, code, nom')
        .eq('organisation_id', organisationId)

      let defautDeptId = depts && depts.length > 0 ? depts[0].id : null

      if (!defautDeptId) {
        const { data: newDept } = await supabase
          .from('departements')
          .insert({
            organisation_id: organisationId,
            code: 'GEN',
            nom: 'Direction & Exploitation',
            type: 'fonctionnement'
          })
          .select('id')
          .single()
        if (newDept) defautDeptId = newDept.id
      }

      const statutsValides = ['permanent', 'saisonnier', 'journalier', 'prestataire']

      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const nom = (r.nom || '').toString().trim()
        const prenom = (r.prenom || '').toString().trim() || null
        let matricule = (r.matricule || '').toString().trim()

        if (!nom) {
          erreurs++
          details.push(`Ligne ${i + 1} : Le nom de l'employé est obligatoire.`)
          continue
        }

        if (!matricule) {
          matricule = `EMP-${(i + 1).toString().padStart(4, '0')}`
        }

        let statut = (r.statut || 'permanent').toString().toLowerCase().trim()
        if (!statutsValides.includes(statut)) statut = 'permanent'

        const poste = (r.poste || '').toString().trim() || null
        const dateEmbauche = (r.date_embauche || new Date().toISOString().split('T')[0]).toString().trim()
        const telephone = (r.telephone || '').toString().trim() || null

        let deptId = defautDeptId
        const deptRef = (r.departement || '').toString().trim().toLowerCase()
        if (deptRef && depts) {
          const found = depts.find((d: any) => d.code.toLowerCase() === deptRef || d.nom.toLowerCase().includes(deptRef))
          if (found) deptId = found.id
        }

        const { error } = await supabase.from('employes').upsert(
          {
            organisation_id: organisationId,
            matricule,
            nom,
            prenom,
            statut,
            poste,
            date_embauche: dateEmbauche,
            departement_id: deptId,
            telephone,
            actif: true
          },
          { onConflict: 'organisation_id,matricule' }
        )

        if (error) {
          erreurs++
          details.push(`Ligne ${i + 1} (${prenom || ''} ${nom}) : ${error.message}`)
        } else {
          succes++
        }
      }

      revalidatePath('/rh/employes')
    }

    return { succes, erreurs, details }
  } catch (err: any) {
    return {
      succes: 0,
      erreurs: records.length,
      details: [`Erreur inattendue : ${err?.message || 'Erreur inconnue'}`]
    }
  }
}
