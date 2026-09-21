#!/usr/bin/env node
/**
 * Crée l'entreprise de démonstration « Riz du Delta » avec des données réalistes de bout en bout :
 * exercices, campagnes, achats, production, usine, ventes, financement, trésorerie, personnel et paie, lots et contrôles qualité,
 * prévisions, rapprochement bancaire.
 *
 *   node scripts/seed-demo.mjs
 *
 * Nécessite NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY (fichier .env.local).
 * Comptes (connexion automatique depuis /decouvrir-dagrobusiness, aucun mot de passe communiqué) :
 *   direction@ / comptable@ / rh@demo-agro.dembasolution.com, plus admin@ (propriétaire, non proposé au public).
 * Le script est reprenable : chaque étape vérifie ce qui existe déjà et ne recrée rien, donc une coupure réseau ne demande
 * qu'à le relancer.
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

/** Rejoue un appel réseau en cas d'échec transitoire (« fetch failed »). */
async function reessayer(fn, tentatives = 4) {
  let derniere
  for (let i = 1; i <= tentatives; i++) {
    try {
      return await fn()
    } catch (e) {
      derniere = e
      await new Promise((r) => setTimeout(r, 800 * i))
    }
  }
  throw derniere
}

const bilan = { ok: 0, ignore: 0, ko: [] }
async function etape(nom, fn) {
  try {
    const detail = await reessayer(fn, 1).catch((e) => { throw e })
    if (detail === 'déjà fait') { bilan.ignore++; console.log('--  ' + nom + '  (déjà fait)') }
    else { bilan.ok++; console.log('OK  ' + nom + (detail ? '  -> ' + detail : '')) }
  } catch (e) {
    bilan.ko.push(nom)
    console.log('KO  ' + nom + '  -> ' + (e?.message ?? e))
  }
}
const ok = (r, ctx) => {
  if (r.error) throw new Error(`${ctx} : ${r.error.message}`)
  return r.data
}

// ---------- Compte propriétaire et organisation ----------
async function trouverUtilisateur(email) {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await reessayer(() => admin.auth.admin.listUsers({ page, perPage: 200 }))
    if (error) throw error
    const u = data.users.find((x) => x.email?.toLowerCase() === email)
    if (u) return u
    if (data.users.length < 200) return null
  }
  return null
}

let orgId
await etape('Entreprise et compte propriétaire', async () => {
  let u = await trouverUtilisateur(ADMIN.email)
  let dejaFait = Boolean(u)
  if (u) {
    // mot de passe renouvelé : le propriétaire n'est jamais utilisé par le public, le script a seulement besoin d'une session
    ok(await reessayer(() => admin.auth.admin.updateUserById(u.id, { password: ADMIN.mdp })), 'mot de passe')
  } else {
    const { data, error } = await reessayer(() => admin.auth.admin.createUser({
      email: ADMIN.email, password: ADMIN.mdp, email_confirm: true,
      user_metadata: { organisation_nom: 'Riz du Delta', nom_complet: ADMIN.nom, pays: 'SN' },
    }))
    if (error) throw error
    u = data.user
  }
  const ligne = ok(await reessayer(() => admin.from('utilisateurs').select('organisation_id').eq('id', u.id).single()), 'utilisateur')
  orgId = ligne.organisation_id
  // organisation de démonstration : Premium sans échéance, exclue des chiffres réels
  ok(await reessayer(() => admin.from('organisations').update({ demo: true, niveau: 'premium', abonnement_expire_le: '2099-12-31T00:00:00Z', essai_expire_le: '2099-12-31T00:00:00Z', adresse: 'Ross-Béthio, delta du fleuve Sénégal' }).eq('id', orgId)), 'organisation')
  return dejaFait ? 'déjà fait' : orgId
})
if (!orgId) process.exit(1)

await etape('Comptes de démonstration (direction, comptable, RH)', async () => {
  let crees = 0
  for (const c of COMPTES) {
    let u = await trouverUtilisateur(c.email)
    if (!u) {
      const { data, error } = await reessayer(() => admin.auth.admin.createUser({ email: c.email, password: randomBytes(24).toString('base64url') + 'aA1!', email_confirm: true, user_metadata: { nom_complet: c.nom } }))
      if (error) throw error
      u = data.user
      crees++
    }
    const existe = await reessayer(() => admin.from('utilisateurs').select('id').eq('id', u.id).maybeSingle())
    if (!existe.data) ok(await reessayer(() => admin.from('utilisateurs').insert({ id: u.id, organisation_id: orgId, nom_complet: c.nom, role: c.role })), 'utilisateur ' + c.role)
  }
  return crees ? crees + ' comptes' : 'déjà fait'
})

