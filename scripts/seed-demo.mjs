#!/usr/bin/env node
/**
 * Crée l'entreprise de démonstration « Riz du Delta » avec des données réalistes de bout en bout :
 * campagnes, achats, production, usine, ventes, financement, trésorerie, personnel et paie, lots et contrôles qualité, prévisions.
 *
 *   node scripts/seed-demo.mjs
 *
 * Nécessite NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY (fichier .env.local).
 * Comptes créés (connexion automatique depuis /decouvrir-dagrobusiness, sans mot de passe communiqué) :
 *   direction@ / comptable@ / rh@demo-agro.dembasolution.com, plus admin@ (propriétaire, non proposé au public).
 * Le script ne recrée rien si la démonstration existe déjà.
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) {
  console.error('Variables manquantes : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const DOMAINE = 'demo-agro.dembasolution.com'
const COMPTES = [
  { email: `direction@${DOMAINE}`, nom: 'Aïssatou Diop', role: 'direction' },
  { email: `comptable@${DOMAINE}`, nom: 'Moussa Sarr', role: 'comptable' },
  { email: `rh@${DOMAINE}`, nom: 'Fatou Ba', role: 'rh' },
]
const ADMIN = { email: `admin@${DOMAINE}`, nom: 'Amadou Ndiaye', mdp: randomBytes(24).toString('base64url') + 'aA1!' }

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const s = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })

const bilan = { ok: 0, ko: [] }
async function etape(nom, fn) {
  try {
    const detail = await fn()
    bilan.ok++
    console.log('OK  ' + nom + (detail ? '  -> ' + detail : ''))
  } catch (e) {
    bilan.ko.push(nom)
    console.log('KO  ' + nom + '  -> ' + (e?.message ?? e))
  }
}
const ok = (r, ctx) => {
  if (r.error) throw new Error(`${ctx} : ${r.error.message}`)
  return r.data
}

// ---------- Organisation et comptes ----------
const { data: dejaOrg } = await admin.from('organisations').select('id').eq('demo', true).maybeSingle()
if (dejaOrg) {
  console.log('La démonstration existe déjà (organisation ' + dejaOrg.id + '). Rien à faire.')
  process.exit(0)
}

let orgId
await etape('Création de l’entreprise et du compte propriétaire', async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: ADMIN.email, password: ADMIN.mdp, email_confirm: true,
    user_metadata: { organisation_nom: 'Riz du Delta', nom_complet: ADMIN.nom, pays: 'SN' },
  })
  if (error) throw error
  const u = ok(await admin.from('utilisateurs').select('organisation_id').eq('id', data.user.id).single(), 'utilisateur')
  orgId = u.organisation_id
  // organisation de démonstration : Premium sans échéance, exclue des chiffres réels
  ok(await admin.from('organisations').update({ demo: true, niveau: 'premium', abonnement_expire_le: '2099-12-31T00:00:00Z', essai_expire_le: '2099-12-31T00:00:00Z', adresse: 'Ross-Béthio, delta du fleuve Sénégal' }).eq('id', orgId), 'organisation')
  return orgId
})
if (!orgId) process.exit(1)

await etape('Comptes de démonstration (direction, comptable, RH)', async () => {
  for (const c of COMPTES) {
    const { data, error } = await admin.auth.admin.createUser({ email: c.email, password: randomBytes(24).toString('base64url') + 'aA1!', email_confirm: true, user_metadata: { nom_complet: c.nom } })
    if (error) throw error
    ok(await admin.from('utilisateurs').insert({ id: data.user.id, organisation_id: orgId, nom_complet: c.nom, role: c.role }), 'utilisateur ' + c.role)
  }
  return COMPTES.length + ' comptes'
})

ok(await s.auth.signInWithPassword({ email: ADMIN.email, password: ADMIN.mdp }), 'connexion propriétaire')
const rpc = async (fn, p) => ok(await s.rpc(fn, { p }), fn)
const ins = async (table, row) => ok(await s.from(table).insert({ organisation_id: orgId, ...row }).select().single(), table)
const jour = (mois, j) => `2026-${String(mois).padStart(2, '0')}-${String(j).padStart(2, '0')}`

const deps = Object.fromEntries(ok(await s.from('departements').select('id, code'), 'departements').map((d) => [d.code, d.id]))
const mag = ok(await s.from('magasins').select('id').eq('code', 'MAG1').single(), 'magasin').id
const cpt = ok(await s.from('comptes_tresorerie').select('id, type'), 'comptes')
const banque = cpt.find((c) => c.type === 'banque').id
const T = {}, P = {}, C = {}

await etape('Tiers (fournisseurs, coopérative, clients, banque)', async () => {
  T.semences = await ins('tiers', { code: 'F001', nom: 'Semences du Delta', types: ['fournisseur'], telephone: '+221 33 961 00 01' })
  T.intrants = await ins('tiers', { code: 'F002', nom: 'Agro-Intrants du Sahel', types: ['fournisseur'], telephone: '+221 33 961 00 02' })
  T.coop = await ins('tiers', { code: 'P001', nom: 'Coopérative de Ross-Béthio', types: ['producteur'] })
  T.minoterie = await ins('tiers', { code: 'C001', nom: 'Minoterie de Dakar', types: ['client'], telephone: '+221 33 822 10 10' })
  T.distribution = await ins('tiers', { code: 'C002', nom: 'Grande Distribution du Sénégal', types: ['client'] })
  T.export = await ins('tiers', { code: 'C003', nom: 'Export Riz Afrique SARL', types: ['client'] })
  T.banque = await ins('tiers', { code: 'B001', nom: 'Banque Agricole du Sénégal', types: ['bailleur'] })
  return '7 tiers'
})

await etape('Produits', async () => {
  const defs = [
    ['SEM-RIZ', 'Semences de riz certifiées', 'semence', 'kg'], ['NPK', 'Engrais NPK 15-15-15', 'intrant', 'kg'], ['UREE', 'Urée 46 %', 'intrant', 'kg'],
    ['HERB', 'Herbicide riz', 'intrant', 'l'], ['PADDY', 'Paddy', 'produit_agricole', 'kg'], ['RIZ-B', 'Riz blanc 25 kg', 'produit_fini', 'kg'],
    ['BRIS', 'Brisures de riz', 'sous_produit', 'kg'], ['SON', 'Son de riz', 'sous_produit', 'kg'],
  ]
  for (const [code, nom, categorie, unite] of defs) P[code] = await ins('produits', { code, nom, categorie, unite, taux_tva: 0, prix_reference: null })
  return defs.length + ' produits'
})

await etape('Secteurs et campagnes', async () => {
  C.nord = await ins('secteurs_projets', { departement_id: deps.PROD, code: 'CAS-N', nom: 'Casier Nord', nature: 'secteur', superficie_ha: 120 })
  C.sud = await ins('secteurs_projets', { departement_id: deps.PROD, code: 'CAS-S', nom: 'Casier Sud', nature: 'secteur', superficie_ha: 80 })
  C.cs = await ins('campagnes', { code: 'CS2026', libelle: 'Contre-saison chaude 2026', date_debut: '2026-02-01', date_fin: '2026-07-31' })
  C.hiv = await ins('campagnes', { code: 'HIV2026', libelle: 'Hivernage 2026', date_debut: '2026-07-01', date_fin: '2026-12-31' })
  return '2 secteurs, 2 campagnes'
})

await etape('Capital et financement bancaire', async () => {
  const capital = ok(await s.from('comptes_comptables').select('id').eq('numero', '10').maybeSingle(), 'compte 10').id
  await rpc('enregistrer_operation_tresorerie', { date: jour(1, 15), sens: 'encaissement', montant: 30000000, compte_tresorerie_id: banque, contrepartie_compte_id: capital, libelle: 'Apport en capital des associés' })
  const emp = await ins('contrats_financement', { code: 'EMP-TRACT', libelle: 'Emprunt investissement — tracteurs et moissonneuse', type: 'emprunt_investissement', bailleur_id: T.banque.id, departement_id: deps.MATE, montant_accorde: 24000000, taux_annuel: 9, duree_mois: 24, periodicite_mois: 1, mode_remboursement: 'annuite_constante', date_debut: jour(2, 1) })
  ok(await s.rpc('generer_echeancier', { p_contrat_id: emp.id }), 'échéancier')
  await rpc('enregistrer_tirage', { contrat_id: emp.id, date: jour(2, 5), montant: 24000000, compte_tresorerie_id: banque })
  const ech = ok(await s.from('echeances_financement').select('id, numero').eq('contrat_id', emp.id).order('numero'), 'échéances')
  for (const e of ech.slice(0, 6)) await rpc('rembourser_echeance', { echeance_id: e.id, date: jour(2 + e.numero, 1), compte_tresorerie_id: banque })
  return '30 M capital, emprunt 24 M, 6 échéances payées'
})

await etape('Achats d’intrants et de semences', async () => {
  await rpc('enregistrer_achat', { date: jour(2, 10), fournisseur_id: T.semences.id, magasin_id: mag, campagne_id: C.cs.id, lignes: [{ produit_id: P['SEM-RIZ'].id, quantite: 6000, prix_unitaire: 550 }] })
  await rpc('enregistrer_achat', { date: jour(2, 12), fournisseur_id: T.intrants.id, magasin_id: mag, campagne_id: C.cs.id, lignes: [
    { produit_id: P.NPK.id, quantite: 12000, prix_unitaire: 420 }, { produit_id: P.UREE.id, quantite: 9000, prix_unitaire: 380 }, { produit_id: P.HERB.id, quantite: 600, prix_unitaire: 3800 }] })
  await rpc('enregistrer_achat', { date: jour(7, 8), fournisseur_id: T.intrants.id, magasin_id: mag, campagne_id: C.hiv.id, lignes: [
    { produit_id: P.NPK.id, quantite: 8000, prix_unitaire: 430 }, { produit_id: P.UREE.id, quantite: 6000, prix_unitaire: 390 }] })
  await rpc('enregistrer_reglement', { date: jour(3, 1), sens: 'paiement', tiers_id: T.semences.id, montant: 3300000, compte_tresorerie_id: banque })
  await rpc('enregistrer_reglement', { date: jour(3, 5), sens: 'paiement', tiers_id: T.intrants.id, montant: 9000000, compte_tresorerie_id: banque })
  return '3 achats, 2 règlements'
})

let prodCS
await etape('Production de la contre-saison : intrants consommés et récolte de paddy', async () => {
  prodCS = await ins('productions', { code: 'PR-CS26-N', secteur_id: C.nord.id, campagne_id: C.cs.id, produit_id: P.PADDY.id, superficie_ha: 120, date_semis: jour(2, 20), date_recolte_prevue: jour(6, 15) })
  await rpc('consommer_intrants_production', { production_id: prodCS.id, date: jour(2, 20), magasin_id: mag, lignes: [{ produit_id: P['SEM-RIZ'].id, quantite: 3600 }] })
  await rpc('consommer_intrants_production', { production_id: prodCS.id, date: jour(3, 15), magasin_id: mag, lignes: [{ produit_id: P.NPK.id, quantite: 7200 }, { produit_id: P.UREE.id, quantite: 5400 }] })
  await rpc('consommer_intrants_production', { production_id: prodCS.id, date: jour(4, 10), magasin_id: mag, lignes: [{ produit_id: P.HERB.id, quantite: 360 }] })
  // autres charges du casier (main-d'œuvre saisonnière, eau, carburant) imputées au secteur
  const charge = ok(await s.from('comptes_comptables').select('id').eq('numero', '661').maybeSingle(), 'compte 661').id
  await rpc('enregistrer_operation_tresorerie', { date: jour(4, 30), sens: 'decaissement', montant: 3600000, compte_tresorerie_id: banque, contrepartie_compte_id: charge, libelle: 'Main-d’œuvre saisonnière — repiquage et récolte', departement_id: deps.PROD, secteur_id: C.nord.id, campagne_id: C.cs.id })
  const eau = ok(await s.from('comptes_comptables').select('id').eq('numero', '62').maybeSingle(), 'compte 62').id
  await rpc('enregistrer_operation_tresorerie', { date: jour(5, 5), sens: 'decaissement', montant: 1800000, compte_tresorerie_id: banque, contrepartie_compte_id: eau, libelle: 'Redevance hydraulique et carburant de pompage', departement_id: deps.PROD, secteur_id: C.nord.id, campagne_id: C.cs.id })
  await rpc('enregistrer_recolte', { production_id: prodCS.id, date: jour(6, 12), magasin_id: mag, produit_id: P.PADDY.id, quantite: 78000, observation: 'Récolte du casier Nord — rendement 6,5 t/ha' })
  return 'récolte 78 t de paddy'
})

let of1
await etape('Usine : nomenclature et transformation du paddy', async () => {
  const nom = await ins('nomenclatures', { code: 'DECORT-STD', libelle: 'Décorticage et blanchiment du paddy', matiere_id: P.PADDY.id })
  await ins('nomenclature_sorties', { nomenclature_id: nom.id, produit_id: P['RIZ-B'].id, rendement_pct: 65, principal: true })
  await ins('nomenclature_sorties', { nomenclature_id: nom.id, produit_id: P.BRIS.id, rendement_pct: 10, principal: false })
  await ins('nomenclature_sorties', { nomenclature_id: nom.id, produit_id: P.SON.id, rendement_pct: 8, principal: false })
  of1 = await rpc('lancer_transformation', { date: jour(6, 25), nomenclature_id: nom.id, magasin_source_id: mag, magasin_destination_id: mag, departement_id: deps.USIN, campagne_id: C.cs.id, quantite_matiere: 60000, frais_imputes: 900000, observation: 'Première campagne de transformation' })
  return '60 t de paddy transformées'
})

await etape('Ventes et encaissements', async () => {
  const v = (client, date, lignes) => rpc('enregistrer_vente', { type: 'marche', date, client_id: client.id, magasin_id: mag, departement_id: deps.USIN, campagne_id: C.cs.id, lignes })
  await v(T.minoterie, jour(7, 10), [{ produit_id: P['RIZ-B'].id, quantite: 15000, prix_unitaire: 480 }])
  await v(T.distribution, jour(7, 22), [{ produit_id: P['RIZ-B'].id, quantite: 12000, prix_unitaire: 495 }])
  await v(T.export, jour(8, 14), [{ produit_id: P['RIZ-B'].id, quantite: 10000, prix_unitaire: 470 }, { produit_id: P.BRIS.id, quantite: 3000, prix_unitaire: 210 }])
  await v(T.minoterie, jour(9, 5), [{ produit_id: P.SON.id, quantite: 4000, prix_unitaire: 90 }])
  await rpc('enregistrer_reglement', { date: jour(7, 30), sens: 'encaissement', tiers_id: T.minoterie.id, montant: 7200000, compte_tresorerie_id: banque })
  await rpc('enregistrer_reglement', { date: jour(8, 20), sens: 'encaissement', tiers_id: T.distribution.id, montant: 5940000, compte_tresorerie_id: banque })
  return '4 ventes, 2 encaissements (1 créance client ouverte)'
})

await etape('Hivernage 2026 en cours : production et intrants', async () => {
  const pr = await ins('productions', { code: 'PR-HIV26-S', secteur_id: C.sud.id, campagne_id: C.hiv.id, produit_id: P.PADDY.id, superficie_ha: 80, date_semis: jour(7, 20), date_recolte_prevue: '2026-11-25' })
  await rpc('consommer_intrants_production', { production_id: pr.id, date: jour(8, 5), magasin_id: mag, lignes: [{ produit_id: P.NPK.id, quantite: 4800 }, { produit_id: P.UREE.id, quantite: 3600 }] })
  return 'casier Sud semé'
})

await etape('Personnel et paie (juillet et août)', async () => {
  await s.rpc('charger_modele_paie', { p_pays: 'SN' })
  await s.rpc('valider_parametrage_paie')
  const emp = [
    ['D-001', 'Amadou Ndiaye', 'permanent', 950000, deps.FONC, 'marie', 2], ['D-002', 'Moussa Sarr', 'permanent', 620000, deps.FONC, 'marie', 3],
    ['D-003', 'Cheikh Fall', 'permanent', 540000, deps.USIN, 'marie', 4], ['D-004', 'Ibrahima Diallo', 'permanent', 380000, deps.MATE, 'celibataire', 1],
    ['D-005', 'Mariama Sow', 'permanent', 340000, deps.USIN, 'celibataire', 1], ['D-006', 'Ousmane Thiam', 'permanent', 300000, deps.PROD, 'marie', 2],
  ]
  for (const [matricule, nom, statut, salaire, dep, situation, parts] of emp) {
    const e = await ins('employes', { matricule, nom, statut, date_embauche: '2025-03-01', departement_id: dep, situation_familiale: situation, nombre_conjoints: situation === 'marie' ? 1 : 0, nombre_enfants: Math.max(0, parts - 2), parts_ir: parts })
    await ins('contrats_travail', { employe_id: e.id, type: 'cdi', date_debut: '2025-03-01', salaire_base: salaire })
  }
  for (const mois of [7, 8]) {
    const per = await ins('periodes_paie', { annee: 2026, mois })
    ok(await s.rpc('calculer_paie', { p_periode_id: per.id }), 'calcul paie ' + mois)
    ok(await s.rpc('valider_paie', { p_periode_id: per.id }), 'validation paie ' + mois)
  }
  return '6 salariés, 2 paies validées'
})

await etape('Traçabilité et qualité', async () => {
  const lots = ok(await s.from('lots').select('id, numero, produit_id, statut').order('created_at'), 'lots')
  const de = (code) => lots.find((l) => l.produit_id === P[code].id)
  const paddy = de('PADDY'), riz = de('RIZ-B'), bris = de('BRIS')
  if (!paddy || !riz || !bris) throw new Error('lots automatiques introuvables')
  await rpc('enregistrer_controle', { lot_id: paddy.id, date: jour(6, 13), parametre: 'Humidité (%)', valeur: 13.5, minimum: 12, maximum: 14 })
  await rpc('changer_statut_lot', { lot_id: paddy.id, statut: 'libere' })
  await rpc('enregistrer_controle', { lot_id: riz.id, date: jour(6, 26), parametre: 'Taux de brisures (%)', valeur: 4.2, maximum: 5 })
  await rpc('enregistrer_controle', { lot_id: riz.id, date: jour(6, 26), parametre: 'Impuretés (%)', valeur: 0.3, maximum: 0.5 })
  await rpc('changer_statut_lot', { lot_id: riz.id, statut: 'libere' })
  await rpc('lier_lots', { lot_amont_id: paddy.id, lot_aval_id: riz.id, quantite: 60000 })
  await rpc('lier_lots', { lot_amont_id: paddy.id, lot_aval_id: bris.id, quantite: 60000 })
  await rpc('enregistrer_controle', { lot_id: bris.id, date: jour(6, 26), parametre: 'Humidité (%)', valeur: 16.8, maximum: 14 })   // non conforme : lot bloqué automatiquement
  await rpc('enregistrer_expedition', { lot_id: riz.id, date: jour(7, 10), quantite: 15000, tiers_id: T.minoterie.id })
  await rpc('enregistrer_expedition', { lot_id: riz.id, date: jour(7, 22), quantite: 12000, tiers_id: T.distribution.id })
  return 'lots liés, un lot bloqué, 2 expéditions'
})

await etape('Prévisions de trésorerie', async () => {
  const p = (libelle, categorie, sens, montant, date, recurrence = 'unique', fin = null) =>
    ins('previsions_tresorerie', { libelle, categorie, sens, montant, date_debut: date, recurrence, date_fin: fin })
  await p('Vente de la récolte d’hivernage', 'vente', 'encaissement', 42000000, '2026-12-10')
  await p('Loyer du terrain et redevances', 'autre', 'decaissement', 450000, '2026-10-01', 'mensuelle', '2027-03-01')
  await p('Achat d’une décortiqueuse', 'investissement', 'decaissement', 8500000, '2026-11-05')
  await p('Impôts et taxes (acompte)', 'impot', 'decaissement', 1200000, '2026-12-15')
  return '4 prévisions'
})

await etape('Rapprochement bancaire (relevé de septembre)', async () => {
  const lignes = [
    { date: jour(9, 2), libelle: 'FRAIS TENUE DE COMPTE', montant: -25000 },
    { date: jour(9, 8), libelle: 'AGIOS SEPTEMBRE', montant: -68000 },
  ]
  await rpc('importer_releve', { compte_tresorerie_id: banque, libelle: 'Relevé de septembre 2026', date_debut: jour(9, 1), date_fin: jour(9, 30), lignes })
  return '2 lignes à comptabiliser'
})

console.log(`\nTerminé : ${bilan.ok} étapes réussies${bilan.ko.length ? `, ${bilan.ko.length} en échec (${bilan.ko.join(' ; ')})` : ''}.`)
process.exit(bilan.ko.length ? 1 : 0)
