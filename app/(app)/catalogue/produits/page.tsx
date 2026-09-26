import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { formatMontant } from '@/lib/utils'
import { CATEGORIES } from '@/lib/catalogue'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { LigneActions } from '@/components/LigneActions'
import { deleteProduit, updateProduit } from '../../referentiels/edition'
import { ExportButtons } from '@/components/ExportButtons'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addProduit } from '../../operations/actions'

export default async function ProduitsPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: produits } = await supabase.from('produits').select('*').order('code')
  const peutModifier = ctx.role === 'admin'
  const peutEcrire = peutMenu(ctx, '/catalogue/produits', ['admin', 'comptable', 'chef_departement'])

  return (
    <>
      <PageHeader
        titre={t('Produits')}
        description={t('La catégorie détermine les comptes de stock, de variation de stock et de vente utilisés.')}
      >
        <SimpleCreateForm
          titre={t('Nouveau produit')}
          disabled={!peutEcrire}
          action={addProduit}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'nom', label: t('Désignation'), required: true },
            { name: 'categorie', label: t('Catégorie'), type: 'select', required: true, options: CATEGORIES.map((c) => ({ ...c, label: t(c.label) })) },
            { name: 'unite', label: t('Unité'), defaultValue: 'kg' },
            { name: 'taux_tva', label: t('TVA %'), type: 'number', step: '0.01', defaultValue: '0' },
            { name: 'prix_reference', label: t('Prix de référence'), type: 'number', step: '0.01' },
          ]}
        />
        <ExportButtons titre={t('Produits')} sousTitre={ctx.organisationNom} fichier="produits"
          colonnes={[t('Code'), t('Désignation'), t('Catégorie'), t('Unité'), t('TVA'), t('Prix réf.')]}
          lignes={(produits ?? []).map((p) => [p.code, p.nom, t(CATEGORIES.find((c) => c.value === p.categorie)?.label ?? ''), p.unite, `${Number(p.taux_tva)} %`, p.prix_reference != null ? Number(p.prix_reference) : ''])} />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Désignation')}</th>
            <th className={th}>{t('Catégorie')}</th>
            <th className={th}>{t('Unité')}</th>
            <th className={`${th} text-right`}>{t('TVA')}</th>
            <th className={`${th} text-right`}>{t('Prix réf.')}</th>
            {peutModifier && <th className={th}></th>}
          </tr>
        </thead>
        <tbody>
          {produits?.map((p) => (
            <tr key={p.id}>
              <td className={td}>{p.code}</td>
              <td className={td}>{p.nom}</td>
              <td className={td}>{t(CATEGORIES.find((c) => c.value === p.categorie)?.label ?? '')}</td>
              <td className={td}>{p.unite}</td>
              <td className={`${td} text-right`}>{Number(p.taux_tva)} %</td>
              <td className={`${td} text-right tabular-nums`}>
                {p.prix_reference != null ? formatMontant(p.prix_reference, ctx.devise, ctx.lang) : '—'}
              </td>
              {peutModifier && (
                <td className={td}>
                  <LigneActions
                    libelle={p.nom}
                    confirmation={t('Supprimer « {nom} » ? Cette action est définitive.', { nom: p.nom })}
                    modifier={updateProduit.bind(null, p.id)}
                    supprimer={deleteProduit.bind(null, p.id)}
                    champs={[
                      { name: 'code', label: t('Code'), required: true, defaultValue: p.code },
                      { name: 'nom', label: t('Désignation'), required: true, defaultValue: p.nom },
                      { name: 'categorie', label: t('Catégorie'), type: 'select', required: true, options: CATEGORIES.map((c) => ({ ...c, label: t(c.label) })), defaultValue: p.categorie },
                      { name: 'unite', label: t('Unité'), defaultValue: p.unite },
                      { name: 'taux_tva', label: t('TVA %'), type: 'number', step: '0.01', defaultValue: String(p.taux_tva ?? 0) },
                      { name: 'prix_reference', label: t('Prix de référence'), type: 'number', step: '0.01', defaultValue: p.prix_reference != null ? String(p.prix_reference) : '' },
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