ok(await reessayer(() => s.auth.signInWithPassword({ email: ADMIN.email, password: ADMIN.mdp })), 'connexion propriétaire')
const rpc = async (fn, p) => ok(await reessayer(() => s.rpc(fn, { p })), fn)
const insere = async (table, row) => ok(await reessayer(() => s.from(table).insert({ organisation_id: orgId, ...row }).select().single()), table)
/** Retrouve une ligne par ses colonnes d'identité, sinon la crée. */
async function assurer(table, identite, row = {}) {
  let q = s.from(table).select('*').eq('organisation_id', orgId)
  for (const [k, v] of Object.entries(identite)) q = q.eq(k, v)
  const existant = ok(await reessayer(() => q.maybeSingle()), table)
  return existant ?? insere(table, { ...identite, ...row })
}
const nombre = async (table, filtre = (q) => q) => (await reessayer(() => filtre(s.from(table).select('id', { count: 'exact', head: true }))))?.count ?? 0
const jour = (mois, j) => `2026-${String(mois).padStart(2, '0')}-${String(j).padStart(2, '0')}`

const deps = Object.fromEntries(ok(await reessayer(() => s.from('departements').select('id, code')), 'departements').map((d) => [d.code, d.id]))
const mag = ok(await reessayer(() => s.from('magasins').select('id').eq('code', 'MAG1').single()), 'magasin').id
const banque = ok(await reessayer(() => s.from('comptes_tresorerie').select('id, type')), 'comptes').find((c) => c.type === 'banque').id
const T = {}, P = {}, C = {}

await etape('Exercices comptables 2025 et 2026', async () => {
  await assurer('exercices_comptables', { libelle: 'Exercice 2025' }, { date_debut: '2025-01-01', date_fin: '2025-12-31' })
  await assurer('exercices_comptables', { libelle: 'Exercice 2026' }, { date_debut: '2026-01-01', date_fin: '2026-12-31' })
  return '2 exercices'
})

await etape('Tiers (fournisseurs, coopérative, clients, banque)', async () => {
  const defs = [
    ['F001', 'Semences du Delta', 'fournisseur', '+221 33 961 00 01'], ['F002', 'Agro-Intrants du Sahel', 'fournisseur', '+221 33 961 00 02'],
    ['P001', 'Coopérative de Ross-Béthio', 'producteur', null], ['C001', 'Minoterie de Dakar', 'client', '+221 33 822 10 10'],
    ['C002', 'Grande Distribution du Sénégal', 'client', null], ['C003', 'Export Riz Afrique SARL', 'client', null], ['B001', 'Banque Agricole du Sénégal', 'bailleur', null],
  ]
  const cles = { F001: 'semences', F002: 'intrants', P001: 'coop', C001: 'minoterie', C002: 'distribution', C003: 'export', B001: 'banque' }
  for (const [code, nom, type, telephone] of defs) T[cles[code]] = await assurer('tiers', { code }, { nom, types: [type], telephone })
  return '7 tiers'
})

await etape('Produits', async () => {
  const defs = [
    ['SEM-RIZ', 'Semences de riz certifiées', 'semence', 'kg'], ['NPK', 'Engrais NPK 15-15-15', 'intrant', 'kg'], ['UREE', 'Urée 46 %', 'intrant', 'kg'],
    ['HERB', 'Herbicide riz', 'intrant', 'l'], ['PADDY', 'Paddy', 'produit_agricole', 'kg'], ['RIZ-B', 'Riz blanc 25 kg', 'produit_fini', 'kg'],
    ['BRIS', 'Brisures de riz', 'sous_produit', 'kg'], ['SON', 'Son de riz', 'sous_produit', 'kg'],
  ]
  for (const [code, nom, categorie, unite] of defs) P[code] = await assurer('produits', { code }, { nom, categorie, unite, taux_tva: 0 })
  return defs.length + ' produits'
})

await etape('Secteurs et campagnes', async () => {
  C.nord = await assurer('secteurs_projets', { code: 'CAS-N' }, { departement_id: deps.PROD, nom: 'Casier Nord', nature: 'secteur', superficie_ha: 120 })
  C.sud = await assurer('secteurs_projets', { code: 'CAS-S' }, { departement_id: deps.PROD, nom: 'Casier Sud', nature: 'secteur', superficie_ha: 80 })
  C.cs = await assurer('campagnes', { code: 'CS2026' }, { libelle: 'Contre-saison chaude 2026', date_debut: '2026-02-01', date_fin: '2026-07-31' })
  C.hiv = await assurer('campagnes', { code: 'HIV2026' }, { libelle: 'Hivernage 2026', date_debut: '2026-07-01', date_fin: '2026-12-31' })
  return '2 secteurs, 2 campagnes'
})

