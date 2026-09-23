import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT, LOCALES } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { COULEURS_STATUT, ORIGINES_LOT, STATUTS_LOT } from '@/lib/tracabilite'
import { creerLot } from './actions'

export default async function TracabilitePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()
  const { data: lots } = await supabase.from('v_lots').select('*').order('created_at', { ascending: false }).limit(500)
  const peutEcrire = peutMenu(ctx, '/tracabilite', ['admin', 'comptable', 'chef_departement'])
  const aujourdhui = new Date().toISOString().slice(0, 10)

  return (
    <>
      <PageHeader
        titre={t('Traçabilité et qualité')}
        description={t('Chaque récolte et chaque fabrication crée un lot. Suivez son origine, ses contrôles qualité et ses expéditions, et retrouvez en un clic les clients concernés en cas de rappel.')}
      >
        <SimpleCreateForm
          titre={t('Nouveau lot')}
          disabled={!peutEcrire}
          action={creerLot}
          champs={[
            { name: 'produit_id', label: t('Produit'), type: 'select', required: true, options: o.produits.filter((p) => p.categorie !== 'service').map((p) => ({ value: p.id, label: p.label })) },
            { name: 'origine', label: t('Origine'), type: 'select', defaultValue: 'achat', options: [{ value: 'achat', label: t('Achat') }, { value: 'autre', label: t('Autre') }] },
            { name: 'date', label: t('Date'), type: 'date', required: true, defaultValue: aujourdhui },
            { name: 'quantite', label: t('Quantité'), type: 'number', step: '0.001', required: true },
            { name: 'date_peremption', label: t('Date de péremption'), type: 'date' },
            { name: 'observation', label: t('Observation') },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Lot')}</th>
            <th className={th}>{t('Produit')}</th>
            <th className={th}>{t('Origine')}</th>
            <th className={th}>{t('Date')}</th>
            <th className={`${th} text-right`}>{t('Quantité')}</th>
            <th className={`${th} text-right`}>{t('Expédié')}</th>
            <th className={th}>{t('Péremption')}</th>
            <th className={`${th} text-right`}>{t('Contrôles')}</th>
            <th className={th}>{t('Statut')}</th>
          </tr>
        </thead>
        <tbody>
          {lots?.map((l) => (
            <tr key={l.id}>
              <td className={td}><Link href={`/tracabilite/${l.id}`} className="font-medium text-primary underline">{l.numero}</Link></td>
              <td className={td}>{l.produit_nom}</td>
              <td className={td}>{t(ORIGINES_LOT[l.origine])}</td>
              <td className={td}>{formatDate(l.date_creation, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{Number(l.quantite_initiale).toLocaleString(LOCALES[ctx.lang])} {l.unite}</td>
              <td className={`${td} text-right tabular-nums`}>{Number(l.quantite_expediee).toLocaleString(LOCALES[ctx.lang])}</td>
              <td className={td}>{l.date_peremption ? formatDate(l.date_peremption, ctx.lang) : '—'}</td>
              <td className={`${td} text-right tabular-nums`}>
                {l.nb_controles}{Number(l.nb_non_conformes) > 0 && <span className="text-danger"> ({l.nb_non_conformes} {t('non conforme(s)')})</span>}
              </td>
              <td className={`${td} font-medium ${COULEURS_STATUT[l.statut]}`}>{t(STATUTS_LOT[l.statut])}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
