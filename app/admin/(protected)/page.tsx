import { Building2, Users, CreditCard, Clock, AlertTriangle, Wallet } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { NIVEAUX, type Niveau } from '@/lib/abonnement'
import { Card, PageHeader } from '@/components/ui/card'

export default async function AdminDashboardPage() {
  const t = creerT(await langueNavigateur())
  const admin = createAdminClient()
  const maintenant = new Date()
  const dans7j = new Date(maintenant.getTime() + 7 * 86_400_000)
  const ilYA30j = new Date(maintenant.getTime() - 30 * 86_400_000)

  const [{ data: orgs }, { count: nbUtilisateurs }, { data: paiements }] = await Promise.all([
    admin.from('organisations').select('id, niveau, essai_expire_le, abonnement_expire_le, compte_verrouille').eq('demo', false),
    admin.from('utilisateurs').select('id', { count: 'exact', head: true }),
    admin.from('abonnement_paiements').select('montant, statut, provider, created_at'),
  ])

  const fin = (o: { essai_expire_le: string; abonnement_expire_le: string | null }) =>
    new Date(Math.max(new Date(o.essai_expire_le).getTime(), o.abonnement_expire_le ? new Date(o.abonnement_expire_le).getTime() : 0))
  const actives = (orgs ?? []).filter((o) => !o.compte_verrouille && fin(o) > maintenant)
  const expirees = (orgs ?? []).filter((o) => o.compte_verrouille || fin(o) <= maintenant)
  const bientot = actives.filter((o) => fin(o) <= dans7j)
  const payes = (paiements ?? []).filter((p) => p.statut === 'completed' && p.provider !== 'manuel')
  const chiffre = payes.reduce((s, p) => s + Number(p.montant), 0)
  const chiffre30 = payes.filter((p) => new Date(p.created_at) >= ilYA30j).reduce((s, p) => s + Number(p.montant), 0)
  const enAttente = (paiements ?? []).filter((p) => p.statut === 'pending').length
  const fcfa = (v: number) => `${v.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} F CFA`

  const cartes = [
    { label: t('Entreprises actives'), value: String(actives.length), icon: Building2 },
    { label: t('Utilisateurs'), value: String(nbUtilisateurs ?? 0), icon: Users },
    { label: t('Chiffre d’affaires encaissé'), value: fcfa(chiffre), icon: Wallet },
    { label: t('Encaissé sur 30 jours'), value: fcfa(chiffre30), icon: CreditCard },
    { label: t('Expirent dans 7 jours'), value: String(bientot.length), icon: Clock },
    { label: t('Expirées ou verrouillées'), value: String(expirees.length), icon: AlertTriangle },
  ]
  const parNiveau = (Object.keys(NIVEAUX) as Niveau[]).map((n) => ({ n, nb: actives.filter((o) => o.niveau === n).length }))

  return (
    <>
      <PageHeader titre={t('Tableau de bord')} description={t('Vue d’ensemble de la plateforme (hors organisation de démonstration).')} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cartes.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <Icon className="mb-3 h-5 w-5 text-primary" aria-hidden />
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-sm text-foreground-muted">{label}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">{t('Entreprises actives par niveau')}</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-3">
          {parNiveau.map(({ n, nb }) => (
            <li key={n} className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2">
              <span>{t(NIVEAUX[n].nom)}</span>
              <span className="font-semibold tabular-nums">{nb}</span>
            </li>
          ))}
        </ul>
        {enAttente > 0 && <p className="mt-4 text-sm text-foreground-muted">{t('Paiements en attente')} : {enAttente}</p>}
      </Card>
    </>
  )
}
