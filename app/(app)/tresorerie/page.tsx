import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addCompteTresorerie, addOperationTresorerie, addReglement } from '../operations/actions'

const aujourdhui = () => new Date().toISOString().slice(0, 10)

export default async function TresoreriePage() {
  const ctx = await getContexte()
  const o = await chargerOptions()
  const supabase = await createClient()
  const [{ data: soldes }, { data: reglements }, { data: operations }, { data: comptes }, { data: financements }] = await Promise.all([
    supabase.from('v_soldes_tresorerie').select('*').order('code'),
    supabase
      .from('reglements')
      .select('id, numero, date_reglement, sens, montant, reference, tiers:tiers_id(nom), comptes_tresorerie(code)')
      .order('date_reglement', { ascending: false }).limit(30),
    supabase
      .from('operations_tresorerie')
      .select('id, numero, date_operation, sens, montant, libelle, comptes_tresorerie(code)')
      .order('date_operation', { ascending: false }).limit(30),
    supabase.from('comptes_comptables').select('id, numero, libelle').eq('actif', true).order('numero'),
    supabase.from('contrats_financement').select('id, code, libelle').in('type', ['credit_campagne', 'fonds_commercialisation']).eq('statut', 'actif').order('code'),
  ])
  const peutEcrire = ['admin', 'comptable'].includes(ctx.role)
  const total = (soldes ?? []).reduce((s, x) => s + Number(x.solde), 0)
  const optCt = o.comptesTresorerie.map((c) => ({ value: c.id, label: c.label }))

  return (
    <>
      <PageHeader titre="Trésorerie" description="Encaissements des créances, paiements fournisseurs et autres opérations, avec leurs écritures.">
        <SimpleCreateForm
          titre="Règlement tiers"
          disabled={!peutEcrire}
          action={addReglement}
          champs={[
            { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: aujourdhui() },
            {
              name: 'sens', label: 'Sens', type: 'select', required: true,
              options: [
                { value: 'encaissement', label: 'Encaissement (client / producteur)' },
                { value: 'paiement', label: 'Paiement (fournisseur)' },
              ],
            },
            { name: 'tiers_id', label: 'Tiers', type: 'select', required: true, options: o.tousTiers.map((t) => ({ value: t.id, label: t.label })) },
            { name: 'montant', label: 'Montant', type: 'number', step: '0.01', required: true },
            { name: 'compte_tresorerie_id', label: 'Compte de trésorerie', type: 'select', required: true, options: optCt },
            { name: 'reference', label: 'Référence (chèque, virement…)' },
            {
              name: 'nature', label: 'Nature du paiement', type: 'select', defaultValue: 'courant',
              options: [
                { value: 'courant', label: 'Fournisseur courant (dette 401)' },
                { value: 'immobilisation', label: 'Fournisseur d’investissements (dette 481)' },
              ],
            },
            {
              name: 'contrat_financement_id', label: 'Financement utilisé (crédit de campagne / fonds de commercialisation)', type: 'select',
              options: financements?.map((f) => ({ value: f.id, label: `${f.code} — ${f.libelle}` })),
            },
          ]}
        />
        <SimpleCreateForm
          titre="Autre opération"
          disabled={!peutEcrire}
          action={addOperationTresorerie}
          champs={[
            { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: aujourdhui() },
            {
              name: 'sens', label: 'Sens', type: 'select', required: true,
              options: [{ value: 'encaissement', label: 'Encaissement' }, { value: 'decaissement', label: 'Décaissement' }],
            },
            { name: 'montant', label: 'Montant', type: 'number', step: '0.01', required: true },
            { name: 'compte_tresorerie_id', label: 'Compte de trésorerie', type: 'select', required: true, options: optCt },
            {
              name: 'contrepartie_compte_id', label: 'Compte de contrepartie', type: 'select', required: true,
              options: comptes?.map((c) => ({ value: c.id, label: `${c.numero} — ${c.libelle}` })),
            },
            { name: 'libelle', label: 'Libellé', required: true },
            { name: 'departement_id', label: 'Département (obligatoire pour charges/produits)', type: 'select', options: o.departements.map((d) => ({ value: d.id, label: d.label })) },
            { name: 'secteur_id', label: 'Secteur / projet (doit appartenir au département)', type: 'select', options: o.secteurs.map((s) => ({ value: s.id, label: s.label })) },
            { name: 'campagne_id', label: 'Campagne', type: 'select', options: o.campagnes.map((c) => ({ value: c.id, label: c.label })) },
          ]}
        />
        <SimpleCreateForm
          titre="Nouveau compte"
          disabled={!peutEcrire}
          action={addCompteTresorerie}
          champs={[
            { name: 'nom', label: 'Nom', required: true },
            { name: 'type', label: 'Type', type: 'select', required: true, options: [{ value: 'banque', label: 'Banque' }, { value: 'caisse', label: 'Caisse' }] },
          ]}
        />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {soldes?.map((s) => (
          <Card key={s.compte_tresorerie_id}>
            <p className="text-sm text-foreground-muted">{s.nom} ({s.type === 'banque' ? 'banque' : 'caisse'})</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${Number(s.solde) < 0 ? 'text-danger' : ''}`}>
              {formatMontant(s.solde, ctx.devise)}
            </p>
          </Card>
        ))}
        <Card>
          <p className="text-sm text-foreground-muted">Trésorerie totale</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatMontant(total, ctx.devise)}</p>
        </Card>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Règlements récents</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>N°</th><th className={th}>Date</th><th className={th}>Tiers</th>
              <th className={th}>Compte</th><th className={th}>Référence</th><th className={`${th} text-right`}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {reglements?.map((r) => {
              const t = Array.isArray(r.tiers) ? r.tiers[0] : r.tiers
              const c = Array.isArray(r.comptes_tresorerie) ? r.comptes_tresorerie[0] : r.comptes_tresorerie
              return (
                <tr key={r.id}>
                  <td className={td}>{r.numero}</td>
                  <td className={td}>{formatDate(r.date_reglement)}</td>
                  <td className={td}>{t?.nom}</td>
                  <td className={td}>{c?.code}</td>
                  <td className={td}>{r.reference ?? '—'}</td>
                  <td className={`${td} text-right tabular-nums ${r.sens === 'paiement' ? 'text-danger' : 'text-success'}`}>
                    {r.sens === 'paiement' ? '−' : '+'}{formatMontant(r.montant, ctx.devise)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Autres opérations</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>N°</th><th className={th}>Date</th><th className={th}>Libellé</th>
            <th className={th}>Compte</th><th className={`${th} text-right`}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {operations?.map((r) => {
            const c = Array.isArray(r.comptes_tresorerie) ? r.comptes_tresorerie[0] : r.comptes_tresorerie
            return (
              <tr key={r.id}>
                <td className={td}>{r.numero}</td>
                <td className={td}>{formatDate(r.date_operation)}</td>
                <td className={td}>{r.libelle}</td>
                <td className={td}>{c?.code}</td>
                <td className={`${td} text-right tabular-nums ${r.sens === 'decaissement' ? 'text-danger' : 'text-success'}`}>
                  {r.sens === 'decaissement' ? '−' : '+'}{formatMontant(r.montant, ctx.devise)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
