import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { cn, formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'
import { ContrepassationButton } from '@/components/ContrepassationButton'

type Ligne = { debit: number; credit: number; tiers_id: string | null }

export default async function EcrituresPage({
  searchParams,
}: {
  searchParams: Promise<{ journal?: string; du?: string; au?: string }>
}) {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { journal: journalFiltre, du: duParam, au: auParam } = await searchParams
  const dateValide = (v?: string) => (v && /^d{4}-d{2}-d{2}$/.test(v) ? v : undefined)
  const du = dateValide(duParam)
  const au = dateValide(auParam)
  const periode = du || au ? `${du ? `&du=${du}` : ''}${au ? `&au=${au}` : ''}` : ''
  const [{ data: journaux }, { data: ecritures }] = await Promise.all([
    supabase.from('journaux').select('id, code, libelle').eq('actif', true).order('code'),
    (() => {
      let q = supabase
        .from('ecritures')
        .select('id, numero, date_ecriture, libelle, reference_piece, contrepassation_de, journal_id, journaux(code), lignes_ecritures(debit, credit, tiers_id, libelle, comptes_comptables(numero))')
        .order('date_ecriture', { ascending: false })
        .order('numero', { ascending: false })
      if (journalFiltre) q = q.eq('journal_id', journalFiltre)
      if (du) q = q.gte('date_ecriture', du)
      if (au) q = q.lte('date_ecriture', au)
      // Sans période choisie, on se limite aux 100 dernières écritures ; avec une période, on prend tout.
      if (!du && !au) q = q.limit(100)
      return q
    })(),
  ])

  const contrepassees = new Set(
    (ecritures ?? []).map((e) => e.contrepassation_de).filter((v): v is string => !!v)
  )
  const peutEcrire = peutMenu(ctx, '/comptabilite/ecritures', ['admin', 'comptable'])

  return (
    <>
      <PageHeader
        titre={t('Écritures comptables')}
        description={t('Les écritures validées sont immuables : toute correction passe par une contre-passation.')}
      >
        {peutEcrire && (
          <Button asChild>
            <Link href="/comptabilite/ecritures/nouvelle">
              <Plus className="h-4 w-4" aria-hidden /> {t('Nouvelle écriture')}
            </Link>
          </Button>
        )}
        <ExportButtons
          titre={journalFiltre ? `${t('Journal')} ${journaux?.find((j) => j.id === journalFiltre)?.code ?? ''}` : t('Écritures comptables')}
          sousTitre={du || au ? `${du ? formatDate(du, ctx.lang) : '…'} → ${au ? formatDate(au, ctx.lang) : '…'}` : ctx.organisationNom} fichier={journalFiltre ? 'journal' : 'ecritures-comptables'}
          colonnes={[t('Date'), t('Journal'), 'N°', t('Compte'), t('Libellé'), t('Débit'), t('Crédit')]}
          lignes={(ecritures ?? []).flatMap((e) => {
            const journal = Array.isArray(e.journaux) ? e.journaux[0] : e.journaux
            return (e.lignes_ecritures as unknown as { debit: number; credit: number; libelle: string | null; comptes_comptables: { numero: string } | { numero: string }[] | null }[]).map((l) => {
              const cpt = Array.isArray(l.comptes_comptables) ? l.comptes_comptables[0] : l.comptes_comptables
              return [formatDate(e.date_ecriture, ctx.lang), journal?.code, e.numero, cpt?.numero, l.libelle ?? e.libelle, Number(l.debit) || null, Number(l.credit) || null]
            })
          })}
        />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-foreground-muted">{t('Journal')} :</span>
        <Link
          href={`/comptabilite/ecritures${periode ? `?${periode.slice(1)}` : ''}`}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            !journalFiltre ? 'border-primary bg-primary text-white' : 'border-surface-border text-foreground-muted hover:text-foreground'
          )}
        >
          {t('Tous')}
        </Link>
        {journaux?.map((j) => (
          <Link
            key={j.id}
            href={journalFiltre === j.id ? `/comptabilite/ecritures${periode ? `?${periode.slice(1)}` : ''}` : `/comptabilite/ecritures?journal=${j.id}${periode}`}
            title={j.libelle}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              journalFiltre === j.id ? 'border-primary bg-primary text-white' : 'border-surface-border text-foreground-muted hover:text-foreground'
            )}
          >
            {j.code}
          </Link>
        ))}
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {journalFiltre && <input type="hidden" name="journal" value={journalFiltre} />}
        <label htmlFor="du">{t('Du')}</label>
        <input id="du" type="date" name="du" defaultValue={du} className="h-9 rounded-md border border-surface-border bg-transparent px-2" />
        <label htmlFor="au">{t('Au')}</label>
        <input id="au" type="date" name="au" defaultValue={au} className="h-9 rounded-md border border-surface-border bg-transparent px-2" />
        <Button type="submit" size="sm" variant="outline">{t('Afficher')}</Button>
      </form>

      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Date')}</th>
            <th className={th}>{t('Journal')}</th>
            <th className={th}>N°</th>
            <th className={th}>{t('Libellé')}</th>
            <th className={`${th} text-right`}>{t('Montant')}</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {ecritures?.map((e) => {
            const journal = Array.isArray(e.journaux) ? e.journaux[0] : e.journaux
            // Le montant affiché est celui de la facture/du mouvement lié au tiers (client/fournisseur),
            // pas la somme de tous les débits : une vente de stock combine dans la même écriture la vente
            // elle-même et la sortie de stock à son coût (cf. enregistrer_vente()), et sommer tous les
            // débits gonflerait le montant affiché avec ce coût de sortie, sans rapport avec le montant
            // de la facture tel qu'il apparaît dans le journal des ventes/achats.
            const lignes = e.lignes_ecritures as Ligne[]
            const lignesTiers = lignes.filter((l) => l.tiers_id)
            const montant =
              lignesTiers.length > 0
                ? lignesTiers.reduce((s, l) => s + Number(l.debit) + Number(l.credit), 0)
                : lignes.reduce((s, l) => s + Number(l.debit), 0)
            const estContrepassation = !!e.contrepassation_de
            const dejaContrepassee = contrepassees.has(e.id)
            return (
              <tr key={e.id}>
                <td className={td}>{formatDate(e.date_ecriture, ctx.lang)}</td>
                <td className={td}>{journal?.code}</td>
                <td className={td}>{e.numero}</td>
                <td className={td}>
                  {e.libelle}
                  {estContrepassation && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-xs">{t('contre-passation')}</span>}
                  {dejaContrepassee && <span className="ml-2 rounded bg-sidebar px-1.5 py-0.5 text-xs">{t('contre-passée')}</span>}
                </td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(montant, ctx.devise, ctx.lang)}</td>
                <td className={td}>
                  {peutEcrire && !estContrepassation && !dejaContrepassee && <ContrepassationButton id={e.id} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
