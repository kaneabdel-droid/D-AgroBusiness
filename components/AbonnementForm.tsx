'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useT } from '@/components/I18nProvider'
import { DUREES, NIVEAUX, montantAbonnement, remisePourcent, type Niveau } from '@/lib/abonnement'

type Moyen = 'wave' | 'orange' | 'carte' | 'chariow'
type Resultat = { ok: true; checkoutUrl: string } | { ok: false; error: string }

const MOYENS: Record<Moyen, string> = {
  wave: 'Wave',
  orange: 'Orange Money',
  carte: 'Carte bancaire',
  chariow: 'Mobile Money / carte (Chariow)',
}

const AVANTAGES: Record<Niveau, string[]> = {
  standard: [
    'Comptabilité, achats, ventes, stocks et trésorerie',
    'Production agricole, traçabilité et qualité',
    'Financements, subventions et parc matériel',
    'Pilotage : budgets, états, TVA, prévisions',
    'Sans l’usine de transformation ni les ressources humaines',
  ],
  medium: [
    'Tout le niveau Standard',
    'Usine de transformation (nomenclatures, ordres de fabrication)',
    'Sans les ressources humaines (personnel, pointage, congés, paie)',
  ],
  premium: [
    'Tout le niveau Medium',
    'Personnel, contrats et pointage',
    'Congés et absences',
    'Paie et bulletins de salaire',
  ],
}

/** Choix du niveau, de la durée et du moyen de paiement ; le montant affiché est recalculé côté serveur au paiement. */
export function AbonnementForm({
  niveauActuel,
  niveauBloque,
  moyens,
  action,
}: {
  niveauActuel: Niveau
  niveauBloque: Niveau | null   // niveau imposé pendant un abonnement payé (pas de changement en cours de période)
  moyens: Moyen[]
  action: (niveau: string, mois: number, moyen: Moyen, telephone?: string) => Promise<Resultat>
}) {
  const { t } = useT()
  const [niveau, setNiveau] = useState<Niveau>(niveauBloque ?? niveauActuel)
  const [mois, setMois] = useState<number>(1)
  const [moyen, setMoyen] = useState<Moyen | undefined>(moyens[0])
  const [telephone, setTelephone] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fcfa = (v: number) => `${v.toLocaleString('fr-FR').replace(/ | /g, ' ')} F CFA`

  function payer() {
    if (!moyen) return
    setErreur(null)
    startTransition(async () => {
      const res = await action(niveau, mois, moyen, telephone || undefined)
      if (res.ok) window.location.href = res.checkoutUrl
      else setErreur(res.error)
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(NIVEAUX) as Niveau[]).map((n) => {
          const choisi = niveau === n
          const interdit = niveauBloque !== null && niveauBloque !== n
          return (
            <button
              key={n}
              type="button"
              disabled={interdit}
              onClick={() => setNiveau(n)}
              aria-pressed={choisi}
              className={`rounded-xl border p-5 text-start transition ${choisi ? 'border-primary ring-2 ring-primary' : 'border-surface-border'} ${interdit ? 'opacity-50' : 'hover:border-primary'}`}
            >
              <p className="font-heading text-xl font-semibold">{t(NIVEAUX[n].nom)}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{fcfa(NIVEAUX[n].prixMensuel)} <span className="text-sm font-normal text-foreground-muted">{t('par mois')}</span></p>
              <ul className="mt-3 space-y-1 text-sm text-foreground-muted">
                {AVANTAGES[n].map((a) => <li key={a}>• {t(a)}</li>)}
              </ul>
            </button>
          )
        })}
      </div>

      <Card>
        <p className="mb-3 font-medium">{t('Durée')}</p>
        <div className="flex flex-wrap gap-2">
          {DUREES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setMois(d)}
              aria-pressed={mois === d}
              className={`rounded-lg border px-4 py-2 text-sm ${mois === d ? 'border-primary bg-primary text-white' : 'border-surface-border hover:border-primary'}`}
            >
              {t('{n} mois', { n: d })}{remisePourcent(d) > 0 ? ` (−${remisePourcent(d)} %)` : ''}
            </button>
          ))}
        </div>
        <p className="mt-4 text-lg">
          {t('Total à payer')} : <strong className="tabular-nums">{fcfa(montantAbonnement(niveau, mois))}</strong>
          {remisePourcent(mois) > 0 && (
            <span className="ms-2 text-sm text-success">{t('au lieu de')} <s>{fcfa(NIVEAUX[niveau].prixMensuel * mois)}</s></span>
          )}
        </p>
      </Card>

      {moyens.length === 0 ? (
        <p className="text-sm text-foreground-muted">{t('Le paiement en ligne n’est pas encore configuré. Contactez le support.')}</p>
      ) : (
        <Card>
          <p className="mb-3 font-medium">{t('Moyen de paiement')}</p>
          <div className="flex flex-wrap gap-4">
            {moyens.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="radio" name="moyen" checked={moyen === m} onChange={() => setMoyen(m)} className="h-4 w-4" />
                {t(MOYENS[m])}
              </label>
            ))}
          </div>
          {(moyen === 'chariow' || moyen === 'wave' || moyen === 'orange') && (
            <div className="mt-4 max-w-xs space-y-1.5">
              <label htmlFor="telephone" className="text-sm">{moyen === 'chariow' ? t('Numéro de téléphone (sans l’indicatif du pays)') : t('Numéro de téléphone (facultatif)')}</label>
              <Input id="telephone" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} inputMode="tel" />
            </div>
          )}
          {erreur && <p role="alert" className="mt-3 text-sm text-danger">{t(erreur)}</p>}
          <Button type="button" className="mt-4" disabled={pending || !moyen} onClick={payer}>
            {pending ? t('Patientez…') : `${t('Payer')} ${fcfa(montantAbonnement(niveau, mois))}`}
          </Button>
        </Card>
      )}
    </div>
  )
}
