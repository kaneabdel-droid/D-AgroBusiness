import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatMontant } from '@/lib/utils'
import { MOIS } from '@/lib/rh'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ActionButton } from '@/components/ActionButton'
import { ExportButtons } from '@/components/ExportButtons'
import { liquiderTva } from '../actions'

export default async function TvaPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const { annee: anneeParam } = await searchParams
  const annee = Number(anneeParam) || new Date().getFullYear()
  const supabase = await createClient()
  const [{ data: mensuel }, { data: liquidations }] = await Promise.all([
    supabase.from('v_tva_mensuelle').select('*').eq('annee', annee),
    supabase.from('liquidations_tva').select('*').eq('annee', annee),
  ])
  const peutLiquider = ['admin', 'comptable'].includes(ctx.role)

  const lignes = MOIS.map((mois, i) => {
    const nom = t(mois)
    const m = mensuel?.find((x) => x.mois === i + 1)
    const liq = liquidations?.find((x) => x.mois === i + 1)
    const collectee = Number(m?.collectee ?? 0)
    const ded = Number(m?.deductible_achats ?? 0) + Number(m?.deductible_immobilisations ?? 0)
    return { mois: i + 1, nom, collectee, achats: Number(m?.deductible_achats ?? 0), immo: Number(m?.deductible_immobilisations ?? 0), ded, solde: collectee - ded, liq }
  })
  const totalColl = lignes.reduce((s, l) => s + l.collectee, 0)
  const totalDed = lignes.reduce((s, l) => s + l.ded, 0)

  return (
    <>
      <PageHeader
        titre={`${t('TVA')} ${annee}`}
        description={t('TVA collectée sur les ventes, TVA récupérable sur achats et immobilisations. La liquidation solde ces comptes et constate la TVA due (4441) ou le crédit à reporter (4449).')}
      >
        <form method="get" className="flex items-center gap-2">
          <input name="annee" type="number" defaultValue={annee} min={2000} max={2100} aria-label={t('Année')}
            className="h-10 w-28 rounded-lg border border-surface-border bg-surface px-3 text-sm" />
          <button type="submit" className="h-10 rounded-lg border border-surface-border bg-surface px-3 text-sm">{t('Afficher')}</button>
        </form>
        <ExportButtons titre={`${t('Déclaration de TVA')} ${annee}`} sousTitre={ctx.organisationNom} fichier={`tva-${annee}`}
          colonnes={[t('Mois'), t('TVA collectée'), t('TVA sur achats'), t('TVA sur immobilisations'), t('Solde'), t('Liquidation')]}
          lignes={lignes.map((l) => [l.nom, l.collectee, l.achats, l.immo, l.solde, l.liq ? (Number(l.liq.tva_due) > 0 ? `${t('Due')} ${l.liq.tva_due}` : `${t('Crédit')} ${l.liq.credit_a_reporter}`) : t('Non liquidée')])} />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-foreground-muted">{t('TVA collectée')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatMontant(totalColl, ctx.devise, ctx.lang)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('TVA récupérable')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatMontant(totalDed, ctx.devise, ctx.lang)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Solde de l’année')}</p><p className={`mt-1 text-xl font-semibold tabular-nums ${totalColl - totalDed < 0 ? 'text-success' : ''}`}>{formatMontant(totalColl - totalDed, ctx.devise, ctx.lang)}</p><p className="text-xs text-foreground-muted">{totalColl - totalDed >= 0 ? t('à payer') : t('crédit')}</p></Card>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Mois')}</th>
            <th className={`${th} text-right`}>{t('Collectée')}</th>
            <th className={`${th} text-right`}>{t('Sur achats')}</th>
            <th className={`${th} text-right`}>{t('Sur immobilisations')}</th>
            <th className={`${th} text-right`}>{t('Solde du mois')}</th>
            <th className={th}>{t('Liquidation')}</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.mois}>
              <td className={td}>{l.nom}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.collectee, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.achats, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.immo, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.solde, ctx.devise, ctx.lang)}</td>
              <td className={td}>
                {l.liq ? (
                  <span className="text-sm">
                    {Number(l.liq.tva_due) > 0 ? `${t('TVA due')} ${formatMontant(l.liq.tva_due, ctx.devise, ctx.lang)}` : Number(l.liq.credit_a_reporter) > 0 ? `${t('Crédit')} ${formatMontant(l.liq.credit_a_reporter, ctx.devise, ctx.lang)}` : t('Soldée')}
                    {Number(l.liq.credit_precedent) > 0 && <span className="block text-xs text-foreground-muted">{t('crédit antérieur imputé :')} {formatMontant(l.liq.credit_precedent, ctx.devise, ctx.lang)}</span>}
                  </span>
                ) : peutLiquider && (l.collectee !== 0 || l.ded !== 0) ? (
                  <ActionButton label={t('Liquider')} confirmation={t('Liquider la TVA de {m} {a} ? Une écriture sera générée.', { m: l.nom, a: annee })} action={liquiderTva.bind(null, annee, l.mois)} />
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <p className="mt-3 text-sm text-foreground-muted">
        {t('Liquidez les mois dans l’ordre : un crédit de TVA est reporté automatiquement sur le mois suivant. Le paiement de la TVA due se saisit dans Trésorerie → Autre opération (contrepartie 4441).')}
      </p>
    </>
  )
}
