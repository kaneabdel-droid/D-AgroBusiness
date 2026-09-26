import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ActionButton } from '@/components/ActionButton'
import { comptabiliser, depointer, pointer, pointerAuto } from '../actions'

const DIX_JOURS = 10 * 86400000

export default async function ReleveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()

  const { data: releve } = await supabase.from('releves_bancaires').select('*').eq('id', id).maybeSingle()
  if (!releve) notFound()
  const [{ data: lignes }, { data: ecritures }, { data: comptes }] = await Promise.all([
    supabase.from('lignes_releve').select('*').eq('releve_id', id).order('date_operation'),
    supabase.from('v_ecritures_bancaires').select('*').eq('compte_tresorerie_id', releve.compte_tresorerie_id).lte('date_ecriture', releve.date_fin),
    supabase.from('comptes_comptables').select('id, numero, libelle').eq('actif', true).order('numero'),
  ])
  const monnaie = (v: number) => formatMontant(v, ctx.devise, ctx.lang)
  const peutEcrire = peutMenu(ctx, '/tresorerie/rapprochement', ['admin', 'comptable'])
  const somme = (xs: { montant: number | string }[]) => xs.reduce((s, x) => s + Number(x.montant), 0)

  const nonPointeesLivres = (ecritures ?? []).filter((e) => !e.pointee)
  const nonPointeesBanque = (lignes ?? []).filter((l) => !l.ligne_ecriture_id)

  const soldeLivres = somme(ecritures ?? [])
  const soldeBanque = releve.solde_final != null
    ? Number(releve.solde_final)
    : releve.solde_initial != null ? Number(releve.solde_initial) + somme(lignes ?? []) : null
  // solde banque − lignes de la banque pas encore en comptabilité + écritures pas encore en banque = solde comptable attendu
  const ecart = soldeBanque == null ? null : Math.round((soldeBanque - somme(nonPointeesBanque) + somme(nonPointeesLivres) - soldeLivres) * 100) / 100
  const rapproche = ecart === 0 && nonPointeesBanque.length === 0

  const candidats = (montant: number, date: string) =>
    nonPointeesLivres.filter((e) => Number(e.montant) === montant && Math.abs(new Date(e.date_ecriture).getTime() - new Date(date).getTime()) <= DIX_JOURS)

  const cartes: [string, string, string?][] = [
    [t('Solde selon la banque'), soldeBanque != null ? monnaie(soldeBanque) : '—'],
    [t('Solde selon la comptabilité'), monnaie(soldeLivres)],
    [t('Écart de rapprochement'), ecart != null ? monnaie(ecart) : '—', ecart === 0 ? 'text-success' : ecart != null ? 'text-danger' : undefined],
    [t('Lignes à traiter'), String(nonPointeesBanque.length + nonPointeesLivres.length), rapproche ? 'text-success' : undefined],
  ]

  return (
    <>
      <PageHeader titre={releve.libelle} description={`${formatDate(releve.date_debut, ctx.lang)} → ${formatDate(releve.date_fin, ctx.lang)}`}>
        <Link href="/tresorerie/rapprochement" className="text-sm text-primary underline">{t('← Relevés')}</Link>
        {peutEcrire && nonPointeesBanque.length > 0 && (
          <ActionButton label={t('Pointer automatiquement')} action={pointerAuto.bind(null, id)} variant="default" />
        )}
        <ExportButtons titre={`${t('Rapprochement bancaire')} — ${releve.libelle}`} sousTitre={`${formatDate(releve.date_debut, ctx.lang)} → ${formatDate(releve.date_fin, ctx.lang)}`} fichier="rapprochement-bancaire"
          colonnes={[t('Date'), t('Libellé'), t('Référence'), t('Montant'), t('Pointage')]}
          lignes={[
            ...(lignes ?? []).map((l) => [formatDate(l.date_operation, ctx.lang), l.libelle, l.reference ?? '', Number(l.montant), l.ligne_ecriture_id ? t('Pointée') : t('Non pointée')]),
            ['', '', '', '', ''],
            [t('Solde selon la banque'), '', '', soldeBanque, ''],
            [t('Solde selon la comptabilité'), '', '', soldeLivres, ''],
            [t('Écart de rapprochement'), '', '', ecart, ''],
            ...(nonPointeesLivres.length > 0 ? [['', '', '', '', ''], [t('Écritures de la comptabilité non encore vues en banque'), '', '', '', '']] : []),
            ...nonPointeesLivres.map((e) => [formatDate(e.date_ecriture, ctx.lang), e.libelle, '', Number(e.montant), '']),
          ]}
        />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cartes.map(([libelle, valeur, couleur]) => (
          <Card key={libelle}>
            <p className="text-sm text-foreground-muted">{libelle}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${couleur ?? ''}`}>{valeur}</p>
          </Card>
        ))}
      </div>
      {rapproche && <p className="mb-6 text-sm font-medium text-success">{t('Rapprochement terminé : la banque et la comptabilité concordent.')}</p>}

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Lignes du relevé')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>{t('Date')}</th><th className={th}>{t('Libellé')}</th><th className={th}>{t('Référence')}</th>
              <th className={`${th} text-right`}>{t('Montant')}</th><th className={th}>{t('Pointage')}</th>
            </tr>
          </thead>
          <tbody>
            {lignes?.map((l) => {
              const cands = l.ligne_ecriture_id ? [] : candidats(Number(l.montant), l.date_operation)
              return (
                <tr key={l.id}>
                  <td className={td}>{formatDate(l.date_operation, ctx.lang)}</td>
                  <td className={td}>{l.libelle}</td>
                  <td className={td}>{l.reference ?? '—'}</td>
                  <td className={`${td} text-right tabular-nums ${Number(l.montant) < 0 ? 'text-danger' : 'text-success'}`}>{monnaie(Number(l.montant))}</td>
                  <td className={td}>
                    {l.ligne_ecriture_id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-success">{t('Pointée')}</span>
                        {peutEcrire && <ActionButton label={t('Annuler')} action={depointer.bind(null, l.id)} />}
                      </span>
                    ) : cands.length === 0 ? (
                      <span className="text-foreground-muted">{t('Aucune écriture correspondante')}</span>
                    ) : (
                      <div className="space-y-1">
                        {cands.map((e) => (
                          <div key={e.ligne_ecriture_id} className="flex flex-wrap items-center gap-2 text-xs">
                            <span>{formatDate(e.date_ecriture, ctx.lang)} · {e.libelle}</span>
                            {peutEcrire && <ActionButton label={t('Pointer')} action={pointer.bind(null, l.id, e.ligne_ecriture_id)} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </div>

      {peutEcrire && nonPointeesBanque.length > 0 && (
        <>
          <h2 className="mb-2 font-heading text-lg font-semibold">{t('Lignes de la banque absentes de la comptabilité')}</h2>
          <p className="mb-2 text-sm text-foreground-muted">{t('Frais bancaires, agios, virements non saisis : choisissez le compte de contrepartie pour créer l’écriture, qui est pointée aussitôt.')}</p>
          <div className="mb-6 space-y-2">
            {nonPointeesBanque.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border p-3 text-sm">
                <span>{formatDate(l.date_operation, ctx.lang)} · {l.libelle}</span>
                <span className={`tabular-nums ${Number(l.montant) < 0 ? 'text-danger' : 'text-success'}`}>{monnaie(Number(l.montant))}</span>
                <SimpleCreateForm
                  titre={t('Comptabiliser')}
                  action={comptabiliser.bind(null, l.id)}
                  champs={[
                    { name: 'contrepartie_compte_id', label: t('Compte de contrepartie'), type: 'select', required: true, options: comptes?.map((c) => ({ value: c.id, label: `${c.numero} — ${c.libelle}` })) },
                    { name: 'libelle', label: t('Libellé'), defaultValue: l.libelle },
                    { name: 'departement_id', label: t('Département (obligatoire pour charges/produits)'), type: 'select', options: o.departements.map((d) => ({ value: d.id, label: d.label })) },
                    { name: 'secteur_id', label: t('Secteur / projet (doit appartenir au département)'), type: 'select', options: o.secteurs.map((s) => ({ value: s.id, label: s.label })) },
                    { name: 'campagne_id', label: t('Campagne'), type: 'select', options: o.campagnes.map((c) => ({ value: c.id, label: c.label })) },
                  ]}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {nonPointeesLivres.length > 0 && (
        <>
          <h2 className="mb-2 font-heading text-lg font-semibold">{t('Écritures de la comptabilité non encore vues en banque')}</h2>
          <p className="mb-2 text-sm text-foreground-muted">{t('Chèques émis non encaissés, virements en cours : ils expliquent l’écart entre la banque et la comptabilité.')}</p>
          <TableWrap>
            <thead>
              <tr><th className={th}>{t('Date')}</th><th className={th}>{t('Libellé')}</th><th className={`${th} text-right`}>{t('Montant')}</th></tr>
            </thead>
            <tbody>
              {nonPointeesLivres.map((e) => (
                <tr key={e.ligne_ecriture_id}>
                  <td className={td}>{formatDate(e.date_ecriture, ctx.lang)}</td>
                  <td className={td}>{e.libelle}</td>
                  <td className={`${td} text-right tabular-nums ${Number(e.montant) < 0 ? 'text-danger' : 'text-success'}`}>{monnaie(Number(e.montant))}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </>
      )}
    </>
  )
}
