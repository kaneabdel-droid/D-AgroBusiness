import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT, LOCALES } from '@/lib/i18n'
import { formatDate, formatMontant } from '@/lib/utils'
import { construirePlan, estimerPaie, estimerVentes, indiceMois, moisSuivants, type Flux } from '@/lib/prevision'
import { CATEGORIE_PAIE_ESTIMEE, CATEGORIE_VENTES_ESTIMEES, CATEGORIE_CREANCES, CATEGORIE_DETTES, CATEGORIE_ECHEANCES, CATEGORIES_PREVISION } from '@/lib/tresorerie-previsionnelle'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'
import { Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ActionButton } from '@/components/ActionButton'
import { addPrevision, supprimerPrevision } from './actions'

const HORIZON = 12

export default async function PrevisionnelPage({ searchParams }: { searchParams: Promise<{ delai?: string; ventes?: string; paie?: string }> }) {
  const { delai: delaiParam, ventes: ventesParam, paie: paieParam } = await searchParams
  const avecPaie = paieParam !== '0'
  const delai = Math.min(3, Math.max(0, Number(delaiParam) || 1))
  const partVentes = [0, 50, 70, 80, 90, 100].includes(Number(ventesParam)) && ventesParam !== undefined ? Number(ventesParam) : 80   // part des ventes estimées retenue (prudence)
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const mois = moisSuivants(aujourdhui, HORIZON)

  const [{ data: soldes }, { data: echeances }, { data: tiers }, { data: previsions }, { data: activite }, { data: activitePaie }] = await Promise.all([
    supabase.from('v_soldes_tresorerie').select('solde'),
    supabase.from('echeances_financement').select('date_echeance, capital, interets').eq('statut', 'a_payer'),
    supabase.from('v_soldes_tiers').select('compte_numero, solde'),
    supabase.from('previsions_tresorerie').select('*').eq('actif', true).order('date_debut'),
    supabase.from('v_activite_mensuelle').select('annee, mois, montant').in('rubrique', ['distribution', 'vente_marche']).gte('annee', Number(aujourdhui.slice(0, 4)) - 2),
    supabase.from('v_activite_mensuelle').select('annee, mois, montant').eq('rubrique', 'paie').gte('annee', Number(aujourdhui.slice(0, 4)) - 1),
  ])

  const soldeInitial = (soldes ?? []).reduce((s, x) => s + Number(x.solde), 0)
  const flux: Flux[] = []

  for (const e of echeances ?? []) {
    const i = indiceMois(mois, e.date_echeance)
    if (i !== null) flux.push({ mois: i, categorie: CATEGORIE_ECHEANCES, montant: -(Number(e.capital) + Number(e.interets)) })
  }
  // créances (comptes 41) encaissées et dettes (comptes 40 et 48) payées après « délai » mois
  for (const x of tiers ?? []) {
    const solde = Number(x.solde)
    const compte = String(x.compte_numero)
    if (compte.startsWith('41') && solde > 0) flux.push({ mois: delai, categorie: CATEGORIE_CREANCES, montant: solde })
    if ((compte.startsWith('40') || compte.startsWith('48')) && solde < 0) flux.push({ mois: delai, categorie: CATEGORIE_DETTES, montant: solde })
  }
  // ventes futures estimées d'après l'historique ; encaissées après le même délai que les créances ouvertes
  const estimation = estimerVentes((activite ?? []).map((a) => ({ annee: Number(a.annee), mois: Number(a.mois), montant: Number(a.montant) })), mois, aujourdhui)
  if (partVentes > 0) {
    estimation.valeurs.forEach((v, i) => {
      if (v > 0 && i + delai < HORIZON) flux.push({ mois: i + delai, categorie: CATEGORIE_VENTES_ESTIMEES, montant: Math.round(v * partVentes / 100) })
    })
  }
  // masse salariale : moyenne des 3 dernières paies, reconduite chaque mois (payée le mois même)
  const paie = estimerPaie((activitePaie ?? []).map((a) => ({ annee: Number(a.annee), mois: Number(a.mois), montant: Number(a.montant) })), mois, aujourdhui)
  if (avecPaie) paie.valeurs.forEach((v, i) => { if (v > 0) flux.push({ mois: i, categorie: CATEGORIE_PAIE_ESTIMEE, montant: -v }) })
  for (const p of previsions ?? []) {
    const signe = p.sens === 'encaissement' ? 1 : -1
    if (p.recurrence === 'unique') {
      const i = indiceMois(mois, p.date_debut)
      if (i !== null) flux.push({ mois: i, categorie: p.categorie, montant: signe * Number(p.montant) })
    } else {
      mois.forEach((m, i) => {
        if (m >= p.date_debut.slice(0, 7) && (!p.date_fin || m <= p.date_fin.slice(0, 7))) flux.push({ mois: i, categorie: p.categorie, montant: signe * Number(p.montant) })
      })
    }
  }

  const plan = construirePlan(mois, soldeInitial, flux)
  const monnaie = (v: number) => formatMontant(v, ctx.devise, ctx.lang)
  const libelleMois = (m: string) => new Intl.DateTimeFormat(LOCALES[ctx.lang], { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`))
  const peutEcrire = peutMenu(ctx, '/tresorerie/previsionnel', ['admin', 'comptable', 'direction'])
  const pireSolde = Math.min(...plan.soldeFin)

  return (
    <>
      <PageHeader
        titre={t('Trésorerie prévisionnelle')}
        description={t('Plan sur 12 mois : soldes actuels, échéances de financement, créances et dettes ouvertes, et vos prévisions saisies.')}
      >
        <SimpleCreateForm
          titre={t('Nouvelle prévision')}
          disabled={!peutEcrire}
          action={addPrevision}
          champs={[
            { name: 'libelle', label: t('Libellé'), required: true },
            { name: 'sens', label: t('Sens'), type: 'select', required: true, options: [{ value: 'encaissement', label: t('Encaissement') }, { value: 'decaissement', label: t('Décaissement') }] },
            { name: 'categorie', label: t('Catégorie'), type: 'select', defaultValue: 'autre', options: Object.entries(CATEGORIES_PREVISION).filter(([value]) => value !== CATEGORIE_VENTES_ESTIMEES && value !== CATEGORIE_PAIE_ESTIMEE).map(([value, label]) => ({ value, label: t(label) })) },
            { name: 'montant', label: t('Montant'), type: 'number', step: '0.01', required: true },
            { name: 'date_debut', label: t('Date (ou premier mois)'), type: 'date', required: true, defaultValue: aujourdhui },
            { name: 'recurrence', label: t('Répétition'), type: 'select', defaultValue: 'unique', options: [{ value: 'unique', label: t('Une seule fois') }, { value: 'mensuelle', label: t('Chaque mois') }] },
            { name: 'date_fin', label: t('Dernier mois (si chaque mois)'), type: 'date' },
          ]}
        />
        <ExportButtons titre={t('Trésorerie prévisionnelle')} sousTitre={ctx.organisationNom} fichier="tresorerie-previsionnelle"
          colonnes={[t('Catégorie'), ...plan.mois.map(libelleMois)]}
          lignes={[
            [t('Solde de début'), ...plan.soldeDebut],
            ...plan.lignes.map((l) => [t(CATEGORIES_PREVISION[l.categorie] ?? l.categorie), ...l.parMois]),
            [t('Solde de fin'), ...plan.soldeFin],
          ]}
        />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-foreground-muted">{t('Trésorerie actuelle')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{monnaie(soldeInitial)}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">{t('Solde dans 12 mois')}</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${plan.soldeFin[HORIZON - 1] < 0 ? 'text-danger' : ''}`}>{monnaie(plan.soldeFin[HORIZON - 1])}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">{t('Point le plus bas')}</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${pireSolde < 0 ? 'text-danger' : ''}`}>{monnaie(pireSolde)}</p>
        </Card>
      </div>

      {plan.premierDeficit !== null ? (
        <p role="alert" className="mb-4 text-sm font-medium text-danger">{t('Attention : la trésorerie devient négative en')} {libelleMois(plan.mois[plan.premierDeficit])}.</p>
      ) : (
        <p className="mb-4 text-sm font-medium text-success">{t('La trésorerie reste positive sur les 12 mois.')}</p>
      )}

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="delai">{t('Créances et dettes ouvertes réglées dans')}</label>
        <Select id="delai" name="delai" defaultValue={String(delai)} className="h-9 w-32">
          {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n} {t('mois')}</option>)}
        </Select>
        <label htmlFor="ventes" className="ms-3">{t('Ventes futures estimées, retenues à')}</label>
        <Select id="ventes" name="ventes" defaultValue={String(partVentes)} className="h-9 w-40">
          {[0, 50, 70, 80, 90, 100].map((n) => <option key={n} value={n}>{n === 0 ? t('0 % (sans estimation)') : `${n} %`}</option>)}
        </Select>
        <label htmlFor="paie" className="ms-3">{t('Masse salariale reprise de la paie')}</label>
        <Select id="paie" name="paie" defaultValue={avecPaie ? '1' : '0'} className="h-9 w-28">
          <option value="1">{t('Oui')}</option>
          <option value="0">{t('Non')}</option>
        </Select>
        <Button type="submit" size="sm" variant="outline">{t('Recalculer')}</Button>
      </form>

      {partVentes > 0 && (
        <p className="mb-2 text-sm text-foreground-muted">
          {estimation.moisHistorique === 0
            ? t('Aucune vente dans l’historique : les ventes futures ne peuvent pas être estimées.')
            : t('Ventes estimées d’après l’historique (mois avec ventes : {n}) : même mois des années précédentes, sinon moyenne des 12 derniers mois, encaissées avec le même délai que les créances. Le mois en cours n’est pas estimé.', { n: estimation.moisHistorique })}
        </p>
      )}
      {avecPaie && (
        <p className="mb-2 text-sm text-foreground-muted">
          {paie.moisHistorique === 0
            ? t('Aucune paie enregistrée : la masse salariale n’est pas reprise. Saisissez vos salaires en prévision mensuelle.')
            : t('Masse salariale : moyenne des 3 dernières paies ({n} par mois), reconduite chaque mois. Ne la saisissez pas en plus dans les prévisions.', { n: monnaie(paie.base) })}
        </p>
      )}
      <div className="mb-8">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}></th>
              {plan.mois.map((m) => <th key={m} className={`${th} text-right`}>{libelleMois(m)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${td} font-medium`}>{t('Solde de début')}</td>
              {plan.soldeDebut.map((v, i) => <td key={i} className={`${td} text-right tabular-nums`}>{monnaie(v)}</td>)}
            </tr>
            {plan.lignes.map((l) => (
              <tr key={l.categorie}>
                <td className={td}>{t(CATEGORIES_PREVISION[l.categorie] ?? l.categorie)}</td>
                {l.parMois.map((v, i) => (
                  <td key={i} className={`${td} text-right tabular-nums ${v < 0 ? 'text-danger' : v > 0 ? 'text-success' : 'text-foreground-muted'}`}>{v === 0 ? '—' : monnaie(v)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td className={`${td} font-semibold`}>{t('Solde de fin')}</td>
              {plan.soldeFin.map((v, i) => <td key={i} className={`${td} text-right font-semibold tabular-nums ${v < 0 ? 'text-danger' : ''}`}>{monnaie(v)}</td>)}
            </tr>
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Prévisions saisies')}</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Libellé')}</th><th className={th}>{t('Catégorie')}</th><th className={th}>{t('Répétition')}</th>
            <th className={th}>{t('Période')}</th><th className={`${th} text-right`}>{t('Montant')}</th><th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {previsions?.map((p) => (
            <tr key={p.id}>
              <td className={td}>{p.libelle}</td>
              <td className={td}>{t(CATEGORIES_PREVISION[p.categorie] ?? p.categorie)}</td>
              <td className={td}>{p.recurrence === 'mensuelle' ? t('Chaque mois') : t('Une seule fois')}</td>
              <td className={td}>{formatDate(p.date_debut, ctx.lang)}{p.date_fin ? ` → ${formatDate(p.date_fin, ctx.lang)}` : ''}</td>
              <td className={`${td} text-right tabular-nums ${p.sens === 'decaissement' ? 'text-danger' : 'text-success'}`}>{p.sens === 'decaissement' ? '−' : '+'}{monnaie(Number(p.montant))}</td>
              <td className={td}>{peutEcrire && <ActionButton label={t('Supprimer')} action={supprimerPrevision.bind(null, p.id)} confirmation={t('Supprimer cette prévision ?')} />}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
