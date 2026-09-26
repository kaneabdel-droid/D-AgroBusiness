import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { LigneActions } from '@/components/LigneActions'
import { changerActifDepartement, deleteDepartement, updateDepartement } from '../edition'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addDepartement } from '../actions'

const TYPES = [
  { value: 'fonctionnement', label: 'Fonctionnement' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'production', label: 'Production' },
  { value: 'usine', label: 'Usine' },
  { value: 'materiel', label: 'Matériel' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'autre', label: 'Autre' },
]

export default async function DepartementsPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: departements } = await supabase.from('departements').select('*').order('code')
  const peutModifier = ctx.role === 'admin'
  const peutEcrire = peutMenu(ctx, '/referentiels/departements', ['admin', 'direction', 'comptable'])

  return (
    <>
      <PageHeader
        titre={t('Départements')}
        description={t('Premier axe analytique : chaque charge et chaque produit est imputé à un département.')}
      >
        <SimpleCreateForm
          titre={t('Nouveau département')}
          disabled={!peutEcrire}
          action={addDepartement}
          champs={[
            { name: 'code', label: t('Code'), required: true, placeholder: t('ex. USIN') },
            { name: 'nom', label: t('Nom'), required: true },
            { name: 'type', label: t('Type'), type: 'select', options: TYPES.map((x) => ({ ...x, label: t(x.label) })), required: true },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Nom')}</th>
            <th className={th}>{t('Type')}</th>
            {peutModifier && <th className={th}></th>}
          </tr>
        </thead>
        <tbody>
          {departements?.map((d) => (
            <tr key={d.id} className={d.actif === false ? 'opacity-60' : undefined}>
              <td className={td}>{d.code}</td>
              <td className={td}>{t(d.nom)}{d.actif === false && <span className="ms-2 rounded bg-sidebar px-1.5 py-0.5 text-xs">{t('Inactif')}</span>}</td>
              <td className={td}>{t(TYPES.find((x) => x.value === d.type)?.label ?? d.type)}</td>
                {peutModifier && (
                  <td className={td}>
                    <LigneActions
                      libelle={d.nom}
                      actif={d.actif}
                      basculerActif={changerActifDepartement.bind(null, d.id, d.actif === false)}
                      confirmationActif={t('Désactiver « {nom} » ? Il n’apparaîtra plus dans les listes de choix (ses secteurs et projets seront aussi désactivés) ; les écritures existantes sont conservées.', { nom: d.nom })}
                      confirmation={t('Supprimer « {nom} » ? Cette action est définitive.', { nom: d.nom })}
                      modifier={updateDepartement.bind(null, d.id)}
                      supprimer={deleteDepartement.bind(null, d.id)}
                      champs={[
                        { name: 'code', label: t('Code'), required: true, defaultValue: d.code },
                        { name: 'nom', label: t('Nom'), required: true, defaultValue: d.nom },
                        { name: 'type', label: t('Type'), type: 'select', options: TYPES.map((x) => ({ ...x, label: t(x.label) })), required: true, defaultValue: d.type },
                      ]}
                    />
                  </td>
                )}
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
