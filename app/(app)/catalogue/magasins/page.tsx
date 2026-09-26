import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { LigneActions } from '@/components/LigneActions'
import { deleteMagasin, updateMagasin } from '../../referentiels/edition'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addMagasin } from '../../operations/actions'

export default async function MagasinsPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const [{ data: magasins }, { data: departements }] = await Promise.all([
    supabase.from('magasins').select('*, departements(nom)').order('code'),
    supabase.from('departements').select('id, nom').eq('actif', true).order('nom'),
  ])
  const peutModifier = ctx.role === 'admin'
  const peutEcrire = peutMenu(ctx, '/catalogue/magasins', ['admin', 'comptable', 'chef_departement'])

  return (
    <>
      <PageHeader titre={t('Magasins')} description={t('Lieux de stockage des intrants, produits agricoles et produits finis.')}>
        <SimpleCreateForm
          titre={t('Nouveau magasin')}
          disabled={!peutEcrire}
          action={addMagasin}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'nom', label: t('Nom'), required: true },
            {
              name: 'departement_id',
              label: t('Département'),
              type: 'select',
              options: departements?.map((d) => ({ value: d.id, label: d.nom })),
            },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Nom')}</th>
            <th className={th}>{t('Département')}</th>
            {peutModifier && <th className={th}></th>}
          </tr>
        </thead>
        <tbody>
          {magasins?.map((m) => {
            const dep = Array.isArray(m.departements) ? m.departements[0] : m.departements
            return (
              <tr key={m.id}>
                <td className={td}>{m.code}</td>
                <td className={td}>{m.nom}</td>
                <td className={td}>{dep?.nom ? t(dep.nom) : '—'}</td>
                {peutModifier && (
                  <td className={td}>
                    <LigneActions
                      libelle={m.nom}
                      confirmation={t('Supprimer « {nom} » ? Cette action est définitive.', { nom: m.nom })}
                      modifier={updateMagasin.bind(null, m.id)}
                      supprimer={deleteMagasin.bind(null, m.id)}
                      champs={[
                        { name: 'code', label: t('Code'), required: true, defaultValue: m.code },
                        { name: 'nom', label: t('Nom'), required: true, defaultValue: m.nom },
                        { name: 'departement_id', label: t('Département'), type: 'select', defaultValue: m.departement_id ?? '', options: departements?.map((d) => ({ value: d.id, label: d.nom })) },
                      ]}
                    />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
