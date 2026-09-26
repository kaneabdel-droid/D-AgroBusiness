import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { LigneActions } from '@/components/LigneActions'
import { deleteTiers, updateTiers } from '../edition'
import { ExportButtons } from '@/components/ExportButtons'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addTiers } from '../actions'

const TYPES = [
  { value: 'producteur', label: 'Producteur' },
  { value: 'fournisseur', label: 'Fournisseur' },
  { value: 'client', label: 'Client' },
]

export default async function TiersPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  // Les banques et bailleurs sont des partenaires financiers, gérés à part (Référentiels → Partenaires financiers)
  // et non comme des tiers commerciaux, même s'ils restent techniquement une ligne de la table tiers (le
  // sous-grand livre comptable — soldes, lettrage — s'appuie sur cette table pour tous les tiers sans distinction).
  const { data: tiersData } = await supabase.from('tiers').select('*').order('nom')
  const tiers = (tiersData ?? []).filter((ti) => !(ti.types as string[]).includes('bailleur'))
  const peutModifier = ctx.role === 'admin'
  const peutEcrire = peutMenu(ctx, '/referentiels/tiers', ['admin', 'comptable', 'chef_departement'])

  return (
    <>
      <PageHeader
        titre={t('Tiers')}
        description={t('Un même tiers peut être à la fois producteur, client et fournisseur. Les banques et partenaires financiers sont gérés à part.')}
      >
        <SimpleCreateForm
          titre={t('Nouveau tiers')}
          disabled={!peutEcrire}
          action={addTiers}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'nom', label: t('Nom / raison sociale'), required: true },
            { name: 'types', label: t('Type(s)'), type: 'multiselect', options: TYPES.map((x) => ({ ...x, label: t(x.label) })) },
            { name: 'telephone', label: t('Téléphone'), type: 'tel' },
            { name: 'email', label: t('Email'), type: 'email' },
            { name: 'adresse', label: t('Adresse') },
            { name: 'nif', label: t('NIF / identifiant fiscal') },
          ]}
        />
        <ExportButtons titre={t('Tiers')} sousTitre={ctx.organisationNom} fichier="tiers"
          colonnes={[t('Code'), t('Nom'), t('Type(s)'), t('Téléphone'), t('Email'), t('Adresse'), t('NIF / identifiant fiscal')]}
          lignes={tiers.map((ti) => [ti.code, ti.nom, (ti.types as string[]).map((v) => t(TYPES.find((x) => x.value === v)?.label ?? v)).join(', '), ti.telephone ?? '', ti.email ?? '', ti.adresse ?? '', ti.nif ?? ''])} />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Nom')}</th>
            <th className={th}>{t('Type(s)')}</th>
            <th className={th}>{t('Téléphone')}</th>
            {peutModifier && <th className={th}></th>}
          </tr>
        </thead>
        <tbody>
          {tiers?.map((ti) => (
            <tr key={ti.id}>
              <td className={td}>{ti.code}</td>
              <td className={td}>{ti.nom}</td>
              <td className={td}>
                {ti.types.map((v: string) => t(TYPES.find((x) => x.value === v)?.label ?? v)).join(', ')}
              </td>
              <td className={td}>{ti.telephone ?? '—'}</td>
                {peutModifier && (
                  <td className={td}>
                    <LigneActions
                      libelle={ti.nom}
                      confirmation={t('Supprimer « {nom} » ? Cette action est définitive.', { nom: ti.nom })}
                      modifier={updateTiers.bind(null, ti.id)}
                      supprimer={deleteTiers.bind(null, ti.id)}
                      champs={[
                        { name: 'code', label: t('Code'), required: true, defaultValue: ti.code },
                        { name: 'nom', label: t('Nom / raison sociale'), required: true, defaultValue: ti.nom },
                        { name: 'types', label: t('Type(s)'), type: 'multiselect', options: TYPES.map((x) => ({ ...x, label: t(x.label) })), defaultValues: ti.types as string[] },
                        { name: 'telephone', label: t('Téléphone'), type: 'tel', defaultValue: ti.telephone ?? '' },
                        { name: 'email', label: t('Email'), type: 'email', defaultValue: ti.email ?? '' },
                        { name: 'adresse', label: t('Adresse'), defaultValue: ti.adresse ?? '' },
                        { name: 'nif', label: t('NIF / identifiant fiscal'), defaultValue: ti.nif ?? '' },
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
