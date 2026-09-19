import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatMontant } from '@/lib/utils'
import { Card, PageHeader } from '@/components/ui/card'

export default async function DashboardPage() {
  const ctx = await getContexte()
  const supabase = await createClient()

  const { data: exercice } = await supabase
    .from('exercices_comptables')
    .select('id, libelle')
    .eq('statut', 'ouvert')
    .order('date_debut', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [tiers, ecritures, resultat] = await Promise.all([
    supabase.from('tiers').select('id', { count: 'exact', head: true }),
    supabase.from('ecritures').select('id', { count: 'exact', head: true }),
    exercice
      ? supabase.from('v_resultat_analytique').select('produits, charges, resultat').eq('exercice_id', exercice.id)
      : Promise.resolve({ data: [] as { produits: number; charges: number; resultat: number }[] }),
  ])

  const somme = (k: 'produits' | 'charges' | 'resultat') =>
    (resultat.data ?? []).reduce((s, l) => s + Number(l[k]), 0)

  return (
    <>
      <PageHeader
        titre={`Bonjour${ctx.nomComplet ? `, ${ctx.nomComplet}` : ''}`}
        description={ctx.organisationNom}
      />

      {!exercice && (
        <Card className="mb-6 border-warning">
          <p className="text-sm">
            Aucun exercice comptable ouvert : créez-en un pour pouvoir saisir des écritures.{' '}
            <Link href="/referentiels/exercices" className="font-medium text-primary underline">
              Créer un exercice
            </Link>
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-foreground-muted">Produits {exercice?.libelle}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatMontant(somme('produits'), ctx.devise)}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">Charges {exercice?.libelle}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatMontant(somme('charges'), ctx.devise)}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">Résultat</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${somme('resultat') < 0 ? 'text-danger' : 'text-success'}`}>
            {formatMontant(somme('resultat'), ctx.devise)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">Écritures / tiers</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{ecritures.count ?? 0} / {tiers.count ?? 0}</p>
        </Card>
      </div>
    </>
  )
}
