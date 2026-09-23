import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { ROLES } from '@/lib/pays'
import { MENUS, ROLES_RESTREIGNABLES } from '@/lib/menus'
import { PageHeader } from '@/components/ui/card'
import { PermissionsMatrixForm } from '@/components/PermissionsMatrixForm'
import { enregistrerPermissions } from './actions'

export default async function PermissionsPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  if (ctx.role !== 'admin') {
    return <PageHeader titre={t('Permissions')} description={t('Cette page est réservée aux administrateurs.')} />
  }

  const roles = ROLES_RESTREIGNABLES.map((valeur) => ({ valeur, label: t(ROLES[valeur] ?? valeur) }))

  return (
    <>
      <PageHeader
        titre={t('Permissions')}
        description={t('Pour chaque rôle, cochez les menus accessibles en lecture, écriture et modification. Ceci ne fait que restreindre : un rôle ne peut jamais obtenir plus que ce que le système lui permet déjà techniquement. Le rôle Administrateur garde toujours un accès complet.')}
      />
      <PermissionsMatrixForm groupes={MENUS} roles={roles} matriceInitiale={ctx.permissions} action={enregistrerPermissions} />
    </>
  )
}
