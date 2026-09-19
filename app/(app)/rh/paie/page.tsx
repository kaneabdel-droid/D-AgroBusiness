import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { MOIS } from '@/lib/rh'
import { formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addPeriode } from '../actions'

const STATUTS: Record<string, string> = { ouverte: 'Ouverte', validee: 'Validée (comptabilisée)', payee: 'Payée' }

export default async function PaiePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const fm = (v: number) => formatMontant(v, ctx.devise, ctx.lang)
  const supabase = await createClient()
  const [{ data: periodes }, { data: bulletins }, { data: param }] = await Promise.all([
    supabase.from('periodes_paie').select('*').order('annee', { ascending: false }).order('mois', { ascending: false }),
    supabase.from('bulletins_paie').select('periode_id, brut, net_a_payer, cout_total'),
    supabase.from('parametrage_paie').select('valide_le').maybeSingle(),
  ])
  const peutCreer = ['admin', 'rh', 'comptable'].includes(ctx.role)
  const totaux = new Map<string, { nb: number; brut: number; net: number; cout: number }>()
  for (const b of bulletins ?? []) {
    const cumul = totaux.get(b.periode_id) ?? { nb: 0, brut: 0, net: 0, cout: 0 }
    cumul.nb += 1
    cumul.brut += Number(b.brut)
    cumul.net += Number(b.net_a_payer)
    cumul.cout += Number(b.cout_total)
    totaux.set(b.periode_id, cumul)
  }
  const aujourdhui = new Date()

  return (
    <>
      <PageHeader
        titre={t('Paie')}
        description={t('Une période = un mois. Calcul des bulletins, validation (écriture comptable analytique) puis paiement des salaires.')}
      >
        <SimpleCreateForm
          titre={t('Nouvelle période')}
          disabled={!peutCreer}
          action={addPeriode}
          champs={[
            { name: 'annee', label: t('Année'), type: 'number', required: true, defaultValue: String(aujourdhui.getFullYear()) },
            { name: 'mois', label: t('Mois'), type: 'select', required: true, defaultValue: String(aujourdhui.getMonth() + 1), options: MOIS.map((m, i) => ({ value: String(i + 1), label: t(m) })) },
          ]}
        />
      </PageHeader>

      {!param?.valide_le && (
        <Card className="mb-6 border-warning">
          <p className="text-sm">
            {t('Le paramétrage de la paie (cotisations, barème de retenue) n’est pas validé : aucun calcul n’est possible.')}{' '}
            <Link href="/rh/parametres" className="font-medium text-primary underline">{t('Vérifier et valider le paramétrage')}</Link>
          </p>
        </Card>
      )}

      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Période')}</th>
            <th className={th}>{t('Statut')}</th>
            <th className={`${th} text-right`}>{t('Bulletins')}</th>
            <th className={`${th} text-right`}>{t('Brut')}</th>
            <th className={`${th} text-right`}>{t('Net à payer')}</th>
            <th className={`${th} text-right`}>{t('Coût employeur')}</th>
          </tr>
        </thead>
        <tbody>
          {periodes?.map((p) => {
            const tot = totaux.get(p.id)
            return (
              <tr key={p.id}>
                <td className={td}>
                  <Link href={`/rh/paie/${p.id}`} className="font-medium text-primary underline">
                    {t(MOIS[p.mois - 1])} {p.annee}
                  </Link>
                </td>
                <td className={td}>{t(STATUTS[p.statut])}</td>
                <td className={`${td} text-right`}>{tot?.nb ?? 0}</td>
                <td className={`${td} text-right tabular-nums`}>{fm(tot?.brut ?? 0)}</td>
                <td className={`${td} text-right tabular-nums`}>{fm(tot?.net ?? 0)}</td>
                <td className={`${td} text-right tabular-nums`}>{fm(tot?.cout ?? 0)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
