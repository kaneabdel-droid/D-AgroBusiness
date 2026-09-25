import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, BookOpen, Boxes, Factory, LineChart, Users2, Landmark } from 'lucide-react'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { EnTete, PagePublique, Pied, carteSurvol } from '@/components/vitrine/Vitrine'

export async function generateMetadata(): Promise<Metadata> {
  const t = creerT(await langueNavigateur())
  return { title: `${t('Guide de prise en main')} — D-AGROBUSINESS` }
}

const REFERENTIELS = [
  ['Départements', 'Créez les grandes divisions de votre entreprise : un code, un nom et un type (Fonctionnement, Distribution, Production, Usine, Matériel, Commercial ou Autre). Choisissez un style de codification et gardez-le pour tous vos départements.'],
  ['Secteurs et projets', 'Sous chaque département, créez vos secteurs (par exemple pour distinguer deux exploitations) ou vos projets, avec leur superficie en hectares.'],
  ['Exercices comptables', 'Ouvrez votre exercice en cours (par défaut du 1er janvier au 31 décembre).'],
  ['Campagnes agricoles', 'Si vous suivez votre activité par campagne (hivernage, contre-saison…), créez-les ici. Une campagne peut chevaucher deux exercices comptables.'],
  ['Tiers', 'Enregistrez vos clients, fournisseurs et producteurs suivis individuellement — un même tiers peut cumuler plusieurs rôles. Pour les personnes de passage, regroupez-les dans un compte générique plutôt que d’en créer un par personne.'],
  ['Partenaires financiers', 'Vos banques et bailleurs de fonds sont enregistrés à part, dans leur propre rubrique — pas avec vos tiers commerciaux.'],
] as const

const CATEGORIES_PRODUITS = [
  ['Intrant / Semence', 'Ce que vous achetez pour produire ou distribuer.'],
  ['Produit agricole', 'Votre matière première, propre ou achetée — le paddy pour une usine de décorticage, le maïs pour une usine de farine…'],
  ['Produit fini', 'Ce que vous vendez au terme de la transformation.'],
  ['Sous-produit', 'Un résidu de transformation revendable (son, brisures…), valorisé à son propre prix de référence.'],
  ['Service / prestation', 'Une prestation facturée, sans mouvement de stock.'],
] as const

const OPERATIONS = [
  ['Achats', 'Vos achats auprès de fournisseurs. Gardez toujours le même nom pour un même fournisseur, pour que son historique reste groupé.'],
  ['Dépôt-vente', 'Quand vous vendez un stock qui appartient à quelqu’un d’autre. Renseignez d’abord le contrat qui vous lie à ce fournisseur.'],
  ['Distribution aux producteurs', 'Les intrants et services livrés à crédit à vos producteurs accompagnés.'],
  ['Production agricole', 'Pour vos propres exploitations : consommation d’intrants et services, et récoltes. À ne pas confondre avec la distribution.'],
  ['Ventes', 'Vos ventes à des clients ordinaires, hors accompagnement des producteurs.'],
  ['Remboursements en nature', 'Quand un producteur rembourse en nature ce qui lui a été distribué à crédit.'],
  ['Trésorerie', 'Vos opérations de caisse, banque et mobile money. Distinguez toujours un règlement tiers d’une autre opération. Vous pouvez aussi y effectuer vos rapprochements bancaires et vos prévisions.'],
] as const

const PERSONNEL = [
  'Enregistrez votre personnel avec ses contrats et son type d’emploi.',
  'Gérez le pointage journalier, utile pour les journaliers et prestataires.',
  'Suivez les congés et absences.',
  'Vérifiez que vos paramètres de paie sont conformes à la législation de votre pays.',
  'Éditez les bulletins de salaire de chaque employé en toute transparence.',
] as const

const SOMMAIRE = [
  ['prealables', BookOpen, 'Les préalables'],
  ['quotidien', Boxes, 'Au quotidien'],
  ['usine', Factory, 'L’usine'],
  ['pilotage', LineChart, 'Pilotage et comptabilité'],
  ['personnel', Users2, 'Le personnel'],
] as const

