import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addSubvention, encaisserSubvention } from '../financement/actions'

export default async function SubventionsPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()
  const [{ data: subventions }, { data: materiels }] = await Promise.all([
    supabase.from('v_subventions').select('*, tiers:bailleur_id(nom)').order('date_octroi', { ascending: false }),
    supabase.from('materiels').select('id, code, designation').order('code'),
  ])
  const peutEcrire = peutMenu(ctx, '/subventions', ['admin', 'comptable', 'direction'])
  const peutEncaisser = peutMenu(ctx, '/subventions', ['admin', 'comptable'], 'modifier')

  return (
    <>
      <PageHeader
        titre={t('Subventions d’investissement')}
        description={t('Le matériel reste inscrit à son coût global. À chaque dotation, la part financée par la subvention (taux = subvention ÷ coût) est reprise au résultat (865) et déduite du compte 14.')}
      >
        <SimpleCreateForm
          titre={t('Nouvelle subvention')}
          disabled={!peutEcrire}
          action={addSubvention}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'libelle', label: t('Libellé'), required: true },
            { name: 'bailleur_id', label: t('Bailleur'), type: 'select', required: true, options: o.bailleurs.map((b) => ({ value: b.id, label: b.label })) },
            { name: 'montant_accorde', label: t('Montant accordé (ou laissez vide et indiquez le taux)'), type: 'number', step: '0.01' },
            { name: 'taux_subvention', label: t('ou taux de subvention (% du coût du matériel : 50, 70…)'), type: 'number', step: '0.01' },
            { name: 'date_octroi', label: t('Date d’octroi'), type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            {
              name: 'materiel_id', label: t('Matériel financé (pour la reprise)'), type: 'select',
              options: materiels?.map((m) => ({ value: m.id, label: `${m.code} — ${m.designation}` })),
            },
          ]}
        />
        <SimpleCreateForm
          titre={t('Encaisser une subvention')}
          disabled={!peutEncaisser}
          action={encaisserSubvention}
          champs={[
            { name: 'subvention_id', label: t('Subvention'), type: 'select', required: true, options: subventions?.map((s) => ({ value: s.id, label: `${s.code} — ${s.libelle}` })) },
            { name: 'date', label: t('Date'), type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            { name: 'montant', label: t('Montant encaissé'), type: 'number', step: '0.01', required: true },
            { name: 'compte_tresorerie_id', label: t('Compte crédité'), type: 'select', required: true, options: o.comptesTresorerie.map((c) => ({ value: c.id, label: c.label })) },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Libellé')}</th>
            <th className={th}>{t('Bailleur')}</th>
            <th className={th}>{t('Octroi')}</th>
            <th className={`${th} text-right`}>{t('Taux du coût')}</th>
            <th className={`${th} text-right`}>{t('Accordé')}</th>
            <th className={`${th} text-right`}>{t('Encaissé')}</th>
            <th className={`${th} text-right`}>{t('Repris au résultat')}</th>
            <th className={`${th} text-right`}>{t('Solde compte 14')}</th>
          </tr>
        </thead>
        <tbody>
          {subventions?.map((s) => {
            const b = Array.isArray(s.tiers) ? s.tiers[0] : s.tiers
            return (
              <tr key={s.id}>
                <td className={td}>{s.code}</td>
                <td className={td}>{s.libelle}</td>
                <td className={td}>{b?.nom}</td>
                <td className={td}>{formatDate(s.date_octroi, ctx.lang)}</td>
                <td className={`${td} text-right`}>{s.taux_financement != null ? `${Number(s.taux_financement)} %` : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(s.montant_accorde, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(s.montant_encaisse, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(s.reprises_cumulees, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(s.solde_compte_14, ctx.devise, ctx.lang)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
