import Link from 'next/link'
import { PackagePlus } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addContratDepot } from '../operations/actions'

export default async function DepotVentePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const [{ data: contrats }, { data: tiers }] = await Promise.all([
    supabase.from('contrats_depot').select('*, tiers:fournisseur_id(nom)').order('code'),
    supabase.from('tiers').select('id, code, nom, types').eq('actif', true).order('nom'),
  ])
  const fournisseurs = (tiers ?? []).filter((t) => (t.types as string[]).includes('fournisseur'))
  const peutEcrire = ['admin', 'comptable', 'chef_departement'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre={t('Dépôt-vente')}
        description={t('Marchandises des fournisseurs vendues contre commission. Le stock consigné reste hors bilan jusqu’à la vente.')}
      >
        {peutEcrire && (
          <Button asChild variant="outline">
            <Link href="/depot-vente/reception"><PackagePlus className="h-4 w-4" aria-hidden /> {t('Réceptionner un dépôt')}</Link>
          </Button>
        )}
        <SimpleCreateForm
          titre={t('Nouveau contrat')}
          disabled={!peutEcrire}
          action={addContratDepot}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            {
              name: 'fournisseur_id', label: t('Fournisseur'), type: 'select', required: true,
              options: fournisseurs.map((f) => ({ value: f.id, label: `${f.code} — ${f.nom}` })),
            },
            { name: 'taux_commission', label: t('Commission sur ventes (%)'), type: 'number', step: '0.01', required: true },
            { name: 'date_debut', label: t('Début'), type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            { name: 'date_fin', label: t('Fin'), type: 'date' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Fournisseur')}</th>
            <th className={`${th} text-right`}>{t('Commission')}</th>
            <th className={th}>{t('Début')}</th>
            <th className={th}>{t('Fin')}</th>
            <th className={th}>{t('Statut')}</th>
          </tr>
        </thead>
        <tbody>
          {contrats?.map((c) => {
            const f = Array.isArray(c.tiers) ? c.tiers[0] : c.tiers
            return (
              <tr key={c.id}>
                <td className={td}>{c.code}</td>
                <td className={td}>{f?.nom}</td>
                <td className={`${td} text-right`}>{Number(c.taux_commission)} %</td>
                <td className={td}>{formatDate(c.date_debut, ctx.lang)}</td>
                <td className={td}>{formatDate(c.date_fin, ctx.lang) || '—'}</td>
                <td className={td}>{c.statut === 'actif' ? t('Actif') : t('Terminé')}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
      <p className="mt-4 text-sm text-foreground-muted">
        {t('Le relevé du compte du fournisseur (ventes moins commission, moins règlements) est disponible dans')}{' '}
        <Link href="/comptabilite/releve" className="font-medium text-primary underline">{t('Relevés de compte')}</Link>.
      </p>
    </>
  )
}