export default async function GuidePage() {
  const lang = await langueNavigateur()
  const t = creerT(lang)

  return (
    <PagePublique lang={lang}>
      <EnTete lang={lang} actif="guide" />
      <main>
        <section className="border-b border-surface-border bg-gradient-to-br from-eau-clair via-surface to-[#E6F4DC]">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 md:py-20">
            <Link href="/bienvenue" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground-muted hover:text-primary">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden /> {t('Retour à l’accueil')}
            </Link>
            <p className="text-xs font-bold uppercase tracking-widest text-vert-fonce">{t('Guide de prise en main')}</p>
            <h1 className="mt-3 font-heading text-4xl font-bold md:text-5xl">{t('Bien démarrer avec D-AGROBUSINESS')}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-foreground-muted">{t('Ce guide vous accompagne pas à pas : d’abord la configuration de votre organisation, puis l’utilisation quotidienne de l’application.')}</p>
          </div>
        </section>

        <nav aria-label={t('Sommaire')} className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {SOMMAIRE.map(([id, Icon, titre]) => (
              <a key={id} href={`#${id}`} className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface px-3.5 py-1.5 text-sm font-medium text-foreground-muted transition hover:border-primary/40 hover:text-primary">
                <Icon className="h-3.5 w-3.5" aria-hidden /> {t(titre)}
              </a>
            ))}
          </div>
        </nav>

        <section id="prealables" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">{t('1. Les préalables')}</h2>
          <p className="mt-2 text-foreground-muted">{t('Avant toute saisie d’opération, votre organisation doit être structurée. Cette configuration ne se fait qu’une seule fois — prenez le temps de bien la faire.')}</p>

          <h3 className="mb-3 mt-8 font-heading text-lg font-semibold">{t('Les référentiels de l’entreprise')} <span className="font-normal text-foreground-muted">({t('menu Référentiels')})</span></h3>
          <ol className="space-y-4">
            {REFERENTIELS.map(([titre, desc], i) => (
              <li key={titre} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                <p><strong className="text-foreground">{t(titre)}.</strong> <span className="text-foreground-muted">{t(desc)}</span></p>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-warning">{t('Important')}</p>
            <p className="mt-1 text-sm text-foreground">{t('Aucune écriture comptable ne peut être enregistrée si aucun exercice n’est ouvert pour la période concernée. Ouvrez toujours votre exercice comptable avant de commencer à saisir des opérations.')}</p>
          </div>

          <h3 className="mb-3 mt-10 font-heading text-lg font-semibold">{t('Les stocks')}</h3>
          <p className="text-foreground-muted">{t('Renseignez vos magasins (code, nom, département s’il y a lieu), puis tous les produits et articles suivis en stock : code, désignation, catégorie, unité de mesure, TVA si vous y êtes assujetti, et prix de référence si vous le connaissez.')}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CATEGORIES_PRODUITS.map(([titre, desc]) => (
              <div key={titre} className={`rounded-xl border border-surface-border bg-surface p-4 ${carteSurvol}`}>
                <h4 className="font-heading font-semibold text-primary">{t(titre)}</h4>
                <p className="mt-1 text-sm text-foreground-muted">{t(desc)}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-foreground-muted">{t('Utilisez toujours une unité de mesure standard (kg, litre, sac…) pour que vos analyses restent cohérentes d’un produit à l’autre. Le prix de référence sert notamment à valoriser correctement vos sous-produits lors d’une transformation en usine.')}</p>

          <h3 className="mb-3 mt-10 font-heading text-lg font-semibold">{t('Financement et matériel')}</h3>
          <p className="text-foreground-muted">{t('Renseignez la liste de vos banques et établissements financiers, vos emprunts et crédits en cours, ainsi que tout le matériel appartenant à l’entreprise — son amortissement est calculé automatiquement.')}</p>

          <h3 className="mb-3 mt-10 font-heading text-lg font-semibold">{t('Votre équipe de travail')} <span className="font-normal text-foreground-muted">({t('menu Administration')})</span></h3>
          <p className="text-foreground-muted">{t('Dans Administration → Équipe, invitez chaque collaborateur par son adresse email. Il reçoit une invitation, crée son propre compte, et rejoint automatiquement votre organisation avec le rôle que vous lui avez attribué.')}</p>
          <p className="mt-2 text-foreground-muted">{t('Les rôles disponibles : Administrateur, Direction, Comptable, Chef de département, Ressources humaines, Lecteur (consultation seule). Pour restreindre l’accès d’un rôle à certains modules précis, utilisez Administration → Permissions.')}</p>
        </section>

        <section id="quotidien" className="border-t border-surface-border bg-sidebar/40 py-10">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="font-heading text-2xl font-bold md:text-3xl">{t('2. Utiliser l’application au quotidien')}</h2>
            <p className="mt-2 text-foreground-muted">{t('Une fois votre organisation configurée, vous pouvez enregistrer vos opérations en toute sécurité.')}</p>
            <div className="mt-6 space-y-4">
              {OPERATIONS.map(([titre, desc]) => (
                <div key={titre} className="rounded-xl border border-surface-border bg-surface p-4">
                  <h3 className="font-heading font-semibold">{t(titre)}</h3>
                  <p className="mt-1 text-sm text-foreground-muted">{t(desc)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="usine" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">{t('3. L’usine de transformation')}</h2>
          <p className="mt-2 text-foreground-muted">{t('Si vous transformez de la matière première (décorticage, mouture…), chaque production passe par un ordre de fabrication.')}</p>
          <ol className="mt-6 space-y-4">
            <li className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
              <p><strong className="text-foreground">{t('Créez d’abord la nomenclature')}</strong> <span className="text-foreground-muted">{t('de votre transformation, sur la page Usine : indiquez la matière première utilisée et les produits attendus en sortie, avec leur rendement en pourcentage. Exemple : 100 kg de paddy décortiqué donnent 65 % de riz blanc, 10 % de brisures de riz et 8 % de son de riz.')}</span></p>
            </li>
            <li className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
              <p><strong className="text-foreground">{t('Lancez ensuite un ordre de fabrication')}</strong> <span className="text-foreground-muted">{t('en précisant la quantité de matière utilisée, le magasin d’origine du stock, les frais de transformation à imputer (main-d’œuvre, énergie…) et la nomenclature à suivre.')}</span></p>
            </li>
          </ol>
          <div className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-warning">{t('Important')}</p>
            <p className="mt-1 text-sm text-foreground">{t('Renseignez un prix de référence pour chaque sous-produit (dans Catalogue → Produits) avant de lancer une transformation qui en produit. Sans ce prix, l’application ne peut pas le valoriser correctement et refuse l’opération.')}</p>
          </div>
        </section>

        <section id="pilotage" className="border-t border-surface-border bg-sidebar/40 py-10">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="font-heading text-2xl font-bold md:text-3xl">{t('4. Le pilotage et la comptabilité')}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-surface-border bg-surface p-4">
                <h3 className="font-heading font-semibold">{t('Pilotage')}</h3>
                <p className="mt-1 text-sm text-foreground-muted">{t('Donne à la direction une vue d’ensemble : budgets, états et ratios, bilans de campagne, rapport mensuel, et gestion de la TVA.')}</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-surface p-4">
                <h3 className="font-heading font-semibold">{t('Comptabilité')}</h3>
                <p className="mt-1 text-sm text-foreground-muted">{t('Vos écritures, classées par journal — la plupart générées automatiquement par vos opérations. Personnalisez votre plan comptable, éditez votre balance, suivez les créances et dettes de vos tiers, imprimez vos relevés de compte, et consultez le résultat analytique de chaque département.')}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="personnel" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">{t('5. La gestion du personnel')}</h2>
          <p className="mt-2 text-foreground-muted">{t('Avec la formule Premium, gérez aussi vos ressources humaines.')}</p>
          <ul className="mt-6 space-y-2">
            {PERSONNEL.map((texte) => (
              <li key={texte} className="flex gap-2 text-sm text-foreground-muted">
                <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {t(texte)}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-foreground-muted">{t('Votre période d’essai vous donne un accès complet, formule Premium, pour découvrir toutes les fonctionnalités avant de choisir votre formule.')}</p>
        </section>

        <section className="bg-[#0A3A55] py-14 text-center text-white">
          <div className="mx-auto max-w-2xl px-4">
            <h2 className="font-heading text-2xl font-bold md:text-3xl">{t('Prêt à démarrer ?')}</h2>
            <p className="mt-3 text-[#A8C9D8]">{t('7 jours d’essai gratuit, sans carte bancaire.')}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="rounded-md bg-vert px-6 py-3 text-sm font-semibold text-white transition hover:bg-vert-fonce">{t('Créer mon compte')}</Link>
              <Link href="/decouvrir-dagrobusiness" className="rounded-md border border-white/60 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-primary">{t('Explorer la démonstration')}</Link>
            </div>
          </div>
        </section>
      </main>
      <Pied lang={lang} />
    </PagePublique>
  )
}