await etape('Capital et financement bancaire', async () => {
  if ((await nombre('contrats_financement')) > 0) return 'déjà fait'
  const capital = ok(await reessayer(() => s.from('comptes_comptables').select('id').eq('numero', '10').maybeSingle()), 'compte 10').id
  await rpc('enregistrer_operation_tresorerie', { date: jour(1, 15), sens: 'encaissement', montant: 30000000, compte_tresorerie_id: banque, contrepartie_compte_id: capital, libelle: 'Apport en capital des associés' })
  const emp = await insere('contrats_financement', { code: 'EMP-TRACT', libelle: 'Emprunt investissement — tracteurs et moissonneuse', type: 'emprunt_investissement', bailleur_id: T.banque.id, departement_id: deps.MATE, montant_accorde: 24000000, taux_annuel: 9, duree_mois: 24, periodicite_mois: 1, mode_remboursement: 'annuite_constante', date_debut: jour(2, 1) })
  ok(await reessayer(() => s.rpc('generer_echeancier', { p_contrat_id: emp.id })), 'échéancier')
  await rpc('enregistrer_tirage', { contrat_id: emp.id, date: jour(2, 5), montant: 24000000, compte_tresorerie_id: banque })
  const ech = ok(await reessayer(() => s.from('echeances_financement').select('id, numero').eq('contrat_id', emp.id).order('numero')), 'échéances')
  for (const e of ech.slice(0, 6)) await rpc('rembourser_echeance', { echeance_id: e.id, date: jour(2 + e.numero, 1), compte_tresorerie_id: banque })
  return '30 M capital, emprunt 24 M, 6 échéances payées'
})

await etape('Achats d’intrants et de semences', async () => {
  if ((await nombre('achats')) > 0) return 'déjà fait'
  await rpc('enregistrer_achat', { date: jour(2, 10), fournisseur_id: T.semences.id, magasin_id: mag, campagne_id: C.cs.id, lignes: [{ produit_id: P['SEM-RIZ'].id, quantite: 6000, prix_unitaire: 550 }] })
  await rpc('enregistrer_achat', { date: jour(2, 12), fournisseur_id: T.intrants.id, magasin_id: mag, campagne_id: C.cs.id, lignes: [
    { produit_id: P.NPK.id, quantite: 12000, prix_unitaire: 420 }, { produit_id: P.UREE.id, quantite: 9000, prix_unitaire: 380 }, { produit_id: P.HERB.id, quantite: 600, prix_unitaire: 3800 }] })
  await rpc('enregistrer_achat', { date: jour(7, 8), fournisseur_id: T.intrants.id, magasin_id: mag, campagne_id: C.hiv.id, lignes: [
    { produit_id: P.NPK.id, quantite: 8000, prix_unitaire: 430 }, { produit_id: P.UREE.id, quantite: 6000, prix_unitaire: 390 }] })
  await rpc('enregistrer_reglement', { date: jour(3, 1), sens: 'paiement', tiers_id: T.semences.id, montant: 3300000, compte_tresorerie_id: banque })
  await rpc('enregistrer_reglement', { date: jour(3, 5), sens: 'paiement', tiers_id: T.intrants.id, montant: 9000000, compte_tresorerie_id: banque })
  return '3 achats, 2 règlements'
})

