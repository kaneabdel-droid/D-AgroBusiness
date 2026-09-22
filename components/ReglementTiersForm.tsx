'use client'

import { useRef, useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useT } from '@/components/I18nProvider'

type Option = { id: string; label: string }
type Resultat = { success?: boolean; error?: string } | void

const aujourdhui = () => new Date().toISOString().slice(0, 10)

/**
 * Formulaire dédié du « Règlement tiers » : contrairement à SimpleCreateForm (champs statiques), il filtre en
 * direct le tiers et la nature du paiement selon le sens choisi — un encaissement ne concerne que les clients et
 * producteurs (compte 411), un paiement que les fournisseurs (401 courant ou 481 investissements).
 */
export function ReglementTiersForm({
  disabled,
  action,
  clients,
  producteurs,
  fournisseurs,
  comptesTresorerie,
  financements,
}: {
  disabled?: boolean
  action: (formData: FormData) => Promise<Resultat>
  clients: Option[]
  producteurs: Option[]
  fournisseurs: Option[]
  comptesTresorerie: Option[]
  financements: Option[]
}) {
  const { t } = useT()
  const [ouvert, setOuvert] = useState(false)
  const [sens, setSens] = useState<'encaissement' | 'paiement'>('encaissement')
  const [erreur, setErreur] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  if (disabled) return null

  const optionsTiers = sens === 'encaissement' ? [...clients, ...producteurs] : fournisseurs

  function onSubmit(formData: FormData) {
    setErreur(null)
    startTransition(async () => {
      const res = await action(formData)
      if (res && res.error) {
        setErreur(res.error)
        return
      }
      formRef.current?.reset()
      setSens('encaissement')
      setOuvert(false)
    })
  }

  if (!ouvert) {
    return (
      <Button onClick={() => setOuvert(true)}>
        <Plus className="h-4 w-4" aria-hidden /> {t('Règlement tiers')}
      </Button>
    )
  }

  return (
    <Card className="w-full basis-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">{t('Règlement tiers')}</h2>
        <button type="button" onClick={() => setOuvert(false)} aria-label={t('Fermer')} className="rounded-lg p-2 hover:bg-sidebar">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form ref={formRef} action={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="date">{t('Date')}</Label>
          <Input id="date" name="date" type="date" required defaultValue={aujourdhui()} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sens">{t('Sens')}</Label>
          <Select id="sens" name="sens" required value={sens} onChange={(e) => setSens(e.target.value as 'encaissement' | 'paiement')}>
            <option value="encaissement">{t('Encaissement (client / producteur)')}</option>
            <option value="paiement">{t('Paiement (fournisseur)')}</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tiers_id">{t('Tiers')}</Label>
          {/* key={sens} : remonte le select pour repartir sur une sélection vide quand la liste change de nature */}
          <Select id="tiers_id" name="tiers_id" key={sens} required defaultValue="">
            <option value="" disabled>{t('Choisir…')}</option>
            {optionsTiers.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="montant">{t('Montant')}</Label>
          <Input id="montant" name="montant" type="number" step="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="compte_tresorerie_id">{t('Compte de trésorerie')}</Label>
          <Select id="compte_tresorerie_id" name="compte_tresorerie_id" required defaultValue="">
            <option value="" disabled>{t('Choisir…')}</option>
            {comptesTresorerie.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reference">{t('Référence (chèque, virement…)')}</Label>
          <Input id="reference" name="reference" />
        </div>
        {/* La nature (401/481) et le financement consommé ne concernent que les paiements fournisseurs. */}
        {sens === 'paiement' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="nature">{t('Nature du paiement')}</Label>
              <Select id="nature" name="nature" defaultValue="courant">
                <option value="courant">{t('Fournisseur courant (dette 401)')}</option>
                <option value="immobilisation">{t('Fournisseur d’investissements (dette 481)')}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contrat_financement_id">{t('Financement utilisé (crédit de campagne / fonds de commercialisation)')}</Label>
              <Select id="contrat_financement_id" name="contrat_financement_id" defaultValue="">
                <option value="">{t('— Aucun —')}</option>
                {financements.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </Select>
            </div>
          </>
        )}
        {erreur && (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {t(erreur)}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? t('Enregistrement…') : t('Enregistrer')}
          </Button>
          <Button type="button" variant="outline" onClick={() => setOuvert(false)}>
            {t('Annuler')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
