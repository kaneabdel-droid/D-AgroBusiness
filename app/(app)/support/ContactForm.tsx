'use client'

import { useState, useTransition } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'
import { useT } from '@/components/I18nProvider'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { envoyerMessageSupport } from './actions'

export function ContactForm() {
  const { t } = useT()
  const [pending, startTransition] = useTransition()
  const [envoye, setEnvoye] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await envoyerMessageSupport(formData)
      if (result.error) {
        setError(result.error)
      } else {
        form.reset()
        setEnvoye(true)
      }
    })
  }

  if (envoye) {
    return (
      <div className="rounded-lg border border-success/20 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success" />
        <h3 className="text-lg font-medium text-success">{t('Message envoyé !')}</h3>
        <p className="mt-2 text-sm text-foreground-muted">
          {t('Notre équipe a bien reçu votre message et vous répondra par email dans les plus brefs délais.')}
        </p>
        <button
          type="button"
          onClick={() => setEnvoye(false)}
          className="mt-4 text-sm font-medium text-primary hover:text-primary-hover"
        >
          {t('Envoyer un autre message')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 p-4">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="sujet">{t('Sujet de votre demande')}</Label>
        <Input
          id="sujet"
          name="sujet"
          required
          maxLength={200}
          disabled={pending}
          placeholder={t('Ex : problème sur une facture, question sur l’abonnement...')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">{t('Message détaillé')}</Label>
        <Textarea
          id="message"
          name="message"
          rows={6}
          required
          maxLength={5000}
          disabled={pending}
          placeholder={t('Décrivez votre problème ou votre question en détail...')}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? t('Envoi en cours...') : (
            <>
              <Send className="h-4 w-4 rtl:-scale-x-100" />
              {t('Envoyer le message')}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
