import Link from 'next/link'
import { creerT, type Lang } from '@/lib/i18n'
import { finAcces, joursRestants, type EtatAbonnement } from '@/lib/abonnement'

/** Rappel discret : essai en cours ou abonnement proche de son échéance (7 jours). */
export function BandeauAbonnement({ etat, lang }: { etat: EtatAbonnement; lang: Lang }) {
  const t = creerT(lang)
  const jours = joursRestants(etat)
  const payant = etat.abonnementExpireLe !== null && etat.abonnementExpireLe >= etat.essaiExpireLe
  if (jours > 7 || finAcces(etat) < new Date()) return null
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-border bg-sidebar px-4 py-3 text-sm">
      <span>
        {payant
          ? t('Votre abonnement expire dans {n} jour(s).', { n: jours })
          : t('Essai gratuit : {n} jour(s) restant(s).', { n: jours })}
      </span>
      <Link href="/abonnement" className="font-medium text-primary underline">{t('Choisir un abonnement')}</Link>
    </div>
  )
}