await etape('Contre-saison : intrants consommés, charges du casier et récolte de paddy', async () => {
  if ((await nombre('recoltes')) > 0) return 'déjà fait'
  const prod = await assurer('productions', { code: 'PR-CS26-N' }, { secteur_id: C.nord.id, campagne_id: C.cs.id, produit_id: P.PADDY.id, superficie_ha: 120, date_semis: jour(2, 20), date_recolte_prevue: jour(6, 15) })
  if ((await nombre('consommations_production', (q) => q.eq('production_id', prod.id))) === 0) {
    await rpc('consommer_intrants_production', { production_id: prod.id, date: jour(2, 20), magasin_id: mag, lignes: [{ produit_id: P['SEM-RIZ'].id, quantite: 3600 }] })
    await rpc('consommer_intrants_production', { production_id: prod.id, date: jour(3, 15), magasin_id: mag, lignes: [{ produit_id: P.NPK.id, quantite: 7200 }, { produit_id: P.UREE.id, quantite: 5400 }] })
    await rpc('consommer_intrants_production', { production_id: prod.id, date: jour(4, 10), magasin_id: mag, lignes: [{ produit_id: P.HERB.id, quantite: 360 }] })
  }
  const paie = ok(await reessayer(() => s.from('comptes_comptables').select('id').eq('numero', '661').maybeSingle()), 'compte 661').id
  if ((await nombre('operations_tresorerie', (q) => q.like('libelle', 'Main-d%'))) === 0) await rpc('enregistrer_operation_tresorerie', { date: jour(4, 30), sens: 'decaissement', montant: 3600000, compte_tresorerie_id: banque, contrepartie_compte_id: paie, libelle: 'Main-d’œuvre saisonnière — repiquage et récolte', departement_id: deps.PROD, secteur_id: C.nord.id, campagne_id: C.cs.id })
  const services = ok(await reessayer(() => s.from('comptes_comptables').select('id').eq('numero', '62').maybeSingle()), 'compte 62').id
  if ((await nombre('operations_tresorerie', (q) => q.like('libelle', 'Redevance%'))) === 0) await rpc('enregistrer_operation_tresorerie', { date: jour(5, 5), sens: 'decaissement', montant: 1800000, compte_tresorerie_id: banque, contrepartie_compte_id: services, libelle: 'Redevance hydraulique et carburant de pompage', departement_id: deps.PROD, secteur_id: C.nord.id, campagne_id: C.cs.id })
  await rpc('enregistrer_recolte', { production_id: prod.id, date: jour(6, 12), magasin_id: mag, produit_id: P.PADDY.id, quantite: 78000, observation: 'Récolte du casier Nord — rendement 6,5 t/ha' })
  return 'récolte de 78 t de paddy'
})

await etape('Usine : nomenclature et transformation du paddy', async () => {
  if ((await nombre('ordres_fabrication')) > 0) return 'déjà fait'
  const nom = await assurer('nomenclatures', { code: 'DECORT-STD' }, { libelle: 'Décorticage et blanchiment du paddy', matiere_id: P.PADDY.id })
  await assurer('nomenclature_sorties', { nomenclature_id: nom.id, produit_id: P['RIZ-B'].id }, { rendement_pct: 65, principal: true })
  await assurer('nomenclature_sorties', { nomenclature_id: nom.id, produit_id: P.BRIS.id }, { rendement_pct: 10, principal: false })
  await assurer('nomenclature_sorties', { nomenclature_id: nom.id, produit_id: P.SON.id }, { rendement_pct: 8, principal: false })
  await rpc('lancer_transformation', { date: jour(6, 25), nomenclature_id: nom.id, magasin_source_id: mag, magasin_destination_id: mag, departement_id: deps.USIN, campagne_id: C.cs.id, quantite_matiere: 60000, frais_imputes: 900000, observation: 'Première campagne de transformation' })
  return '60 t de paddy transformées'
})

await etape('Ventes et encaissements', async () => {
  if ((await nombre('ventes')) > 0) return 'déjà fait'
  const v = (client, date, lignes) => rpc('enregistrer_vente', { type: 'marche', date, client_id: client.id, magasin_id: mag, departement_id: deps.USIN, campagne_id: C.cs.id, lignes })
  await v(T.minoterie, jour(7, 10), [{ produit_id: P['RIZ-B'].id, quantite: 15000, prix_unitaire: 480 }])
  await v(T.distribution, jour(7, 22), [{ produit_id: P['RIZ-B'].id, quantite: 12000, prix_unitaire: 495 }])
  await v(T.export, jour(8, 14), [{ produit_id: P['RIZ-B'].id, quantite: 10000, prix_unitaire: 470 }, { produit_id: P.BRIS.id, quantite: 3000, prix_unitaire: 210 }])
  await v(T.minoterie, jour(9, 5), [{ produit_id: P.SON.id, quantite: 4000, prix_unitaire: 90 }])
  await rpc('enregistrer_reglement', { date: jour(7, 30), sens: 'encaissement', tiers_id: T.minoterie.id, montant: 7200000, compte_tresorerie_id: banque })
  await rpc('enregistrer_reglement', { date: jour(8, 20), sens: 'encaissement', tiers_id: T.distribution.id, montant: 5940000, compte_tresorerie_id: banque })
  return '4 ventes, 2 encaissements (des créances restent ouvertes)'
})

