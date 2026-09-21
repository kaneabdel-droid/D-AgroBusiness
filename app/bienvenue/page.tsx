import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, BookOpen, Factory, ShieldCheck, Landmark, Wallet, Users, LineChart, Wheat, Globe2, Languages, Layers } from 'lucide-react'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { CartesTarifs, EnTete, PagePublique, Pied, TableauDurees, carteSurvol } from '@/components/vitrine/Vitrine'

export async function generateMetadata(): Promise<Metadata> {
  const t = creerT(await langueNavigateur())
  return {
    title: t('D-AGROBUSINESS — Gestion intégrée de la chaîne de valeur agricole'),
    description: t('Financement, intrants, parc matériel, production, usine de transformation, RH et comptabilité analytique pour les entreprises agro-industrielles.'),
  }
}

const MODULES = [
  { icone: BookOpen, titre: 'Comptabilité analytique', desc: 'Écritures équilibrées et immuables, plans comptables SYSCOHADA, marocain et mauritanien, résultat par département, secteur et campagne.' },
  { icone: Wheat, titre: 'Production agricole', desc: 'Chaque parcelle et chaque campagne : intrants consommés, récoltes, coût de revient et rendement par hectare.' },
  { icone: Factory, titre: 'Usine de transformation', desc: 'Nomenclatures, ordres de fabrication, rendements réels et valorisation des produits finis et sous-produits.' },
  { icone: ShieldCheck, titre: 'Traçabilité et qualité', desc: 'Lots de la récolte au client, contrôles qualité avec blocage automatique et rappel de lot en un clic.' },
  { icone: Landmark, titre: 'Financement et matériel', desc: 'Crédits de campagne, emprunts, crédit-bail, subventions d’investissement, parc matériel et amortissements.' },
  { icone: Wallet, titre: 'Trésorerie et prévisions', desc: 'Rapprochement bancaire, plan de trésorerie sur 12 mois avec ventes estimées, salaires et échéances.' },
  { icone: Users, titre: 'RH et paie', desc: 'Personnel, pointage, congés et bulletins de paie calculés selon les règles de 13 pays d’Afrique de l’Ouest et du Nord.' },
  { icone: LineChart, titre: 'Pilotage', desc: 'Budgets suivis, bilan et compte de résultat comparatifs, ratios, TVA et bilans de campagne.' },
]

const ETAPES = [
  ['Créez votre entreprise', 'Inscription en 2 minutes : plan comptable, départements et journaux sont préparés selon votre pays.'],
  ['Saisissez ou importez', 'Achats, ventes, récoltes, fabrications, paie : chaque opération crée ses écritures automatiquement.'],
  ['Pilotez en temps réel', 'Coûts de revient, trésorerie prévisionnelle, états financiers et traçabilité, à jour à chaque saisie.'],
]

