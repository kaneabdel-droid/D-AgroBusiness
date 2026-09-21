// Accès à l'espace /admin : une simple liste d'emails autorisés (allowlist par
// variable d'environnement), pas de rôle dédié en base — même principe que les autres produits DembaSolution,
// répété indépendamment ici avec le projet Supabase propre à D-AGROBUSINESS.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allowed = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.toLowerCase())
}
