import { getContexte } from '@/lib/session'
import { AssistantImport, type TypeImportOption } from '@/components/import/AssistantImport'
import { importerDonneesAgro } from './actions'

const OPTIONS_AGRO: TypeImportOption[] = [
  {
    id: 'produits',
    titre: 'Catalogue & Intrants',
    description: 'Importez vos semences, engrais, récoltes agricoles, produits finis et sous-produits avec leurs unités et prix.',
    icone: 'produits',
    nomFichierModele: 'modele_import_produits.csv',
    modeleCSV: `code,nom,categorie,unite,prix_reference,taux_tva
RIZ-PADDY,Riz Paddy Local,produit_agricole,kg,220,0
ENGRAIS-NPK,Engrais NPK 15-15-15,intrant,sac,18500,18
SEM-SAHEL108,Semence certifiée Sahel 108,semence,sac,12000,0
RIZ-BLANC-25,Riz Blanc Brisé 25kg,produit_fini,sac,15000,0
SON-RIZ,Son de riz pour bétail,sous_produit,sac,4500,0`
  },
  {
    id: 'tiers',
    titre: 'Tiers & Partenaires',
    description: 'Importez vos producteurs affiliés, fournisseurs d\'intrants, clients grossistes et distributeurs.',
    icone: 'tiers',
    nomFichierModele: 'modele_import_tiers.csv',
    modeleCSV: `code,nom,types,telephone,email,adresse,nif
PROD-001,Coopérative des Producteurs de Dagana,"producteur,fournisseur",775551122,coop.dagana@email.sn,Dagana Walo,NIF987654321
CL-001,Grossiste Alimentaire du Nord,client,786663344,grossiste.nord@email.sn,Saint-Louis Sor,NIF123456789
FRN-002,Société d'Intrants et Semences,fournisseur,704445566,contact@intrants-sa.sn,Dakar Km 12,NIF555666777`
  },
  {
    id: 'employes',
    titre: 'Personnel & Salariés',
    description: 'Importez le personnel permanent, saisonnier, journalier ou les prestataires pour la gestion RH et la paie.',
    icone: 'employes',
    nomFichierModele: 'modele_import_employes.csv',
    modeleCSV: `matricule,nom,prenom,statut,poste,date_embauche,departement,telephone
EMP-001,Diop,Mamadou,permanent,Directeur d'Usine,2022-01-15,production,771234567
EMP-002,Ndiaye,Aminata,permanent,Responsable Qualité,2022-03-01,autre,782345678
EMP-003,Ba,Ousmane,saisonnier,Opérateur Décortiqueuse,2023-07-01,production,703456789`
  }
]

export default async function ImportAgrobusinessPage() {
  const ctx = await getContexte()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Importation des données existantes
        </h1>
        <p className="text-sm text-foreground-muted mt-1">
          Intégrez rapidement vos produits, tiers et salariés existants dans {ctx.organisationNom || 'votre organisation'}.
        </p>
      </div>

      <AssistantImport
        nomApplication="D-Agrobusiness"
        titreModule="Gestion Agro-Industrielle"
        optionsTypes={OPTIONS_AGRO}
        onImporter={importerDonneesAgro as any}
      />
    </div>
  )
}