export default async function BienvenuePage() {
  const lang = await langueNavigateur()
  const t = creerT(lang)

  return (
    <PagePublique lang={lang}>
      <EnTete lang={lang} />

      {/* Héro : usine + rizière + tracteur en fond dégradé bleu eau → vert herbe */}
      <section className="relative isolate overflow-hidden border-b border-surface-border">
        <div className="absolute inset-0 -z-20 bg-cover bg-center rtl:-scale-x-100" style={{ backgroundImage: "url('/hero-agro.svg')" }} aria-hidden />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#053B5C]/85 via-[#075C8F]/35 to-transparent rtl:bg-gradient-to-l" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-32">
          <div className="max-w-xl text-white">
            <p className="inline-block rounded bg-vert px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">{t('Chaîne de valeur agricole')}</p>
            <h1 className="mt-5 font-heading text-4xl font-bold leading-tight md:text-5xl">
              {t('Pilotez toute votre chaîne agro-industrielle,')} <span className="text-[#B7EA8F]">{t('du champ à l’usine')}</span>
            </h1>
            <p className="mt-5 text-white/90">{t('Financement, intrants, parc matériel, production, usine de transformation, RH et comptabilité analytique pour les entreprises agro-industrielles.')}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/tarifs" className="rounded-md bg-vert px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-vert-fonce">{t('S’abonner')}</Link>
              <Link href="/decouvrir-dagrobusiness" className="rounded-md border border-white/70 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white hover:text-primary">{t('Découvrir')}</Link>
            </div>
            <p className="mt-4 text-sm text-white/80">{t('7 jours d’essai gratuit, sans carte bancaire.')}</p>
          </div>
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-7 sm:px-6 md:grid-cols-4">
          {[
            [Layers, '3 niveaux', 'Standard, Medium, Premium'],
            [Globe2, '13 pays', 'Paie et plan comptable adaptés'],
            [Languages, 'FR · EN · AR', 'Interface trilingue, arabe de droite à gauche'],
            [ShieldCheck, '100 % traçable', 'Écritures immuables et journal d’audit'],
          ].map(([Icone, titre, sous]) => {
            const Icon = Icone as typeof Layers
            return (
              <div key={titre as string} className="flex items-start gap-3">
                <Icon className="mt-1 h-5 w-5 shrink-0 text-[#B7EA8F]" aria-hidden />
                <div><p className="font-heading text-lg font-bold">{t(titre as string)}</p><p className="text-sm text-white/80">{t(sous as string)}</p></div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Modules */}
      <section id="fonctionnalites" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <p className="text-xs font-bold uppercase tracking-widest text-vert-fonce">{t('Solutions')}</p>
        <h2 className="mt-3 max-w-2xl font-heading text-3xl font-bold">{t('Tout ce qu’il faut pour gérer votre entreprise agricole')}</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(({ icone: Icon, titre, desc }) => (
            <div key={titre} className={`flex flex-col rounded-xl border border-surface-border bg-surface p-6 ${carteSurvol}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-eau-clair text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
              <h3 className="mt-5 font-heading text-lg font-semibold">{t(titre)}</h3>
              <p className="mt-2 flex-1 text-sm text-foreground-muted">{t(desc)}</p>
              <Link href="/decouvrir-dagrobusiness" className="mt-4 inline-flex items-center gap-1 py-2 text-sm font-semibold text-primary hover:text-primary-hover">
                {t('Découvrir')} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="bg-[#0A3A55] text-[#E6F3F8]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <p className="text-xs font-bold uppercase tracking-widest text-[#B7EA8F]">{t('Comment ça marche')}</p>
          <h2 className="mt-3 max-w-xl font-heading text-3xl font-bold">{t('Opérationnel dès la première journée')}</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {ETAPES.map(([titre, desc], i) => (
              <li key={titre} className="border-t border-white/20 pt-5">
                <span className="font-heading text-3xl font-bold text-[#B7EA8F]">0{i + 1}</span>
                <h3 className="mt-3 font-semibold">{t(titre)}</h3>
                <p className="mt-1 text-sm text-[#A8C9D8]">{t(desc)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <p className="text-xs font-bold uppercase tracking-widest text-vert-fonce">{t('Tarifs')}</p>
        <h2 className="mt-3 max-w-2xl font-heading text-3xl font-bold">{t('Un abonnement simple, sans engagement')}</h2>
        <p className="mt-3 max-w-2xl text-foreground-muted">{t('Payez au mois ou plusieurs mois d’un coup : 1 % de remise par mois payé, à partir de 2 mois.')}</p>
        <div className="mt-10"><CartesTarifs lang={lang} /></div>
        <div className="mt-8"><TableauDurees lang={lang} /></div>
      </section>

      {/* Appel à l'action */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-heading text-3xl font-bold md:text-4xl">{t('Prêt à piloter votre entreprise ?')}</h2>
        <p className="mt-4 text-foreground-muted">{t('Essayez D-AGROBUSINESS gratuitement pendant 7 jours, ou explorez d’abord une entreprise de démonstration.')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover">{t('Créer mon compte')}</Link>
          <Link href="/decouvrir-dagrobusiness" className="rounded-md border border-primary/40 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground">{t('Explorer la démonstration')}</Link>
        </div>
      </section>

      <Pied lang={lang} />
    </PagePublique>
  )
}
