'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { formatMontant } from '@/lib/utils'
import { useT } from '@/components/I18nProvider'
import {
  enregistrerAchat,
  enregistrerVente,
  recevoirDepot,
} from '@/app/(app)/operations/actions'

type Opt = { id: string; label: string }
export type ProduitOpt = Opt & { prix: number | null; tva: number; categorie: string; unite: string }

export type Kind = 'achat' | 'vente' | 'distribution' | 'depot'

type Ligne = { produit_id: string; quantite: string; prix: string; tva: string; contrat: string }
const vide = (): Ligne => ({ produit_id: '', quantite: '', prix: '', tva: '', contrat: '' })

const CONFIG: Record<Kind, { titreTiers: string; retour: string; bouton: string }> = {
  achat: { titreTiers: 'Fournisseur', retour: '/achats', bouton: 'Enregistrer l’achat' },
  vente: { titreTiers: 'Client', retour: '/ventes?type=marche', bouton: 'Facturer' },
  distribution: { titreTiers: 'Producteur', retour: '/ventes?type=distribution', bouton: 'Facturer la distribution' },
  depot: { titreTiers: 'Contrat de dépôt', retour: '/depot-vente', bouton: 'Enregistrer la réception' },
}

export function DocumentForm({
  kind, tiers, magasins, campagnes, departements, secteurs, produits, contrats, devise,
}: {
  kind: Kind
  tiers: Opt[]                         // fournisseurs / clients / producteurs ; contrats pour 'depot'
  magasins: Opt[]
  campagnes: Opt[]
  departements: Opt[]
  secteurs: (Opt & { departement_id: string })[]
  produits: ProduitOpt[]
  contrats: Opt[]                      // contrats de dépôt actifs (vente de stock consigné)
  devise: string
}) {
  const { t, lang } = useT()
  const cfg = CONFIG[kind]
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [tiersId, setTiersId] = useState('')
  const [magasin, setMagasin] = useState(magasins[0]?.id ?? '')
  const [campagne, setCampagne] = useState('')
  const [dep, setDep] = useState(
    kind === 'distribution' ? (departements.find((d) => d.label.startsWith('Distribution'))?.id ?? '') : ''
  )
  const [sec, setSec] = useState('')
  const [reference, setReference] = useState('')
  const [lignes, setLignes] = useState<Ligne[]>([vide()])

  const avecPrix = kind !== 'depot'
  const produitDe = (id: string) => produits.find((p) => p.id === id)

  const totaux = useMemo(() => {
    let ht = 0, tva = 0
    for (const l of lignes) {
      const p = produitDe(l.produit_id)
      const m = (Number(l.quantite) || 0) * (Number(l.prix) || 0)
      ht += m
      tva += m * ((l.tva !== '' ? Number(l.tva) : (p?.tva ?? 0)) / 100)
    }
    return { ht, tva, ttc: ht + tva }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, produits])

  function maj(i: number, patch: Partial<Ligne>) {
    setLignes((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  function choisirProduit(i: number, id: string) {
    const p = produitDe(id)
    maj(i, { produit_id: id, prix: p?.prix != null ? String(p.prix) : '', tva: p ? String(p.tva) : '' })
  }

  function envoyer() {
    setErreur(null)
    const lignesPayload = lignes
      .filter((l) => l.produit_id)
      .map((l) => ({
        produit_id: l.produit_id,
        quantite: Number(l.quantite),
        ...(avecPrix ? { prix_unitaire: Number(l.prix) } : {}),
        ...(avecPrix && l.tva !== '' ? { taux_tva: Number(l.tva) } : {}),
        ...(kind === 'vente' || kind === 'distribution' ? { contrat_depot_id: l.contrat || undefined } : {}),
      }))

    startTransition(async () => {
      const commun = { date, reference: reference || undefined, lignes: lignesPayload }
      const res =
        kind === 'achat'
          ? await enregistrerAchat({ ...commun, fournisseur_id: tiersId, magasin_id: magasin, campagne_id: campagne || undefined })
          : kind === 'depot'
            ? await recevoirDepot({ ...commun, contrat_id: tiersId, magasin_id: magasin })
            : await enregistrerVente({
                ...commun,
                type: kind === 'vente' ? 'marche' : 'distribution',
                client_id: tiersId,
                magasin_id: magasin || undefined,
                campagne_id: campagne || undefined,
                departement_id: dep,
                secteur_id: sec || undefined,
              })
      if ('error' in res) {
        setErreur(res.error)
        return
      }
      router.push(cfg.retour)
    })
  }

  const secteursDuDep = secteurs.filter((s) => s.departement_id === dep)

  return (
    <div className="space-y-4">
      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">{t('Date')}</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tiers">{t(cfg.titreTiers)}</Label>
          <Select id="tiers" value={tiersId} onChange={(e) => setTiersId(e.target.value)}>
            <option value="">{t('Choisir…')}</option>
            {tiers.map((ti) => <option key={ti.id} value={ti.id}>{ti.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="magasin">{t('Magasin')}</Label>
          <Select id="magasin" value={magasin} onChange={(e) => setMagasin(e.target.value)}>
            <option value="">—</option>
            {magasins.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
        </div>
        {kind !== 'depot' && (
          <div className="space-y-1.5">
            <Label htmlFor="campagne">{t('Campagne')}</Label>
            <Select id="campagne" value={campagne} onChange={(e) => setCampagne(e.target.value)}>
              <option value="">—</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </div>
        )}
        {(kind === 'vente' || kind === 'distribution') && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="dep">{t('Département (produit imputé)')}</Label>
              <Select id="dep" value={dep} onChange={(e) => { setDep(e.target.value); setSec('') }}>
                <option value="">{t('Choisir…')}</option>
                {departements.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sec">{t('Secteur / projet')}</Label>
              <Select id="sec" value={sec} disabled={!dep} onChange={(e) => setSec(e.target.value)}>
                <option value="">—</option>
                {secteursDuDep.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="reference">{t('Référence / pièce')}</Label>
          <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      </Card>

      {lignes.map((l, i) => {
        const p = produitDe(l.produit_id)
        const montant = (Number(l.quantite) || 0) * (Number(l.prix) || 0)
        return (
          <Card key={i} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor={`p-${i}`}>{t('Produit')}</Label>
              <Select id={`p-${i}`} value={l.produit_id} onChange={(e) => choisirProduit(i, e.target.value)}>
                <option value="">{t('Choisir…')}</option>
                {produits.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`q-${i}`}>{t('Quantité')}{p ? ` (${p.unite})` : ''}</Label>
              <Input id={`q-${i}`} type="number" min="0" step="0.001" inputMode="decimal" value={l.quantite}
                onChange={(e) => maj(i, { quantite: e.target.value })} />
            </div>
            {avecPrix && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor={`pu-${i}`}>{t('Prix unitaire')}</Label>
                  <Input id={`pu-${i}`} type="number" min="0" step="0.01" inputMode="decimal" value={l.prix}
                    onChange={(e) => maj(i, { prix: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`tva-${i}`}>{t('TVA %')}</Label>
                  <Input id={`tva-${i}`} type="number" min="0" max="100" step="0.01" value={l.tva}
                    onChange={(e) => maj(i, { tva: e.target.value })} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              {(kind === 'vente' || kind === 'distribution') && contrats.length > 0 ? (
                <>
                  <Label htmlFor={`c-${i}`}>{t('Dépôt-vente')}</Label>
                  <Select id={`c-${i}`} value={l.contrat} onChange={(e) => maj(i, { contrat: e.target.value })}>
                    <option value="">{t('Stock propre')}</option>
                    {contrats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                </>
              ) : avecPrix ? (
                <>
                  <span className="text-sm font-medium">{t('Montant HT')}</span>
                  <p className="pt-2 text-sm tabular-nums">{formatMontant(montant, devise, lang)}</p>
                </>
              ) : null}
            </div>
            {lignes.length > 1 && (
              <div className="flex items-end">
                <Button type="button" variant="outline" size="icon" aria-label={t('Supprimer la ligne')}
                  onClick={() => setLignes((ls) => ls.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Card>
        )
      })}

      <Button type="button" variant="outline" onClick={() => setLignes((ls) => [...ls, vide()])}>
        <Plus className="h-4 w-4" aria-hidden /> {t('Ajouter une ligne')}
      </Button>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {avecPrix ? (
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div><dt className="text-foreground-muted">{t('HT')}</dt><dd className="font-medium tabular-nums">{formatMontant(totaux.ht, devise, lang)}</dd></div>
            <div><dt className="text-foreground-muted">{t('TVA')}</dt><dd className="font-medium tabular-nums">{formatMontant(totaux.tva, devise, lang)}</dd></div>
            <div><dt className="text-foreground-muted">{t('TTC')}</dt><dd className="font-semibold tabular-nums">{formatMontant(totaux.ttc, devise, lang)}</dd></div>
          </dl>
        ) : <span className="text-sm text-foreground-muted">{t('Stock consigné : aucune écriture comptable (hors bilan).')}</span>}
        <Button type="button" onClick={envoyer} disabled={pending || !tiersId}>
          {pending ? t('Enregistrement…') : t(cfg.bouton)}
        </Button>
      </Card>
      {erreur && <p role="alert" className="text-sm text-danger">{t(erreur)}</p>}
    </div>
  )
}
