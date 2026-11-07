// lib/comptabilite/referentielsPays.ts
// Référentiels comptables et fiscaux multi-pays pour la liasse financière
// Supporte :
// - Sénégal / UEMOA (SYSCOHADA Révisé)
// - Afrique Centrale / CEMAC (SYSCOHADA Révisé CEMAC)
// - Maroc (PCGM / CGNC - DGI Maroc)
// - Mauritanie (PCGM - DGI Mauritanie)
// - Nigéria (IFRS / CAMA - FIRS)
// - Ghana (GRA / IFRS for SMEs)
// - Gambie (GRA / Companies Act / GAAP)

export type CodePays = 'SN' | 'CEMAC' | 'MA' | 'MR' | 'NG' | 'GH' | 'GM'

export interface ReferentielPaysConfig {
  code: CodePays
  nom: string
  nomCourt: string
  drapeau: string
  referentielComptable: string
  systeme: string
  paysOfficiel: string
  ministere: string
  directionFiscale: string
  centreDepot: string
  labelIdFiscal: string
  placeholderIdFiscal: string
  deviseCode: string
  deviseSymbole: string
  documentsDeposes: string[]
  titres: {
    liasse: string
    sousTitreLiasse: string
    bilan: string
    compteResultat: string
    fluxTresorerie: string
    notesAnnexees: string
    certification: string
    adminFiscale: string
    piedPage: string
  }
}

