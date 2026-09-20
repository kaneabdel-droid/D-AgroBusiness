import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT, LOCALES } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { formatDate } from '@/lib/utils'
import { COULEURS_STATUT, ORIGINES_LOT, STATUTS_LOT } from '@/lib/tracabilite'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ActionButton } from '@/components/ActionButton'
import { ConfirmerVente } from '@/components/ConfirmerVente'
import { ajouterControle, ajouterExpedition, changerStatut, confirmerVente, lierLot } from '../actions'

type Lien = { lot_id: string; niveau: number }

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()

  const { data: lot } = await supabase.from('v_lots').select('*').eq('id', id).maybeSingle()
  if (!lot) notFound()

  const [{ data: controles }, { data: expeditions }, { data: amontRaw }, { data: avalRaw }, { data: autres }] = await Promise.all([
    supabase.from('controles_qualite').select('*').eq('lot_id', id).order('date_controle', { ascending: false }),
    supabase.from('lot_expeditions').select('*, tiers(code, nom)').eq('lot_id', id).order('date_expedition', { ascending: false }),
    supabase.rpc('tracer_lot', { p_lot: id, p_sens: 'amont' }),
    supabase.rpc('tracer_lot', { p_lot: id, p_sens: 'aval' }),
    supabase.from('v_lots').select('id, numero, produit_nom').neq('id', id).order('created_at', { ascending: false }).limit(300),
  ])
  const amont = ((amontRaw ?? []) as Lien[]).filter((x) => x.lot_id !== id)
  const aval = ((avalRaw ?? []) as Lien[]).filter((x) => x.lot_id !== id)
  const idsLies = [...amont, ...aval].map((x) => x.lot_id)

  const [{ data: lotsLies }, { data: expeditionsAval }] = await Promise.all([
    idsLies.length ? supabase.from('v_lots').select('id, numero, produit_nom, statut').in('id', idsLies) : Promise.resolve({ data: [] }),
    // clients touchés par un rappel : expéditions de ce lot et de tous les lots qu'il a servi à produire
    supabase.from('lot_expeditions').select('lot_id, date_expedition, quantite, tiers(code, nom)').in('lot_id', [id, ...aval.map((x) => x.lot_id)]),
  ])
  const parId = new Map((lotsLies ?? []).map((l) => [l.id, l]))
  const numeroDe = (lotId: string) => (lotId === id ? lot.numero : parId.get(lotId)?.numero ?? '')

  // Ventes du même produit à rattacher à ce lot : la quantité déjà rattachée (à ce lot ou à un autre) est déduite
  const [{ data: lignesVente }, { data: dejaRattache }] = await Promise.all([
    supabase.from('ventes_lignes').select('vente_id, quantite, ventes(numero, date_vente, client_id, tiers:client_id(code, nom))').eq('produit_id', lot.produit_id).order('created_at', { ascending: false }).limit(100),
    supabase.from('lot_expeditions').select('vente_id, quantite, lots!inner(produit_id)').eq('lots.produit_id', lot.produit_id).not('vente_id', 'is', null),
  ])
  const rattache = new Map<string, number>()
  for (const r of dejaRattache ?? []) rattache.set(r.vente_id as string, (rattache.get(r.vente_id as string) ?? 0) + Number(r.quantite))
  const resteLot = Number(lot.quantite_initiale) - Number(lot.quantite_expediee)
  const propositions = (lignesVente ?? [])
    .map((l) => {
      const v = (Array.isArray(l.ventes) ? l.ventes[0] : l.ventes) as { numero: string; date_vente: string; client_id: string; tiers: unknown } | null
      const reste = Number(l.quantite) - (rattache.get(l.vente_id) ?? 0)
      return { l, v, reste: Math.min(reste, resteLot) }
    })
    .filter((x) => x.v && x.reste > 0)

  const peutEcrire = ['admin', 'comptable', 'chef_departement'].includes(ctx.role)
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const optionsLots = (autres ?? []).map((l) => ({ value: l.id, label: `${l.numero} — ${l.produit_nom}` }))
  const num = (v: unknown) => Number(v).toLocaleString(LOCALES[ctx.lang])
  const nomTiers = (x: unknown) => {
    const tt = (Array.isArray(x) ? x[0] : x) as { code: string; nom: string } | null
    return tt ? `${tt.code} — ${tt.nom}` : '—'
  }

  const listeLies = (titre: string, liste: Lien[]) => (
    <div>
      <h3 className="mb-1 text-sm font-medium text-foreground-muted">{titre}</h3>
      {liste.length === 0 ? (
        <p className="text-sm text-foreground-muted">—</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {liste.sort((a, b) => a.niveau - b.niveau).map((x) => {
            const l = parId.get(x.lot_id)
            return (
              <li key={x.lot_id}>
                <span className="text-foreground-muted">{'→ '.repeat(x.niveau)}</span>
                <Link href={`/tracabilite/${x.lot_id}`} className="text-primary underline">{l?.numero}</Link>
                {' '}{l?.produit_nom} · <span className={COULEURS_STATUT[l?.statut ?? 'en_attente']}>{t(STATUTS_LOT[l?.statut ?? 'en_attente'])}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        titre={`${t('Lot')} ${lot.numero}`}
        description={`${lot.produit_nom} · ${t(ORIGINES_LOT[lot.origine])} · ${formatDate(lot.date_creation, ctx.lang)}`}
      >
        <Link href="/tracabilite" className="text-sm text-primary underline">{t('← Lots')}</Link>
        {peutEcrire && (
          <>
            {lot.statut !== 'libere' && <ActionButton label={t('Libérer le lot')} action={changerStatut.bind(null, id, 'libere')} variant="default" />}
            {lot.statut !== 'bloque' && <ActionButton label={t('Bloquer le lot')} action={changerStatut.bind(null, id, 'bloque')} confirmation={t('Bloquer ce lot ? Aucune expédition ne sera plus possible.')} />}
            <SimpleCreateForm
              titre={t('Contrôle qualité')}
              action={ajouterControle.bind(null, id)}
              champs={[
                { name: 'date', label: t('Date'), type: 'date', required: true, defaultValue: aujourdhui },
                { name: 'parametre', label: t('Paramètre (humidité, impuretés, aflatoxines…)'), required: true },
                { name: 'valeur', label: t('Valeur mesurée'), type: 'number', step: '0.0001', required: true },
                { name: 'minimum', label: t('Minimum admis'), type: 'number', step: '0.0001' },
                { name: 'maximum', label: t('Maximum admis'), type: 'number', step: '0.0001' },
                { name: 'observation', label: t('Observation') },
              ]}
            />
            <SimpleCreateForm
              titre={t('Enregistrer une expédition')}
              action={ajouterExpedition.bind(null, id)}
              champs={[
                { name: 'date', label: t('Date'), type: 'date', required: true, defaultValue: aujourdhui },
                { name: 'quantite', label: t('Quantité'), type: 'number', step: '0.001', required: true },
                { name: 'tiers_id', label: t('Destinataire'), type: 'select', options: o.clients.map((c) => ({ value: c.id, label: c.label })) },
                { name: 'observation', label: t('Observation') },
              ]}
            />
            <SimpleCreateForm
              titre={t('Ajouter une matière d’origine')}
              action={lierLot.bind(null, id, 'amont')}
              champs={[
                { name: 'lot_id', label: t('Lot d’origine (a servi à produire ce lot)'), type: 'select', required: true, options: optionsLots },
                { name: 'quantite', label: t('Quantité utilisée'), type: 'number', step: '0.001' },
              ]}
            />
            <SimpleCreateForm
              titre={t('Ajouter un lot dérivé')}
              action={lierLot.bind(null, id, 'aval')}
              champs={[
                { name: 'lot_id', label: t('Lot dérivé (produit à partir de ce lot)'), type: 'select', required: true, options: optionsLots },
                { name: 'quantite', label: t('Quantité utilisée'), type: 'number', step: '0.001' },
              ]}
            />
          </>
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-sm text-foreground-muted">{t('Statut')}</p><p className={`mt-1 text-xl font-semibold ${COULEURS_STATUT[lot.statut]}`}>{t(STATUTS_LOT[lot.statut])}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Quantité')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{num(lot.quantite_initiale)} {lot.unite}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Expédié')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{num(lot.quantite_expediee)} {lot.unite}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Péremption')}</p><p className="mt-1 text-xl font-semibold">{lot.date_peremption ? formatDate(lot.date_peremption, ctx.lang) : '—'}</p></Card>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Filiation')}</h2>
      <Card className="mb-6 grid gap-6 sm:grid-cols-2">
        {listeLies(t('Origine (lots amont)'), amont)}
        {listeLies(t('Lots dérivés (aval)'), aval)}
      </Card>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Contrôles qualité')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>{t('Date')}</th><th className={th}>{t('Paramètre')}</th>
              <th className={`${th} text-right`}>{t('Valeur mesurée')}</th><th className={`${th} text-right`}>{t('Limites')}</th>
              <th className={th}>{t('Résultat')}</th>
            </tr>
          </thead>
          <tbody>
            {controles?.map((c) => (
              <tr key={c.id}>
                <td className={td}>{formatDate(c.date_controle, ctx.lang)}</td>
                <td className={td}>{c.parametre}</td>
                <td className={`${td} text-right tabular-nums`}>{num(c.valeur)}</td>
                <td className={`${td} text-right tabular-nums`}>{c.minimum != null ? num(c.minimum) : '—'} / {c.maximum != null ? num(c.maximum) : '—'}</td>
                <td className={`${td} font-medium ${c.conforme ? 'text-success' : 'text-danger'}`}>{c.conforme ? t('Conforme') : t('Non conforme')}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Expéditions')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr><th className={th}>{t('Date')}</th><th className={th}>{t('Destinataire')}</th><th className={`${th} text-right`}>{t('Quantité')}</th></tr>
          </thead>
          <tbody>
            {expeditions?.map((e) => (
              <tr key={e.id}>
                <td className={td}>{formatDate(e.date_expedition, ctx.lang)}</td>
                <td className={td}>{nomTiers(e.tiers)}</td>
                <td className={`${td} text-right tabular-nums`}>{num(e.quantite)} {lot.unite}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      {peutEcrire && lot.statut !== 'bloque' && propositions.length > 0 && (
        <>
          <h2 className="mb-2 font-heading text-lg font-semibold">{t('Ventes à rattacher à ce lot')}</h2>
          <p className="mb-2 text-sm text-foreground-muted">{t('Ventes de ce produit dont la sortie n’est pas encore rattachée à un lot. Vérifiez la quantité puis confirmez : l’expédition est alors enregistrée avec le client et la date de la vente.')}</p>
          <div className="mb-6">
            <TableWrap>
              <thead>
                <tr><th className={th}>{t('Vente')}</th><th className={th}>{t('Date')}</th><th className={th}>{t('Client')}</th><th className={`${th} text-right`}>{t('Reste à rattacher')}</th><th className={th}></th></tr>
              </thead>
              <tbody>
                {propositions.map(({ l, v, reste }) => (
                  <tr key={l.vente_id + String(l.quantite)}>
                    <td className={td}>{v!.numero}</td>
                    <td className={td}>{formatDate(v!.date_vente, ctx.lang)}</td>
                    <td className={td}>{nomTiers(v!.tiers)}</td>
                    <td className={`${td} text-right tabular-nums`}>{num(reste)} {lot.unite}</td>
                    <td className={td}><ConfirmerVente maxQuantite={reste} action={confirmerVente.bind(null, id, l.vente_id, v!.client_id, v!.date_vente)} /></td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </>
      )}

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Rappel de lot : destinataires concernés')}</h2>
      <p className="mb-2 text-sm text-foreground-muted">{t('Expéditions de ce lot et de tous les lots produits à partir de lui.')}</p>
      <TableWrap>
        <thead>
          <tr><th className={th}>{t('Lot')}</th><th className={th}>{t('Date')}</th><th className={th}>{t('Destinataire')}</th><th className={`${th} text-right`}>{t('Quantité')}</th></tr>
        </thead>
        <tbody>
          {expeditionsAval?.map((e, i) => (
            <tr key={i}>
              <td className={td}>{numeroDe(e.lot_id)}</td>
              <td className={td}>{formatDate(e.date_expedition, ctx.lang)}</td>
              <td className={td}>{nomTiers(e.tiers)}</td>
              <td className={`${td} text-right tabular-nums`}>{num(e.quantite)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
