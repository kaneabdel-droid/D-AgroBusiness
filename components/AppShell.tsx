'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarRange,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  Sprout,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/auth/actions'

const NAV = [
  {
    titre: 'Pilotage',
    items: [{ href: '/', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  {
    titre: 'Référentiels',
    items: [
      { href: '/referentiels/departements', label: 'Départements', icon: Building2 },
      { href: '/referentiels/secteurs', label: 'Secteurs & projets', icon: Layers },
      { href: '/referentiels/exercices', label: 'Exercices', icon: CalendarRange },
      { href: '/referentiels/campagnes', label: 'Campagnes', icon: Sprout },
      { href: '/referentiels/tiers', label: 'Tiers', icon: Users },
    ],
  },
  {
    titre: 'Comptabilité',
    items: [
      { href: '/comptabilite/plan-comptable', label: 'Plan comptable', icon: BookOpen },
      { href: '/comptabilite/ecritures', label: 'Écritures', icon: FileText },
      { href: '/comptabilite/balance', label: 'Balance', icon: Scale },
      { href: '/comptabilite/analytique', label: 'Résultat analytique', icon: BarChart3 },
    ],
  },
]

export function AppShell({
  organisation,
  utilisateur,
  role,
  children,
}: {
  organisation: string
  utilisateur: string
  role: string
  children: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const pathname = usePathname()

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto p-4" aria-label="Navigation principale">
      {NAV.map((groupe) => (
        <div key={groupe.titre}>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            {groupe.titre}
          </p>
          <ul className="space-y-1">
            {groupe.items.map(({ href, label, icon: Icon }) => {
              const actif = href === '/' ? pathname === '/' : pathname.startsWith(href)
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
                    {label}
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
      <p className="truncate text-sm font-medium">{utilisateur}</p>
      <p className="mb-3 text-xs text-foreground-muted">{role}</p>
      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Déconnexion
        </button>
      </form>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-1">
      {/* Bureau : barre latérale fixe */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-surface-border bg-sidebar lg:flex">
        <div className="border-b border-surface-border p-4">
          <p className="font-heading text-lg font-semibold text-primary">D-AGROBUSINESS</p>
          <p className="truncate text-xs text-foreground-muted">{organisation}</p>
        </div>
        {nav}
        {pied}
      </aside>

      {/* Mobile : barre supérieure + tiroir */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-surface-border bg-sidebar px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOuvert(true)}
            aria-label="Ouvrir le menu"
            className="rounded-lg p-2 hover:bg-surface"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="font-heading font-semibold text-primary">D-AGROBUSINESS</p>
            <p className="truncate text-xs text-foreground-muted">{organisation}</p>
          </div>
        </header>

        {ouvert && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Fermer le menu"
              className="absolute inset-0 bg-black/40"
              onClick={() => setOuvert(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl">
              <div className="flex items-center justify-between border-b border-surface-border p-4">
                <p className="font-heading text-lg font-semibold text-primary">D-AGROBUSINESS</p>
                <button
                  type="button"
                  onClick={() => setOuvert(false)}
                  aria-label="Fermer le menu"
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

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
