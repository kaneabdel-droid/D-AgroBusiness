#!/usr/bin/env node
/**
 * Agent CLI d'importation de données existantes pour D-Agrobusiness.
 * 
 * Usage :
 *   node scripts/importer-donnees.mjs --modele=produits|tiers|employes
 *   node scripts/importer-donnees.mjs --entreprise="Nom ou ID" --type=produits|tiers|employes --fichier=donnees.csv
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local')
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const MODELES = {
  produits: `code,nom,categorie,unite,prix_reference,taux_tva
RIZ-PADDY,Riz Paddy Local,produit_agricole,kg,220,0
ENGRAIS-NPK,Engrais NPK 15-15-15,intrant,sac,18500,18
SEM-SAHEL108,Semence certifiée Sahel 108,semence,sac,12000,0
RIZ-BLANC-25,Riz Blanc Brisé 25kg,produit_fini,sac,15000,0
SON-RIZ,Son de riz pour bétail,sous_produit,sac,4500,0`,

  tiers: `code,nom,types,telephone,email,adresse,nif
PROD-001,Coopérative des Producteurs de Dagana,"producteur,fournisseur",775551122,coop.dagana@email.sn,Dagana Walo,NIF987654321
CL-001,Grossiste Alimentaire du Nord,client,786663344,grossiste.nord@email.sn,Saint-Louis Sor,NIF123456789
FRN-002,Société d'Intrants et Semences,fournisseur,704445566,contact@intrants-sa.sn,Dakar Km 12,NIF555666777`,

  employes: `matricule,nom,prenom,statut,poste,date_embauche,departement,telephone
EMP-001,Diop,Mamadou,permanent,Directeur d'Usine,2022-01-15,production,771234567
EMP-002,Ndiaye,Aminata,permanent,Responsable Qualité,2022-03-01,autre,782345678
EMP-003,Ba,Ousmane,saisonnier,Opérateur Décortiqueuse,2023-07-01,production,703456789`
}

function parseCSV(content) {
  const clean = content.replace(/^\uFEFF/, '').trim()
  const lines = clean.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length === 0) return []

  const separator = lines[0].includes(';') ? ';' : ','
  
  function parseLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === separator && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const rawHeaders = parseLine(lines[0])
  const headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''))
  const records = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    if (values.length === 0 || (values.length === 1 && !values[0])) continue
    const obj = {}
    headers.forEach((header, idx) => {
      let val = values[idx] !== undefined ? values[idx] : ''
      val = val.replace(/^["']|["']$/g, '')
      obj[header] = val
    })
    records.push(obj)
  }

  return records
}

function parseArgs() {
  const args = process.argv.slice(2)
  const params = {}
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx)
        const val = arg.slice(eqIdx + 1)
        params[key] = val
      } else {
        params[arg.slice(2)] = true
      }
    }
  }
  return params
}

async function main() {
  const args = parseArgs()

  if (args.modele) {
    const type = args.modele.toLowerCase()
    const content = MODELES[type]
    if (!content) {
      console.error(`Type de modèle invalide. Choix possibles : ${Object.keys(MODELES).join(', ')}`)
      process.exit(1)
    }
    const filename = `modele_import_agrobusiness_${type}.csv`
    writeFileSync(filename, content, 'utf8')
    console.log(`✓ Fichier modèle généré avec succès : ${filename}`)
    return
  }

  if (!args.fichier || !args.type) {
    console.log(`
Agent d'importation de données - D-Agrobusiness
==============================================
Usage :
  1. Générer un fichier modèle CSV :
     node scripts/importer-donnees.mjs --modele=produits|tiers|employes

  2. Importer des données :
     node scripts/importer-donnees.mjs --entreprise="Nom ou ID" --type=produits|tiers|employes --fichier=chemin/vers/fichier.csv
    `)
    return
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Erreur : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants.")
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // Résoudre l'organisation
  let organisationId = args.organisation_id
  if (!organisationId && args.entreprise) {
    const { data: orgs } = await supabase
      .from('organisations')
      .select('id, nom')
      .or(`nom.ilike.%${args.entreprise}%,id.eq.${args.entreprise}`)
      .limit(1)

    if (orgs && orgs.length > 0) {
      organisationId = orgs[0].id
      console.log(`✓ Organisation sélectionnée : ${orgs[0].nom} (${organisationId})`)
    }
  }

  if (!organisationId) {
    const { data: orgs } = await supabase.from('organisations').select('id, nom').limit(5)
    console.error("Veuillez préciser une entreprise valide (--entreprise=\"Nom\").")
    if (orgs && orgs.length > 0) {
      console.log("Organisations disponibles :")
      orgs.forEach(o => console.log(`  - ${o.nom} (ID: ${o.id})`))
    }
    process.exit(1)
  }

  const filePath = resolve(args.fichier)
  if (!existsSync(filePath)) {
    console.error(`Fichier introuvable : ${filePath}`)
    process.exit(1)
  }

  const rawFile = readFileSync(filePath, 'utf8')
  let records = []
  if (filePath.endsWith('.json')) {
    records = JSON.parse(rawFile)
  } else {
    records = parseCSV(rawFile)
  }

  console.log(`✓ ${records.length} ligne(s) chargée(s). Début de l'importation (${args.type})...\n`)

  let reussis = 0
  let erreurs = 0

  if (args.type === 'produits') {
    const categoriesValides = ['intrant', 'semence', 'produit_agricole', 'produit_fini', 'sous_produit', 'service']

    for (let i = 0; i < records.length; i++) {
      const r = records[i]
      const nom = (r.nom || '').trim()
      let code = (r.code || '').trim()

      if (!nom) {
        erreurs++
        console.error(`Ligne ${i + 1} : Nom obligatoire.`)
        continue
      }

      if (!code) {
        code = nom.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) + '-' + (i + 1)
      }

      let categorie = (r.categorie || 'produit_agricole').toLowerCase().trim()
      if (!categoriesValides.includes(categorie)) categorie = 'produit_agricole'

      const unite = (r.unite || 'kg').trim()
      const prixRef = r.prix_reference ? parseFloat(r.prix_reference) : null
      const tauxTva = r.taux_tva ? parseFloat(r.taux_tva) : 0

      const { error } = await supabase.from('produits').upsert(
        {
          organisation_id: organisationId,
          code,
          nom,
          categorie,
          unite,
          prix_reference: isNaN(prixRef) ? null : prixRef,
          taux_tva: isNaN(tauxTva) ? 0 : tauxTva,
          actif: true
        },
        { onConflict: 'organisation_id,code' }
      )

      if (error) {
        erreurs++
        console.error(`Ligne ${i + 1} (${nom}) : ${error.message}`)
      } else {
        reussis++
      }
    }
  } else if (args.type === 'tiers') {
    const typesTiersValides = ['producteur', 'fournisseur', 'client', 'bailleur']

    for (let i = 0; i < records.length; i++) {
      const r = records[i]
      const nom = (r.nom || '').trim()
      let code = (r.code || '').trim()

      if (!nom) {
        erreurs++
        console.error(`Ligne ${i + 1} : Nom obligatoire.`)
        continue
      }

      if (!code) {
        code = 'T-' + nom.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + '-' + (i + 1)
      }

      // Parser le tableau types: 'producteur,fournisseur' -> ['producteur', 'fournisseur']
      const typesBruts = (r.types || r.type || 'fournisseur').split(/[,;]/).map(t => t.trim().toLowerCase())
      const types = typesBruts.filter(t => typesTiersValides.includes(t))
      if (types.length === 0) types.push('fournisseur')

      const telephone = (r.telephone || '').trim() || null
      const email = (r.email || '').trim() || null
      const adresse = (r.adresse || '').trim() || null
      const nif = (r.nif || '').trim() || null

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
        console.error(`Ligne ${i + 1} (${nom}) : ${error.message}`)
      } else {
        reussis++
      }
    }
  } else if (args.type === 'employes') {
    // Récupérer un département par défaut
    const { data: depts } = await supabase
      .from('departements')
      .select('id, code, nom')
      .eq('organisation_id', organisationId)

    let defautDeptId = depts && depts.length > 0 ? depts[0].id : null

    // Si aucun département n'existe, en créer un de base
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
      const nom = (r.nom || '').trim()
      const prenom = (r.prenom || '').trim() || null
      let matricule = (r.matricule || '').trim()

      if (!nom) {
        erreurs++
        console.error(`Ligne ${i + 1} : Nom obligatoire.`)
        continue
      }

      if (!matricule) {
        matricule = `EMP-${(i + 1).toString().padStart(4, '0')}`
      }

      let statut = (r.statut || 'permanent').toLowerCase().trim()
      if (!statutsValides.includes(statut)) statut = 'permanent'

      const poste = (r.poste || '').trim() || null
      const dateEmbauche = (r.date_embauche || new Date().toISOString().split('T')[0]).trim()
      const telephone = (r.telephone || '').trim() || null

      // Trouver departement_id si spécifié
      let deptId = defautDeptId
      const deptRef = (r.departement || '').trim().toLowerCase()
      if (deptRef && depts) {
        const found = depts.find(d => d.code.toLowerCase() === deptRef || d.nom.toLowerCase().includes(deptRef))
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
        console.error(`Ligne ${i + 1} (${prenom} ${nom}) : ${error.message}`)
      } else {
        reussis++
      }
    }
  }

  console.log(`\nImportation terminée : ${reussis} succès, ${erreurs} échec(s).`)
}

main().catch(err => {
  console.error("Erreur inattendue :", err)
  process.exit(1)
})
