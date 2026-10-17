'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Boxes,
  Handshake,
  Landmark,
  Package,
  ShoppingCart,
  Sprout as Semis,
  Store,
  Truck,
  Wallet,
  Banknote,
  HandCoins,
  Tractor,
  Factory,
  ShieldCheck,
  TrendingUp,
  ScrollText,
  CreditCard,
  UserCog,
  Wheat,
  ClipboardCheck,
  Receipt,
  Settings,
  PiggyBank,
  Percent,
  LineChart,
  Flag,
  CalendarDays,
  Building2,
  CalendarRange,
  FileText,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Scale,
  Sprout,
  UploadCloud,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/auth/actions'
import { useT } from '@/components/I18nProvider'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { OfflineSyncBar } from '@/components/offline/OfflineSyncBar'
import { estRtl } from '@/lib/i18n'
import { MENUS } from '@/lib/menus'
import { permissionMenu, type Matrice } from '@/lib/permissions'

// Icônes par href : tenues à part du registre partagé lib/menus.ts (qui ne doit pas dépendre de lucide-react
// côté admin/permissions, une page qui n'affiche pas d'icônes).
const ICONES: Record<string, typeof LayoutDashboard> = {
  '/': LayoutDashboard,
  '/referentiels/departements': Building2,
  '/referentiels/secteurs': Layers,
  '/referentiels/exercices': CalendarRange,
  '/referentiels/campagnes': Sprout,
  '/referentiels/tiers': Users,
  '/catalogue/produits': Package,
  '/catalogue/magasins': Store,
  '/stocks': Boxes,
  '/achats': ShoppingCart,
  '/depot-vente': Handshake,
  '/ventes?type=distribution': Truck,
  '/ventes?type=marche': ArrowLeftRight,
  '/remboursements-nature': Semis,
  '/tresorerie': Wallet,
  '/tresorerie/rapprochement': ArrowLeftRight,
  '/tresorerie/previsionnel': TrendingUp,
  '/production': Wheat,
  '/usine': Factory,
  '/tracabilite': ShieldCheck,
  '/rh/employes': Users,
  '/rh/categories': Layers,
  '/rh/pointage': ClipboardCheck,
  '/rh/conges': CalendarRange,
  '/rh/paie': Receipt,
  '/rh/parametres': Settings,
  '/referentiels/partenaires-financiers': Landmark,
  '/financements': Banknote,
  '/subventions': HandCoins,
  '/materiel': Tractor,
  '/materiel/prestations': ClipboardCheck,
  '/pilotage/budgets': PiggyBank,
  '/pilotage/etats': LineChart,
  '/pilotage/campagnes': Flag,
  '/pilotage/rapport-mensuel': CalendarDays,
  '/pilotage/tva': Percent,
  '/administration/entreprise': Building2,
  '/administration/import': UploadCloud,
  '/administration/equipe': UserCog,
  '/administration/permissions': ShieldCheck,
  '/administration/audit': ScrollText,
  '/abonnement': CreditCard,
  '/comptabilite/plan-comptable': BookOpen,
  '/comptabilite/ecritures': FileText,
  '/comptabilite/balance': Scale,
  '/comptabilite/soldes-tiers': Landmark,
  '/comptabilite/releve': FileText,
  '/comptabilite/analytique': BarChart3,
}
// Chemins de menu, pour qu'un sous-menu (/materiel/prestations) ne surligne pas aussi son parent (/materiel).
const CHEMINS = MENUS.flatMap((g) => g.items.map((i) => i.href.split('?')[0]))
const NAV = MENUS.map((g) => ({ titre: g.titre, items: g.items.map((i) => ({ ...i, icon: ICONES[i.href] ?? LayoutDashboard })) }))

