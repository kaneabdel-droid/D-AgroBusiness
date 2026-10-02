'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useT } from '@/components/I18nProvider'
import { UNITES_PRESTATION } from '@/lib/catalogue'

type Resultat = { success: true } | { error: string }
type Opt = { id: string; label: string }
export type ClientOpt = Opt & { telephone: string | null }
export type ProduitPointe = Opt & { unite: string; variete_obligatoire: boolean }

/** Valeurs d'une prestation existante (modification). */
export type PrestationValeurs = {
  materiel_id: string
  campagne_id: string | null
  date_prestation: string
  type_prestation: string
  client_id: string | null
  client_nom: string | null
  client_telephone: string | null
  unite: string
  unite_autre: string | null
  quantite_traitee: number
  tarif_unitaire: number | null
  produit_id: string | null
  variete: string | null
  quantite_obtenue: number | null
  unite_obtenue: string | null
  mode_paiement: string
  taux_part: number | null
  prix_unitaire_part: number | null
  montant: number
}

const s = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))
const arrondi = (n: number) => Math.round(n * 100) / 100

/**
 * Pointage d'une prestation du matériel sur le terrain : unité (ha, heures, sacs ou autre), quantité traitée, client et
 * téléphone, quantité obtenue avec produit et variété (obligatoire selon le produit), paiement en argent ou en part de récolte.
 */
