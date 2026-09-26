import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin/auth'
import { createAdminIdentityMiddlewareClient } from '@/utils/supabase/admin-identity'
import { withRetry } from '@/utils/supabase/retry'
import { fetchAvecDelai } from '@/utils/supabase/fetch'

// Pages publiques (vitrine, tarifs, démonstration, connexion) et routes serveur-à-serveur (webhooks, cron), authentifiées par leur secret.
const PUBLIC_PREFIXES = [
  '/login', '/signup', '/forgot-password', '/update-password', '/auth',
  '/bienvenue', '/tarifs', '/decouvrir-dagrobusiness', '/guide',
  '/api/webhooks', '/api/cron',
]

export async function updateSession(request: NextRequest) {
  // Chemin demandé, lu par le layout (contrôle d'expiration de l'abonnement) sans requête supplémentaire à la base
  request.headers.set('x-pathname', request.nextUrl.pathname)
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchAvecDelai },
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

  // Aucune logique entre createServerClient et getClaims() (rafraîchissement de session). Le jeton est vérifié localement (signature),
  // sans aller-retour réseau : l'appartenance à l'entreprise et son activité sont contrôlées en base par current_org_id().
  const { data: jeton } = await supabase.auth.getClaims()
  const user = jeton?.claims?.sub ? { id: jeton.claims.sub, email: jeton.claims.email as string | undefined } : null

  // Espace super-admin : réservé aux emails de ADMIN_EMAILS. Identité admin partagée entre les produits DembaSolution
  // (cookie à domaine .dembasolution.com) d'abord, session locale en secours, sinon connexion centralisée.
  // (« /admin » exactement ou « /admin/… » : /administration/… est l'équipe de l'entreprise, pas la super-administration)
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const sharedAdminUser = await withRetry(() =>
      createAdminIdentityMiddlewareClient(request, supabaseResponse).auth.getUser().then(({ data }) => data.user)
    ).catch(() => null)

    if (isAdminEmail(sharedAdminUser?.email) || isAdminEmail(user?.email)) return supabaseResponse

    // Pas de détour par l'accueil quand une session client existe : le même email peut
    // avoir un compte client (éventuellement verrouillé) et doit pouvoir atteindre la
    // connexion admin.
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

  return supabaseResponse
}
