import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { cn, formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ReglementTiersForm } from '@/components/ReglementTiersForm'
import { addCompteTresorerie, addOperationTresorerie, addReglement } from '../operations/actions'

const aujourdhui = () => new Date().toISOString().slice(0, 10)

export default async function TresoreriePage({
  searchParams,
}: {
  searchParams: Promise<{ compte?: string }>
}) {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()
  const { compte: compteFiltre } = await searchParams
  const [{ data: soldes }, { data: reglements }, { data: operations }, { data: comptes }, { data: financements }] = await Promise.all([
    supabase.from('v_soldes_tresorerie').select('*').order('code'),
    (() => {
      let q = supabase
        .from('reglements')
        .select('id, numero, date_reglement, sens, montant, reference, tiers:tiers_id(nom), comptes_tresorerie(code)')
        .order('date_reglement', { ascending: false }).limit(30)
      if (compteFiltre) q = q.eq('compte_tresorerie_id', compteFiltre)
      return q
    })(),
    (() => {
      let q = supabase
        .from('operations_tresorerie')
        .select('id, numero, date_operation, sens, montant, libelle, comptes_tresorerie(code)')
        .order('date_operation', { ascending: false }).limit(30)
      if (compteFiltre) q = q.eq('compte_tresorerie_id', compteFiltre)
      return q
    })(),
    supabase.from('comptes_comptables').select('id, numero, libelle').eq('actif', true).order('numero'),
    supabase.from('contrats_financement').select('id, code, libelle').in('type', ['credit_campagne', 'fonds_commercialisation']).eq('statut', 'actif').order('code'),
  ])
  const peutEcrire = peutMenu(ctx, '/tresorerie', ['admin', 'comptable'])
  const total = (soldes ?? []).reduce((s, x) => s + Number(x.solde), 0)
  const optCt = o.comptesTresorerie.map((c) => ({ value: c.id, label: c.label }))

  return (
    <>
      <PageHeader titre={t('Trésorerie')} description={t('Encaissements des créances, paiements fournisseurs et autres opérations, avec leurs écritures.')}>
        <ReglementTiersForm
          disabled={!peutEcrire}
          action={addReglement}
          clients={o.clients}
          producteurs={o.producteurs}
          fournisseurs={o.fournisseurs}
          comptesTresorerie={optCt.map((c) => ({ id: c.value, label: c.label }))}
          financements={(financements ?? []).map((f) => ({ id: f.id, label: `${f.code} — ${f.libelle}` }))}
        />
        <SimpleCreateForm
          titre={t('Autre opération')}
          disabled={!peutEcrire}
          action={addOperationTresorerie}
          champs={[
            { name: 'date', label: t('Date'), type: 'date', required: true, defaultValue: aujourdhui() },
            {
              name: 'sens', label: t('Sens'), type: 'select', required: true,
              options: [{ value: 'encaissement', label: t('Encaissement') }, { value: 'decaissement', label: t('Décaissement') }],
            },
            { name: 'montant', label: t('Montant'), type: 'number', step: '0.01', required: true },
            { name: 'compte_tresorerie_id', label: t('Compte de trésorerie'), type: 'select', required: true, options: optCt },
            {
              name: 'contrepartie_compte_id', label: t('Compte de contrepartie'), type: 'select', required: true,
              options: comptes?.map((c) => ({ value: c.id, label: `${c.numero} — ${c.libelle}` })),
            },
            { name: 'libelle', label: t('Libellé'), required: true },
            { name: 'departement_id', label: t('Département (obligatoire pour charges/produits)'), type: 'select', options: o.departements.map((d) => ({ value: d.id, label: d.label })) },
            { name: 'secteur_id', label: t('Secteur / projet (doit appartenir au département)'), type: 'select', options: o.secteurs.map((s) => ({ value: s.id, label: s.label })) },
            { name: 'campagne_id', label: t('Campagne'), type: 'select', options: o.campagnes.map((c) => ({ value: c.id, label: c.label })) },
          ]}
        />
        <SimpleCreateForm
          titre={t('Nouveau compte')}
          disabled={!peutEcrire}
          action={addCompteTresorerie}
          champs={[
            { name: 'nom', label: t('Nom'), required: true },
            { name: 'type', label: t('Type'), type: 'select', required: true, options: [{ value: 'banque', label: t('Banque') }, { value: 'caisse', label: t('Caisse') }] },
          ]}
        />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {soldes?.map((s) => {
          const actif = compteFiltre === s.compte_tresorerie_id
          return (
            <Card key={s.compte_tresorerie_id}>
              <p className="text-sm text-foreground-muted">
                {s.nom} (
                <Link
                  href={actif ? '/tresorerie' : `/tresorerie?compte=${s.compte_tresorerie_id}`}
                  className={cn(
                    'rounded underline decoration-dotted underline-offset-2 hover:text-primary',
                    actif && 'font-semibold text-primary no-underline'
                  )}
                  title={actif ? t('Cliquer pour retirer le filtre') : t('Filtrer sur ce compte')}
                >
                  {s.type === 'banque' ? 'banque' : 'caisse'}
                </Link>
                )
              </p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${Number(s.solde) < 0 ? 'text-danger' : ''}`}>
                {formatMontant(s.solde, ctx.devise, ctx.lang)}
              </p>
            </Card>
          )
        })}
        <Card>
          <p className="text-sm text-foreground-muted">{t('Trésorerie totale')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatMontant(total, ctx.devise, ctx.lang)}</p>
        </Card>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Règlements récents')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>N°</th><th className={th}>{t('Date')}</th><th className={th}>{t('Tiers')}</th>
              <th className={th}>{t('Compte')}</th><th className={th}>{t('Référence')}</th><th className={`${th} text-right`}>{t('Montant')}</th>
            </tr>
          </thead>
          <tbody>
            {reglements?.map((r) => {
              const t = Array.isArray(r.tiers) ? r.tiers[0] : r.tiers
              const c = Array.isArray(r.comptes_tresorerie) ? r.comptes_tresorerie[0] : r.comptes_tresorerie
              return (
                <tr key={r.id}>
                  <td className={td}>{r.numero}</td>
                  <td className={td}>{formatDate(r.date_reglement, ctx.lang)}</td>
                  <td className={td}>{t?.nom}</td>
                  <td className={td}>{c?.code}</td>
                  <td className={td}>{r.reference ?? '—'}</td>
                  <td className={`${td} text-right tabular-nums ${r.sens === 'paiement' ? 'text-danger' : 'text-success'}`}>
                    {r.sens === 'paiement' ? '−' : '+'}{formatMontant(r.montant, ctx.devise, ctx.lang)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Autres opérations')}</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>N°</th><th className={th}>{t('Date')}</th><th className={th}>{t('Libellé')}</th>
            <th className={th}>{t('Compte')}</th><th className={`${th} text-right`}>{t('Montant')}</th>
          </tr>
        </thead>
        <tbody>
          {operations?.map((r) => {
            const c = Array.isArray(r.comptes_tresorerie) ? r.comptes_tresorerie[0] : r.comptes_tresorerie
            return (
              <tr key={r.id}>
                <td className={td}>{r.numero}</td>
                <td className={td}>{formatDate(r.date_operation, ctx.lang)}</td>
                <td className={td}>{r.libelle}</td>
                <td className={td}>{c?.code}</td>
                <td className={`${td} text-right tabular-nums ${r.sens === 'decaissement' ? 'text-danger' : 'text-success'}`}>
                  {r.sens === 'decaissement' ? '−' : '+'}{formatMontant(r.montant, ctx.devise, ctx.lang)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
