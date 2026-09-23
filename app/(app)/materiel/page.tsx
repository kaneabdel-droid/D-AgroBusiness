import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { CATEGORIES_MATERIEL, MODES_REMBOURSEMENT } from '@/lib/catalogue'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { acquerirMateriel } from '../financement/actions'

export default async function MaterielPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()
  const { data: materiels } = await supabase
    .from('v_materiels')
    .select('*, departements(nom)')
    .order('code')
  const peutEcrire = peutMenu(ctx, '/materiel', ['admin', 'comptable'])
  const valeurBrute = (materiels ?? []).reduce((s, m) => s + Number(m.cout_acquisition), 0)
  const vnc = (materiels ?? []).reduce((s, m) => s + Number(m.valeur_nette_comptable), 0)

  return (
    <>
      <PageHeader
        titre={t('Parc matériel')}
        description={`${t('Valeur brute')} ${formatMontant(valeurBrute, ctx.devise, ctx.lang)} — ${t('valeur nette comptable')} ${formatMontant(vnc, ctx.devise, ctx.lang)}.`}
      >
        <Button asChild variant="outline">
          <Link href="/materiel/amortissements">{t('Amortissements')}</Link>
        </Button>
        <SimpleCreateForm
          titre={t('Acquérir un matériel')}
          disabled={!peutEcrire}
          action={acquerirMateriel}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'designation', label: t('Désignation'), required: true },
            { name: 'categorie', label: t('Catégorie'), type: 'select', required: true, options: CATEGORIES_MATERIEL.map((c) => ({ ...c, label: t(c.label) })) },
            {
              name: 'mode_acquisition', label: t('Mode d’acquisition'), type: 'select', required: true, defaultValue: 'achat',
              options: [
                { value: 'achat', label: t('Achat (dette fournisseur d’investissements)') },
                { value: 'credit_bail', label: t('Crédit-bail (inscrit à l’actif avec sa dette)') },
              ],
            },
            { name: 'fournisseur_id', label: t('Fournisseur ou crédit-bailleur'), type: 'select', required: true, options: o.tousTiers.map((t) => ({ value: t.id, label: t.label })) },
            { name: 'date_acquisition', label: t('Date d’acquisition'), type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            { name: 'date_mise_service', label: t('Mise en service (par défaut : acquisition)'), type: 'date' },
            { name: 'cout', label: t('Coût global HT (subvention incluse)'), type: 'number', step: '0.01', required: true },
            { name: 'taux_tva', label: t('TVA récupérable % (achat)'), type: 'number', step: '0.01' },
            { name: 'valeur_residuelle', label: t('Valeur résiduelle'), type: 'number', step: '0.01' },
            { name: 'duree_ans', label: t('Durée d’amortissement (années)'), type: 'number', step: '0.5', required: true },
            { name: 'departement_id', label: t('Département d’affectation'), type: 'select', required: true, options: o.departements.map((d) => ({ value: d.id, label: d.label })) },
            { name: 'secteur_id', label: t('Secteur / projet'), type: 'select', options: o.secteurs.map((s) => ({ value: s.id, label: s.label })) },
            { name: 'taux_annuel', label: t('Crédit-bail : taux annuel (%)'), type: 'number', step: '0.001' },
            { name: 'duree_contrat_mois', label: t('Crédit-bail : durée du contrat (mois)'), type: 'number' },
            {
              name: 'periodicite_mois', label: t('Crédit-bail : périodicité'), type: 'select',
              options: [{ value: '1', label: t('Mensuelle') }, { value: '3', label: t('Trimestrielle') }, { value: '6', label: t('Semestrielle') }, { value: '12', label: t('Annuelle') }],
            },
            { name: 'mode_remboursement', label: t('Crédit-bail : mode de remboursement'), type: 'select', options: MODES_REMBOURSEMENT.map((m) => ({ ...m, label: t(m.label) })) },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Désignation')}</th>
            <th className={th}>{t('Département')}</th>
            <th className={th}>{t('Acquisition')}</th>
            <th className={`${th} text-right`}>{t('Coût')}</th>
            <th className={`${th} text-right`}>{t('Amorti')}</th>
            <th className={`${th} text-right`}>{t('VNC')}</th>
          </tr>
        </thead>
        <tbody>
          {materiels?.map((m) => {
            const dep = Array.isArray(m.departements) ? m.departements[0] : m.departements
            return (
              <tr key={m.id}>
                <td className={td}>
                  <Link href={`/materiel/${m.id}`} className="font-medium text-primary underline">{m.code}</Link>
                </td>
                <td className={td}>
                  {m.designation}
                  {m.mode_acquisition === 'credit_bail' && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-xs">{t('crédit-bail')}</span>}
                </td>
                <td className={td}>{dep?.nom ? t(dep.nom) : ''}</td>
                <td className={td}>{formatDate(m.date_acquisition, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(m.cout_acquisition, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(m.cumul_amortissement, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(m.valeur_nette_comptable, ctx.devise, ctx.lang)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
