'use client'

import { useRef, useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useT } from '@/components/I18nProvider'

export type Champ = {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'email' | 'tel' | 'select' | 'multiselect' | 'file'
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  step?: string
  defaultValue?: string
  accept?: string
}

type Resultat = { success?: boolean; error?: string } | void

/** Bouton + formulaire déroulant pour créer une ligne de référentiel via une server action. */
export function SimpleCreateForm({
  titre,
  champs,
  action,
  disabled,
}: {
  titre: string
  champs: Champ[]
  action: (formData: FormData) => Promise<Resultat>
  disabled?: boolean
}) {
  const { t } = useT()
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  if (disabled) return null

  function onSubmit(formData: FormData) {
    setErreur(null)
    startTransition(async () => {
      const res = await action(formData)
      if (res && res.error) {
        setErreur(res.error)
        return
      }
      formRef.current?.reset()
      setOuvert(false)
    })
  }

  if (!ouvert) {
    return (
      <Button onClick={() => setOuvert(true)}>
        <Plus className="h-4 w-4" aria-hidden /> {titre}
      </Button>
    )
  }

  return (
    <Card className="w-full basis-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">{titre}</h2>
        <button type="button" onClick={() => setOuvert(false)} aria-label={t('Fermer')} className="rounded-lg p-2 hover:bg-sidebar">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form ref={formRef} action={onSubmit} className="grid gap-4 sm:grid-cols-2">
        {champs.map((c) => (
          <div key={c.name} className="space-y-1.5">
            <Label htmlFor={c.name}>{c.label}</Label>
            {c.type === 'select' ? (
              <Select id={c.name} name={c.name} required={c.required} defaultValue={c.defaultValue ?? ''}>
                <option value="" disabled={c.required}>
                  {c.required ? t('Choisir…') : t('— Aucun —')}
                </option>
                {c.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : c.type === 'multiselect' ? (
              <div className="flex flex-wrap gap-3 pt-1">
                {c.options?.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={c.name} value={o.value} className="h-4 w-4" />
                    {o.label}
                  </label>
                ))}
              </div>
            ) : (
              <Input
                id={c.name}
                name={c.name}
                type={c.type ?? 'text'}
                required={c.required}
                placeholder={c.placeholder}
                step={c.step}
                defaultValue={c.defaultValue}
                accept={c.accept}
              />
            )}
          </div>
        ))}
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
