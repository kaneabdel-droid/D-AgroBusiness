import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { pageSuivante } from '@/lib/suite'

// Lien de confirmation d'inscription envoyé par Supabase Auth : le `code` est échangé contre une session, puis on ouvre la page
// suivante (le paiement de l'abonnement choisi sur les tarifs). Si l'échange échoue (lien ouvert dans un autre navigateur que
// celui de l'inscription, lien expiré), l'adresse est tout de même confirmée : on demande de se connecter, en gardant la suite.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const suite = pageSuivante(searchParams.get('suite')) ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${suite}`)
  }
  return NextResponse.redirect(`${origin}/login?erreur=lien&suite=${encodeURIComponent(suite)}`)
}
