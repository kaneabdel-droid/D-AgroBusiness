import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PREFIXES = ['/login', '/signup', '/forgot-password', '/update-password', '/auth', '/api/webhooks', '/api/cron']

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

  // Aucune logique entre createServerClient et getUser() (rafraîchissement de session).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

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
      .select('organisations(essai_expire_le, abonnement_expire_le, compte_verrouille)')
      .eq('id', user.id)
      .maybeSingle()
    const org = Array.isArray(data?.organisations) ? data?.organisations[0] : data?.organisations
    if (org) {
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
