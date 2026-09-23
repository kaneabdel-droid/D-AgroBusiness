// Matrice de permissions par rôle (table parametres_permissions.matrice) : voir la migration 37 pour la philosophie
// (restriction additive uniquement, jamais une extension du plafond déjà codé page par page).

export type ActionPermission = 'lire' | 'ecrire' | 'modifier'
export type Matrice = Record<string, Partial<Record<string, Partial<Record<ActionPermission, boolean>>>>>

/** Une valeur absente de la matrice vaut « autorisé » : rétrocompatible avec une organisation qui n'a rien configuré. */
export function permissionMenu(matrice: Matrice | null | undefined, href: string, role: string, action: ActionPermission): boolean {
  if (role === 'admin') return true
  const v = matrice?.[href]?.[role]?.[action]
  return v !== false
}

/**
 * Combine le plafond technique propre à chaque page (rolesBase, déjà codé en dur) avec la restriction
 * éventuellement posée par l'administrateur local dans la matrice. Ne peut jamais autoriser plus que rolesBase.
 */
export function peutMenu(ctx: { role: string; permissions: Matrice }, href: string, rolesBase: string[], action: ActionPermission = 'ecrire'): boolean {
  return rolesBase.includes(ctx.role) && permissionMenu(ctx.permissions, href, ctx.role, action)
}
