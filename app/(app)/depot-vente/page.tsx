import Link from 'next/link'
import { PackagePlus } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addContratDepot } from '../operations/actions'

export default async function DepotVentePage() {
  const ctx = await getContexte()
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
        titre="Dépôt-vente"
        description="Marchandises des fournisseurs vendues contre commission. Le stock consigné reste hors bilan jusqu'à la vente."
      >
        {peutEcrire && (
          <Button asChild variant="outline">
            <Link href="/depot-vente/reception"><PackagePlus className="h-4 w-4" aria-hidden /> Réceptionner un dépôt</Link>
          </Button>
        )}
        <SimpleCreateForm
          titre="Nouveau contrat"
          disabled={!peutEcrire}
          action={addContratDepot}
          champs={[
            { name: 'code', label: 'Code', required: true },
            {
              name: 'fournisseur_id', label: 'Fournisseur', type: 'select', required: true,
              options: fournisseurs.map((f) => ({ value: f.id, label: `${f.code} — ${f.nom}` })),
            },
            { name: 'taux_commission', label: 'Commission sur ventes (%)', type: 'number', step: '0.01', required: true },
            { name: 'date_debut', label: 'Début', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            { name: 'date_fin', label: 'Fin', type: 'date' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Code</th>
            <th className={th}>Fournisseur</th>
            <th className={`${th} text-right`}>Commission</th>
            <th className={th}>Début</th>
            <th className={th}>Fin</th>
            <th className={th}>Statut</th>
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
                <td className={td}>{formatDate(c.date_debut)}</td>
                <td className={td}>{formatDate(c.date_fin) || '—'}</td>
                <td className={td}>{c.statut === 'actif' ? 'Actif' : 'Terminé'}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
      <p className="mt-4 text-sm text-foreground-muted">
        Le relevé du compte du fournisseur (ventes moins commission, moins règlements) est disponible dans{' '}
        <Link href="/comptabilite/releve" className="font-medium text-primary underline">Relevés de compte</Link>.
      </p>
    </>
  )
}
