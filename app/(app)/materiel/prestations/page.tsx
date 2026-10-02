import Link from 'next/link'
import { Phone } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { ROLES_PRESTATIONS, UNITES_PRESTATION } from '@/lib/catalogue'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'
import { ActionButton } from '@/components/ActionButton'
import { PrestationMaterielForm, type PrestationValeurs } from '@/components/PrestationMaterielForm'
import { ajouterPrestation, modifierPrestation, supprimerPrestation } from './actions'

const un = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

export default async function PrestationsMaterielPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const [{ data: prestations }, { data: materiels }, { data: tiers }, { data: produits }, { data: campagnes }] = await Promise.all([
    supabase
      .from('prestations_materiel')
      .select('*, materiels(code, designation), produits(nom), campagnes(code)')
      .order('date_prestation', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('materiels').select('id, code, designation').eq('statut', 'en_service').order('code'),
    supabase.from('tiers').select('id, code, nom, telephone, types').eq('actif', true).order('nom'),
    supabase.from('produits').select('id, code, nom, unite, variete_obligatoire').eq('actif', true).neq('categorie', 'service').order('nom'),
    supabase.from('campagnes').select('id, code, libelle').eq('statut', 'ouverte').order('date_debut', { ascending: false }),
  ])
  const peutEcrire = peutMenu(ctx, '/materiel/prestations', ROLES_PRESTATIONS)

  const optMateriels = (materiels ?? []).map((m) => ({ id: m.id, label: `${m.code} — ${m.designation}` }))
  const clients = (tiers ?? [])
    .filter((x) => (x.types as string[]).some((ty) => ty === 'client' || ty === 'producteur'))
    .map((x) => ({ id: x.id, label: `${x.code} — ${x.nom}`, telephone: x.telephone }))
  const optProduits = (produits ?? []).map((p) => ({ id: p.id, label: `${p.code} — ${p.nom}`, unite: p.unite, variete_obligatoire: p.variete_obligatoire }))
  const optCampagnes = (campagnes ?? []).map((c) => ({ id: c.id, label: `${c.code} — ${c.libelle}` }))

  // Variétés déjà pointées, proposées en suggestion pour chaque produit.
  const varietes: Record<string, string[]> = {}
  for (const p of prestations ?? []) {
    if (!p.produit_id || !p.variete) continue
    const liste = (varietes[p.produit_id] ??= [])
    if (!liste.includes(p.variete)) liste.push(p.variete)
  }

  const unite = (p: { unite: string; unite_autre: string | null }) =>
    p.unite === 'autre' ? p.unite_autre ?? t('autre') : t(UNITES_PRESTATION.find((u) => u.value === p.unite)?.court ?? p.unite)
  const nombre = (n: number) => Number(n).toLocaleString(ctx.lang, { maximumFractionDigits: 2 })

  const total = (prestations ?? []).reduce((s, p) => s + Number(p.montant), 0)
  const parUnite = new Map<string, number>()
  for (const p of prestations ?? []) parUnite.set(unite(p), (parUnite.get(unite(p)) ?? 0) + Number(p.quantite_traitee))

  const formProps = { materiels: optMateriels, clients, produits: optProduits, campagnes: optCampagnes, varietes }

  return (
    <>
      <PageHeader
        titre={t('Prestations du matériel')}
        description={`${t('Travaux réalisés avec le matériel, pointés sur le terrain.')} ${t('Total')} : ${formatMontant(total, ctx.devise, ctx.lang)}${
          parUnite.size ? ` — ${[...parUnite].map(([u, q]) => `${nombre(q)} ${u}`).join(' · ')}` : ''
        }.`}
      >
        <Button asChild variant="outline">
          <Link href="/materiel">{t('Parc matériel')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/catalogue/produits">{t('Produits et variétés')}</Link>
        </Button>
        <ExportButtons
          titre={t('Prestations du matériel')}
          sousTitre={ctx.organisationNom}
          fichier="prestations-materiel"
          colonnes={[t('N°'), t('Date'), t('Matériel'), t('Prestation'), t('Client'), t('Téléphone'), t('Quantité'), t('Unité'), t('Produit'), t('Variété'), t('Quantité obtenue'), t('Part'), t('Montant')]}
          lignes={(prestations ?? []).map((p) => [
            p.numero,
            formatDate(p.date_prestation, ctx.lang),
            un(p.materiels)?.code ?? '',
            p.type_prestation,
            p.client_nom ?? '',
            p.client_telephone,
            Number(p.quantite_traitee),
            unite(p),
            un(p.produits)?.nom ?? '',
            p.variete ?? '',
            p.quantite_obtenue != null ? `${nombre(p.quantite_obtenue)} ${p.unite_obtenue ?? ''}` : '',
            p.part_quantite != null ? `${nombre(p.taux_part)} % = ${nombre(p.part_quantite)} ${p.unite_obtenue ?? ''}` : '',
            Number(p.montant),
          ])}
        />
        {peutEcrire && <PrestationMaterielForm action={ajouterPrestation} {...formProps} />}
      </PageHeader>
      {optMateriels.length === 0 && (
        <p className="mb-4 rounded-lg bg-warning/15 p-3 text-sm">{t('Aucun matériel en service : enregistrez d’abord le matériel dans le parc.')}</p>
      )}
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('N°')}</th>
            <th className={th}>{t('Date')}</th>
            <th className={th}>{t('Matériel')}</th>
            <th className={th}>{t('Prestation et client')}</th>
            <th className={`${th} text-right`}>{t('Quantité pointée')}</th>
            <th className={th}>{t('Obtenu')}</th>
            <th className={`${th} text-right`}>{t('Montant')}</th>
            {peutEcrire && <th className={th}></th>}
          </tr>
        </thead>
        <tbody>
          {(prestations ?? []).map((p) => {
            const valeurs: PrestationValeurs = {
              materiel_id: p.materiel_id,
              campagne_id: p.campagne_id,
              date_prestation: p.date_prestation,
              type_prestation: p.type_prestation,
              client_id: p.client_id,
              client_nom: p.client_nom,
              client_telephone: p.client_telephone,
              unite: p.unite,
              unite_autre: p.unite_autre,
              quantite_traitee: Number(p.quantite_traitee),
              tarif_unitaire: p.tarif_unitaire != null ? Number(p.tarif_unitaire) : null,
              produit_id: p.produit_id,
              variete: p.variete,
              quantite_obtenue: p.quantite_obtenue != null ? Number(p.quantite_obtenue) : null,
              unite_obtenue: p.unite_obtenue,
              mode_paiement: p.mode_paiement,
              taux_part: p.taux_part != null ? Number(p.taux_part) : null,
              prix_unitaire_part: p.prix_unitaire_part != null ? Number(p.prix_unitaire_part) : null,
              montant: Number(p.montant),
            }
            return (
              <tr key={p.id} className="align-top">
                <td className={`${td} whitespace-nowrap font-mono text-xs`}>{p.numero}</td>
                <td className={td}>{formatDate(p.date_prestation, ctx.lang)}</td>
                <td className={td}>
                  {un(p.materiels)?.code} <span className="text-foreground-muted">{un(p.materiels)?.designation}</span>
                </td>
                <td className={td}>
                  <span className="font-medium">{p.type_prestation}</span>
                  {un(p.campagnes)?.code && <span className="ms-2 rounded bg-sidebar px-1.5 py-0.5 text-xs">{un(p.campagnes)?.code}</span>}
                  <span className="block text-xs text-foreground-muted">{p.client_nom}</span>
                  <a href={`tel:${p.client_telephone.replace(/[^\d+]/g, '')}`} dir="ltr" className="inline-flex items-center gap-1 text-xs text-primary underline">
                    <Phone className="h-3 w-3" aria-hidden /> {p.client_telephone}
                  </a>
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {nombre(p.quantite_traitee)} {unite(p)}
                </td>
                <td className={td}>
                  {p.quantite_obtenue != null ? (
                    <>
                      {nombre(p.quantite_obtenue)} {p.unite_obtenue} {un(p.produits)?.nom && `· ${un(p.produits)?.nom}`}
                      {p.variete && <span className="block text-xs text-foreground-muted">{t('Variété')} : {p.variete}</span>}
                      {p.part_quantite != null && (
                        <span className="block text-xs text-foreground-muted">
                          {t('Part')} {nombre(p.taux_part)} % : {nombre(p.part_quantite)} {p.unite_obtenue}
                        </span>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(p.montant, ctx.devise, ctx.lang)}</td>
                {peutEcrire && (
                  <td className={td}>
                    <div className="flex items-start gap-2">
                      <PrestationMaterielForm action={modifierPrestation.bind(null, p.id)} {...formProps} valeurs={valeurs} />
                      <ActionButton
                        label={t('Supprimer')}
                        confirmation={t('Supprimer cette prestation ? Cette action est définitive.')}
                        action={supprimerPrestation.bind(null, p.id)}
                      />
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
          {(prestations ?? []).length === 0 && (
            <tr>
              <td colSpan={peutEcrire ? 8 : 7} className={`${td} text-center text-foreground-muted`}>
                {t('Aucune prestation pointée.')}
              </td>
            </tr>
          )}
        </tbody>
      </TableWrap>
    </>
  )
}
