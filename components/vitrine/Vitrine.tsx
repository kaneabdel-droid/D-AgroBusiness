import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { creerT, estRtl, type Lang } from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { DUREES, NIVEAUX, montantAbonnement, remisePourcent, type Niveau } from '@/lib/abonnement'

export const carteSurvol = 'transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md'

export const fcfa = (v: number) => `${v.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} F CFA`

/** Contenu des offres, partagé par la page d'accueil et la page des tarifs (les textes passent par t()). */
export const OFFRES: Record<Niveau, { inclus: string[]; exclus: string[] }> = {
  standard: {
    inclus: ['Comptabilité analytique, achats, ventes et stocks', 'Trésorerie, rapprochement bancaire et prévisions', 'Production agricole, traçabilité et qualité', 'Financements, subventions et parc matériel', 'Budgets, états financiers et TVA'],
    exclus: ['Usine de transformation', 'Ressources humaines et paie'],
  },
  medium: {
    inclus: ['Tout le niveau Standard', 'Usine de transformation (nomenclatures, ordres de fabrication)'],
    exclus: ['Ressources humaines et paie'],
  },
  premium: {
    inclus: ['Tout le niveau Medium', 'Personnel, contrats, pointage et congés', 'Paie et bulletins de salaire (13 pays)'],
    exclus: [],
  },
}

export function EnTete({ lang, actif }: { lang: Lang; actif?: 'tarifs' | 'decouvrir' }) {
  const t = creerT(lang)
  return (
    <header className="sticky top-0 z-20 border-b border-surface-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/bienvenue" className="font-heading text-xl font-bold text-primary">D-AGRO<span className="text-vert">BUSINESS</span></Link>
          <a href="https://www.dembasolution.com" className="hidden items-center gap-1.5 text-sm text-foreground-muted hover:text-primary md:flex">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden /> {t('Retour à DembaSolution')}
          </a>
        </div>
        <nav className="flex flex-wrap items-center gap-2 sm:gap-4" aria-label={t('Navigation principale')}>
          <Link href="/decouvrir-dagrobusiness" aria-current={actif === 'decouvrir' ? 'page' : undefined} className="hidden text-sm font-medium text-foreground-muted hover:text-primary sm:inline">{t('Découvrir')}</Link>
          <Link href="/tarifs" aria-current={actif === 'tarifs' ? 'page' : undefined} className="hidden text-sm font-medium text-foreground-muted hover:text-primary sm:inline">{t('Tarifs')}</Link>
          <Link href="/login" className="text-sm font-medium text-foreground-muted hover:text-primary">{t('Se connecter')}</Link>
          <LanguageSwitcher lang={lang} />
          <Link href="/tarifs" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover">{t('S’abonner')}</Link>
        </nav>
      </div>
    </header>
  )
}

export function Pied({ lang }: { lang: Lang }) {
  const t = creerT(lang)
  return (
    <footer className="border-t border-surface-border bg-sidebar py-8 text-sm text-foreground-muted">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} D-AGROBUSINESS · DembaSolution</p>
        <p className="flex gap-4">
          <Link href="/decouvrir-dagrobusiness" className="hover:text-primary">{t('Découvrir')}</Link>
          <Link href="/tarifs" className="hover:text-primary">{t('Tarifs')}</Link>
          <Link href="/login" className="hover:text-primary">{t('Se connecter')}</Link>
        </p>
      </div>
    </footer>
  )
}

/** Trois cartes de tarifs : prix mensuel, contenu, et bouton d'abonnement. */
export function CartesTarifs({ lang }: { lang: Lang }) {
  const t = creerT(lang)
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {(Object.keys(NIVEAUX) as Niveau[]).map((n) => {
        const vedette = n === 'medium'
        return (
          <div key={n} className={`flex flex-col rounded-xl border bg-surface p-6 ${vedette ? 'border-primary ring-2 ring-primary' : 'border-surface-border'} ${carteSurvol}`}>
            {vedette && <p className="mb-2 inline-block self-start rounded-full bg-vert px-3 py-0.5 text-xs font-semibold text-white">{t('Le plus choisi')}</p>}
            <h3 className="font-heading text-xl font-semibold">{t(NIVEAUX[n].nom)}</h3>
            <p className="mt-2 text-3xl font-bold tabular-nums">{fcfa(NIVEAUX[n].prixMensuel)}</p>
            <p className="text-sm text-foreground-muted">{t('par mois')}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {OFFRES[n].inclus.map((x) => (
                <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-vert" aria-hidden />{t(x)}</li>
              ))}
              {OFFRES[n].exclus.map((x) => (
                <li key={x} className="flex gap-2 text-foreground-muted"><X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{t('Sans')} : {t(x)}</span></li>
              ))}
            </ul>
            <Link href="/signup" className={`mt-6 inline-flex items-center justify-center gap-1 rounded-md px-4 py-2.5 text-sm font-semibold transition ${vedette ? 'bg-primary text-primary-foreground hover:bg-primary-hover' : 'border border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground'}`}>
              {t('S’abonner')} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        )
      })}
    </div>
  )
}

/** Prix selon la durée : 1 mois au prix plein, puis 1 % de remise par mois payé d'un coup. */
export function TableauDurees({ lang }: { lang: Lang }) {
  const t = creerT(lang)
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="bg-sidebar text-foreground-muted">
            <th className="px-4 py-3 text-start font-medium">{t('Durée')}</th>
            {(Object.keys(NIVEAUX) as Niveau[]).map((n) => <th key={n} className="px-4 py-3 text-end font-medium">{t(NIVEAUX[n].nom)}</th>)}
          </tr>
        </thead>
        <tbody>
          {DUREES.map((d) => (
            <tr key={d} className="border-t border-surface-border">
              <td className="px-4 py-3">{t('{n} mois', { n: d })}{remisePourcent(d) > 0 && <span className="ms-2 rounded bg-vert/15 px-1.5 py-0.5 text-xs font-semibold text-vert-fonce">−{remisePourcent(d)} %</span>}</td>
              {(Object.keys(NIVEAUX) as Niveau[]).map((n) => <td key={n} className="px-4 py-3 text-end tabular-nums">{fcfa(montantAbonnement(n, d))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Conteneur de page publique : direction d'écriture selon la langue. */
export function PagePublique({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <div dir={estRtl(lang) ? 'rtl' : 'ltr'} className="min-h-screen bg-background text-foreground">{children}</div>
}
