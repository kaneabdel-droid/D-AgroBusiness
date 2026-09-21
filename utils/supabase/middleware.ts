import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin/auth'
import { createAdminIdentityMiddlewareClient } from '@/utils/supabase/admin-identity'
import { withRetry } from '@/utils/supabase/retry'

// Pages publiques (vitrine, tarifs, démonstration, connexion) et routes serveur-à-serveur (webhooks, cron), authentifiées par leur secret.
const PUBLIC_PREFIXES = [
  '/login', '/signup', '/forgot-password', '/update-password', '/auth',
  '/bienvenue', '/tarifs', '/decouvrir-dagrobusiness',
  '/api/webhooks', '/api/cron',
]
// Un compte expiré ou verrouillé ne peut plus que payer.
const LIBRES_SI_EXPIRE = ['/abonnement', '/api']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // /admin/login est le point d'entrée dédié de l'espace admin : jamais soumis aux redirections ci-dessous.
  if (pathname === '/admin/login') return supabaseResponse

  // Aucune logique entre createServerClient et getUser() (rafraîchissement de session).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Espace super-admin : réservé aux emails de ADMIN_EMAILS. Identité admin partagée entre les produits DembaSolution
  // (cookie à domaine .dembasolution.com) d'abord, session locale en secours, sinon connexion centralisée.
  if (pathname.startsWith('/admin')) {
    const sharedAdminUser = await withRetry(() =>
      createAdminIdentityMiddlewareClient(request, supabaseResponse).auth.getUser().then(({ data }) => data.user)
    ).catch(() => null)

    if (isAdminEmail(sharedAdminUser?.email) || isAdminEmail(user?.email)) return supabaseResponse

    if (user) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  // Visiteur non connecté sur la racine : page de présentation ; ailleurs : connexion.
  if (!user && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/bienvenue'
    return NextResponse.redirect(url)
  }
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Abonnement expiré (essai terminé sans paiement) ou compte verrouillé : seules les pages nécessaires pour payer restent accessibles.
  if (user && !isPublic && !LIBRES_SI_EXPIRE.some((p) => pathname.startsWith(p))) {
    const { data } = await supabase
      .from('utilisateurs')
      .select('organisations(essai_expire_le, abonnement_expire_le, compte_verrouille, demo)')
      .eq('id', user.id)
      .maybeSingle()
    const org = Array.isArray(data?.organisations) ? data?.organisations[0] : data?.organisations
    if (org && !org.demo) {
      const fin = Math.max(new Date(org.essai_expire_le).getTime(), org.abonnement_expire_le ? new Date(org.abonnement_expire_le).getTime() : 0)
      if (org.compte_verrouille || fin < Date.now()) {
        const url = request.nextUrl.clone()
        url.pathname = '/abonnement'
        url.search = '?expire=1'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
