import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { importerReleve } from './actions'

export default async function RapprochementPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()
  const [{ data: releves }, { data: lignes }, { data: comptes }] = await Promise.all([
    supabase.from('releves_bancaires').select('*').order('date_fin', { ascending: false }),
    supabase.from('lignes_releve').select('releve_id, ligne_ecriture_id'),
    supabase.from('comptes_tresorerie').select('id, nom'),
  ])
  const nomCompte = new Map((comptes ?? []).map((c) => [c.id, t(c.nom)]))
  const total = new Map<string, number>()
  const pointees = new Map<string, number>()
  for (const l of lignes ?? []) {
    total.set(l.releve_id, (total.get(l.releve_id) ?? 0) + 1)
    if (l.ligne_ecriture_id) pointees.set(l.releve_id, (pointees.get(l.releve_id) ?? 0) + 1)
  }
  const peutEcrire = peutMenu(ctx, '/tresorerie/rapprochement', ['admin', 'comptable'])

  return (
    <>
      <PageHeader
        titre={t('Rapprochement bancaire')}
        description={t('Importez le relevé de la banque (CSV) et pointez chaque ligne avec les écritures de la comptabilité. Les lignes absentes des livres (frais bancaires, virements non saisis) se comptabilisent d’ici.')}
      >
        <SimpleCreateForm
          titre={t('Importer un relevé')}
          disabled={!peutEcrire}
          action={importerReleve}
          champs={[
            { name: 'compte_tresorerie_id', label: t('Compte bancaire'), type: 'select', required: true, options: o.comptesTresorerie.map((c) => ({ value: c.id, label: c.label })) },
            { name: 'fichier', label: t('Fichier CSV (date ; libellé ; référence ; montant)'), type: 'file', required: true, accept: '.csv,text/csv' },
            { name: 'libelle', label: t('Libellé du relevé (ex. Relevé de mai)') },
            { name: 'solde_initial', label: t('Solde initial du relevé'), type: 'number', step: '0.01' },
            { name: 'solde_final', label: t('Solde final du relevé'), type: 'number', step: '0.01' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Relevé')}</th>
            <th className={th}>{t('Compte')}</th>
            <th className={th}>{t('Période')}</th>
            <th className={`${th} text-right`}>{t('Lignes pointées')}</th>
          </tr>
        </thead>
        <tbody>
          {releves?.map((r) => (
            <tr key={r.id}>
              <td className={td}><Link href={`/tresorerie/rapprochement/${r.id}`} className="font-medium text-primary underline">{r.libelle}</Link></td>
              <td className={td}>{nomCompte.get(r.compte_tresorerie_id)}</td>
              <td className={td}>{formatDate(r.date_debut, ctx.lang)} → {formatDate(r.date_fin, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums ${(pointees.get(r.id) ?? 0) === (total.get(r.id) ?? 0) ? 'text-success' : ''}`}>
                {pointees.get(r.id) ?? 0} / {total.get(r.id) ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
