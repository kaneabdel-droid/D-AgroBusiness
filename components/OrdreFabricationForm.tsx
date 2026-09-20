'use client'

import { useMemo, useState, useTransition } from 'react'
import { LOCALES } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { lancerTransformation } from '@/app/(app)/production/actions'
import { useT } from '@/components/I18nProvider'

type Opt = { id: string; label: string }
export type NomenclatureOpt = {
  id: string
  label: string
  matiere: string
  sorties: { produit_id: string; label: string; unite: string; rendement: number; principal: boolean }[]
}

export function OrdreFabricationForm({
  nomenclatures, magasins, departements, campagnes, departementParDefaut,
}: {
  nomenclatures: NomenclatureOpt[]
  magasins: Opt[]
  departements: Opt[]
  campagnes: Opt[]
  departementParDefaut: string
}) {
  const { t, lang } = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [nomId, setNomId] = useState('')
  const [src, setSrc] = useState(magasins[0]?.id ?? '')
  const [dst, setDst] = useState(magasins[0]?.id ?? '')
  const [dep, setDep] = useState(departementParDefaut)
  const [camp, setCamp] = useState('')
  const [matiere, setMatiere] = useState('')
  const [frais, setFrais] = useState('')
  const [observation, setObservation] = useState('')
  const [reels, setReels] = useState<Record<string, string>>({})

  const nom = nomenclatures.find((n) => n.id === nomId)
  const qte = Number(matiere) || 0

  const lignes = useMemo(
    () =>
      (nom?.sorties ?? []).map((s) => {
        const prevu = Math.round(qte * s.rendement * 10) / 1000
        const saisi = reels[s.produit_id]
        const quantite = saisi !== undefined && saisi !== '' ? Number(saisi) : prevu
        return { ...s, prevu, quantite, rendementReel: qte > 0 ? (quantite / qte) * 100 : 0 }
      }),
    [nom, qte, reels]
  )
  const totalSorties = lignes.reduce((s, l) => s + l.quantite, 0)

  function envoyer() {
    setErreur(null)
    startTransition(async () => {
      const res = await lancerTransformation({
        date,
        nomenclature_id: nomId,
        magasin_source_id: src,
        magasin_destination_id: dst,
        departement_id: dep,
        campagne_id: camp || undefined,
        quantite_matiere: qte,
        frais_imputes: frais ? Number(frais) : undefined,
        observation: observation || undefined,
        sorties: lignes.filter((l) => l.quantite > 0).map((l) => ({ produit_id: l.produit_id, quantite: l.quantite })),
      })
      if ('error' in res) {
        setErreur(res.error)
        return
      }
      router.push('/usine')
    })
  }

  return (
    <div className="space-y-4">
      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">{t('Date')}</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="nom">{t('Nomenclature')}</Label>
          <Select id="nom" value={nomId} onChange={(e) => { setNomId(e.target.value); setReels({}) }}>
            <option value="">{t('Choisir…')}</option>
            {nomenclatures.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="matiere">{t('Quantité de {m}', { m: nom?.matiere ?? t('matière première') })}</Label>
          <Input id="matiere" type="number" min="0" step="0.001" inputMode="decimal" value={matiere} onChange={(e) => setMatiere(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="src">{t('Magasin matière')}</Label>
          <Select id="src" value={src} onChange={(e) => setSrc(e.target.value)}>
            {magasins.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dst">{t('Magasin produits finis')}</Label>
          <Select id="dst" value={dst} onChange={(e) => setDst(e.target.value)}>
            {magasins.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dep">{t('Département')}</Label>
          <Select id="dep" value={dep} onChange={(e) => setDep(e.target.value)}>
            {departements.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="camp">{t('Campagne')}</Label>
          <Select id="camp" value={camp} onChange={(e) => setCamp(e.target.value)}>
            <option value="">—</option>
            {campagnes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="frais">{t('Frais de transformation imputés')}</Label>
          <Input id="frais" type="number" min="0" step="0.01" inputMode="decimal" value={frais} onChange={(e) => setFrais(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="obs">{t('Observation')}</Label>
          <Input id="obs" value={observation} onChange={(e) => setObservation(e.target.value)} />
        </div>
      </Card>

      {nom && (
        <Card>
          <h2 className="mb-3 font-heading text-lg font-semibold">{t('Produits obtenus')}</h2>
          <div className="space-y-3">
            {lignes.map((l) => (
              <div key={l.produit_id} className="grid items-end gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium">
                    {l.label} {l.principal && <span className="ml-1 rounded bg-sidebar px-1.5 py-0.5 text-xs">{t('principal')}</span>}
                  </p>
                  <p className="text-xs text-foreground-muted">{t('Rendement prévu {r} % → {q} {u}', { r: l.rendement, q: l.prevu.toLocaleString(LOCALES[lang]), u: l.unite })}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`q-${l.produit_id}`}>{t('Quantité réelle ({u})', { u: l.unite })}</Label>
                  <Input id={`q-${l.produit_id}`} type="number" min="0" step="0.001" inputMode="decimal"
                    value={reels[l.produit_id] ?? ''} placeholder={String(l.prevu)}
                    onChange={(e) => setReels((r) => ({ ...r, [l.produit_id]: e.target.value }))} />
                </div>
                <p className="pb-2 text-sm tabular-nums">{t('Rendement réel : {r} %', { r: l.rendementReel.toFixed(1) })}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-foreground-muted">
            {t('Total obtenu : {a} pour {b} de matière (écart / pertes : {c}, si les unités sont identiques).', { a: totalSorties.toLocaleString(LOCALES[lang]), b: qte.toLocaleString(LOCALES[lang]), c: (qte - totalSorties).toLocaleString(LOCALES[lang]) })}
          </p>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={envoyer} disabled={pending || !nomId || qte <= 0 || !dep}>
          {pending ? t('Enregistrement…') : t('Lancer la transformation')}
        </Button>
        {erreur && <p role="alert" className="text-sm text-danger">{erreur}</p>}
      </div>
    </div>
  )
}
