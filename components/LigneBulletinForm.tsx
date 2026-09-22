'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useT } from '@/components/I18nProvider'

type Resultat = { success: true } | { error: string }

// Rubriques libres proposées au comptable/RH sur un bulletin non encore validé. « gain » s'ajoute au brut,
// « retenue_salariale » se déduit du net à payer — voir la migration 36 pour la simplification assumée
// (pas de recalcul automatique des cotisations/IR sur ces montants).
const RUBRIQUES = [
  { code: 'sursalaire', libelle: 'Sursalaire', type: 'gain' as const },
  { code: 'primes_avantages', libelle: 'Primes et avantages', type: 'gain' as const },
  { code: 'avance', libelle: 'Avance sur salaire', type: 'retenue_salariale' as const },
  { code: 'autre_retenue', libelle: 'Autre retenue', type: 'retenue_salariale' as const },
]

export function LigneBulletinForm({
  bulletinId,
  action,
}: {
  bulletinId: string
  action: (formData: FormData) => Promise<Resultat>
}) {
  const { t } = useT()
  const [ouvert, setOuvert] = useState(false)
  const [rubrique, setRubrique] = useState(RUBRIQUES[0].code)
  const [libelle, setLibelle] = useState(t(RUBRIQUES[0].libelle))
  const [montant, setMontant] = useState('')
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  const def = RUBRIQUES.find((r) => r.code === rubrique) ?? RUBRIQUES[0]

  function onRubriqueChange(code: string) {
    const r = RUBRIQUES.find((x) => x.code === code) ?? RUBRIQUES[0]
    setRubrique(r.code)
    setLibelle(t(r.libelle))
  }

  function soumettre() {
    if (!montant || Number(montant) <= 0) {
      setErreur(t('Montant invalide'))
      return
    }
    setErreur(null)
    const fd = new FormData()
    fd.set('bulletin_id', bulletinId)
    fd.set('type', def.type)
    fd.set('libelle', libelle)
    fd.set('montant', montant)
    startTransition(async () => {
      const res = await action(fd)
      if ('error' in res) setErreur(res.error)
      else {
        setMontant('')
        setOuvert(false)
      }
    })
  }

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="mt-2 text-xs text-primary underline">
        + {t('Ajouter une ligne')}
      </button>
    )
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded border border-surface-border bg-surface p-2">
      <div>
        <label className="block text-[11px] text-foreground-muted">{t('Rubrique')}</label>
        <Select value={rubrique} onChange={(e) => onRubriqueChange(e.target.value)} className="h-8 text-xs">
          {RUBRIQUES.map((r) => (
            <option key={r.code} value={r.code}>{t(r.libelle)}</option>
          ))}
        </Select>
      </div>
      <div>
        <label className="block text-[11px] text-foreground-muted">{t('Libellé')}</label>
        <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} className="h-8 w-40 text-xs" />
      </div>
      <div>
        <label className="block text-[11px] text-foreground-muted">{t('Montant')}</label>
        <Input type="number" min="0" step="1" value={montant} onChange={(e) => setMontant(e.target.value)} className="h-8 w-28 text-xs" />
      </div>
      <Button type="button" size="sm" disabled={pending} onClick={soumettre}>
        {pending ? '…' : t('Ajouter')}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setOuvert(false)}>
        {t('Annuler')}
      </Button>
      {erreur && <span role="alert" className="w-full text-xs text-danger">{t(erreur)}</span>}
    </div>
  )
}
