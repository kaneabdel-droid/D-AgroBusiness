import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { MOIS } from '@/lib/rh'
import { formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addPeriode } from '../actions'

const STATUTS: Record<string, string> = { ouverte: 'Ouverte', validee: 'Validée (comptabilisée)', payee: 'Payée' }

export default async function PaiePage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const [{ data: periodes }, { data: bulletins }, { data: param }] = await Promise.all([
    supabase.from('periodes_paie').select('*').order('annee', { ascending: false }).order('mois', { ascending: false }),
    supabase.from('bulletins_paie').select('periode_id, brut, net_a_payer, cout_total'),
    supabase.from('parametrage_paie').select('valide_le').maybeSingle(),
  ])
  const peutCreer = ['admin', 'rh', 'comptable'].includes(ctx.role)
  const totaux = new Map<string, { nb: number; brut: number; net: number; cout: number }>()
  for (const b of bulletins ?? []) {
    const t = totaux.get(b.periode_id) ?? { nb: 0, brut: 0, net: 0, cout: 0 }
    t.nb += 1
    t.brut += Number(b.brut)
    t.net += Number(b.net_a_payer)
    t.cout += Number(b.cout_total)
    totaux.set(b.periode_id, t)
  }
  const aujourdhui = new Date()

  return (
    <>
      <PageHeader
        titre="Paie"
        description="Une période = un mois. Calcul des bulletins, validation (écriture comptable analytique) puis paiement des salaires."
      >
        <SimpleCreateForm
          titre="Nouvelle période"
          disabled={!peutCreer}
          action={addPeriode}
          champs={[
            { name: 'annee', label: 'Année', type: 'number', required: true, defaultValue: String(aujourdhui.getFullYear()) },
            { name: 'mois', label: 'Mois', type: 'select', required: true, defaultValue: String(aujourdhui.getMonth() + 1), options: MOIS.map((m, i) => ({ value: String(i + 1), label: m })) },
          ]}
        />
      </PageHeader>

      {!param?.valide_le && (
        <Card className="mb-6 border-warning">
          <p className="text-sm">
            Le paramétrage de la paie (cotisations, barème de retenue) n&apos;est pas validé : aucun calcul n&apos;est possible.{' '}
            <Link href="/rh/parametres" className="font-medium text-primary underline">Vérifier et valider le paramétrage</Link>
          </p>
        </Card>
      )}

      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Période</th>
            <th className={th}>Statut</th>
            <th className={`${th} text-right`}>Bulletins</th>
            <th className={`${th} text-right`}>Brut</th>
            <th className={`${th} text-right`}>Net à payer</th>
            <th className={`${th} text-right`}>Coût employeur</th>
          </tr>
        </thead>
        <tbody>
          {periodes?.map((p) => {
            const t = totaux.get(p.id)
            return (
              <tr key={p.id}>
                <td className={td}>
                  <Link href={`/rh/paie/${p.id}`} className="font-medium text-primary underline">
                    {MOIS[p.mois - 1]} {p.annee}
                  </Link>
                </td>
                <td className={td}>{STATUTS[p.statut]}</td>
                <td className={`${td} text-right`}>{t?.nb ?? 0}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(t?.brut ?? 0, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(t?.net ?? 0, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(t?.cout ?? 0, ctx.devise)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
