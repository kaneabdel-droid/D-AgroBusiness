import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Client "service role" utilisé uniquement par les routes serveur-à-serveur
// (webhooks des prestataires de paiement) qui n'ont pas de session utilisateur
// et doivent donc contourner le RLS pour créditer l'abonnement du bon GIE.
// Ne jamais importer ce module depuis du code exécuté côté client.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant : requis pour traiter les webhooks de paiement')
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