export function PrestationMaterielForm({
  action,
  materiels,
  clients,
  produits,
  campagnes,
  varietes,
  valeurs,
}: {
  action: (formData: FormData) => Promise<Resultat>
  materiels: Opt[]
  clients: ClientOpt[]
  produits: ProduitPointe[]
  campagnes: Opt[]
  varietes: Record<string, string[]>
  valeurs?: PrestationValeurs
}) {
  const { t } = useT()
  const v = valeurs
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [unite, setUnite] = useState(v?.unite ?? 'ha')
  const [quantite, setQuantite] = useState(s(v?.quantite_traitee))
  const [clientId, setClientId] = useState(v?.client_id ?? '')
  const [telephone, setTelephone] = useState(s(v?.client_telephone))
  const [produitId, setProduitId] = useState(v?.produit_id ?? '')
  const [obtenue, setObtenue] = useState(s(v?.quantite_obtenue))
  const [uniteObtenue, setUniteObtenue] = useState(v?.unite_obtenue ?? 'sac')
  const [mode, setMode] = useState(v?.mode_paiement ?? 'especes')
  const [tarif, setTarif] = useState(s(v?.tarif_unitaire))
  const [taux, setTaux] = useState(s(v?.taux_part))
  const [prixPart, setPrixPart] = useState(s(v?.prix_unitaire_part))
  const [montant, setMontant] = useState(s(v?.montant))

  const produit = produits.find((p) => p.id === produitId)
  const part = mode === 'part_recolte' && obtenue && taux ? arrondi((Number(obtenue) * Number(taux)) / 100) : null
  const uniteDef = UNITES_PRESTATION.find((u) => u.value === unite) ?? UNITES_PRESTATION[0]

  // Montant proposé : quantité × tarif, ou part de récolte × valeur unitaire. Le pointeur peut le corriger.
  function proposer(n: { quantite?: string; tarif?: string; obtenue?: string; taux?: string; prixPart?: string; mode?: string }) {
    if ((n.mode ?? mode) === 'especes') {
      const q = Number(n.quantite ?? quantite)
      const tf = n.tarif ?? tarif
      if (tf && q) setMontant(String(arrondi(q * Number(tf))))
    } else {
      const o = Number(n.obtenue ?? obtenue)
      const tx = Number(n.taux ?? taux)
      const px = n.prixPart ?? prixPart
      if (px && o && tx) setMontant(String(arrondi(((o * tx) / 100) * Number(px))))
    }
  }

  function onSubmit(formData: FormData) {
    setErreur(null)
    startTransition(async () => {
      const res = await action(formData)
      if ('error' in res) {
        setErreur(res.error)
        return
      }
      setOuvert(false)
    })
  }

  if (!ouvert) {
    return v ? (
      <Button type="button" size="sm" variant="outline" onClick={() => setOuvert(true)} aria-label={t('Modifier')}>
        <Pencil className="h-4 w-4" aria-hidden />
      </Button>
    ) : (
      <Button onClick={() => setOuvert(true)}>
        <Plus className="h-4 w-4" aria-hidden /> {t('Pointer une prestation')}
      </Button>
    )
  }

  const titre = v ? t('Modifier la prestation') : t('Pointer une prestation')
  const champ = 'space-y-1.5'
  const bloc = 'grid gap-4 rounded-lg border border-surface-border p-4 sm:grid-cols-2'
  const legende = 'px-1 text-xs font-semibold uppercase tracking-wider text-foreground-muted'

  const formulaire = (
    <Card className="w-full basis-full text-start">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">{titre}</h2>
        <button type="button" onClick={() => setOuvert(false)} aria-label={t('Fermer')} className="rounded-lg p-2 hover:bg-sidebar">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form action={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className={champ}>
            <Label htmlFor="materiel_id">{t('Matériel')}</Label>
            <Select id="materiel_id" name="materiel_id" required defaultValue={v?.materiel_id ?? ''}>
              <option value="" disabled>{t('Choisir…')}</option>
              {materiels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
          </div>
          <div className={champ}>
            <Label htmlFor="date_prestation">{t('Date')}</Label>
            <Input id="date_prestation" name="date_prestation" type="date" required defaultValue={v?.date_prestation ?? new Date().toISOString().slice(0, 10)} />
          </div>
          <div className={champ}>
            <Label htmlFor="campagne_id">{t('Campagne (exécution budgétaire)')}</Label>
            <Select id="campagne_id" name="campagne_id" defaultValue={v ? v.campagne_id ?? '' : campagnes[0]?.id ?? ''}>
              <option value="">{t('Hors campagne')}</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </div>
        </div>

        <fieldset className={bloc}>
          <legend className={legende}>{t('Client')}</legend>
          <div className={champ}>
            <Label htmlFor="client_id">{t('Client enregistré')}</Label>
            <Select
              id="client_id"
              name="client_id"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value)
                const c = clients.find((x) => x.id === e.target.value)
                if (c?.telephone && !telephone) setTelephone(c.telephone)
              }}
            >
              <option value="">{t('— Client occasionnel —')}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </div>
          {!clientId && (
            <div className={champ}>
              <Label htmlFor="client_nom">{t('Nom du client')} *</Label>
              <Input id="client_nom" name="client_nom" required defaultValue={v?.client_nom ?? ''} />
            </div>
          )}
          <div className={champ}>
            <Label htmlFor="client_telephone">{t('Téléphone du client')} *</Label>
            <Input
              id="client_telephone"
              name="client_telephone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              required
              pattern="[0-9+ ().\-]{7,}"
              placeholder="77 123 45 67"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className={bloc}>
          <legend className={legende}>{t('Travail réalisé')}</legend>
          <div className={`${champ} sm:col-span-2`}>
            <Label htmlFor="type_prestation">{t('Type de prestation')}</Label>
            <Input id="type_prestation" name="type_prestation" required placeholder={t('Ex. : labour, offset, moisson, nivellement…')} defaultValue={v?.type_prestation ?? ''} />
          </div>
          <div className={champ}>
            <Label htmlFor="unite">{t('Unité de pointage')}</Label>
            <Select id="unite" name="unite" value={unite} onChange={(e) => setUnite(e.target.value)}>
              {UNITES_PRESTATION.map((u) => <option key={u.value} value={u.value}>{t(u.label)}</option>)}
            </Select>
          </div>
          {unite === 'autre' && (
            <div className={champ}>
              <Label htmlFor="unite_autre">{t('Unité (préciser)')}</Label>
              <Input id="unite_autre" name="unite_autre" required placeholder={t('Ex. : km, voyages, tonnes')} defaultValue={v?.unite_autre ?? ''} />
            </div>
          )}
          <div className={champ}>
            <Label htmlFor="quantite_traitee">{t(uniteDef.quantite)}</Label>
            <Input
              id="quantite_traitee"
              name="quantite_traitee"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={quantite}
              onChange={(e) => {
                setQuantite(e.target.value)
                proposer({ quantite: e.target.value })
              }}
            />
          </div>
        </fieldset>

        <fieldset className={bloc}>
          <legend className={legende}>{t('Quantité obtenue (récolte)')}</legend>
          <div className={champ}>
            <Label htmlFor="produit_id">{t('Produit')}</Label>
            <Select
              id="produit_id"
              name="produit_id"
              value={produitId}
              onChange={(e) => {
                setProduitId(e.target.value)
                const p = produits.find((x) => x.id === e.target.value)
                if (p) setUniteObtenue(p.unite)
              }}
            >
              <option value="">{t('— Aucun —')}</option>
              {produits.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </div>
          {produit && (
            <div className={champ}>
              <Label htmlFor="variete">
                {t('Variété')}
                {produit.variete_obligatoire && <span className="font-normal text-foreground-muted"> * ({t('obligatoire pour ce produit')})</span>}
              </Label>
              <Input
                key={produit.id}
                id="variete"
                name="variete"
                list="varietes-pointees"
                required={produit.variete_obligatoire}
                defaultValue={v?.produit_id === produit.id ? v?.variete ?? '' : ''}
              />
              <datalist id="varietes-pointees">
                {(varietes[produit.id] ?? []).map((x) => <option key={x} value={x} />)}
              </datalist>
            </div>
          )}
          <div className={champ}>
            <Label htmlFor="quantite_obtenue">{t('Quantité obtenue')}{mode === 'part_recolte' && ' *'}</Label>
            <Input
              id="quantite_obtenue"
              name="quantite_obtenue"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required={mode === 'part_recolte'}
              value={obtenue}
              onChange={(e) => {
                setObtenue(e.target.value)
                proposer({ obtenue: e.target.value })
              }}
            />
          </div>
          <div className={champ}>
            <Label htmlFor="unite_obtenue">{t('Unité')}</Label>
            <Input id="unite_obtenue" name="unite_obtenue" value={uniteObtenue} onChange={(e) => setUniteObtenue(e.target.value)} />
          </div>
        </fieldset>

        <fieldset className={bloc}>
          <legend className={legende}>{t('Paiement')}</legend>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:gap-6">
            {[
              { value: 'especes', label: t('En argent (tarif ou forfait)') },
              { value: 'part_recolte', label: t('En part de la récolte (%)') },
            ].map((m) => (
              <label key={m.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="mode_paiement"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => {
                    setMode(m.value)
                    proposer({ mode: m.value })
                  }}
                  className="h-4 w-4"
                />
                {m.label}
              </label>
            ))}
          </div>
          {mode === 'especes' ? (
            <div className={champ}>
              <Label htmlFor="tarif_unitaire">{t('Tarif par unité')}</Label>
              <Input
                id="tarif_unitaire"
                name="tarif_unitaire"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={tarif}
                onChange={(e) => {
                  setTarif(e.target.value)
                  proposer({ tarif: e.target.value })
                }}
              />
            </div>
          ) : (
            <>
              <div className={champ}>
                <Label htmlFor="taux_part">{t('Part prélevée (%)')} *</Label>
                <Input
                  id="taux_part"
                  name="taux_part"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="100"
                  step="0.01"
                  required
                  value={taux}
                  onChange={(e) => {
                    setTaux(e.target.value)
                    proposer({ taux: e.target.value })
                  }}
                />
              </div>
              <div className={champ}>
                <Label htmlFor="prix_unitaire_part">{t('Valeur d’une unité de récolte')}</Label>
                <Input
                  id="prix_unitaire_part"
                  name="prix_unitaire_part"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={prixPart}
                  onChange={(e) => {
                    setPrixPart(e.target.value)
                    proposer({ prixPart: e.target.value })
                  }}
                />
              </div>
              {part !== null && (
                <p className="rounded-lg bg-sidebar px-3 py-2 text-sm sm:col-span-2">
                  {t('Part revenant à l’entreprise')} : <span className="font-semibold">{part.toLocaleString()} {uniteObtenue}</span>
                </p>
              )}
            </>
          )}
          <div className={champ}>
            <Label htmlFor="montant">{t('Montant')}</Label>
            <Input id="montant" name="montant" type="number" inputMode="decimal" min="0" step="0.01" required value={montant} onChange={(e) => setMontant(e.target.value)} />
            <p className="text-xs text-foreground-muted">{t('Calculé automatiquement, modifiable.')}</p>
          </div>
        </fieldset>

        <p className="text-xs text-foreground-muted">{t('Chaque prestation est comptabilisée en facture de service (journal des ventes), imputée au département et au secteur du matériel : elle compte dans l’exécution budgétaire. Une part de récolte se solde par un remboursement en nature.')}</p>
        {erreur && <p role="alert" className="text-sm text-danger">{t(erreur)}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? t('Enregistrement…') : t('Enregistrer')}</Button>
          <Button type="button" variant="outline" onClick={() => setOuvert(false)}>{t('Annuler')}</Button>
        </div>
      </form>
    </Card>
  )

  // En modification, le formulaire s'ouvre par-dessus le tableau.
  return v ? (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4" onClick={(e) => e.target === e.currentTarget && setOuvert(false)}>
      <div className="mx-auto max-w-3xl">{formulaire}</div>
    </div>
  ) : (
    formulaire
  )
}