export const REFERENTIELS_PAYS: Record<CodePays, ReferentielPaysConfig> = {
  SN: {
    code: 'SN',
    nom: 'Sénégal (UEMOA / SYSCOHADA)',
    nomCourt: 'Sénégal',
    drapeau: '🇸🇳',
    referentielComptable: 'SYSCOHADA Révisé (Système Normal)',
    systeme: 'SYSTÈME NORMAL',
    paysOfficiel: 'RÉPUBLIQUE DU SÉNÉGAL',
    ministere: 'MINISTÈRE DE L’ÉCONOMIE, DU PLAN ET DE LA COOPÉRATION',
    directionFiscale: 'DIRECTION GÉNÉRALE DES IMPÔTS ET DES DOMAINES (DGID)',
    centreDepot: 'CENTRE DES SERVICES FISCAUX (CSF)',
    labelIdFiscal: 'N° NINEA (Identification Fiscale)',
    placeholderIdFiscal: '00123456-2K',
    deviseCode: 'XOF',
    deviseSymbole: 'FCFA',
    documentsDeposes: [
      'Fiche d’identification & renseignements divers (ZK à ZP)',
      'Bilan du Système Normal (Actif & Passif)',
      'Compte de Résultat (Système Normal)',
      'Tableau des Flux de Trésorerie (TFT)',
      'Notes Annexées (36 notes officielles SYSCOHADA)',
    ],
    titres: {
      liasse: 'ÉTATS FINANCIERS NORMALISÉS DU SYSTÈME COMPTABLE OUEST AFRICAIN (SYSCOHADA)',
      sousTitreLiasse: 'Liasse Fiscale Officielle Conforme aux Normes OHADA & DGID Sénégal',
      bilan: 'BILAN NORMALISÉ SYSCOHADA (ACTIF & PASSIF)',
      compteResultat: 'COMPTE DE RÉSULTAT DU SYSTÈME NORMAL',
      fluxTresorerie: 'TABLEAU DES FLUX DE TRÉSORERIE (TFT)',
      notesAnnexees: 'NOTES ANNEXÉES OFFICIELLES (36 NOTES SYSCOHADA)',
      certification: 'Certification de sincérité et de régularité (DGID Sénégal)',
      adminFiscale: 'Réservé à l’Administration Fiscale (DGID Sénégal)',
      piedPage: 'Liasse Fiscale SYSCOHADA — Direction Générale des Impôts et des Domaines (Sénégal)',
    },
  },

  CEMAC: {
    code: 'CEMAC',
    nom: 'Afrique Centrale (CEMAC / SYSCOHADA)',
    nomCourt: 'Afrique Centrale (CEMAC)',
    drapeau: '🇨🇲',
    referentielComptable: 'SYSCOHADA Révisé Harmonisé CEMAC',
    systeme: 'SYSTÈME NORMAL CEMAC',
    paysOfficiel: 'COMMUNAUTÉ ÉCONOMIQUE ET MONÉTAIRE DE L’AFRIQUE CENTRALE (CEMAC)',
    ministere: 'MINISTÈRE DES FINANCES ET DU BUDGET',
    directionFiscale: 'DIRECTION GÉNÉRALE DES IMPÔTS (DGI / CEMAC)',
    centreDepot: 'DIRECTION DES GRANDES ET MOYENNES ENTREPRISES',
    labelIdFiscal: 'N° NIU (Numéro d’Identifiant Unique)',
    placeholderIdFiscal: 'M012345678901A',
    deviseCode: 'XAF',
    deviseSymbole: 'FCFA',
    documentsDeposes: [
      'Fiche de Déclaration Annuelle des Résultats (DSF / DGI)',
      'Bilan Normalisé SYSCOHADA CEMAC (Actif & Passif)',
      'Compte de Résultat d’Exploitation et Hors Activités Ordinaires',
      'Tableau des Flux de Trésorerie Harmonisé CEMAC',
      'Notes Annexées et Renseignements Complémentaires',
    ],
    titres: {
      liasse: 'ÉTATS FINANCIERS ET DÉCLARATION STATISTIQUE ET FISCALE (DSF / SYSCOHADA CEMAC)',
      sousTitreLiasse: 'Conforme aux Actes Uniformes OHADA et au Code Général des Impôts CEMAC',
      bilan: 'BILAN RÉVISÉ CEMAC / SYSCOHADA',
      compteResultat: 'COMPTE DE RÉSULTAT CEMAC',
      fluxTresorerie: 'TABLEAU DES FLUX DE TRÉSORERIE (TFT)',
      notesAnnexees: 'NOTES ANNEXÉES DSF CEMAC',
      certification: 'Attestation de conformité des états financiers (DGI CEMAC)',
      adminFiscale: 'Réservé aux Services Fiscaux (DGI CEMAC)',
      piedPage: 'Déclaration Statistique et Fiscale (DSF) — Zone CEMAC / OHADA',
    },
  },

  MA: {
    code: 'MA',
    nom: 'Maroc (PCGM / CGNC / DGI)',
    nomCourt: 'Maroc',
    drapeau: '🇲🇦',
    referentielComptable: 'Code Général de Normalisation Comptable (PCGM / CGNC Maroc)',
    systeme: 'MODÈLE NORMAL MAROCAIN',
    paysOfficiel: 'ROYAUME DU MAROC',
    ministere: 'MINISTÈRE DE L’ÉCONOMIE ET DES FINANCES',
    directionFiscale: 'DIRECTION GÉNÉRALE DES IMPÔTS (DGI MAROC)',
    centreDepot: 'DIRECTION RÉGIONALE DES IMPÔTS / DIRECTION DES GRANDES ENTREPRISES',
    labelIdFiscal: 'ICE (Identifiant Commun de l’Entreprise) & IF',
    placeholderIdFiscal: '001234567000089 / IF: 40123456',
    deviseCode: 'MAD',
    deviseSymbole: 'DH',
    documentsDeposes: [
      'Bilan Normalisé (Actif & Passif - Modèle Normal Marocain)',
      'Compte de Produits et Charges (CPC)',
      'État des Soldes de Gestion (ESG - Tableau de Formation du Résultat & CAF)',
      'Tableau de Financement de l’Exercice',
      'État des Informations Complémentaires (ETIC - Modèle Normal)',
    ],
    titres: {
      liasse: 'LIASSE FISCALE OFFICIELLE DU ROYAUME DU MAROC (PCGM / CGNC)',
      sousTitreLiasse: 'Conforme au Code Général des Impôts & au Plan Comptable Général Marocain (Modèle Normal)',
      bilan: 'BILAN (MODÈLE NORMAL MAROCAIN - ACTIF / PASSIF)',
      compteResultat: 'COMPTE DE PRODUITS ET CHARGES (CPC - HORS TAXES)',
      fluxTresorerie: 'TABLEAU DE FINANCEMENT DE L’EXERCICE (EMPLOIS & RESSOURCES)',
      notesAnnexees: 'ÉTAT DES INFORMATIONS COMPLÉMENTAIRES (ETIC MAROC)',
      certification: 'Attestation de sincérité et visa de l’Expert-Comptable / DGI Maroc',
      adminFiscale: 'Réservé à l’Administration Fiscale (DGI Maroc)',
      piedPage: 'Liasse Fiscale Officielle — Direction Générale des Impôts (Royaume du Maroc)',
    },
  },

  MR: {
    code: 'MR',
    nom: 'Mauritanie (PCGM / DGI)',
    nomCourt: 'Mauritanie',
    drapeau: '🇲🇷',
    referentielComptable: 'Plan Comptable Général Mauritanien (PCGM)',
    systeme: 'SYSTÈME GÉNÉRAL MAURITANIEN',
    paysOfficiel: 'RÉPUBLIQUE ISLAMIQUE DE MAURITANIE',
    ministere: 'MINISTÈRE DES FINANCES',
    directionFiscale: 'DIRECTION GÉNÉRALE DES IMPÔTS (DGI MAURITANIE)',
    centreDepot: 'DIRECTION DES GRANDES ET MOYENNES ENTREPRISES (DGE / DME)',
    labelIdFiscal: 'NIF (Numéro d’Identification Fiscale)',
    placeholderIdFiscal: '00123456-MR',
    deviseCode: 'MRU',
    deviseSymbole: 'MRU',
    documentsDeposes: [
      'Fiche Signalétique de l’Entreprise (DGI Mauritanie)',
      'Bilan Général Mauritanien (Actif & Passif)',
      'Compte d’Exploitation Générale et de Pertes & Profits',
      'Tableau de Trésorerie et de Financement',
      'Annexes Légales et Relevé des Amortissements & Provisions',
    ],
    titres: {
      liasse: 'DÉCLARATION FISCALE ET ÉTATS FINANCIERS DE MAURITANIE (PCGM)',
      sousTitreLiasse: 'Conforme au Plan Comptable Général Mauritanien & au Code Général des Impôts',
      bilan: 'BILAN GÉNÉRAL (PCGM MAURITANIE)',
      compteResultat: 'COMPTE D’EXPLOITATION GÉNÉRALE & RÉSULTAT',
      fluxTresorerie: 'TABLEAU DES FLUX FINANCIERS & TRÉSORERIE',
      notesAnnexees: 'ANNEXES STATISTIQUES ET FISCALES (DGI MAURITANIE)',
      certification: 'Visa fiscal et certification du commissaire aux comptes / DGI Mauritanie',
      adminFiscale: 'Réservé à la Direction Générale des Impôts (Mauritanie)',
      piedPage: 'Liasse Fiscale Annuelle — Direction Générale des Impôts (Mauritanie)',
    },
  },

  NG: {
    code: 'NG',
    nom: 'Nigeria (IFRS / CAMA / FIRS)',
    nomCourt: 'Nigeria',
    drapeau: '🇳🇬',
    referentielComptable: 'IFRS / Companies and Allied Matters Act (CAMA 2020)',
    systeme: 'IFRS FINANCIAL REPORTING STANDARDS',
    paysOfficiel: 'FEDERAL REPUBLIC OF NIGERIA',
    ministere: 'FEDERAL MINISTRY OF FINANCE, BUDGET AND NATIONAL PLANNING',
    directionFiscale: 'FEDERAL INLAND REVENUE SERVICE (FIRS)',
    centreDepot: 'LARGE TAXPAYERS OFFICE (LTO) / MEDIUM TAXPAYERS OFFICE',
    labelIdFiscal: 'TIN (Taxpayer Identification Number) & RC Number',
    placeholderIdFiscal: 'TIN: 20123456-0001 / RC: 1234567',
    deviseCode: 'NGN',
    deviseSymbole: '₦',
    documentsDeposes: [
      'Statement of Financial Position (Balance Sheet under IFRS)',
      'Statement of Profit or Loss and Other Comprehensive Income',
      'Statement of Cash Flows (Direct / Indirect Method)',
      'Statement of Changes in Equity',
      'Notes to the Financial Statements and Significant Accounting Policies',
    ],
    titres: {
      liasse: 'AUDITED ANNUAL FINANCIAL STATEMENTS & TAX FILING (IFRS / CAMA)',
      sousTitreLiasse: 'Prepared in Accordance with International Financial Reporting Standards & FIRS Requirements',
      bilan: 'STATEMENT OF FINANCIAL POSITION (ASSETS & LIABILITIES)',
      compteResultat: 'STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME',
      fluxTresorerie: 'STATEMENT OF CASH FLOWS',
      notesAnnexees: 'NOTES TO THE FINANCIAL STATEMENTS (IFRS DISCLOSURES)',
      certification: 'Director’s Report & Independent Auditor’s Certification',
      adminFiscale: 'Official Stamp & Acknowledgment (Federal Inland Revenue Service)',
      piedPage: 'Annual Financial Statements — Federal Inland Revenue Service (Nigeria)',
    },
  },

  GH: {
    code: 'GH',
    nom: 'Ghana (GRA / IFRS for SMEs)',
    nomCourt: 'Ghana',
    drapeau: '🇬🇭',
    referentielComptable: 'Ghana Accounting Standards / IFRS for SMEs',
    systeme: 'GHANA NATIONAL STANDARDS / IFRS',
    paysOfficiel: 'REPUBLIC OF GHANA',
    ministere: 'MINISTRY OF FINANCE AND ECONOMIC PLANNING',
    directionFiscale: 'GHANA REVENUE AUTHORITY (GRA)',
    centreDepot: 'LARGE TAXPAYER UNIT (LTU) / MEDIUM TAXPAYER OFFICE',
    labelIdFiscal: 'TIN / Ghana Card PIN & RGD Reg. No.',
    placeholderIdFiscal: 'GHA-001234567-8 / TIN: C0001234567',
    deviseCode: 'GHS',
    deviseSymbole: 'GH₵',
    documentsDeposes: [
      'Statement of Financial Position (Balance Sheet)',
      'Statement of Comprehensive Income (Profit and Loss Account)',
      'Statement of Cash Flows',
      'Statement of Changes in Equity',
      'Explanatory Notes and Accounting Policies (GRA Returns)',
    ],
    titres: {
      liasse: 'ANNUAL FINANCIAL STATEMENTS & TAX RETURN (GRA / IFRS)',
      sousTitreLiasse: 'Conforming to Ghana Revenue Authority (GRA) Guidelines & Companies Act 2019 (Act 992)',
      bilan: 'STATEMENT OF FINANCIAL POSITION',
      compteResultat: 'STATEMENT OF COMPREHENSIVE INCOME',
      fluxTresorerie: 'STATEMENT OF CASH FLOWS',
      notesAnnexees: 'EXPLANATORY NOTES TO THE FINANCIAL STATEMENTS',
      certification: 'Certification of True and Fair View by Directors and Auditors',
      adminFiscale: 'For Official Use Only (Ghana Revenue Authority)',
      piedPage: 'Annual Tax Returns & Accounts — Ghana Revenue Authority',
    },
  },

  GM: {
    code: 'GM',
    nom: 'The Gambia (GRA / Companies Act)',
    nomCourt: 'The Gambia',
    drapeau: '🇬🇲',
    referentielComptable: 'Gambia Companies Act / GRA Financial Guidelines',
    systeme: 'GRA STANDARD REPORTING',
    paysOfficiel: 'REPUBLIC OF THE GAMBIA',
    ministere: 'MINISTRY OF FINANCE AND ECONOMIC AFFAIRS (MOFEA)',
    directionFiscale: 'GAMBIA REVENUE AUTHORITY (GRA)',
    centreDepot: 'LARGE & MEDIUM TAXPAYERS OFFICE (KANIFING / BANJUL)',
    labelIdFiscal: 'TIN (Tax Identification Number) & Business Reg.',
    placeholderIdFiscal: 'TIN: 1002345678',
    deviseCode: 'GMD',
    deviseSymbole: 'D',
    documentsDeposes: [
      'Balance Sheet (Financial Position as at Year End)',
      'Profit and Loss Account (Income Statement)',
      'Cash Flow Statement for the Period',
      'Schedule of Capital Allowances & Depreciation',
      'Notes and Accounting Policies Submitted to GRA',
    ],
    titres: {
      liasse: 'ANNUAL FINANCIAL STATEMENTS & CORPORATE TAX RETURN (GRA)',
      sousTitreLiasse: 'In Accordance with the Companies Act 2013 & Gambia Revenue Authority Regulations',
      bilan: 'BALANCE SHEET (ASSETS, CAPITAL & LIABILITIES)',
      compteResultat: 'PROFIT AND LOSS ACCOUNT',
      fluxTresorerie: 'CASH FLOW STATEMENT',
      notesAnnexees: 'NOTES TO THE ACCOUNTS & TAX SCHEDULES',
      certification: 'Board of Directors Approval and Certification',
      adminFiscale: 'Received and Verified by Gambia Revenue Authority (GRA)',
      piedPage: 'Annual Tax Return & Financial Statements — Gambia Revenue Authority',
    },
  },
}

export const LISTE_REFERENTIELS_PAYS = Object.values(REFERENTIELS_PAYS)

export function getReferentielPays(code?: string): ReferentielPaysConfig {
  if (!code) return REFERENTIELS_PAYS.SN
  const upper = code.toUpperCase() as CodePays
  return REFERENTIELS_PAYS[upper] || REFERENTIELS_PAYS.SN
}

export function detecterPaysParDevise(devise?: string): CodePays {
  if (!devise) return 'SN'
  const d = devise.toUpperCase().trim()
  if (d === 'MAD' || d === 'DH') return 'MA'
  if (d === 'MRU') return 'MR'
  if (d === 'NGN' || d === '₦') return 'NG'
  if (d === 'GHS' || d === 'GH₵') return 'GH'
  if (d === 'GMD' || d === 'D') return 'GM'
  if (d === 'XAF') return 'CEMAC'
  return 'SN'
}

