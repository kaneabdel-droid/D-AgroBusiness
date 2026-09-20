'use client'

import { useTransition } from 'react'
import { Languages } from 'lucide-react'
import { LANGUES, type Lang } from '@/lib/i18n'
import { changerLangue } from '@/app/actions/langue'
import { cn } from '@/lib/utils'

/** Sélecteur de langue (français, anglais, arabe). Fonctionne avant et après la connexion. */
export function LanguageSwitcher({ lang, className }: { lang: Lang; className?: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className={cn('flex items-center gap-1 text-sm', className)} role="group" aria-label="Language / Langue / اللغة">
      <Languages className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
      {LANGUES.map((l) => (
        <button
          key={l.code}
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => changerLangue(l.code))}
          aria-pressed={l.code === lang}
          lang={l.code}
          className={cn(
            'rounded-md px-2 py-1 transition-colors',
            l.code === lang ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-surface'
          )}
        >
          {l.nom}
        </button>
      ))}
    </div>
  )
}