export function AppShell({
  organisation,
  utilisateur,
  role,
  roleCle,
  permissions,
  accesRh,
  accesUsine,
  menuLayout = 'sidebar',
  children,
}: {
  organisation: string
  utilisateur: string
  role: string
  roleCle: string
  permissions: Matrice
  accesRh: boolean
  accesUsine: boolean
  menuLayout?: 'sidebar' | 'horizontal'
  children: React.ReactNode
}) {
  const { t, lang } = useT()
  const [ouvert, setOuvert] = useState(false)
  const [menuOuvert, setMenuOuvert] = useState<string | null>(null)
  const navHorizontalRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const typeVente = useSearchParams().get('type') === 'marche' ? 'marche' : 'distribution'

  // Fermer le menu déroulant lors d'une navigation ou au clic extérieur
  useEffect(() => {
    setMenuOuvert(null)
  }, [pathname])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navHorizontalRef.current && !navHorizontalRef.current.contains(event.target as Node)) {
        setMenuOuvert(null)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOuvert(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
  // Visibilité du menu : plafond de l'abonnement (RH/usine), puis restriction éventuelle de la matrice de permissions.
  const visible = (item: { href: string; requiertRh?: boolean; requiertUsine?: boolean }) =>
    (!item.requiertRh || accesRh) && (!item.requiertUsine || accesUsine) && permissionMenu(permissions, item.href, roleCle, 'lire')

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto p-4" aria-label={t('Navigation principale')}>
      {NAV.map((groupe) => ({ ...groupe, items: groupe.items.filter(visible) }))
        .filter((groupe) => groupe.items.length > 0)
        .map((groupe) => (
        <div key={groupe.titre}>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            {t(groupe.titre)}
          </p>
          <ul className="space-y-1">
            {groupe.items.map(({ href, label, icon: Icon }) => {
              const [chemin, requete] = href.split('?')
              const actif =
                chemin === '/'
                  ? pathname === '/'
                  : pathname.startsWith(chemin) &&
                    !CHEMINS.some((c) => c.length > chemin.length && c.startsWith(`${chemin}/`) && pathname.startsWith(c)) &&
                    (!requete || (chemin === '/ventes' && requete === `type=${typeVente}`))
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOuvert(false)}
                    aria-current={actif ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      actif
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-surface'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {t(label)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  const pied = (
    <div className="border-t border-surface-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{utilisateur}</p>
          <p className="text-xs text-foreground-muted">{role}</p>
        </div>
        <OfflineSyncBar />
      </div>
      <LanguageSwitcher lang={lang} className="mb-3 flex-wrap" />
      <Link
        href="/support"
        onClick={() => setOuvert(false)}
        className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface"
      >
        <LifeBuoy className="h-4 w-4" aria-hidden /> {t('Assistance')}
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface"
        >
          <LogOut className="h-4 w-4" aria-hidden /> {t('Déconnexion')}
        </button>
      </form>
    </div>
  )

  return (
    <div className={cn("flex min-h-screen flex-1", menuLayout === 'horizontal' ? "flex-col" : "flex-row")} dir={estRtl(lang) ? 'rtl' : 'ltr'}>
      {/* Bureau : mode horizontal en haut de page */}
      {menuLayout === 'horizontal' ? (
        <header className="sticky top-0 z-30 hidden w-full border-b border-surface-border bg-sidebar lg:block">
          <div className="flex h-16 items-center justify-between px-6 border-b border-surface-border">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-heading text-lg font-bold text-primary tracking-tight">
                D-AGROBUSINESS
              </Link>
              <span className="text-surface-border">|</span>
              <span className="text-sm font-semibold text-foreground truncate max-w-xs">{organisation}</span>
            </div>

            <div className="flex items-center gap-4">
              <OfflineSyncBar />
              <div className="text-end">
                <p className="text-xs font-semibold text-foreground">{utilisateur}</p>
                <p className="text-[10px] text-foreground-muted">{role}</p>
              </div>
              <LanguageSwitcher lang={lang} className="flex-wrap" />
              <Link
                href="/support"
                className="rounded-lg p-2 text-foreground-muted hover:bg-surface hover:text-foreground transition-colors"
                title={t('Assistance')}
              >
                <LifeBuoy className="h-4 w-4" />
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg p-2 text-foreground-muted hover:bg-surface hover:text-danger transition-colors"
                  title={t('Déconnexion')}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Navigation par catégories déroulantes */}
          <div ref={navHorizontalRef} className="flex items-center gap-1.5 px-6 py-2 text-xs flex-wrap relative">
            {NAV.map((groupe) => ({ ...groupe, items: groupe.items.filter(visible) }))
              .filter((groupe) => groupe.items.length > 0)
              .map((groupe) => {
                const aUnItemActif = groupe.items.some(({ href }) => {
                  const [chemin, requete] = href.split('?')
                  return chemin === '/'
                    ? pathname === '/'
                    : pathname.startsWith(chemin) && (!requete || (chemin === '/ventes' && requete === `type=${typeVente}`))
                })
                const estOuvert = menuOuvert === groupe.titre

                return (
                  <div
                    key={groupe.titre}
                    className="relative group"
                    onMouseEnter={() => setMenuOuvert(groupe.titre)}
                    onMouseLeave={() => setMenuOuvert((actuel) => (actuel === groupe.titre ? null : actuel))}
                  >
                    <button
                      type="button"
                      onClick={() => setMenuOuvert((actuel) => (actuel === groupe.titre ? null : groupe.titre))}
                      aria-expanded={estOuvert}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                        aUnItemActif || estOuvert
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-foreground hover:bg-surface'
                      )}
                    >
                      {t(groupe.titre)}
                      <span className={cn('text-[9px] opacity-70 transition-transform duration-150', estOuvert ? 'rotate-180' : '')}>▼</span>
                    </button>

                    <div
                      className={cn(
                        'absolute left-0 top-full pt-1 z-50 transition-all duration-150',
                        estOuvert ? 'block opacity-100 scale-100 pointer-events-auto' : 'hidden group-hover:block'
                      )}
                    >
                      <div className="min-w-56 rounded-xl border border-surface-border bg-sidebar p-1.5 shadow-xl">
                        {groupe.items.map(({ href, label, icon: Icon }) => {
                          const [chemin, requete] = href.split('?')
                          const actif =
                            chemin === '/'
                              ? pathname === '/'
                              : pathname.startsWith(chemin) &&
                                (!requete || (chemin === '/ventes' && requete === `type=${typeVente}`))
                          return (
                            <Link
                              key={href}
                              href={href}
                              onClick={() => setMenuOuvert(null)}
                              className={cn(
                                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors',
                                actif
                                  ? 'bg-primary text-primary-foreground font-medium'
                                  : 'text-foreground hover:bg-surface'
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              {t(label)}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </header>
      ) : (
        /* Bureau : barre latérale fixe */
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-surface-border bg-sidebar lg:flex">
          <div className="border-b border-surface-border p-4">
            <p className="font-heading text-lg font-semibold text-primary">D-AGROBUSINESS</p>
            <p className="truncate text-xs text-foreground-muted">{organisation}</p>
          </div>
          {nav}
          {pied}
        </aside>
      )}

      {/* Mobile : barre supérieure + tiroir */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-surface-border bg-sidebar px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOuvert(true)}
            aria-label={t('Ouvrir le menu')}
            className="rounded-lg p-2 hover:bg-surface"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="font-heading font-semibold text-primary">D-AGROBUSINESS</p>
            <p className="truncate text-xs text-foreground-muted">{organisation}</p>
          </div>
          <div className="ms-auto">
            <OfflineSyncBar />
          </div>
        </header>

        {ouvert && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label={t('Fermer le menu')}
              className="absolute inset-0 bg-black/40"
              onClick={() => setOuvert(false)}
            />
            <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl">
              <div className="flex items-center justify-between border-b border-surface-border p-4">
                <p className="font-heading text-lg font-semibold text-primary">D-AGROBUSINESS</p>
                <button
                  type="button"
                  onClick={() => setOuvert(false)}
                  aria-label={t('Fermer le menu')}
                  className="rounded-lg p-2 hover:bg-surface"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              {pied}
            </div>
          </div>
        )}

        <main className={cn("mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:px-8", menuLayout === 'horizontal' ? "max-w-7xl" : "max-w-7xl")}>
          {children}
        </main>
      </div>
    </div>
  )
}