await etape('Hivernage 2026 en cours : production et intrants', async () => {
  const pr = await assurer('productions', { code: 'PR-HIV26-S' }, { secteur_id: C.sud.id, campagne_id: C.hiv.id, produit_id: P.PADDY.id, superficie_ha: 80, date_semis: jour(7, 20), date_recolte_prevue: '2026-11-25' })
  if ((await nombre('consommations_production', (q) => q.eq('production_id', pr.id))) > 0) return 'déjà fait'
  await rpc('consommer_intrants_production', { production_id: pr.id, date: jour(8, 5), magasin_id: mag, lignes: [{ produit_id: P.NPK.id, quantite: 4800 }, { produit_id: P.UREE.id, quantite: 3600 }] })
  return 'casier Sud semé'
})

await etape('Personnel et paie (juillet et août)', async () => {
  if ((await nombre('periodes_paie', (q) => q.eq('annee', 2026).eq('mois', 8))) > 0) return 'déjà fait'
  await reessayer(() => s.rpc('charger_modele_paie', { p_pays: 'SN' }))
  await reessayer(() => s.rpc('valider_parametrage_paie'))
  const emp = [
    ['D-001', 'Amadou Ndiaye', 950000, deps.FONC, 'marie', 2], ['D-002', 'Moussa Sarr', 620000, deps.FONC, 'marie', 3],
    ['D-003', 'Cheikh Fall', 540000, deps.USIN, 'marie', 4], ['D-004', 'Ibrahima Diallo', 380000, deps.MATE, 'celibataire', 1],
    ['D-005', 'Mariama Sow', 340000, deps.USIN, 'celibataire', 1], ['D-006', 'Ousmane Thiam', 300000, deps.PROD, 'marie', 2],
  ]
  for (const [matricule, nom, salaire, dep, situation, parts] of emp) {
    const e = await assurer('employes', { matricule }, { nom, statut: 'permanent', date_embauche: '2025-03-01', departement_id: dep, situation_familiale: situation, nombre_conjoints: situation === 'marie' ? 1 : 0, nombre_enfants: Math.max(0, parts - 2), parts_ir: parts })
    await assurer('contrats_travail', { employe_id: e.id }, { type: 'cdi', date_debut: '2025-03-01', salaire_base: salaire })
  }
  for (const mois of [7, 8]) {
    const per = await assurer('periodes_paie', { annee: 2026, mois })
    ok(await reessayer(() => s.rpc('calculer_paie', { p_periode_id: per.id })), 'calcul paie ' + mois)
    ok(await reessayer(() => s.rpc('valider_paie', { p_periode_id: per.id })), 'validation paie ' + mois)
  }
  return '6 salariés, 2 paies validées'
})

await etape('Traçabilité et qualité', async () => {
  if ((await nombre('controles_qualite')) > 0) return 'déjà fait'
  const lots = ok(await reessayer(() => s.from('lots').select('id, numero, produit_id, statut').order('created_at')), 'lots')
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
  if ((await nombre('previsions_tresorerie')) > 0) return 'déjà fait'
  const p = (libelle, categorie, sens, montant, date, recurrence = 'unique', fin = null) =>
    insere('previsions_tresorerie', { libelle, categorie, sens, montant, date_debut: date, recurrence, date_fin: fin })
  await p('Vente de la récolte d’hivernage', 'vente', 'encaissement', 42000000, '2026-12-10')
  await p('Loyer du terrain et redevances', 'autre', 'decaissement', 450000, '2026-10-01', 'mensuelle', '2027-03-01')
  await p('Achat d’une décortiqueuse', 'investissement', 'decaissement', 8500000, '2026-11-05')
  await p('Impôts et taxes (acompte)', 'impot', 'decaissement', 1200000, '2026-12-15')
  return '4 prévisions'
})

await etape('Rapprochement bancaire (relevé de septembre)', async () => {
  if ((await nombre('releves_bancaires')) > 0) return 'déjà fait'
  await rpc('importer_releve', { compte_tresorerie_id: banque, libelle: 'Relevé de septembre 2026', date_debut: jour(9, 1), date_fin: jour(9, 30), lignes: [
    { date: jour(9, 2), libelle: 'FRAIS TENUE DE COMPTE', montant: -25000 },
    { date: jour(9, 8), libelle: 'AGIOS SEPTEMBRE', montant: -68000 },
  ] })
  return '2 lignes à comptabiliser'
})

console.log(`\nTerminé : ${bilan.ok} étape(s) réalisée(s), ${bilan.ignore} déjà faite(s)${bilan.ko.length ? `, ${bilan.ko.length} en échec (${bilan.ko.join(' ; ')})` : ''}.`)
process.exit(bilan.ko.length ? 1 : 0)
