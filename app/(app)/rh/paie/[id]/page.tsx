import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { MOIS, STATUTS_EMPLOYE } from '@/lib/rh'
import { formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ActionButton, PayerEcheance } from '@/components/ActionButton'
import { BulletinPdfButton } from '@/components/BulletinPdfButton'
import { calculerPaie, payerSalaires, validerPaie } from '../../actions'

type Ligne = { ordre: number; code: string; libelle: string; type: string; base: number | null; taux: number | null; montant: number }

export default async function PeriodePaiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContexte()
  const o = await chargerOptions()
  const supabase = await createClient()

  const { data: periode } = await supabase.from('periodes_paie').select('*').eq('id', id).maybeSingle()
  if (!periode) notFound()

  const [{ data: bulletins }, { data: cotisations }] = await Promise.all([
    supabase
      .from('bulletins_paie')
      .select('*, employes(matricule, nom, prenom, statut, poste), bulletins_lignes(ordre, code, libelle, type, base, taux, montant)')
      .eq('periode_id', id)
      .order('created_at'),
    supabase.from('v_cotisations_periode').select('*').eq('periode_id', id).order('code'),
  ])
  const libellePeriode = `${MOIS[periode.mois - 1]} ${periode.annee}`
  const peutCalculer = ['admin', 'rh'].includes(ctx.role) && periode.statut === 'ouverte'
  const peutValider = ['admin', 'comptable'].includes(ctx.role) && periode.statut === 'ouverte' && (bulletins?.length ?? 0) > 0
  const peutPayer = ['admin', 'comptable'].includes(ctx.role) && periode.statut === 'validee'

  const somme = (k: 'brut' | 'total_retenues' | 'net_a_payer' | 'charges_patronales' | 'cout_total') =>
    (bulletins ?? []).reduce((s, b) => s + Number(b[k]), 0)

  return (
    <>
      <PageHeader titre={`Paie — ${libellePeriode}`} description={`Période ${periode.statut === 'ouverte' ? 'ouverte' : periode.statut === 'validee' ? 'validée, écriture comptable générée' : 'payée'}.`}>
        <Link href="/rh/paie" className="text-sm text-primary underline">← Périodes</Link>
        {peutCalculer && (
          <ActionButton
            label={(bulletins?.length ?? 0) > 0 ? 'Recalculer les bulletins' : 'Calculer les bulletins'}
            variant="default"
            size="default"
            action={calculerPaie.bind(null, id)}
          />
        )}
        {peutValider && (
          <ActionButton
            label="Valider et comptabiliser"
            confirmation={`Valider la paie de ${libellePeriode} ? L'écriture comptable sera générée et les bulletins ne seront plus modifiables.`}
            size="default"
            action={validerPaie.bind(null, id)}
          />
        )}
        {peutPayer && <PayerEcheance comptes={o.comptesTresorerie} action={payerSalaires.bind(null, id)} />}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {([
          ['Brut', somme('brut')],
          ['Retenues salariales', somme('total_retenues')],
          ['Net à payer', somme('net_a_payer')],
          ['Charges patronales', somme('charges_patronales')],
          ['Coût employeur', somme('cout_total')],
        ] as [string, number][]).map(([libelle, valeur]) => (
          <Card key={libelle}>
            <p className="text-sm text-foreground-muted">{libelle}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatMontant(valeur, ctx.devise)}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Bulletins</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Employé</th>
              <th className={`${th} text-right`}>Jours</th>
              <th className={`${th} text-right`}>Brut</th>
              <th className={`${th} text-right`}>Retenues</th>
              <th className={`${th} text-right`}>Net</th>
              <th className={`${th} text-right`}>Coût</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {bulletins?.map((b) => {
              const e = Array.isArray(b.employes) ? b.employes[0] : b.employes
              const lignes = ([...(b.bulletins_lignes as Ligne[])]).sort((x, y) => x.ordre - y.ordre)
              return (
                <tr key={b.id}>
                  <td className={td}>
                    <details>
                      <summary className="cursor-pointer font-medium">{e?.matricule} — {e?.nom} {e?.prenom}</summary>
                      <ul className="mt-2 space-y-1 text-xs text-foreground-muted">
                        {lignes.map((l, i) => (
                          <li key={i} className="flex justify-between gap-4">
                            <span>{l.libelle}{l.taux ? ` (${Number(l.taux)} %)` : ''}</span>
                            <span className={`tabular-nums ${l.type === 'retenue_salariale' || l.type === 'retenue_absence' ? 'text-danger' : ''}`}>
                              {l.type === 'retenue_salariale' || l.type === 'retenue_absence' ? '−' : l.type === 'charge_patronale' ? '(employeur) ' : ''}
                              {formatMontant(l.montant, ctx.devise)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                    <span className="text-xs text-foreground-muted">{STATUTS_EMPLOYE[e?.statut ?? '']}</span>
                    {b.avertissements && <p className="mt-1 text-xs text-warning">⚠ {b.avertissements}</p>}
                  </td>
                  <td className={`${td} text-right`}>{Number(b.jours_payes)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMontant(b.brut, ctx.devise)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMontant(b.total_retenues, ctx.devise)}</td>
                  <td className={`${td} text-right tabular-nums font-medium`}>{formatMontant(b.net_a_payer, ctx.devise)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMontant(b.cout_total, ctx.devise)}</td>
                  <td className={td}>
                    <BulletinPdfButton
                      data={{
                        organisation: ctx.organisationNom,
                        periode: libellePeriode,
                        matricule: e?.matricule ?? '',
                        nom: `${e?.nom ?? ''} ${e?.prenom ?? ''}`.trim(),
                        statut: STATUTS_EMPLOYE[e?.statut ?? ''] ?? '',
                        poste: e?.poste ?? '',
                        devise: ctx.devise,
                        joursPayes: Number(b.jours_payes),
                        brut: Number(b.brut),
                        retenues: Number(b.total_retenues),
                        net: Number(b.net_a_payer),
                        chargesPatronales: Number(b.charges_patronales),
                        lignes: lignes.map((l) => ({ libelle: l.libelle, type: l.type, base: l.base != null ? Number(l.base) : null, taux: l.taux != null ? Number(l.taux) : null, montant: Number(l.montant) })),
                      }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">État des cotisations et impôts (base des déclarations)</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Code</th>
            <th className={th}>Libellé</th>
            <th className={th}>À la charge de</th>
            <th className={`${th} text-right`}>Employés</th>
            <th className={`${th} text-right`}>Montant à déclarer</th>
          </tr>
        </thead>
        <tbody>
          {cotisations?.map((c, i) => (
            <tr key={i}>
              <td className={td}>{c.code}</td>
              <td className={td}>{c.libelle}</td>
              <td className={td}>{c.type === 'retenue_salariale' ? 'Salarié (retenue)' : 'Employeur'}</td>
              <td className={`${td} text-right`}>{c.nb_employes}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(c.montant, ctx.devise)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <p className="mt-2 text-sm text-foreground-muted">
        Le règlement de ces montants aux organismes (IPRES, CSS, DGID) se saisit dans Trésorerie → Autre opération, contrepartie 431, 442 ou 447.
      </p>
    </>
  )
}
