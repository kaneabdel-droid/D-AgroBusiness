import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { ROLES } from '@/lib/pays'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ActionButton } from '@/components/ActionButton'
import { RoleSelect } from '@/components/RoleSelect'
import { annulerInvitation, changerActivation, changerRole, inviter } from './actions'

export default async function EquipePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  if (ctx.role !== 'admin') {
    return <PageHeader titre={t('Équipe')} description={t('Cette page est réservée aux administrateurs.')} />
  }
  const supabase = await createClient()
  const [{ data: equipe }, { data: invitations }] = await Promise.all([
    supabase.rpc('liste_equipe'),
    supabase.from('invitations').select('*').eq('statut', 'en_attente').order('created_at', { ascending: false }),
  ])
  const optionsRoles = Object.entries(ROLES).map(([value, label]) => ({ value, label: t(label) }))

  return (
    <>
      <PageHeader
        titre={t('Équipe')}
        description={t('Invitez vos collaborateurs par leur adresse email. Ils créent leur compte avec cette adresse, en laissant vide le nom de l’entreprise, et rejoignent automatiquement votre organisation avec le rôle choisi.')}
      >
        <SimpleCreateForm
          titre={t('Inviter une personne')}
          action={inviter}
          champs={[
            { name: 'email', label: t('Adresse email'), type: 'email', required: true },
            { name: 'role', label: t('Rôle'), type: 'select', required: true, defaultValue: 'lecteur', options: optionsRoles },
          ]}
        />
      </PageHeader>

      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Nom')}</th><th className={th}>{t('Email')}</th><th className={th}>{t('Rôle')}</th>
            <th className={th}>{t('Depuis le')}</th><th className={th}>{t('Statut')}</th><th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {(equipe as { id: string; nom_complet: string | null; email: string; role: string; actif: boolean; created_at: string }[] | null)?.map((u) => (
            <tr key={u.id}>
              <td className={td}>{u.nom_complet ?? '—'}{u.id === ctx.userId ? ` (${t('vous')})` : ''}</td>
              <td className={td}>{u.email}</td>
              <td className={td}><RoleSelect valeur={u.role} options={optionsRoles} action={changerRole.bind(null, u.id)} /></td>
              <td className={td}>{formatDate(u.created_at, ctx.lang)}</td>
              <td className={`${td} ${u.actif ? 'text-success' : 'text-danger'}`}>{u.actif ? t('Actif') : t('Désactivé')}</td>
              <td className={td}>
                <ActionButton
                  label={u.actif ? t('Désactiver') : t('Réactiver')}
                  action={changerActivation.bind(null, u.id, !u.actif)}
                  confirmation={u.actif ? t('Désactiver cet utilisateur ? Il ne pourra plus se connecter à l’organisation.') : undefined}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {invitations && invitations.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 font-heading text-lg font-semibold">{t('Invitations en attente')}</h2>
          <TableWrap>
            <thead>
              <tr><th className={th}>{t('Email')}</th><th className={th}>{t('Rôle')}</th><th className={th}>{t('Envoyée le')}</th><th className={th}></th></tr>
            </thead>
            <tbody>
              {invitations.map((i) => (
                <tr key={i.id}>
                  <td className={td}>{i.email}</td>
                  <td className={td}>{t(ROLES[i.role] ?? i.role)}</td>
                  <td className={td}>{formatDate(i.created_at, ctx.lang)}</td>
                  <td className={td}><ActionButton label={t('Annuler')} action={annulerInvitation.bind(null, i.id)} /></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </>
      )}
    </>
  )
}
