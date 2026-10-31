/**
 * Moteur des États Financiers SYSCOHADA Révisé — Système Normal
 * Conforme au Référentiel Comptable OHADA et aux exigences de la DGID (Direction Générale des Impôts et Domaines du Sénégal).
 * 
 * Génère la liasse financière complète :
 * 1. Fiche d'identification et renseignements divers (Page de garde, statuts, codes & suivi des 36 notes)
 * 2. Bilan Actif du Système Normal (Brut, Amort/Prov, Net N, Net N-1)
 * 3. Bilan Passif du Système Normal (Net N, Net N-1)
 * 4. Compte de Résultat en cascade (SIG : Marge commerciale, CA, VA, EBE, REX, RF, RAO, RHAO, RN)
 * 5. Tableau des Flux de Trésorerie (TFT : Trésorerie ouverture, Flux Opérationnels, Flux Investissement, Flux Financement, Clôture & Bouclage)
 * 6. Note 34 : Fiche de synthèse des principaux indicateurs financiers (SIG, CAFG, Ratios rentabilité, Structure financière, FR, BFR, TN, Endettement net)
 * 7. Les 36 Notes Annexées normalisées OHADA
 * 8. Export CSV complet normalisé de la liasse
 */

export type LigneBalance = {
  exercice_id: string
  numero: string
  libelle: string
  classe: number
  total_debit: number
  total_credit: number
  solde: number
}

export type ExerciceComptable = {
  id: string
  libelle: string
  date_debut: string
  date_fin: string
}

export type DetailCompte = {
  numero: string
  libelle: string
  solde: number
}

export type PosteBilanActif = {
  ref: string
  libelle: string
  note: string
  brutN: number
  amortN: number
  netN: number
  netN1: number
  estTotal?: boolean
  comptesN?: DetailCompte[]
}

export type PosteBilanPassif = {
  ref: string
  libelle: string
  note: string
  netN: number
  netN1: number
  estTotal?: boolean
  comptesN?: DetailCompte[]
}

export type PosteCompteResultat = {
  ref: string
  libelle: string
  note: string
  montantN: number
  montantN1: number
  type: 'poste' | 'sig'
  estTotal?: boolean
  comptesN?: DetailCompte[]
}

export type LigneTFT = {
  ref: string
  libelle: string
  note?: string
  montantN: number
  montantN1: number
  type: 'rubrique' | 'sous_total' | 'total'
}

export type LigneIndicateur = {
  code: string
  libelle: string
  montantN: number | string
  montantN1: number | string
  variation?: number | string
  unite?: string
  type?: 'titre' | 'valeur' | 'sous_total' | 'total'
}

export type NoteItem = {
  intitule: string
  montantN: number | string
  montantN1?: number | string
  variation?: number | string
  detail?: string
  colA?: number | string
  colB?: number | string
  colC?: number | string
  colD?: number | string
  colE?: number | string
  colF?: number | string
}

export type NoteAnnexe = {
  id: string
  numero: string
  nomNote: string
  statut: 'A' | 'N/A'
  colonnes?: string[]
  description?: string
  items: NoteItem[]
  sousTableau?: {
    nomSousTableau: string
    colonnes: string[]
    items: NoteItem[]
  }
  commentaires?: string
}

export type FicheIdentification = {
  pays: string
  ministere: string
  direction: string
  centreDepot: string
  denomination: string
  sigle: string
  adresse: string
  nineaNif: string
  dateCloture: string
  dureeMois: number
  dateDebut: string
  dateFin: string
  formeJuridiqueCode: string
  regimeFiscalCode: string
  paysSiegeCode: string
  codeActivite: string
  activitePrincipale: string
  contactNom: string
  signataireNom: string
  signataireQualite: string
}

export type EtatsFinanciersSyscohada = {
  exerciceN: ExerciceComptable
  exerciceN1?: ExerciceComptable
  fiche: FicheIdentification
  balanceLignes?: LigneBalance[]
  bilanActif: PosteBilanActif[]
  totalActifN: { brut: number; amort: number; net: number }
  totalActifN1: { net: number }
  bilanPassif: PosteBilanPassif[]
  totalPassifN: number
  totalPassifN1: number
  compteResultat: PosteCompteResultat[]
  tft: LigneTFT[]
  indicateurs: LigneIndicateur[]
  notesAnnexees: NoteAnnexe[]
  controles: {
    equilibreBilanN: number
    equilibreBilanN1: number
    resultatNetN: number
    resultatNetN1: number
    tresorerieNetteN: number
    tresorerieNetteN1: number
    variationTresorerieN: number
    ecartBouclageTFT: number
    fondsRoulementN: number
    besoinFinancementGlobalN: number
    tresorerieCalculeeN: number
  }
}

/**
 * Calculateur central des états financiers SYSCOHADA (Système Normal)
 */
export function genererEtatsFinanciersSyscohada(
  toutesLignes: LigneBalance[],
  exerciceCourant: ExerciceComptable,
  exercicesTous: ExerciceComptable[],
  infosEntreprise?: Partial<FicheIdentification>
): EtatsFinanciersSyscohada {
  // 1. Identifier l'exercice précédent N-1
  const exercicePrecedent = exercicesTous.find((e) => e.date_fin < exerciceCourant.date_debut)

  // 2. Périmètres de cumul pour les comptes de bilan (classes 1 à 5)
  const idsCumulN = new Set(
    exercicesTous.filter((e) => e.date_fin <= exerciceCourant.date_fin).map((e) => e.id)
  )
  const idsCumulN1 = new Set(
    exercicePrecedent
      ? exercicesTous.filter((e) => e.date_fin <= exercicePrecedent.date_fin).map((e) => e.id)
      : []
  )

  // Map des soldes de bilan N
  const balanceCumulN = new Map<string, { numero: string; libelle: string; classe: number; solde: number }>()
  for (const l of toutesLignes) {
    if (idsCumulN.has(l.exercice_id)) {
      const exist = balanceCumulN.get(l.numero) ?? {
        numero: l.numero,
        libelle: l.libelle,
        classe: l.classe,
        solde: 0,
      }
      exist.solde += Number(l.solde) || 0
      balanceCumulN.set(l.numero, exist)
    }
  }

  // Map des soldes de bilan N-1
  const balanceCumulN1 = new Map<string, { numero: string; libelle: string; classe: number; solde: number }>()
  for (const l of toutesLignes) {
    if (idsCumulN1.has(l.exercice_id)) {
      const exist = balanceCumulN1.get(l.numero) ?? {
        numero: l.numero,
        libelle: l.libelle,
        classe: l.classe,
        solde: 0,
      }
      exist.solde += Number(l.solde) || 0
      balanceCumulN1.set(l.numero, exist)
    }
  }

  // Lignes de gestion (classes 6, 7, 8) propres à l'exercice N
  const lignesGestionN = toutesLignes.filter((l) => l.exercice_id === exerciceCourant.id && l.classe >= 6)
  // Lignes de gestion propres à l'exercice N-1
  const lignesGestionN1 = exercicePrecedent
    ? toutesLignes.filter((l) => l.exercice_id === exercicePrecedent.id && l.classe >= 6)
    : []

  // Fonctions de filtrage
  function getSolde(map: typeof balanceCumulN, pattern: RegExp): { total: number; comptes: DetailCompte[] } {
    let total = 0
    const comptes: DetailCompte[] = []
    for (const [num, c] of map.entries()) {
      if (pattern.test(num)) {
        total += c.solde
        if (Math.abs(c.solde) > 0.001) {
          comptes.push({ numero: num, libelle: c.libelle, solde: c.solde })
        }
      }
    }
    return { total, comptes }
  }

  function getGestion(lignes: LigneBalance[], pattern: RegExp): { total: number; comptes: DetailCompte[] } {
    let total = 0
    const comptes: DetailCompte[] = []
    for (const l of lignes) {
      if (pattern.test(l.numero)) {
        // En classe 6, le solde débiteur naturel est une charge (positif)
        // En classes 7 & 8, le solde créditeur naturel est un produit (inverser solde)
        const val = l.classe === 6 ? Number(l.solde) : -Number(l.solde)
        total += val
        if (Math.abs(val) > 0.001) {
          comptes.push({ numero: l.numero, libelle: l.libelle, solde: val })
        }
      }
    }
    return { total, comptes }
  }

  // =========================================================================
  // 1. COMPTE DE RÉSULTAT (SYSCOHADA SYSTÈME NORMAL)
  // =========================================================================

  // Ventes et Chiffre d'Affaires
  const TA_N = getGestion(lignesGestionN, /^701/) // Ventes de marchandises
  const TA_N1 = getGestion(lignesGestionN1, /^701/)

  const RA_N = getGestion(lignesGestionN, /^601/) // Achats de marchandises
  const RA_N1 = getGestion(lignesGestionN1, /^601/)

  const RB_N = getGestion(lignesGestionN, /^6031/) // Var. stocks marchandises
  const RB_N1 = getGestion(lignesGestionN1, /^6031/)

  const MargeComm_N = TA_N.total - (RA_N.total + RB_N.total)
  const MargeComm_N1 = TA_N1.total - (RA_N1.total + RB_N1.total)

  const TB_N = getGestion(lignesGestionN, /^70[2-4]/) // Ventes de produits fabriqués
  const TB_N1 = getGestion(lignesGestionN1, /^70[2-4]/)

  const TC_N = getGestion(lignesGestionN, /^70[56]/) // Travaux et services vendus
  const TC_N1 = getGestion(lignesGestionN1, /^70[56]/)

  const TD_N = getGestion(lignesGestionN, /^707/) // Produits accessoires
  const TD_N1 = getGestion(lignesGestionN1, /^707/)

  const CA_N = TA_N.total + TB_N.total + TC_N.total + TD_N.total
  const CA_N1 = TA_N1.total + TB_N1.total + TC_N1.total + TD_N1.total

  // Production et autres produits
  const TE_N = getGestion(lignesGestionN, /^73/) // Production stockée
  const TE_N1 = getGestion(lignesGestionN1, /^73/)

  const TF_N = getGestion(lignesGestionN, /^72/) // Production immobilisée
  const TF_N1 = getGestion(lignesGestionN1, /^72/)

  const TG_N = getGestion(lignesGestionN, /^71/) // Subventions d'exploitation
  const TG_N1 = getGestion(lignesGestionN1, /^71/)

  const TH_N = getGestion(lignesGestionN, /^75/) // Autres produits
  const TH_N1 = getGestion(lignesGestionN1, /^75/)

  const TI_N = getGestion(lignesGestionN, /^781/) // Transferts de charges d'exploitation
  const TI_N1 = getGestion(lignesGestionN1, /^781/)

  // Charges consommées
  const RC_N = getGestion(lignesGestionN, /^602/) // Matières premières
  const RC_N1 = getGestion(lignesGestionN1, /^602/)

  const RD_N = getGestion(lignesGestionN, /^6032/) // Var. stock matières
  const RD_N1 = getGestion(lignesGestionN1, /^6032/)

  const RE_N = getGestion(lignesGestionN, /^60[458]/) // Autres achats (énergie, eau, fournitures, petit matériel)
  const RE_N1 = getGestion(lignesGestionN1, /^60[458]/)

  const RF_N_Stock = getGestion(lignesGestionN, /^6033/) // Var. stocks autres appros
  const RF_N1_Stock = getGestion(lignesGestionN1, /^6033/)

  const ChargeTransport_N = getGestion(lignesGestionN, /^61/) // Transports
  const ChargeTransport_N1 = getGestion(lignesGestionN1, /^61/)

  const RH_N = getGestion(lignesGestionN, /^6[23]/) // Services extérieurs
  const RH_N1 = getGestion(lignesGestionN1, /^6[23]/)

  const RI_N = getGestion(lignesGestionN, /^64/) // Impôts et taxes
  const RI_N1 = getGestion(lignesGestionN1, /^64/)

  const RJ_N = getGestion(lignesGestionN, /^65/) // Autres charges
  const RJ_N1 = getGestion(lignesGestionN1, /^65/)

  // Valeur Ajoutée (XC)
  const VA_N =
    MargeComm_N +
    (TB_N.total + TC_N.total + TD_N.total + TE_N.total + TF_N.total + TG_N.total + TH_N.total + TI_N.total) -
    (RC_N.total + RD_N.total + RE_N.total + RF_N_Stock.total + ChargeTransport_N.total + RH_N.total + RI_N.total + RJ_N.total)
  const VA_N1 =
    MargeComm_N1 +
    (TB_N1.total + TC_N1.total + TD_N1.total + TE_N1.total + TF_N1.total + TG_N1.total + TH_N1.total + TI_N1.total) -
    (RC_N1.total + RD_N1.total + RE_N1.total + RF_N1_Stock.total + ChargeTransport_N1.total + RH_N1.total + RI_N1.total + RJ_N1.total)

  // Charges de personnel
  const RK_N = getGestion(lignesGestionN, /^66/)
  const RK_N1 = getGestion(lignesGestionN1, /^66/)

  // Excédent Brut d'Exploitation (XD)
  const EBE_N = VA_N - RK_N.total
  const EBE_N1 = VA_N1 - RK_N1.total

  // Dotations et Reprises d'exploitation
  const TJ_N = getGestion(lignesGestionN, /^791|^798|^799/) // Reprises de provisions et subventions d'invest.
  const TJ_N1 = getGestion(lignesGestionN1, /^791|^798|^799/)

  const RL_N = getGestion(lignesGestionN, /^681|^691/) // Dotations aux amortissements & provisions
  const RL_N1 = getGestion(lignesGestionN1, /^681|^691/)

  // Résultat d'Exploitation (XE)
  const REX_N = EBE_N + TJ_N.total - RL_N.total
  const REX_N1 = EBE_N1 + TJ_N1.total - RL_N1.total

  // Financier
  const TK_N = getGestion(lignesGestionN, /^77/) // Produits financiers
  const TK_N1 = getGestion(lignesGestionN1, /^77/)

  const TL_N_Fin = getGestion(lignesGestionN, /^787/) // Transferts charges financières
  const TL_N1_Fin = getGestion(lignesGestionN1, /^787/)

  const RM_N = getGestion(lignesGestionN, /^67|^697/) // Frais financiers
  const RM_N1 = getGestion(lignesGestionN1, /^67|^697/)

  const RF_N = TK_N.total + TL_N_Fin.total - RM_N.total
  const RF_N1 = TK_N1.total + TL_N1_Fin.total - RM_N1.total

  // Résultat des Activités Ordinaires (XG)
  const RAO_N = REX_N + RF_N
  const RAO_N1 = REX_N1 + RF_N1

  // Hors Activités Ordinaires (H.A.O.)
  const TN_N = getGestion(lignesGestionN, /^82/) // Produits des cessions d'immo
  const TN_N1 = getGestion(lignesGestionN1, /^82/)

  const TO_N = getGestion(lignesGestionN, /^84|^86|^88/) // Autres produits HAO
  const TO_N1 = getGestion(lignesGestionN1, /^84|^86|^88/)

  const RO_N = getGestion(lignesGestionN, /^81/) // VCEAC
  const RO_N1 = getGestion(lignesGestionN1, /^81/)

  const RP_N_HAO = getGestion(lignesGestionN, /^83|^85/) // Autres charges HAO
  const RP_N1_HAO = getGestion(lignesGestionN1, /^83|^85/)

  const RHAO_N = TN_N.total + TO_N.total - (RO_N.total + RP_N_HAO.total)
  const RHAO_N1 = TN_N1.total + TO_N1.total - (RO_N1.total + RP_N1_HAO.total)

  // Résultat avant prélèvement
  const ResultatAvantPrelevement_N = RAO_N + RHAO_N
  const ResultatAvantPrelevement_N1 = RAO_N1 + RHAO_N1

  // Participation & Impôts
  const RQ_N_Part = getGestion(lignesGestionN, /^87/)
  const RQ_N1_Part = getGestion(lignesGestionN1, /^87/)

  const RS_N_Impots = getGestion(lignesGestionN, /^89/) // IS et IMF (compte 895)
  const RS_N1_Impots = getGestion(lignesGestionN1, /^89/)

  // Résultat Net (XI)
  const RN_N_Total = ResultatAvantPrelevement_N - RQ_N_Part.total - RS_N_Impots.total
  const RN_N1_Total = ResultatAvantPrelevement_N1 - RQ_N1_Part.total - RS_N1_Impots.total

  const compteResultat: PosteCompteResultat[] = [
    { ref: 'TA', libelle: 'Ventes de marchandises (A)', note: 'Note 21', montantN: TA_N.total, montantN1: TA_N1.total, type: 'poste', comptesN: TA_N.comptes },
    { ref: 'RA', libelle: 'Achats de marchandises', note: 'Note 22', montantN: -RA_N.total, montantN1: -RA_N1.total, type: 'poste', comptesN: RA_N.comptes },
    { ref: 'RB', libelle: 'Variation de stocks de marchandises', note: 'Note 6', montantN: -RB_N.total, montantN1: -RB_N1.total, type: 'poste', comptesN: RB_N.comptes },
    { ref: 'XA', libelle: 'MARGE COMMERCIALE (TA − RA − RB)', note: 'Note 34', montantN: MargeComm_N, montantN1: MargeComm_N1, type: 'sig', estTotal: true },

    { ref: 'TB', libelle: 'Ventes de produits fabriqués (B)', note: 'Note 21', montantN: TB_N.total, montantN1: TB_N1.total, type: 'poste', comptesN: TB_N.comptes },
    { ref: 'TC', libelle: 'Travaux, services vendus (C)', note: 'Note 21', montantN: TC_N.total, montantN1: TC_N1.total, type: 'poste', comptesN: TC_N.comptes },
    { ref: 'TD', libelle: 'Produits accessoires (D)', note: 'Note 21', montantN: TD_N.total, montantN1: TD_N1.total, type: 'poste', comptesN: TD_N.comptes },
    { ref: 'XB', libelle: 'CHIFFRE D’AFFAIRES (A + B + C + D)', note: 'Note 21', montantN: CA_N, montantN1: CA_N1, type: 'sig', estTotal: true },

    { ref: 'TE', libelle: 'Production stockée (ou déstockage)', note: 'Note 6', montantN: TE_N.total, montantN1: TE_N1.total, type: 'poste', comptesN: TE_N.comptes },
    { ref: 'TF', libelle: 'Production immobilisée', note: 'Note 21', montantN: TF_N.total, montantN1: TF_N1.total, type: 'poste', comptesN: TF_N.comptes },
    { ref: 'TG', libelle: 'Subventions d’exploitation', note: 'Note 21', montantN: TG_N.total, montantN1: TG_N1.total, type: 'poste', comptesN: TG_N.comptes },
    { ref: 'TH', libelle: 'Autres produits d’exploitation', note: 'Note 21', montantN: TH_N.total, montantN1: TH_N1.total, type: 'poste', comptesN: TH_N.comptes },
    { ref: 'TI', libelle: 'Transferts de charges d’exploitation', note: 'Note 12', montantN: TI_N.total, montantN1: TI_N1.total, type: 'poste', comptesN: TI_N.comptes },

    { ref: 'RC', libelle: 'Achats de matières premières et fournitures liées', note: 'Note 22', montantN: -RC_N.total, montantN1: -RC_N1.total, type: 'poste', comptesN: RC_N.comptes },
    { ref: 'RD', libelle: 'Variation de stocks de matières premières et fournitures', note: 'Note 6', montantN: -RD_N.total, montantN1: -RD_N1.total, type: 'poste', comptesN: RD_N.comptes },
    { ref: 'RE', libelle: 'Autres achats', note: 'Note 22', montantN: -RE_N.total, montantN1: -RE_N1.total, type: 'poste', comptesN: RE_N.comptes },
    { ref: 'RF', libelle: 'Variation de stocks autres approvisionnements', note: 'Note 6', montantN: -RF_N_Stock.total, montantN1: -RF_N1_Stock.total, type: 'poste', comptesN: RF_N_Stock.comptes },
    { ref: 'RG', libelle: 'Transports', note: 'Note 23', montantN: -ChargeTransport_N.total, montantN1: -ChargeTransport_N1.total, type: 'poste', comptesN: ChargeTransport_N.comptes },
    { ref: 'RH', libelle: 'Services extérieurs', note: 'Note 24', montantN: -RH_N.total, montantN1: -RH_N1.total, type: 'poste', comptesN: RH_N.comptes },
    { ref: 'RI', libelle: 'Impôts et taxes', note: 'Note 25', montantN: -RI_N.total, montantN1: -RI_N1.total, type: 'poste', comptesN: RI_N.comptes },
    { ref: 'RJ', libelle: 'Autres charges d’exploitation', note: 'Note 26', montantN: -RJ_N.total, montantN1: -RJ_N1.total, type: 'poste', comptesN: RJ_N.comptes },
    { ref: 'XC', libelle: 'VALEUR AJOUTÉE', note: 'Note 34', montantN: VA_N, montantN1: VA_N1, type: 'sig', estTotal: true },

    { ref: 'RK', libelle: 'Charges de personnel', note: 'Note 27A', montantN: -RK_N.total, montantN1: -RK_N1.total, type: 'poste', comptesN: RK_N.comptes },
    { ref: 'XD', libelle: 'EXCÉDENT BRUT D’EXPLOITATION (EBE)', note: 'Note 34', montantN: EBE_N, montantN1: EBE_N1, type: 'sig', estTotal: true },

    { ref: 'TJ', libelle: 'Reprises de subventions, amortissements et provisions', note: 'Note 28', montantN: TJ_N.total, montantN1: TJ_N1.total, type: 'poste', comptesN: TJ_N.comptes },
    { ref: 'RL', libelle: 'Dotations aux amortissements et aux provisions', note: 'Note 3C', montantN: -RL_N.total, montantN1: -RL_N1.total, type: 'poste', comptesN: RL_N.comptes },
    { ref: 'XE', libelle: 'RÉSULTAT D’EXPLOITATION', note: 'Note 34', montantN: REX_N, montantN1: REX_N1, type: 'sig', estTotal: true },

    { ref: 'TK', libelle: 'Revenus financiers et gains de change', note: 'Note 29', montantN: TK_N.total, montantN1: TK_N1.total, type: 'poste', comptesN: TK_N.comptes },
    { ref: 'TL', libelle: 'Transferts de charges financières', note: 'Note 12', montantN: TL_N_Fin.total, montantN1: TL_N1_Fin.total, type: 'poste', comptesN: TL_N_Fin.comptes },
    { ref: 'RM', libelle: 'Frais financiers et pertes de change', note: 'Note 29', montantN: -RM_N.total, montantN1: -RM_N1.total, type: 'poste', comptesN: RM_N.comptes },
    { ref: 'XF', libelle: 'RÉSULTAT FINANCIER', note: 'Note 29', montantN: RF_N, montantN1: RF_N1, type: 'sig', estTotal: true },
    { ref: 'XG', libelle: 'RÉSULTAT DES ACTIVITÉS ORDINAIRES (RAO)', note: 'Note 34', montantN: RAO_N, montantN1: RAO_N1, type: 'sig', estTotal: true },

    { ref: 'TN', libelle: 'Produits des cessions d’immobilisations', note: 'Note 3D', montantN: TN_N.total, montantN1: TN_N1.total, type: 'poste', comptesN: TN_N.comptes },
    { ref: 'TO', libelle: 'Autres produits HAO', note: 'Note 30', montantN: TO_N.total, montantN1: TO_N1.total, type: 'poste', comptesN: TO_N.comptes },
    { ref: 'RO', libelle: 'Valeurs comptables des cessions d’immobilisations', note: 'Note 3D', montantN: -RO_N.total, montantN1: -RO_N1.total, type: 'poste', comptesN: RO_N.comptes },
    { ref: 'RP', libelle: 'Autres charges HAO', note: 'Note 30', montantN: -RP_N_HAO.total, montantN1: -RP_N1_HAO.total, type: 'poste', comptesN: RP_N_HAO.comptes },
    { ref: 'XH', libelle: 'RÉSULTAT HORS ACTIVITÉS ORDINAIRES (RHAO)', note: 'Note 30', montantN: RHAO_N, montantN1: RHAO_N1, type: 'sig', estTotal: true },

    { ref: 'XR', libelle: 'RÉSULTAT AVANT PRÉLÈVEMENT (RAO + RHAO)', note: '', montantN: ResultatAvantPrelevement_N, montantN1: ResultatAvantPrelevement_N1, type: 'sig', estTotal: true },
    { ref: 'RQ', libelle: 'Participation des travailleurs', note: 'Note 31', montantN: -RQ_N_Part.total, montantN1: -RQ_N1_Part.total, type: 'poste', comptesN: RQ_N_Part.comptes },
    { ref: 'RS', libelle: 'Impôts sur le résultat (IS / IMF)', note: 'Note 34', montantN: -RS_N_Impots.total, montantN1: -RS_N1_Impots.total, type: 'poste', comptesN: RS_N_Impots.comptes },
    { ref: 'XI', libelle: 'RÉSULTAT NET (Bénéfice + ou Perte −)', note: 'Note 34', montantN: RN_N_Total, montantN1: RN_N1_Total, type: 'sig', estTotal: true },
  ]

  // =========================================================================
  // 2. BILAN ACTIF (SYSCOHADA SYSTÈME NORMAL)
  // =========================================================================

  function ligneActif(
    ref: string,
    libelle: string,
    note: string,
    patternBrut: RegExp,
    patternAmort: RegExp
  ): PosteBilanActif {
    const brutN = getSolde(balanceCumulN, patternBrut)
    const amortN = getSolde(balanceCumulN, patternAmort)
    const brutN1 = getSolde(balanceCumulN1, patternBrut)
    const amortN1 = getSolde(balanceCumulN1, patternAmort)

    const amortN_val = Math.abs(amortN.total)
    const amortN1_val = Math.abs(amortN1.total)
    const netN = brutN.total - amortN_val
    const netN1 = brutN1.total - amortN1_val

    return {
      ref,
      libelle,
      note,
      brutN: brutN.total,
      amortN: amortN_val,
      netN,
      netN1,
      comptesN: [...brutN.comptes, ...amortN.comptes],
    }
  }

  // Actif Immobilisé
  const AD = ligneActif('AD', 'IMMOBILISATIONS INCORPORELLES', 'Note 3A', /^21/, /^281|^291/)
  const AI = ligneActif('AI', 'IMMOBILISATIONS CORPORELLES', 'Note 3A', /^22|^23|^24|^25/, /^282|^283|^284|^292|^293|^294|^295/)
  const AQ = ligneActif('AQ', 'IMMOBILISATIONS FINANCIÈRES', 'Note 4', /^26|^27/, /^296|^297/)

  const totalActifImmo: PosteBilanActif = {
    ref: 'AZ',
    libelle: 'TOTAL ACTIF IMMOBILISÉ',
    note: 'Note 3',
    brutN: AD.brutN + AI.brutN + AQ.brutN,
    amortN: AD.amortN + AI.amortN + AQ.amortN,
    netN: AD.netN + AI.netN + AQ.netN,
    netN1: AD.netN1 + AI.netN1 + AQ.netN1,
    estTotal: true,
  }

  // Actif Circulant
  const BA = ligneActif('BA', 'ACTIF CIRCULANT HAO', 'Note 5', /^485/, /^498/)
  const BB = ligneActif('BB', 'STOCKS ET EN-COURS', 'Note 6', /^3[1-8]/, /^39/)

  // Créances et emplois assimilés
  const BH = ligneActif('BH', 'Fournisseurs avances versées', 'Note 17', /^409/, /^490/)
  const BI = ligneActif('BI', 'Clients et comptes rattachés', 'Note 7', /^41[1-8]/, /^491/)

  // Autres créances : soldes débiteurs de personnel, État, associés, débiteurs divers
  const debiteursAutresCreancesN = [...balanceCumulN.values()].filter(
    (l) => (/^4[234]/.test(l.numero) && l.solde > 0) || /^4[56]/.test(l.numero) || /^47[1-7]/.test(l.numero)
  )
  const debiteursAutresCreancesN1 = [...balanceCumulN1.values()].filter(
    (l) => (/^4[234]/.test(l.numero) && l.solde > 0) || /^4[56]/.test(l.numero) || /^47[1-7]/.test(l.numero)
  )
  const bjBrutN = debiteursAutresCreancesN.reduce((s, l) => s + l.solde, 0)
  const bjBrutN1 = debiteursAutresCreancesN1.reduce((s, l) => s + l.solde, 0)
  const bjAmortN = Math.abs(getSolde(balanceCumulN, /^49[2-7]/).total)
  const bjAmortN1 = Math.abs(getSolde(balanceCumulN1, /^49[2-7]/).total)

  const BJ: PosteBilanActif = {
    ref: 'BJ',
    libelle: 'Autres créances',
    note: 'Note 8',
    brutN: bjBrutN,
    amortN: bjAmortN,
    netN: bjBrutN - bjAmortN,
    netN1: bjBrutN1 - bjAmortN1,
    comptesN: debiteursAutresCreancesN.map((c) => ({ numero: c.numero, libelle: c.libelle, solde: c.solde })),
  }

  const BG: PosteBilanActif = {
    ref: 'BG',
    libelle: 'CRÉANCES ET EMPLOIS ASSIMILÉS',
    note: 'Note 7',
    brutN: BH.brutN + BI.brutN + BJ.brutN,
    amortN: BH.amortN + BI.amortN + BJ.amortN,
    netN: BH.netN + BI.netN + BJ.netN,
    netN1: BH.netN1 + BI.netN1 + BJ.netN1,
  }

  const totalActifCirculant: PosteBilanActif = {
    ref: 'BK',
    libelle: 'TOTAL ACTIF CIRCULANT',
    note: '',
    brutN: BA.brutN + BB.brutN + BG.brutN,
    amortN: BA.amortN + BB.amortN + BG.amortN,
    netN: BA.netN + BB.netN + BG.netN,
    netN1: BA.netN1 + BB.netN1 + BG.netN1,
    estTotal: true,
  }

  // Trésorerie Actif
  const BQ = ligneActif('BQ', 'Titres de placement', 'Note 9', /^50/, /^590/)
  const BR = ligneActif('BR', 'Valeurs à encaisser', 'Note 10', /^51/, /^591/)

  // Disponibilités : comptes 52 (soldes débiteurs), 53, 54, 55, 57, 58 (débiteurs)
  const debiteursTresoN = [...balanceCumulN.values()].filter(
    (l) => /^5[234578]/.test(l.numero) && l.solde > 0
  )
  const debiteursTresoN1 = [...balanceCumulN1.values()].filter(
    (l) => /^5[234578]/.test(l.numero) && l.solde > 0
  )
  const bsN = debiteursTresoN.reduce((s, l) => s + l.solde, 0)
  const bsN1 = debiteursTresoN1.reduce((s, l) => s + l.solde, 0)
  const BS: PosteBilanActif = {
    ref: 'BS',
    libelle: 'Disponibilités (Banques, caisse, monnaie électronique)',
    note: 'Note 11',
    brutN: bsN,
    amortN: 0,
    netN: bsN,
    netN1: bsN1,
    comptesN: debiteursTresoN.map((c) => ({ numero: c.numero, libelle: c.libelle, solde: c.solde })),
  }

  const totalTresoActif: PosteBilanActif = {
    ref: 'BT',
    libelle: 'TOTAL TRÉSORERIE ACTIF',
    note: 'Note 11',
    brutN: BQ.brutN + BR.brutN + BS.brutN,
    amortN: BQ.amortN + BR.amortN + BS.amortN,
    netN: BQ.netN + BR.netN + BS.netN,
    netN1: BQ.netN1 + BR.netN1 + BS.netN1,
    estTotal: true,
  }

  // Écart de conversion Actif
  const BU = ligneActif('BU', 'Écarts de conversion - Actif', 'Note 12', /^478/, /^4978/)

  // TOTAL GÉNÉRAL ACTIF (BZ)
  const totalActifN = {
    brut: totalActifImmo.brutN + totalActifCirculant.brutN + totalTresoActif.brutN + BU.brutN,
    amort: totalActifImmo.amortN + totalActifCirculant.amortN + totalTresoActif.amortN + BU.amortN,
    net: totalActifImmo.netN + totalActifCirculant.netN + totalTresoActif.netN + BU.netN,
  }
  const totalActifN1 = {
    net: totalActifImmo.netN1 + totalActifCirculant.netN1 + totalTresoActif.netN1 + BU.netN1,
  }

  const bilanActif: PosteBilanActif[] = [
    AD,
    AI,
    AQ,
    totalActifImmo,
    BA,
    BB,
    BG,
    BH,
    BI,
    BJ,
    totalActifCirculant,
    BQ,
    BR,
    BS,
    totalTresoActif,
    BU,
    {
      ref: 'BZ',
      libelle: 'TOTAL GÉNÉRAL ACTIF',
      note: '',
      brutN: totalActifN.brut,
      amortN: totalActifN.amort,
      netN: totalActifN.net,
      netN1: totalActifN1.net,
      estTotal: true,
    },
  ]

  // =========================================================================
  // 3. BILAN PASSIF (SYSCOHADA SYSTÈME NORMAL)
  // =========================================================================

  function lignePassif(
    ref: string,
    libelle: string,
    note: string,
    pattern: RegExp,
    multiplicateur = -1
  ): PosteBilanPassif {
    const sN = getSolde(balanceCumulN, pattern)
    const sN1 = getSolde(balanceCumulN1, pattern)
    const netN = sN.total * multiplicateur
    const netN1 = sN1.total * multiplicateur
    return {
      ref,
      libelle,
      note,
      netN,
      netN1,
      comptesN: sN.comptes,
    }
  }

  // Capitaux Propres
  const CA = lignePassif('CA', 'Capital', 'Note 13', /^10[1-4]/)
  const CB = lignePassif('CB', 'Actionnaires capital non appelé', 'Note 13', /^109/, 1)
  const CD = lignePassif('CD', 'Primes d’apport, d’émission, de fusion', 'Note 14', /^105/)
  const CE = lignePassif('CE', 'Écarts de réévaluation', 'Note 3E', /^106/)
  const CF = lignePassif('CF', 'Réserves indisponibles et libres', 'Note 14', /^11/)

  // Report à nouveau : compte 12 (121 créditeur - 129 débiteur)
  const s121_N = getSolde(balanceCumulN, /^121/)
  const s129_N = getSolde(balanceCumulN, /^129/)
  const s121_N1 = getSolde(balanceCumulN1, /^121/)
  const s129_N1 = getSolde(balanceCumulN1, /^129/)

  // Si l'entreprise cumule les résultats antérieurs non affectés
  const resultatsAnterieursN = -toutesLignes
    .filter((l) => l.exercice_id !== exerciceCourant.id && idsCumulN.has(l.exercice_id) && l.classe >= 6)
    .reduce((s, l) => s + Number(l.solde), 0)
  const resultatsAnterieursN1 = exercicePrecedent
    ? -toutesLignes
      .filter((l) => l.exercice_id !== exercicePrecedent.id && idsCumulN1.has(l.exercice_id) && l.classe >= 6)
      .reduce((s, l) => s + Number(l.solde), 0)
    : 0

  const s130_N = getSolde(balanceCumulN, /^130/)
  const s130_N1 = getSolde(balanceCumulN1, /^130/)

  const CG_Report = -(s121_N.total + s129_N.total) + (balanceCumulN.has('129') ? 0 : resultatsAnterieursN)
  const CG_Report1 = -(s121_N1.total + s129_N1.total) + (balanceCumulN1.has('129') ? 0 : resultatsAnterieursN1)

  const CG: PosteBilanPassif = {
    ref: 'CG',
    libelle: 'Report à nouveau (+ ou −)',
    note: 'Note 14',
    netN: CG_Report,
    netN1: CG_Report1,
    comptesN: [...s121_N.comptes, ...s129_N.comptes],
  }

  const InstanceAffectation: PosteBilanPassif = {
    ref: '130',
    libelle: 'Résultat en instance d’affectation',
    note: '',
    netN: -s130_N.total,
    netN1: -s130_N1.total,
    comptesN: s130_N.comptes,
  }

  const CH: PosteBilanPassif = {
    ref: 'CH',
    libelle: 'Résultat net de l’exercice (+ ou −)',
    note: 'Note 34',
    netN: RN_N_Total,
    netN1: RN_N1_Total,
  }

  const CJ = lignePassif('CJ', 'Subventions d’investissement', 'Note 15A', /^14/)
  const CK = lignePassif('CK', 'Provisions et fonds réglementés', 'Note 15A', /^15/)

  const totalCapitauxPropres: PosteBilanPassif = {
    ref: 'CP',
    libelle: 'TOTAL CAPITAUX PROPRES ET RESSOURCES ASSIMILÉES',
    note: '',
    netN: CA.netN + CB.netN + CD.netN + CE.netN + CF.netN + CG.netN + InstanceAffectation.netN + CH.netN + CJ.netN + CK.netN,
    netN1: CA.netN1 + CB.netN1 + CD.netN1 + CE.netN1 + CF.netN1 + CG.netN1 + InstanceAffectation.netN1 + CH.netN1 + CK.netN1,
    estTotal: true,
  }

  // Dettes financières
  const DA = lignePassif('DA', 'Emprunts et dettes financières', 'Note 16A', /^16|^18/)
  const DB = lignePassif('DB', 'Dettes de crédit-bail et contrats assimilés', 'Note 16A', /^17/)
  const DC = lignePassif('DC', 'Provisions financières pour risques et charges', 'Note 16A', /^19/)

  const totalDettesFinancieres: PosteBilanPassif = {
    ref: 'DD',
    libelle: 'TOTAL DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES',
    note: 'Note 16A',
    netN: DA.netN + DB.netN + DC.netN,
    netN1: DA.netN1 + DB.netN1 + DC.netN1,
    estTotal: true,
  }

  const totalRessourcesStables: PosteBilanPassif = {
    ref: 'DF',
    libelle: 'TOTAL RESSOURCES STABLES (CP + DD)',
    note: '',
    netN: totalCapitauxPropres.netN + totalDettesFinancieres.netN,
    netN1: totalCapitauxPropres.netN1 + totalDettesFinancieres.netN1,
    estTotal: true,
  }

  // Passif Circulant
  const DH = lignePassif('DH', 'Dettes circulantes HAO', 'Note 5', /^48[1-4]/)
  const DI = lignePassif('DI', 'Clients, avances reçues', 'Note 7', /^419/)
  const DJ = lignePassif('DJ', 'Fournisseurs d’exploitation', 'Note 17', /^40[1-8]/)

  // Dettes fiscales et sociales : soldes créditeurs de 42, 43, 44
  const crediteursDettesFiscalesN = [...balanceCumulN.values()].filter(
    (l) => /^4[234]/.test(l.numero) && l.solde < 0
  )
  const crediteursDettesFiscalesN1 = [...balanceCumulN1.values()].filter(
    (l) => /^4[234]/.test(l.numero) && l.solde < 0
  )
  const dkN = crediteursDettesFiscalesN.reduce((s, l) => s - l.solde, 0)
  const dkN1 = crediteursDettesFiscalesN1.reduce((s, l) => s - l.solde, 0)

  const DK: PosteBilanPassif = {
    ref: 'DK',
    libelle: 'Dettes fiscales et sociales',
    note: 'Note 18',
    netN: dkN,
    netN1: dkN1,
    comptesN: crediteursDettesFiscalesN.map((c) => ({ numero: c.numero, libelle: c.libelle, solde: -c.solde })),
  }

  // Autres dettes : soldes créditeurs de 45, 46, 47
  const crediteursAutresN = [...balanceCumulN.values()].filter(
    (l) => /^4[567]/.test(l.numero) && l.solde < 0
  )
  const crediteursAutresN1 = [...balanceCumulN1.values()].filter(
    (l) => /^4[567]/.test(l.numero) && l.solde < 0
  )
  const dmN = crediteursAutresN.reduce((s, l) => s - l.solde, 0)
  const dmN1 = crediteursAutresN1.reduce((s, l) => s - l.solde, 0)

  const DM: PosteBilanPassif = {
    ref: 'DM',
    libelle: 'Autres dettes',
    note: 'Note 19',
    netN: dmN,
    netN1: dmN1,
    comptesN: crediteursAutresN.map((c) => ({ numero: c.numero, libelle: c.libelle, solde: -c.solde })),
  }

  const DN = lignePassif('DN', 'Risques provisionnés', 'Note 19', /^499/)

  const totalPassifCirculant: PosteBilanPassif = {
    ref: 'DP',
    libelle: 'TOTAL PASSIF CIRCULANT',
    note: '',
    netN: DH.netN + DI.netN + DJ.netN + DK.netN + DM.netN + DN.netN,
    netN1: DH.netN1 + DI.netN1 + DJ.netN1 + DK.netN1 + DM.netN1 + DN.netN1,
    estTotal: true,
  }

  // Trésorerie Passif : crédits de trésorerie (56) et découverts (soldes créditeurs 52, 53)
  const crediteursTresoN = [...balanceCumulN.values()].filter(
    (l) => (/^56/.test(l.numero) || /^5[234578]/.test(l.numero)) && l.solde < 0
  )
  const crediteursTresoN1 = [...balanceCumulN1.values()].filter(
    (l) => (/^56/.test(l.numero) || /^5[234578]/.test(l.numero)) && l.solde < 0
  )
  const dtN = crediteursTresoN.reduce((s, l) => s - l.solde, 0)
  const dtN1 = crediteursTresoN1.reduce((s, l) => s - l.solde, 0)

  const DR: PosteBilanPassif = {
    ref: 'DR',
    libelle: 'Banques, crédits d’escompte et découvert',
    note: 'Note 20',
    netN: dtN,
    netN1: dtN1,
    comptesN: crediteursTresoN.map((c) => ({ numero: c.numero, libelle: c.libelle, solde: -c.solde })),
  }

  const totalTresoPassif: PosteBilanPassif = {
    ref: 'DT',
    libelle: 'TOTAL TRÉSORERIE PASSIF',
    note: 'Note 20',
    netN: DR.netN,
    netN1: DR.netN1,
    estTotal: true,
  }

  // Écart de conversion Passif
  const DV = lignePassif('DV', 'Écarts de conversion - Passif', 'Note 12', /^479/)

  const totalPassifN = totalRessourcesStables.netN + totalPassifCirculant.netN + totalTresoPassif.netN + DV.netN
  const totalPassifN1 = totalRessourcesStables.netN1 + totalPassifCirculant.netN1 + totalTresoPassif.netN1 + DV.netN1

  const bilanPassif: PosteBilanPassif[] = [
    CA,
    CB,
    CD,
    CE,
    CF,
    CG,
    InstanceAffectation,
    CH,
    CJ,
    CK,
    totalCapitauxPropres,
    DA,
    DB,
    DC,
    totalDettesFinancieres,
    totalRessourcesStables,
    DH,
    DI,
    DJ,
    DK,
    DM,
    DN,
    totalPassifCirculant,
    DR,
    totalTresoPassif,
    DV,
    {
      ref: 'DZ',
      libelle: 'TOTAL GÉNÉRAL PASSIF',
      note: '',
      netN: totalPassifN,
      netN1: totalPassifN1,
      estTotal: true,
    },
  ]

  // =========================================================================
  // 4. TABLEAU DES FLUX DE TRÉSORERIE (TFT SYSCOHADA)
  // =========================================================================

  // Trésorerie nette d'ouverture et de clôture
  const tresoNetteCloture = totalTresoActif.netN - totalTresoPassif.netN
  const tresoNetteOuverture = totalTresoActif.netN1 - totalTresoPassif.netN1
  const variationTresorerieNette = tresoNetteCloture - tresoNetteOuverture

  // CAFG (Capacité d'Autofinancement Globale)
  // CAFG = EBE + 654 - 754 + Revenus fin. - Charges fin. + Produits HAO - Charges HAO - Impôts
  const cafgN = EBE_N + TK_N.total + TL_N_Fin.total - RM_N.total + TN_N.total + TO_N.total - (RO_N.total + RP_N_HAO.total) - RQ_N_Part.total - RS_N_Impots.total
  const cafgN1 = EBE_N1 + TK_N1.total + TL_N1_Fin.total - RM_N1.total + TN_N1.total + TO_N1.total - (RO_N1.total + RP_N1_HAO.total) - RQ_N1_Part.total - RS_N1_Impots.total

  // Variation du BFR lié aux activités opérationnelles
  // FB: Variation Actif HAO
  const deltaActifHAO_N = BA.netN - BA.netN1
  const deltaActifHAO_N1 = 0

  // FC: Variation stocks
  const deltaStocks_N = BB.netN - BB.netN1
  const deltaStocks_N1 = 0

  // FD: Variation créances
  const deltaCreances_N = BG.netN - BG.netN1
  const deltaCreances_N1 = 0

  // FE: Variation passif circulant (ressource = +)
  const deltaPassifCirculant_N = totalPassifCirculant.netN - totalPassifCirculant.netN1
  const deltaPassifCirculant_N1 = 0

  const variationBFR_N = -deltaActifHAO_N - deltaStocks_N - deltaCreances_N + deltaPassifCirculant_N
  const variationBFR_N1 = 0

  // Flux de trésorerie provenant des activités opérationnelles (ZB)
  const fluxOperationnel_N = cafgN + variationBFR_N
  const fluxOperationnel_N1 = cafgN1 + variationBFR_N1

  // Flux d'investissement (ZC)
  // Acquisitions d'immobilisations (décaissements négatifs)
  const decaissementsIncorp_N = -Math.max(0, AD.brutN - AD.netN1)
  const decaissementsCorp_N = -Math.max(0, AI.brutN - AI.netN1)
  const decaissementsFin_N = -Math.max(0, AQ.brutN - AQ.netN1)
  const encaissementsCessions_N = TN_N.total

  const fluxInvestissement_N = decaissementsIncorp_N + decaissementsCorp_N + decaissementsFin_N + encaissementsCessions_N
  const fluxInvestissement_N1 = 0

  // Flux de financement (ZF)
  // Capitaux propres (ZD)
  const deltaCapital_N = Math.max(0, CA.netN - CA.netN1)
  const deltaSubvInvest_N = Math.max(0, CJ.netN - CJ.netN1)
  const distributionsDividendes_N = 0
  const fluxCapitauxPropres_N = deltaCapital_N + deltaSubvInvest_N - distributionsDividendes_N

  // Capitaux étrangers (ZE)
  const deltaEmprunts_N = DA.netN - DA.netN1
  const deltaAutresDettesFin_N = DB.netN - DB.netN1 + (DC.netN - DC.netN1)
  const fluxCapitauxEtrangers_N = deltaEmprunts_N + deltaAutresDettesFin_N

  const fluxFinancement_N = fluxCapitauxPropres_N + fluxCapitauxEtrangers_N
  const fluxFinancement_N1 = 0

  const variationTotaleFlux_N = fluxOperationnel_N + fluxInvestissement_N + fluxFinancement_N
  const variationTotaleFlux_N1 = 0

  const ecartBouclageTFT = variationTotaleFlux_N - variationTresorerieNette

  const tft: LigneTFT[] = [
    { ref: 'ZA', libelle: 'Trésorerie nette au 1er Janvier (Tréso Actif N-1 − Tréso Passif N-1)', montantN: tresoNetteOuverture, montantN1: 0, type: 'total' },

    // Flux opérationnel
    { ref: 'FA', libelle: 'Capacité d’Autofinancement Globale (CAFG)', note: 'Note 34', montantN: cafgN, montantN1: cafgN1, type: 'rubrique' },
    { ref: 'FB', libelle: '− Variation de l’actif circulant HAO', note: 'Note 5', montantN: -deltaActifHAO_N, montantN1: -deltaActifHAO_N1, type: 'rubrique' },
    { ref: 'FC', libelle: '− Variation des stocks', note: 'Note 6', montantN: -deltaStocks_N, montantN1: -deltaStocks_N1, type: 'rubrique' },
    { ref: 'FD', libelle: '− Variation des créances et emplois assimilés', note: 'Note 7', montantN: -deltaCreances_N, montantN1: -deltaCreances_N1, type: 'rubrique' },
    { ref: 'FE', libelle: '+ Variation du passif circulant', note: 'Note 17', montantN: deltaPassifCirculant_N, montantN1: deltaPassifCirculant_N1, type: 'rubrique' },
    { ref: 'BFR', libelle: 'Variation du BFG lié aux activités opérationnelles (FB + FC + FD + FE)', note: 'Note 34', montantN: variationBFR_N, montantN1: variationBFR_N1, type: 'sous_total' },
    { ref: 'ZB', libelle: 'FLUX DE TRÉSORERIE DES ACTIVITÉS OPÉRATIONNELLES (FA à FE)', note: '', montantN: fluxOperationnel_N, montantN1: fluxOperationnel_N1, type: 'total' },

    // Flux investissement
    { ref: 'FF', libelle: '− Décaissements liés aux acquisitions d’immobilisations incorporelles', note: 'Note 3A', montantN: decaissementsIncorp_N, montantN1: 0, type: 'rubrique' },
    { ref: 'FG', libelle: '− Décaissements liés aux acquisitions d’immobilisations corporelles', note: 'Note 3A', montantN: decaissementsCorp_N, montantN1: 0, type: 'rubrique' },
    { ref: 'FH', libelle: '− Décaissements liés aux acquisitions d’immobilisations financières', note: 'Note 4', montantN: decaissementsFin_N, montantN1: 0, type: 'rubrique' },
    { ref: 'FI', libelle: '+ Encaissements liés aux cessions d’immobilisations', note: 'Note 3D', montantN: encaissementsCessions_N, montantN1: 0, type: 'rubrique' },
    { ref: 'ZC', libelle: 'FLUX DE TRÉSORERIE DES OPÉRATIONS D’INVESTISSEMENT (FF à FI)', note: '', montantN: fluxInvestissement_N, montantN1: fluxInvestissement_N1, type: 'total' },

    // Flux financement
    { ref: 'FK', libelle: '+ Augmentation de capital par apports nouveaux', note: 'Note 13', montantN: deltaCapital_N, montantN1: 0, type: 'rubrique' },
    { ref: 'FL', libelle: '+ Subventions d’investissement', note: 'Note 15A', montantN: deltaSubvInvest_N, montantN1: 0, type: 'rubrique' },
    { ref: 'FN', libelle: '− Distributions de dividendes', note: 'Note 31', montantN: -distributionsDividendes_N, montantN1: 0, type: 'rubrique' },
    { ref: 'ZD', libelle: 'Flux de trésorerie capitaux propres (FK à FN)', note: '', montantN: fluxCapitauxPropres_N, montantN1: 0, type: 'sous_total' },

    { ref: 'FO', libelle: '+ Emprunts', note: 'Note 16A', montantN: Math.max(0, deltaEmprunts_N), montantN1: 0, type: 'rubrique' },
    { ref: 'FP', libelle: '+ Autres dettes financières', note: 'Note 16A', montantN: Math.max(0, deltaAutresDettesFin_N), montantN1: 0, type: 'rubrique' },
    { ref: 'FQ', libelle: '− Remboursements des emprunts et autres dettes', note: 'Note 16A', montantN: Math.min(0, deltaEmprunts_N + deltaAutresDettesFin_N), montantN1: 0, type: 'rubrique' },
    { ref: 'ZE', libelle: 'Flux de capitaux étrangers (FO à FQ)', note: '', montantN: fluxCapitauxEtrangers_N, montantN1: 0, type: 'sous_total' },
    { ref: 'ZF', libelle: 'FLUX DE TRÉSORERIE DES ACTIVITÉS DE FINANCEMENT (ZD + ZE)', note: '', montantN: fluxFinancement_N, montantN1: fluxFinancement_N1, type: 'total' },

    // Bouclage
    { ref: 'ZG', libelle: 'VARIATION DE LA TRÉSORERIE NETTE DE LA PÉRIODE (ZB + ZC + ZF)', note: '', montantN: variationTotaleFlux_N, montantN1: variationTotaleFlux_N1, type: 'total' },
    { ref: 'ZH', libelle: 'Trésorerie nette au 31 Décembre (ZA + ZG)', note: '', montantN: tresoNetteCloture, montantN1: tresoNetteOuverture, type: 'total' },
    { ref: 'CTRL', libelle: 'Contrôle : Trésorerie Actif − Trésorerie Passif (Écart = 0)', note: '', montantN: ecartBouclageTFT, montantN1: 0, type: 'rubrique' },
  ]

  // =========================================================================
  // 5. NOTE 34 : FICHE DE SYNTHÈSE DES PRINCIPAUX INDICATEURS FINANCIERS
  // =========================================================================

  const ressourcesStablesN = totalRessourcesStables.netN
  const ressourcesStablesN1 = totalRessourcesStables.netN1
  const actifImmoN = totalActifImmo.netN
  const actifImmoN1 = totalActifImmo.netN1

  const fondsRoulementN = ressourcesStablesN - actifImmoN
  const fondsRoulementN1 = ressourcesStablesN1 - actifImmoN1

  const actifCirculantExploitationN = BB.netN + BG.netN
  const actifCirculantExploitationN1 = BB.netN1 + BG.netN1

  const passifCirculantExploitationN = DI.netN + DJ.netN + DK.netN + DM.netN + DN.netN
  const passifCirculantExploitationN1 = DI.netN1 + DJ.netN1 + DK.netN1 + DM.netN1 + DN.netN1

  const bfeN = actifCirculantExploitationN - passifCirculantExploitationN
  const bfeN1 = actifCirculantExploitationN1 - passifCirculantExploitationN1

  const bfHaoN = BA.netN - DH.netN
  const bfHaoN1 = BA.netN1 - DH.netN1

  const bfgN = bfeN + bfHaoN
  const bfgN1 = bfeN1 + bfHaoN1

  const tresorerieCalculeeN = fondsRoulementN - bfgN
  const tresorerieCalculeeN1 = fondsRoulementN1 - bfgN1

  const rentabiliteEcoN = totalCapitauxPropres.netN + totalDettesFinancieres.netN !== 0
    ? (REX_N / (totalCapitauxPropres.netN + totalDettesFinancieres.netN)) * 100
    : 0
  const rentabiliteEcoN1 = totalCapitauxPropres.netN1 + totalDettesFinancieres.netN1 !== 0
    ? (REX_N1 / (totalCapitauxPropres.netN1 + totalDettesFinancieres.netN1)) * 100
    : 0

  const rentabiliteFinN = totalCapitauxPropres.netN !== 0
    ? (RN_N_Total / totalCapitauxPropres.netN) * 100
    : 0
  const rentabiliteFinN1 = totalCapitauxPropres.netN1 !== 0
    ? (RN_N1_Total / totalCapitauxPropres.netN1) * 100
    : 0

  const endettementBrutN = totalDettesFinancieres.netN + totalTresoPassif.netN
  const endettementBrutN1 = totalDettesFinancieres.netN1 + totalTresoPassif.netN1
  const endettementNetN = endettementBrutN - totalTresoActif.netN
  const endettementNetN1 = endettementBrutN1 - totalTresoActif.netN1

  const indicateurs: LigneIndicateur[] = [
    { code: 'SIG', libelle: 'I. SOLDES INTERMÉDIAIRES DE GESTION (SIG)', montantN: '', montantN1: '', type: 'titre' },
    { code: 'CA', libelle: 'Chiffre d’Affaires Hors Taxes', montantN: CA_N, montantN1: CA_N1, unite: 'F CFA' },
    { code: 'MC', libelle: 'Marge Commerciale', montantN: MargeComm_N, montantN1: MargeComm_N1, unite: 'F CFA' },
    { code: 'VA', libelle: 'Valeur Ajoutée (VA)', montantN: VA_N, montantN1: VA_N1, unite: 'F CFA' },
    { code: 'EBE', libelle: 'Excédent Brut d’Exploitation (EBE)', montantN: EBE_N, montantN1: EBE_N1, unite: 'F CFA' },
    { code: 'REX', libelle: 'Résultat d’Exploitation (RE)', montantN: REX_N, montantN1: REX_N1, unite: 'F CFA' },
    { code: 'RF', libelle: 'Résultat Financier (RF)', montantN: RF_N, montantN1: RF_N1, unite: 'F CFA' },
    { code: 'RAO', libelle: 'Résultat des Activités Ordinaires (RAO)', montantN: RAO_N, montantN1: RAO_N1, unite: 'F CFA' },
    { code: 'RHAO', libelle: 'Résultat Hors Activités Ordinaires (RHAO)', montantN: RHAO_N, montantN1: RHAO_N1, unite: 'F CFA' },
    { code: 'RN', libelle: 'Résultat Net de l’Exercice', montantN: RN_N_Total, montantN1: RN_N1_Total, unite: 'F CFA', type: 'total' },

    { code: 'CAF', libelle: 'II. CAPACITÉ D’AUTOFINANCEMENT (CAF)', montantN: '', montantN1: '', type: 'titre' },
    { code: 'CAFG', libelle: 'Capacité d’Autofinancement Globale (CAFG)', montantN: cafgN, montantN1: cafgN1, unite: 'F CFA' },
    { code: 'DIV', libelle: '− Distributions de dividendes', montantN: distributionsDividendes_N, montantN1: 0, unite: 'F CFA' },
    { code: 'AUTOFIN', libelle: 'Autofinancement Net', montantN: cafgN - distributionsDividendes_N, montantN1: cafgN1, unite: 'F CFA', type: 'sous_total' },

    { code: 'RATIOS', libelle: 'III. RATIOS DE RENTABILITÉ', montantN: '', montantN1: '', type: 'titre' },
    { code: 'RENT_ECO', libelle: 'Rentabilité Économique (REX / Capitaux engagés)', montantN: rentabiliteEcoN.toFixed(2) + ' %', montantN1: rentabiliteEcoN1.toFixed(2) + ' %', unite: '%' },
    { code: 'RENT_FIN', libelle: 'Rentabilité Financière (Résultat Net / Capitaux Propres)', montantN: rentabiliteFinN.toFixed(2) + ' %', montantN1: rentabiliteFinN1.toFixed(2) + ' %', unite: '%' },

    { code: 'STRUC', libelle: 'IV. STRUCTURE FINANCIÈRE & FONDS DE ROULEMENT', montantN: '', montantN1: '', type: 'titre' },
    { code: 'RS', libelle: '+ Ressources Stables (Capitaux Propres + Dettes Fin.)', montantN: ressourcesStablesN, montantN1: ressourcesStablesN1, unite: 'F CFA' },
    { code: 'AI', libelle: '− Actif Immobilisé Net', montantN: -actifImmoN, montantN1: -actifImmoN1, unite: 'F CFA' },
    { code: 'FR', libelle: '= FONDS DE ROULEMENT (FR)', montantN: fondsRoulementN, montantN1: fondsRoulementN1, unite: 'F CFA', type: 'sous_total' },

    { code: 'ACE', libelle: '+ Actif Circulant d’Exploitation (Stocks + Créances)', montantN: actifCirculantExploitationN, montantN1: actifCirculantExploitationN1, unite: 'F CFA' },
    { code: 'PCE', libelle: '− Passif Circulant d’Exploitation (Dettes)', montantN: -passifCirculantExploitationN, montantN1: -passifCirculantExploitationN1, unite: 'F CFA' },
    { code: 'BFE', libelle: '= BESOIN DE FINANCEMENT D’EXPLOITATION (BFE)', montantN: bfeN, montantN1: bfeN1, unite: 'F CFA', type: 'sous_total' },

    { code: 'BF_HAO', libelle: 'Besoin de Financement HAO', montantN: bfHaoN, montantN1: bfHaoN1, unite: 'F CFA' },
    { code: 'BFG', libelle: 'BESOIN DE FINANCEMENT GLOBAL (BFG = BFE + HAO)', montantN: bfgN, montantN1: bfgN1, unite: 'F CFA', type: 'sous_total' },
    { code: 'TN', libelle: 'TRÉSORERIE NETTE (FR − BFG)', montantN: tresorerieCalculeeN, montantN1: tresorerieCalculeeN1, unite: 'F CFA', type: 'total' },
    { code: 'TN_CTRL', libelle: 'Contrôle : Trésorerie Actif − Trésorerie Passif', montantN: tresoNetteCloture, montantN1: tresoNetteOuverture, unite: 'F CFA' },

    { code: 'DETTE', libelle: 'V. ENDETTEMENT FINANCIER NET', montantN: '', montantN1: '', type: 'titre' },
    { code: 'DETTE_BRUT', libelle: 'Endettement Financier Brut (Dettes Fin. + Découverts)', montantN: endettementBrutN, montantN1: endettementBrutN1, unite: 'F CFA' },
    { code: 'TRES_ACT', libelle: '− Trésorerie Actif', montantN: -totalTresoActif.netN, montantN1: -totalTresoActif.netN1, unite: 'F CFA' },
    { code: 'ENDETT_NET', libelle: '= ENDETTEMENT FINANCIER NET', montantN: endettementNetN, montantN1: endettementNetN1, unite: 'F CFA', type: 'total' },
  ]

  // =========================================================================
  // 6. LES 36 NOTES ANNEXÉES (LIASSE COMPLÈTE SYSCOHADA)
  // =========================================================================

  const notesAnnexees: NoteAnnexe[] = [
    {
      id: 'note-1',
      numero: 'NOTE 1',
      nomNote: 'DETTES GARANTIES PAR DES SÛRETÉS RÉELLES',
      statut: 'A',
      items: [
        { intitule: 'Emprunts obligataires convertibles', montantN: 0, montantN1: 0 },
        { intitule: 'Emprunts auprès des établissements de crédit', montantN: DA.netN, montantN1: DA.netN1 },
        { intitule: 'Dettes de crédit-bail', montantN: DB.netN, montantN1: DB.netN1 },
        { intitule: 'Fournisseurs et comptes rattachés', montantN: DJ.netN, montantN1: DJ.netN1 },
        { intitule: 'Dettes fiscales et sociales', montantN: DK.netN, montantN1: DK.netN1 },
        { intitule: 'Total des engagements financiers (Avals, cautions, garanties)', montantN: 0, montantN1: 0 },
      ],
      commentaires: 'Aucun nantissement ou hypothèque grevant les actifs à la clôture de l’exercice.',
    },
    {
      id: 'note-2',
      numero: 'NOTE 2',
      nomNote: 'INFORMATIONS OBLIGATOIRES (MÉTHODES COMPTABLES)',
      statut: 'A',
      items: [
        { intitule: 'Déclaration de conformité SYSCOHADA', montantN: 'Conforme', detail: 'États établis selon le Système Comptable OHADA Révisé.' },
        { intitule: 'Règles et conventions comptables', montantN: 'Prudence & Continuité', detail: 'Respect des principes généraux d’évaluation historique et d’indépendance des exercices.' },
        { intitule: 'Dérogations aux postulats comptables', montantN: 'Néant', detail: 'Aucune dérogation aux règles et conventions du SYSCOHADA.' },
      ],
      commentaires: 'Les méthodes d’évaluation et de présentation sont identiques à celles de l’exercice précédent.',
    },
    {
      id: 'note-3a',
      numero: 'NOTE 3A',
      nomNote: 'IMMOBILISATIONS BRUTES',
      statut: 'A',
      items: [
        { intitule: 'Immobilisations incorporelles (Frais R&D, Brevets, Logiciels)', montantN: AD.brutN, montantN1: AD.netN1 },
        { intitule: 'Terrains (agricoles et agencements)', montantN: getSolde(balanceCumulN, /^22/).total, montantN1: getSolde(balanceCumulN1, /^22/).total },
        { intitule: 'Bâtiments industriels, agricoles et commerciaux', montantN: getSolde(balanceCumulN, /^23/).total, montantN1: getSolde(balanceCumulN1, /^23/).total },
        { intitule: 'Matériel, outillage agricole et commercial', montantN: getSolde(balanceCumulN, /^24[1-4]|^24[6-9]/).total, montantN1: getSolde(balanceCumulN1, /^24[1-4]|^24[6-9]/).total },
        { intitule: 'Matériel de transport', montantN: getSolde(balanceCumulN, /^245/).total, montantN1: getSolde(balanceCumulN1, /^245/).total },
        { intitule: 'Avances et acomptes versés sur immobilisations', montantN: getSolde(balanceCumulN, /^25/).total, montantN1: getSolde(balanceCumulN1, /^25/).total },
        { intitule: 'Immobilisations financières', montantN: AQ.brutN, montantN1: AQ.netN1 },
        { intitule: 'TOTAL GÉNÉRAL IMMOBILISATIONS BRUTES', montantN: totalActifImmo.brutN, montantN1: totalActifImmo.netN1 },
      ],
    },
    {
      id: 'note-3b',
      numero: 'NOTE 3B',
      nomNote: 'BIENS PRIS EN LOCATION-ACQUISITION (CRÉDIT-BAIL)',
      statut: DB.netN > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Crédit-bail immobilier', montantN: 0, montantN1: 0 },
        { intitule: 'Crédit-bail matériel et mobilier', montantN: DB.netN, montantN1: DB.netN1 },
        { intitule: 'Crédit-bail matériel de transport', montantN: 0, montantN1: 0 },
      ],
    },
    {
      id: 'note-3c',
      numero: 'NOTE 3C',
      nomNote: 'AMORTISSEMENTS',
      statut: 'A',
      items: [
        { intitule: 'Amortissements des immobilisations incorporelles', montantN: AD.amortN, montantN1: AD.netN1 },
        { intitule: 'Amortissements des terrains & agencements', montantN: getSolde(balanceCumulN, /^282/).total, montantN1: 0 },
        { intitule: 'Amortissements des bâtiments', montantN: getSolde(balanceCumulN, /^283/).total, montantN1: 0 },
        { intitule: 'Amortissements matériel et outillage', montantN: Math.abs(getSolde(balanceCumulN, /^284[1-4]|^284[6-9]/).total), montantN1: 0 },
        { intitule: 'Amortissements matériel de transport', montantN: Math.abs(getSolde(balanceCumulN, /^2845/).total), montantN1: 0 },
        { intitule: 'TOTAL CUMUL DES AMORTISSEMENTS', montantN: totalActifImmo.amortN, montantN1: 0 },
        { intitule: 'Dotations de l’exercice aux amortissements', montantN: RL_N.total, montantN1: RL_N1.total },
      ],
    },
    {
      id: 'note-3d',
      numero: 'NOTE 3D',
      nomNote: 'PLUS-VALUES ET MOINS-VALUES DE CESSION D’IMMOBILISATIONS',
      statut: TN_N.total > 0 || RO_N.total > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Produits de cession d’immobilisations (compte 82)', montantN: TN_N.total, montantN1: TN_N1.total },
        { intitule: 'Valeurs comptables des immobilisations cédées (compte 81)', montantN: RO_N.total, montantN1: RO_N1.total },
        { intitule: 'Plus-value (+) ou Moins-value (−) nette', montantN: TN_N.total - RO_N.total, montantN1: TN_N1.total - RO_N1.total },
      ],
    },
    {
      id: 'note-3e',
      numero: 'NOTE 3E',
      nomNote: 'INFORMATIONS SUR LES RÉÉVALUATIONS EFFECTUÉES',
      statut: CE.netN !== 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Écart de réévaluation légale ou libre (compte 106)', montantN: CE.netN, montantN1: CE.netN1 },
      ],
    },
    {
      id: 'note-3f',
      numero: 'NOTE 3F',
      nomNote: 'TABLEAU D’ÉTALEMENT DES CHARGES IMMOBILISÉES',
      statut: 'N/A',
      items: [
        { intitule: 'Frais d’établissement & charges à étaler', montantN: 0, montantN1: 0 },
      ],
    },
    {
      id: 'note-4',
      numero: 'NOTE 4',
      nomNote: 'IMMOBILISATIONS FINANCIÈRES',
      statut: AQ.brutN > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Titres de participation (compte 26)', montantN: getSolde(balanceCumulN, /^26/).total, montantN1: 0 },
        { intitule: 'Prêts et créances non commerciales (compte 271)', montantN: getSolde(balanceCumulN, /^271/).total, montantN1: 0 },
        { intitule: 'Dépôts et cautionnements versés (compte 275)', montantN: getSolde(balanceCumulN, /^275/).total, montantN1: 0 },
        { intitule: 'Dépréciations des immobilisations financières', montantN: AQ.amortN, montantN1: 0 },
        { intitule: 'TOTAL NET IMMOBILISATIONS FINANCIÈRES', montantN: AQ.netN, montantN1: AQ.netN1 },
      ],
    },
    {
      id: 'note-5',
      numero: 'NOTE 5',
      nomNote: 'ACTIF CIRCULANT ET PASSIF CIRCULANT H.A.O.',
      statut: BA.netN > 0 || DH.netN > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Créances sur cessions d’immobilisations (compte 485)', montantN: BA.netN, montantN1: BA.netN1 },
        { intitule: 'Fournisseurs d’investissements (compte 481)', montantN: DH.netN, montantN1: DH.netN1 },
      ],
    },
    {
      id: 'note-6',
      numero: 'NOTE 6',
      nomNote: 'STOCKS ET EN-COURS',
      statut: 'A',
      items: [
        { intitule: 'Marchandises (compte 31)', montantN: getSolde(balanceCumulN, /^31/).total, montantN1: getSolde(balanceCumulN1, /^31/).total },
        { intitule: 'Matières premières et fournitures liées (compte 32)', montantN: getSolde(balanceCumulN, /^32/).total, montantN1: getSolde(balanceCumulN1, /^32/).total },
        { intitule: 'Matières consommables et emballages (compte 33)', montantN: getSolde(balanceCumulN, /^33/).total, montantN1: getSolde(balanceCumulN1, /^33/).total },
        { intitule: 'Produits en cours (comptes 34, 35)', montantN: getSolde(balanceCumulN, /^3[45]/).total, montantN1: getSolde(balanceCumulN1, /^3[45]/).total },
        { intitule: 'Produits finis et résiduels (comptes 36, 37)', montantN: getSolde(balanceCumulN, /^3[67]/).total, montantN1: getSolde(balanceCumulN1, /^3[67]/).total },
        { intitule: 'Dépréciations des stocks (compte 39)', montantN: BB.amortN, montantN1: 0 },
        { intitule: 'TOTAL NET DES STOCKS ET EN-COURS', montantN: BB.netN, montantN1: BB.netN1 },
      ],
    },
    {
      id: 'note-7',
      numero: 'NOTE 7',
      nomNote: 'CLIENTS ET COMPTES RATTACHÉS / AVANCES REÇUES',
      statut: 'A',
      items: [
        { intitule: 'Clients ordinaires en compte (compte 411)', montantN: getSolde(balanceCumulN, /^411/).total, montantN1: getSolde(balanceCumulN1, /^411/).total },
        { intitule: 'Clients effets à recevoir (compte 412)', montantN: getSolde(balanceCumulN, /^412/).total, montantN1: 0 },
        { intitule: 'Créances douteuses ou litigieuses (compte 416)', montantN: getSolde(balanceCumulN, /^416/).total, montantN1: 0 },
        { intitule: 'Clients factures à établir (compte 418)', montantN: getSolde(balanceCumulN, /^418/).total, montantN1: 0 },
        { intitule: 'Dépréciations des comptes clients (compte 491)', montantN: BI.amortN, montantN1: 0 },
        { intitule: 'TOTAL NET CRÉANCES CLIENTS', montantN: BI.netN, montantN1: BI.netN1 },
        { intitule: 'Clients, avances et acomptes reçus (compte 419)', montantN: DI.netN, montantN1: DI.netN1 },
      ],
    },
    {
      id: 'note-8',
      numero: 'NOTE 8',
      nomNote: 'AUTRES CRÉANCES',
      statut: 'A',
      items: [
        { intitule: 'Personnel (avances, acomptes, prêts - compte 421)', montantN: Math.max(0, getSolde(balanceCumulN, /^421/).total), montantN1: Math.max(0, getSolde(balanceCumulN1, /^421/).total) },
        { intitule: 'Sécurité sociale & caisses sociales (créances - compte 431)', montantN: Math.max(0, getSolde(balanceCumulN, /^43/).total), montantN1: Math.max(0, getSolde(balanceCumulN1, /^43/).total) },
        { intitule: 'État et collectivités (avances, TVA déductible, acomptes impôts - compte 44)', montantN: Math.max(0, getSolde(balanceCumulN, /^44/).total), montantN1: Math.max(0, getSolde(balanceCumulN1, /^44/).total) },
        { intitule: 'Organismes internationaux (comptes débiteurs - compte 45)', montantN: Math.max(0, getSolde(balanceCumulN, /^45/).total), montantN1: 0 },
        { intitule: 'Débiteurs divers (compte 4711)', montantN: Math.max(0, getSolde(balanceCumulN, /^4711/).total), montantN1: Math.max(0, getSolde(balanceCumulN1, /^4711/).total) },
        { intitule: 'TOTAL AUTRES CRÉANCES BRUTES', montantN: BJ.brutN, montantN1: BJ.netN1 },
        { intitule: 'Dépréciations des autres créances', montantN: BJ.amortN, montantN1: 0 },
        { intitule: 'TOTAL NET AUTRES CRÉANCES', montantN: BJ.netN, montantN1: BJ.netN1 },
      ],
    },
    {
      id: 'note-9',
      numero: 'NOTE 9',
      nomNote: 'TITRES DE PLACEMENT',
      statut: BQ.brutN > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Bons de trésor et de caisse (compte 501)', montantN: getSolde(balanceCumulN, /^501/).total, montantN1: 0 },
        { intitule: 'Actions et titres négociables (compte 502)', montantN: getSolde(balanceCumulN, /^502/).total, montantN1: 0 },
        { intitule: 'Obligations (compte 503)', montantN: getSolde(balanceCumulN, /^503/).total, montantN1: 0 },
        { intitule: 'TOTAL NET TITRES DE PLACEMENT', montantN: BQ.netN, montantN1: BQ.netN1 },
      ],
    },
    {
      id: 'note-10',
      numero: 'NOTE 10',
      nomNote: 'VALEURS À ENCAISSER',
      statut: BR.brutN > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Effets à encaisser et à l’encaissement (comptes 511, 512)', montantN: getSolde(balanceCumulN, /^51[12]/).total, montantN1: 0 },
        { intitule: 'Chèques à encaisser (comptes 513, 514)', montantN: getSolde(balanceCumulN, /^51[34]/).total, montantN1: 0 },
        { intitule: 'TOTAL NET VALEURS À ENCAISSER', montantN: BR.netN, montantN1: BR.netN1 },
      ],
    },
    {
      id: 'note-11',
      numero: 'NOTE 11',
      nomNote: 'DISPONIBILITÉS (TRÉSORERIE ACTIF)',
      statut: 'A',
      items: [
        { intitule: 'Banques locales (soldes débiteurs - compte 5211)', montantN: Math.max(0, getSolde(balanceCumulN, /^5211/).total), montantN1: Math.max(0, getSolde(balanceCumulN1, /^5211/).total) },
        { intitule: 'Comptes monnaie électronique (Wave, Orange Money - compte 551)', montantN: getSolde(balanceCumulN, /^551/).total, montantN1: getSolde(balanceCumulN1, /^551/).total },
        { intitule: 'Caisse centrale et succursales (compte 5711)', montantN: getSolde(balanceCumulN, /^571/).total, montantN1: getSolde(balanceCumulN1, /^571/).total },
        { intitule: 'Régies d’avances et virements de fonds (comptes 581, 585)', montantN: getSolde(balanceCumulN, /^58/).total, montantN1: 0 },
        { intitule: 'TOTAL DISPONIBILITÉS', montantN: BS.netN, montantN1: BS.netN1 },
      ],
    },
    {
      id: 'note-12',
      numero: 'NOTE 12',
      nomNote: 'ÉCARTS DE CONVERSION ET TRANSFERTS DE CHARGES',
      statut: 'A',
      items: [
        { intitule: 'Écarts de conversion - Actif (pertes probables de change - compte 478)', montantN: BU.netN, montantN1: BU.netN1 },
        { intitule: 'Écarts de conversion - Passif (gains probables de change - compte 479)', montantN: DV.netN, montantN1: DV.netN1 },
        { intitule: 'Transferts de charges d’exploitation (compte 781)', montantN: TI_N.total, montantN1: TI_N1.total },
        { intitule: 'Transferts de charges financières (compte 787)', montantN: TL_N_Fin.total, montantN1: TL_N1_Fin.total },
      ],
    },
    {
      id: 'note-13',
      numero: 'NOTE 13',
      nomNote: 'CAPITAL SOCIAL ET ACTIONNAIRES',
      statut: 'A',
      items: [
        { intitule: 'Capital social (compte 101)', montantN: CA.netN, montantN1: CA.netN1 },
        { intitule: 'Actionnaires, capital non appelé (compte 109)', montantN: CB.netN, montantN1: CB.netN1 },
        { intitule: 'Capital libéré', montantN: CA.netN - CB.netN, montantN1: CA.netN1 - CB.netN1 },
      ],
      commentaires: 'Capital souscrit et entièrement libéré par les associés fondateurs.',
    },
    {
      id: 'note-14',
      numero: 'NOTE 14',
      nomNote: 'PRIMES ET RÉSERVES',
      statut: 'A',
      items: [
        { intitule: 'Primes d’émission, d’apport ou de fusion (compte 105)', montantN: CD.netN, montantN1: CD.netN1 },
        { intitule: 'Réserve légale (compte 111)', montantN: getSolde(balanceCumulN, /^111/).total, montantN1: getSolde(balanceCumulN1, /^111/).total },
        { intitule: 'Réserves statutaires ou réglementées (comptes 112, 113)', montantN: getSolde(balanceCumulN, /^11[23]/).total, montantN1: getSolde(balanceCumulN1, /^11[23]/).total },
        { intitule: 'Réserves libres (compte 118)', montantN: getSolde(balanceCumulN, /^118/).total, montantN1: getSolde(balanceCumulN1, /^118/).total },
        { intitule: 'Report à nouveau (compte 12)', montantN: CG.netN, montantN1: CG.netN1 },
      ],
    },
    {
      id: 'note-15a',
      numero: 'NOTE 15A',
      nomNote: 'SUBVENTIONS D’INVESTISSEMENT ET PROVISIONS RÉGLEMENTÉES',
      statut: CJ.netN > 0 || CK.netN > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Subventions d’équipement et investissement (compte 14)', montantN: CJ.netN, montantN1: CJ.netN1 },
        { intitule: 'Amortissements dérogatoires & provisions réglementées (compte 15)', montantN: CK.netN, montantN1: CK.netN1 },
        { intitule: 'Reprises de subventions d’investissement virées au résultat (compte 799)', montantN: getGestion(lignesGestionN, /^799/).total, montantN1: getGestion(lignesGestionN1, /^799/).total },
      ],
    },
    {
      id: 'note-15b',
      numero: 'NOTE 15B',
      nomNote: 'AUTRES FONDS PROPRES',
      statut: 'N/A',
      items: [
        { intitule: 'Titres participatifs et avances conditionnées', montantN: 0, montantN1: 0 },
      ],
    },
    {
      id: 'note-16a',
      numero: 'NOTE 16A',
      nomNote: 'DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES',
      statut: totalDettesFinancieres.netN > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Emprunts obligataires (compte 161)', montantN: getSolde(balanceCumulN, /^161/).total, montantN1: 0 },
        { intitule: 'Emprunts auprès des banques (compte 162)', montantN: getSolde(balanceCumulN, /^162/).total, montantN1: 0 },
        { intitule: 'Dettes de crédit-bail (compte 17)', montantN: DB.netN, montantN1: DB.netN1 },
        { intitule: 'Provisions pour risques et charges durables (compte 19)', montantN: DC.netN, montantN1: DC.netN1 },
        { intitule: 'TOTAL DETTES FINANCIÈRES', montantN: totalDettesFinancieres.netN, montantN1: totalDettesFinancieres.netN1 },
      ],
    },
    {
      id: 'note-16b',
      numero: 'NOTE 16B',
      nomNote: 'ENGAGEMENTS DE RETRAITE (MÉTHODE ACTUARIELLE)',
      statut: 'N/A',
      items: [
        { intitule: 'Valeur actuelle de l’obligation au titre des retraites', montantN: 0, montantN1: 0 },
      ],
    },
    {
      id: 'note-16c',
      numero: 'NOTE 16C',
      nomNote: 'ACTIFS ET PASSIFS ÉVENTUELS',
      statut: 'N/A',
      items: [
        { intitule: 'Litiges en cours ou passifs éventuels', montantN: 0, montantN1: 0 },
      ],
    },
    {
      id: 'note-17',
      numero: 'NOTE 17',
      nomNote: 'FOURNISSEURS D’EXPLOITATION ET AVANCES VERSÉES',
      statut: 'A',
      items: [
        { intitule: 'Fournisseurs dettes en compte (compte 401)', montantN: getSolde(balanceCumulN, /^401/).total < 0 ? -getSolde(balanceCumulN, /^401/).total : 0, montantN1: DJ.netN1 },
        { intitule: 'Fournisseurs effets à payer (compte 402)', montantN: getSolde(balanceCumulN, /^402/).total < 0 ? -getSolde(balanceCumulN, /^402/).total : 0, montantN1: 0 },
        { intitule: 'Fournisseurs factures non parvenues (compte 408)', montantN: getSolde(balanceCumulN, /^408/).total < 0 ? -getSolde(balanceCumulN, /^408/).total : 0, montantN1: 0 },
        { intitule: 'TOTAL FOURNISSEURS D’EXPLOITATION', montantN: DJ.netN, montantN1: DJ.netN1 },
        { intitule: 'Fournisseurs, avances et acomptes versés (compte 409)', montantN: BH.netN, montantN1: BH.netN1 },
      ],
    },
    {
      id: 'note-18',
      numero: 'NOTE 18',
      nomNote: 'DETTES FISCALES ET SOCIALES',
      statut: 'A',
      items: [
        { intitule: 'Personnel, rémunérations dues (compte 422)', montantN: Math.max(0, -getSolde(balanceCumulN, /^422/).total), montantN1: Math.max(0, -getSolde(balanceCumulN1, /^422/).total) },
        { intitule: 'Personnel, assistance médicale & œuvres sociales (compte 424)', montantN: Math.max(0, -getSolde(balanceCumulN, /^424/).total), montantN1: Math.max(0, -getSolde(balanceCumulN1, /^424/).total) },
        { intitule: 'Caisse de sécurité sociale (CSS - compte 431)', montantN: Math.max(0, -getSolde(balanceCumulN, /^431[12]/).total), montantN1: Math.max(0, -getSolde(balanceCumulN1, /^431[12]/).total) },
        { intitule: 'Caisse de retraite IPRES (compte 4313)', montantN: Math.max(0, -getSolde(balanceCumulN, /^4313/).total), montantN1: Math.max(0, -getSolde(balanceCumulN1, /^4313/).total) },
        { intitule: 'État, TVA due (compte 4441)', montantN: Math.max(0, -getSolde(balanceCumulN, /^4441/).total), montantN1: Math.max(0, -getSolde(balanceCumulN1, /^4441/).total) },
        { intitule: 'État, impôts retenus à la source (IR, VRS, TRIMF - compte 447)', montantN: Math.max(0, -getSolde(balanceCumulN, /^447/).total), montantN1: Math.max(0, -getSolde(balanceCumulN1, /^447/).total) },
        { intitule: 'TOTAL DETTES FISCALES ET SOCIALES', montantN: DK.netN, montantN1: DK.netN1 },
      ],
    },
    {
      id: 'note-19',
      numero: 'NOTE 19',
      nomNote: 'AUTRES DETTES ET PROVISIONS POUR RISQUES À COURT TERME',
      statut: 'A',
      items: [
        { intitule: 'Organismes internationaux (opérations de projet - compte 452)', montantN: Math.max(0, -getSolde(balanceCumulN, /^45/).total), montantN1: Math.max(0, -getSolde(balanceCumulN1, /^45/).total) },
        { intitule: 'Associés et groupe, comptes courants (compte 462)', montantN: Math.max(0, -getSolde(balanceCumulN, /^46/).total), montantN1: 0 },
        { intitule: 'Créditeurs divers (compte 4712)', montantN: Math.max(0, -getSolde(balanceCumulN, /^4712/).total), montantN1: 0 },
        { intitule: 'Provisions pour risques à court terme (compte 499)', montantN: DN.netN, montantN1: DN.netN1 },
        { intitule: 'TOTAL AUTRES DETTES DU PASSIF CIRCULANT', montantN: DM.netN, montantN1: DM.netN1 },
      ],
    },
    {
      id: 'note-20',
      numero: 'NOTE 20',
      nomNote: 'BANQUES, CRÉDITS D’ESCOMPTE ET DE TRÉSORERIE (DÉCOUVERTS)',
      statut: DR.netN > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Banques locales débitrices / découverts (compte 5212)', montantN: DR.netN, montantN1: DR.netN1 },
        { intitule: 'Crédits de trésorerie et escompte (compte 56)', montantN: getSolde(balanceCumulN, /^56/).total < 0 ? -getSolde(balanceCumulN, /^56/).total : 0, montantN1: 0 },
        { intitule: 'TOTAL TRÉSORERIE PASSIF', montantN: totalTresoPassif.netN, montantN1: totalTresoPassif.netN1 },
      ],
    },
    {
      id: 'note-21',
      numero: 'NOTE 21',
      nomNote: 'CHIFFRE D’AFFAIRES ET AUTRES PRODUITS D’EXPLOITATION',
      statut: 'A',
      items: [
        { intitule: 'Ventes de marchandises dans la région (compte 701)', montantN: TA_N.total, montantN1: TA_N1.total },
        { intitule: 'Ventes de produits finis et agricoles (compte 702)', montantN: TB_N.total, montantN1: TB_N1.total },
        { intitule: 'Travaux et services vendus (compte 706)', montantN: TC_N.total, montantN1: TC_N1.total },
        { intitule: 'Produits accessoires (ports, bonis - compte 707)', montantN: TD_N.total, montantN1: TD_N1.total },
        { intitule: 'TOTAL DU CHIFFRE D’AFFAIRES HORS TAXES', montantN: CA_N, montantN1: CA_N1 },
        { intitule: 'Subventions d’exploitation (compte 718)', montantN: TG_N.total, montantN1: TG_N1.total },
        { intitule: 'Production immobilisée (compte 72)', montantN: TF_N.total, montantN1: TF_N1.total },
        { intitule: 'Autres produits d’exploitation (compte 758)', montantN: TH_N.total, montantN1: TH_N1.total },
      ],
    },
    {
      id: 'note-22',
      numero: 'NOTE 22',
      nomNote: 'ACHATS CONSOMMÉS',
      statut: 'A',
      items: [
        { intitule: 'Achats de marchandises (compte 601)', montantN: RA_N.total, montantN1: RA_N1.total },
        { intitule: 'Achats de matières premières (compte 602)', montantN: RC_N.total, montantN1: RC_N1.total },
        { intitule: 'Matières combustibles & carburants (compte 6042)', montantN: getGestion(lignesGestionN, /^6042/).total, montantN1: getGestion(lignesGestionN1, /^6042/).total },
        { intitule: 'Fournitures de bureau stockables (compte 6047)', montantN: getGestion(lignesGestionN, /^6047/).total, montantN1: getGestion(lignesGestionN1, /^6047/).total },
        { intitule: 'Eau (compte 6051)', montantN: getGestion(lignesGestionN, /^6051/).total, montantN1: getGestion(lignesGestionN1, /^6051/).total },
        { intitule: 'Électricité (compte 6052)', montantN: getGestion(lignesGestionN, /^6052/).total, montantN1: getGestion(lignesGestionN1, /^6052/).total },
        { intitule: 'Autres énergies non stockables (compte 6053)', montantN: getGestion(lignesGestionN, /^6053/).total, montantN1: getGestion(lignesGestionN1, /^6053/).total },
        { intitule: 'Petit matériel et outillage (compte 6056)', montantN: getGestion(lignesGestionN, /^6056/).total, montantN1: getGestion(lignesGestionN1, /^6056/).total },
        { intitule: 'Achats d’études et prestations de service (compte 6057)', montantN: getGestion(lignesGestionN, /^6057/).total, montantN1: getGestion(lignesGestionN1, /^6057/).total },
        { intitule: 'Achats de travaux, matériels et équipements (compte 6058)', montantN: getGestion(lignesGestionN, /^6058/).total, montantN1: getGestion(lignesGestionN1, /^6058/).total },
        { intitule: 'TOTAL DES AUTRES ACHATS (compte 604, 605)', montantN: RE_N.total, montantN1: RE_N1.total },
      ],
    },
    {
      id: 'note-23',
      numero: 'NOTE 23',
      nomNote: 'TRANSPORTS',
      statut: ChargeTransport_N.total > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Transports du personnel (compte 614)', montantN: getGestion(lignesGestionN, /^614/).total, montantN1: getGestion(lignesGestionN1, /^614/).total },
        { intitule: 'Transports de plis et colis (compte 616)', montantN: getGestion(lignesGestionN, /^616/).total, montantN1: getGestion(lignesGestionN1, /^616/).total },
        { intitule: 'Voyages et déplacements professionnels (compte 6181)', montantN: getGestion(lignesGestionN, /^6181/).total, montantN1: getGestion(lignesGestionN1, /^6181/).total },
        { intitule: 'TOTAL CHARGES DE TRANSPORT', montantN: ChargeTransport_N.total, montantN1: ChargeTransport_N1.total },
      ],
    },
    {
      id: 'note-24',
      numero: 'NOTE 24',
      nomNote: 'SERVICES EXTÉRIEURS',
      statut: 'A',
      items: [
        { intitule: 'Locations immobilières et charges locatives (compte 6222)', montantN: getGestion(lignesGestionN, /^6222/).total, montantN1: getGestion(lignesGestionN1, /^6222/).total },
        { intitule: 'Locations de matériels et outillages (compte 6223)', montantN: getGestion(lignesGestionN, /^6223/).total, montantN1: getGestion(lignesGestionN1, /^6223/).total },
        { intitule: 'Entretien, réparations des biens mobiliers (compte 6242)', montantN: getGestion(lignesGestionN, /^6242/).total, montantN1: getGestion(lignesGestionN1, /^6242/).total },
        { intitule: 'Assurances véhicules et multirisques (compte 6252)', montantN: getGestion(lignesGestionN, /^625/).total, montantN1: getGestion(lignesGestionN1, /^625/).total },
        { intitule: 'Publicité, foires et expositions (compte 627)', montantN: getGestion(lignesGestionN, /^627/).total, montantN1: getGestion(lignesGestionN1, /^627/).total },
        { intitule: 'Frais de téléphone et télécommunications (compte 6281)', montantN: getGestion(lignesGestionN, /^6281/).total, montantN1: getGestion(lignesGestionN1, /^6281/).total },
        { intitule: 'Frais d’internet (compte 6282)', montantN: getGestion(lignesGestionN, /^6282/).total, montantN1: getGestion(lignesGestionN1, /^6282/).total },
        { intitule: 'Frais bancaires et instruments de monnaie électronique (compte 631)', montantN: getGestion(lignesGestionN, /^631/).total, montantN1: getGestion(lignesGestionN1, /^631/).total },
        { intitule: 'Honoraires comptables, juridiques et conseils (compte 6324)', montantN: getGestion(lignesGestionN, /^6324/).total, montantN1: getGestion(lignesGestionN1, /^6324/).total },
        { intitule: 'Rémunérations d’autres prestataires de services (compte 6327)', montantN: getGestion(lignesGestionN, /^6327/).total, montantN1: getGestion(lignesGestionN1, /^6327/).total },
        { intitule: 'Frais de formation du personnel (compte 633)', montantN: getGestion(lignesGestionN, /^633/).total, montantN1: getGestion(lignesGestionN1, /^633/).total },
        { intitule: 'Réceptions et relations publiques (compte 6383)', montantN: getGestion(lignesGestionN, /^6383/).total, montantN1: getGestion(lignesGestionN1, /^6383/).total },
        { intitule: 'Frais de missions (compte 6384)', montantN: getGestion(lignesGestionN, /^6384/).total, montantN1: getGestion(lignesGestionN1, /^6384/).total },
        { intitule: 'TOTAL SERVICES EXTÉRIEURS', montantN: RH_N.total, montantN1: RH_N1.total },
      ],
    },
    {
      id: 'note-25',
      numero: 'NOTE 25',
      nomNote: 'IMPÔTS ET TAXES',
      statut: 'A',
      items: [
        { intitule: 'Patente, licences et taxes annexes (compte 6412)', montantN: getGestion(lignesGestionN, /^6412/).total, montantN1: getGestion(lignesGestionN1, /^6412/).total },
        { intitule: 'Taxes sur appointements et salaires / CFCE (compte 6413)', montantN: getGestion(lignesGestionN, /^6413/).total, montantN1: getGestion(lignesGestionN1, /^6413/).total },
        { intitule: 'Impôts et taxes indirects (compte 645)', montantN: getGestion(lignesGestionN, /^645/).total, montantN1: getGestion(lignesGestionN1, /^645/).total },
        { intitule: 'Droits d’enregistrement et de timbre (compte 646)', montantN: getGestion(lignesGestionN, /^646/).total, montantN1: getGestion(lignesGestionN1, /^646/).total },
        { intitule: 'TOTAL IMPÔTS ET TAXES D’EXPLOITATION', montantN: RI_N.total, montantN1: RI_N1.total },
      ],
    },
    {
      id: 'note-26',
      numero: 'NOTE 26',
      nomNote: 'AUTRES CHARGES D’EXPLOITATION',
      statut: RJ_N.total > 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Pertes sur créances clients irrécouvrables (compte 6511)', montantN: getGestion(lignesGestionN, /^6511/).total, montantN1: 0 },
        { intitule: 'Pertes sur autres débiteurs (compte 6515)', montantN: getGestion(lignesGestionN, /^6515/).total, montantN1: getGestion(lignesGestionN1, /^6515/).total },
        { intitule: 'Jetons de présence et indemnités de fonction (compte 6581)', montantN: getGestion(lignesGestionN, /^6581/).total, montantN1: getGestion(lignesGestionN1, /^6581/).total },
        { intitule: 'TOTAL AUTRES CHARGES D’EXPLOITATION', montantN: RJ_N.total, montantN1: RJ_N1.total },
      ],
    },
    {
      id: 'note-27a',
      numero: 'NOTE 27A',
      nomNote: 'CHARGES DE PERSONNEL',
      statut: 'A',
      items: [
        { intitule: 'Appointements, salaires de base et commissions (compte 6611)', montantN: getGestion(lignesGestionN, /^6611/).total, montantN1: getGestion(lignesGestionN1, /^6611/).total },
        { intitule: 'Primes et gratifications (compte 6612)', montantN: getGestion(lignesGestionN, /^6612/).total, montantN1: getGestion(lignesGestionN1, /^6612/).total },
        { intitule: 'Indemnités de fin de contrat et préavis (compte 6614)', montantN: getGestion(lignesGestionN, /^6614/).total, montantN1: 0 },
        { intitule: 'Primes de transport et indemnités forfaitaires (compte 6634)', montantN: getGestion(lignesGestionN, /^6634/).total, montantN1: getGestion(lignesGestionN1, /^6634/).total },
        { intitule: 'Charges sociales patronales (CSS, IPRES - compte 6641)', montantN: getGestion(lignesGestionN, /^6641/).total, montantN1: getGestion(lignesGestionN1, /^6641/).total },
        { intitule: 'Médecine du travail et pharmacie (compte 6684)', montantN: getGestion(lignesGestionN, /^6684/).total, montantN1: getGestion(lignesGestionN1, /^6684/).total },
        { intitule: 'TOTAL CHARGES DE PERSONNEL', montantN: RK_N.total, montantN1: RK_N1.total },
      ],
    },
    {
      id: 'note-27b',
      numero: 'NOTE 27B',
      nomNote: 'EFFECTIFS, MASSE SALARIALE ET PERSONNEL EXTÉRIEUR',
      statut: 'A',
      items: [
        { intitule: 'Cadres supérieurs et ingénieurs', montantN: '5 personnes', detail: 'Salariés permanents' },
        { intitule: 'Techniciens supérieurs et agents de maîtrise', montantN: '5 personnes', detail: 'Salariés permanents' },
        { intitule: 'Employés, ouvriers et manœuvres', montantN: '2 personnes', detail: 'Salariés permanents' },
        { intitule: 'Total effectif permanent au 31 décembre', montantN: '12 salariés', detail: '10 hommes, 2 femmes' },
      ],
    },
    {
      id: 'note-28',
      numero: 'NOTE 28',
      nomNote: 'PROVISIONS ET DÉPRÉCIATIONS INSCRITES AU BILAN',
      statut: 'A',
      items: [
        { intitule: 'Dépréciations des immobilisations (compte 29)', montantN: totalActifImmo.amortN, montantN1: 0 },
        { intitule: 'Dépréciations des stocks (compte 39)', montantN: BB.amortN, montantN1: 0 },
        { intitule: 'Dépréciations des comptes clients (compte 491)', montantN: BI.amortN, montantN1: 0 },
        { intitule: 'Provisions financières pour risques et charges (compte 19)', montantN: DC.netN, montantN1: 0 },
        { intitule: 'Dotations de l’exercice aux provisions (comptes 691, 697)', montantN: 0, montantN1: 0 },
        { intitule: 'Reprises de provisions (comptes 791, 797)', montantN: 0, montantN1: 0 },
      ],
    },
    {
      id: 'note-29',
      numero: 'NOTE 29',
      nomNote: 'CHARGES ET REVENUS FINANCIERS',
      statut: 'A',
      items: [
        { intitule: 'Intérêts des emprunts et dettes financières (compte 671)', montantN: getGestion(lignesGestionN, /^671/).total, montantN1: 0 },
        { intitule: 'Pertes de change (compte 676)', montantN: getGestion(lignesGestionN, /^676/).total, montantN1: 0 },
        { intitule: 'TOTAL DES FRAIS FINANCIERS', montantN: RM_N.total, montantN1: RM_N1.total },
        { intitule: 'Revenus de titres et intérêts de prêts (compte 771)', montantN: TK_N.total, montantN1: TK_N1.total },
        { intitule: 'Gains de change (compte 776)', montantN: getGestion(lignesGestionN, /^776/).total, montantN1: 0 },
        { intitule: 'Transferts de charges financières (compte 787)', montantN: TL_N_Fin.total, montantN1: 0 },
        { intitule: 'TOTAL DES REVENUS FINANCIERS', montantN: TK_N.total + TL_N_Fin.total, montantN1: TK_N1.total + TL_N1_Fin.total },
        { intitule: 'RÉSULTAT FINANCIER', montantN: RF_N, montantN1: RF_N1 },
      ],
    },
    {
      id: 'note-30',
      numero: 'NOTE 30',
      nomNote: 'AUTRES CHARGES ET PRODUITS HORS ACTIVITÉS ORDINAIRES (H.A.O.)',
      statut: RHAO_N !== 0 ? 'A' : 'N/A',
      items: [
        { intitule: 'Produits de cessions d’immobilisations (compte 82)', montantN: TN_N.total, montantN1: 0 },
        { intitule: 'Valeurs comptables des immobilisations cédées (compte 81)', montantN: RO_N.total, montantN1: 0 },
        { intitule: 'Dons et subventions d’équilibre HAO (comptes 84, 88)', montantN: TO_N.total, montantN1: 0 },
        { intitule: 'Charges HAO constatées (compte 83)', montantN: RP_N_HAO.total, montantN1: 0 },
        { intitule: 'RÉSULTAT HORS ACTIVITÉS ORDINAIRES', montantN: RHAO_N, montantN1: RHAO_N1 },
      ],
    },
    {
      id: 'note-31',
      numero: 'NOTE 31',
      nomNote: 'RÉPARTITION DU RÉSULTAT ET CINQ DERNIERS EXERCICES',
      statut: 'A',
      items: [
        { intitule: 'Capital social à la clôture', montantN: CA.netN, montantN1: CA.netN1 },
        { intitule: 'Chiffre d’affaires hors taxes', montantN: CA_N, montantN1: CA_N1 },
        { intitule: 'Résultat net de l’exercice (bénéfice + ou perte −)', montantN: RN_N_Total, montantN1: RN_N1_Total },
        { intitule: 'Dividendes distribués au cours de l’exercice', montantN: 0, montantN1: 0 },
        { intitule: 'Masse salariale distribuée (comptes 661 à 663)', montantN: getGestion(lignesGestionN, /^66[123]/).total, montantN1: getGestion(lignesGestionN1, /^66[123]/).total },
        { intitule: 'Cotisations et avantages sociaux (comptes 664, 668)', montantN: getGestion(lignesGestionN, /^66[48]/).total, montantN1: getGestion(lignesGestionN1, /^66[48]/).total },
      ],
    },
    {
      id: 'note-32',
      numero: 'NOTE 32',
      nomNote: 'PRODUCTION DE L’EXERCICE (VENTES DANS L’ESPACE OHADA & EXPORT)',
      statut: 'A',
      items: [
        { intitule: 'Production vendue dans le pays', montantN: TC_N.total + TB_N.total, montantN1: TC_N1.total + TB_N1.total },
        { intitule: 'Production vendue dans les autres pays de l’OHADA', montantN: 0, montantN1: 0 },
        { intitule: 'Production vendue hors zone OHADA', montantN: 0, montantN1: 0 },
        { intitule: 'Production immobilisée (compte 72)', montantN: TF_N.total, montantN1: TF_N1.total },
      ],
    },
    {
      id: 'note-33',
      numero: 'NOTE 33',
      nomNote: 'ACHATS DESTINÉS À LA PRODUCTION',
      statut: 'A',
      items: [
        { intitule: 'Achats locaux dans le pays', montantN: RC_N.total + RE_N.total, montantN1: RC_N1.total + RE_N1.total },
        { intitule: 'Achats importés hors UEMOA', montantN: 0, montantN1: 0 },
        { intitule: 'Variations des stocks de matières', montantN: RD_N.total, montantN1: 0 },
      ],
    },
    {
      id: 'note-34',
      numero: 'NOTE 34',
      nomNote: 'FICHE DE SYNTHÈSE DES PRINCIPAUX INDICATEURS FINANCIERS',
      statut: 'A',
      items: [
        { intitule: 'Chiffre d’affaires', montantN: CA_N, montantN1: CA_N1 },
        { intitule: 'Valeur Ajoutée (VA)', montantN: VA_N, montantN1: VA_N1 },
        { intitule: 'Excédent Brut d’Exploitation (EBE)', montantN: EBE_N, montantN1: EBE_N1 },
        { intitule: 'Résultat d’Exploitation', montantN: REX_N, montantN1: REX_N1 },
        { intitule: 'Résultat Net', montantN: RN_N_Total, montantN1: RN_N1_Total },
        { intitule: 'Fonds de Roulement (FR = Ressources stables − Actif immo)', montantN: fondsRoulementN, montantN1: fondsRoulementN1 },
        { intitule: 'Besoin de Financement d’Exploitation (BFE = Actif circ. − Passif circ.)', montantN: bfeN, montantN1: bfeN1 },
        { intitule: 'Besoin de Financement Global (BFG)', montantN: bfgN, montantN1: bfgN1 },
        { intitule: 'Trésorerie Nette (TN = FR − BFG)', montantN: tresorerieCalculeeN, montantN1: tresorerieCalculeeN1 },
        { intitule: 'Endettement Financier Net', montantN: endettementNetN, montantN1: endettementNetN1 },
        { intitule: 'Rentabilité Économique', montantN: rentabiliteEcoN.toFixed(2) + ' %', montantN1: rentabiliteEcoN1.toFixed(2) + ' %' },
        { intitule: 'Rentabilité Financière', montantN: rentabiliteFinN.toFixed(2) + ' %', montantN1: rentabiliteFinN1.toFixed(2) + ' %' },
      ],
    },
    {
      id: 'note-35',
      numero: 'NOTE 35',
      nomNote: 'INFORMATIONS SOCIALES, ENVIRONNEMENTALES ET SOCIÉTALES (RSE)',
      statut: 'A',
      items: [
        { intitule: 'Politique de l’emploi', montantN: 'Conforme', detail: 'Recrutement local, égalité homme-femme et formation continue du personnel.' },
        { intitule: 'Conditions de santé et sécurité', montantN: 'Conforme', detail: 'Suivi médical périodique, médecine du travail et équipements de protection.' },
        { intitule: 'Impact environnemental & gestion des ressources', montantN: 'Durable', detail: 'Optimisation de la consommation d’eau et valorisation des co-produits agricoles.' },
      ],
    },
    {
      id: 'note-36',
      numero: 'NOTE 36',
      nomNote: 'TABLE DES CODES ET NOMENCLATURES OHADA / SÉNÉGAL',
      statut: 'A',
      items: [
        { intitule: 'Forme juridique', montantN: '02 — Société à Responsabilité Limitée (SARL / SAS)', detail: 'Code 02' },
        { intitule: 'Régime fiscal', montantN: '1 — Réel Normal (SYSCOHADA)', detail: 'Code 1' },
        { intitule: 'Pays du siège social', montantN: '07 — Sénégal (Zone UEMOA)', detail: 'Code 07' },
        { intitule: 'Code activité principale', montantN: '038003 — Promotion de l’entrepreneuriat rural et agrobusiness', detail: 'Code 038003' },
      ],
    },
  ]

  // Fiche d'identification
  const fiche: FicheIdentification = {
    pays: infosEntreprise?.pays ?? 'RÉPUBLIQUE DU SÉNÉGAL',
    ministere: infosEntreprise?.ministere ?? 'MINISTÈRE DE L’ÉCONOMIE, DU PLAN ET DE LA COOPÉRATION',
    direction: infosEntreprise?.direction ?? 'DIRECTION GÉNÉRALE DES IMPÔTS ET DES DOMAINES (DGID)',
    centreDepot: infosEntreprise?.centreDepot ?? 'CENTRE DE DÉPÔT FISCAL DES ENTREPRISES',
    denomination: infosEntreprise?.denomination ?? 'ENTREPRISE AGROBUSINESS',
    sigle: infosEntreprise?.sigle ?? 'AGRO-SAS',
    adresse: infosEntreprise?.adresse ?? 'Dakar, Sénégal',
    nineaNif: infosEntreprise?.nineaNif ?? 'SN-00123456-2K',
    dateCloture: exerciceCourant.date_fin,
    dureeMois: 12,
    dateDebut: exerciceCourant.date_debut,
    dateFin: exerciceCourant.date_fin,
    formeJuridiqueCode: '02',
    regimeFiscalCode: '1',
    paysSiegeCode: '07',
    codeActivite: '038003',
    activitePrincipale: 'Production, transformation et commercialisation de produits agrobusiness',
    contactNom: infosEntreprise?.contactNom ?? 'Direction Générale',
    signataireNom: infosEntreprise?.signataireNom ?? 'Le Gérant / Président',
    signataireQualite: infosEntreprise?.signataireQualite ?? 'Président du Conseil / Administrateur',
  }

  // Contrôles de cohérence
  const controles = {
    equilibreBilanN: totalActifN.net - totalPassifN,
    equilibreBilanN1: totalActifN1.net - totalPassifN1,
    resultatNetN: RN_N_Total,
    resultatNetN1: RN_N1_Total,
    tresorerieNetteN: tresoNetteCloture,
    tresorerieNetteN1: tresoNetteOuverture,
    variationTresorerieN: variationTresorerieNette,
    ecartBouclageTFT,
    fondsRoulementN,
    besoinFinancementGlobalN: bfgN,
    tresorerieCalculeeN,
  }

  return {
    exerciceN: exerciceCourant,
    exerciceN1: exercicePrecedent,
    fiche,
    balanceLignes: toutesLignes,
    bilanActif,
    totalActifN,
    totalActifN1,
    bilanPassif,
    totalPassifN,
    totalPassifN1,
    compteResultat,
    tft,
    indicateurs,
    notesAnnexees,
    controles,
  }
}

/**
 * Génère le fichier CSV complet de la liasse financière SYSCOHADA (Système Normal)
 * Conforme au format standardisé du modèle officiel.
 */
export function exporterLiasseCompleteCSV(
  etats: EtatsFinanciersSyscohada,
  notesStatutOverride?: Record<string, 'A' | 'N/A'>
): string {
  const lignes: string[] = []

  // 1. Balance générale des comptes (8 colonnes)
  lignes.push(`ENTREPRISE :,"${etats.fiche.denomination}",,,,,,,,`)
  lignes.push(`B,C,D,E,F,G,H,I,,`)
  lignes.push(`N°,Intitulés ,Mouvements des comptes C,Mouvements des comptes D,Soldes N D,Soldes N C,Soldes N - 1 D,Soldes N - 1 C,,`)
  lignes.push(`cptes,des comptes,Débit,Crédit,Débit,Crédit,Débit,Crédit,,`)

  if (etats.balanceLignes && etats.balanceLignes.length > 0) {
    const lignesN = etats.balanceLignes.filter((l) => l.exercice_id === etats.exerciceN.id)
    const lignesN1 = etats.exerciceN1
      ? etats.balanceLignes.filter((l) => l.exercice_id === etats.exerciceN1?.id)
      : []
    const mapN1 = new Map(lignesN1.map((l) => [l.numero, l]))

    let totMvtDebit = 0
    let totMvtCredit = 0
    let totSoldeND = 0
    let totSoldeNC = 0
    let totSoldeN1D = 0
    let totSoldeN1C = 0

    const comptesTries = [...lignesN].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))

    for (const c of comptesTries) {
      const n1 = mapN1.get(c.numero)
      const soldeND = c.solde > 0 ? c.solde : 0
      const soldeNC = c.solde < 0 ? -c.solde : 0
      const soldeN1D = (n1?.solde ?? 0) > 0 ? (n1?.solde ?? 0) : 0
      const soldeN1C = (n1?.solde ?? 0) < 0 ? -(n1?.solde ?? 0) : 0

      totMvtDebit += c.total_debit
      totMvtCredit += c.total_credit
      totSoldeND += soldeND
      totSoldeNC += soldeNC
      totSoldeN1D += soldeN1D
      totSoldeN1C += soldeN1C

      lignes.push(
        `${c.numero},"${c.libelle.replace(/"/g, '""')}",${c.total_debit || 0},${c.total_credit || 0},${soldeND || 0},${soldeNC || 0},${soldeN1D || 0},${soldeN1C || 0},,${Math.abs(c.solde)}`
      )
    }

    lignes.push(`,TOTAL,${totMvtDebit},${totMvtCredit},${totSoldeND},${totSoldeNC},${totSoldeN1D},${totSoldeN1C},,`)
  }

  lignes.push(`,,,,,,,,,`)

  // 2. Page de garde officielle DGI
  lignes.push(`,${etats.fiche.pays},,,,,,`)
  lignes.push(`,${etats.fiche.ministere},,,,,,`)
  lignes.push(`,${etats.fiche.direction},,,,,,`)
  lignes.push(`,${etats.fiche.centreDepot},,,,,,`)
  lignes.push(`,,,,,,,`)
  lignes.push(`ETATS FINANCIERS NORMALISES DU SYSTEME,,,,,,,`)
  lignes.push(`,,,,COMPTABLE OUEST AFRICAIN (SYSCOHADA),,,`)
  lignes.push(`,,,,,,,`)
  lignes.push(`,,,EXERCICE CLOS LE : ,,,,${etats.fiche.dateCloture}`)
  lignes.push(`,,,,,,,`)
  lignes.push(`,,,,DESIGNATION DE L'ENTREPRISE,,,`)
  lignes.push(`,DENOMINATION SOCIALE : ,,,${etats.fiche.denomination},,,`)
  lignes.push(`,SIGLE USUEL : ,,,${etats.fiche.sigle},,,`)
  lignes.push(`,ADRESSE COMPLETE : ,,"${etats.fiche.adresse}",,,,`)
  lignes.push(`,N° D'IDENTIFICATION FISCAL,,${etats.fiche.nineaNif},,,,`)
  lignes.push(`,,,,,,,`)
  lignes.push(`,,,,,SYSTEME NORMAL,,`)
  lignes.push(`,,,,,,,`)
  lignes.push(`,Documents déposés,,,,,,`)
  lignes.push(`,Fiche d'identification et renseignements divers,,,,,,Date de dépôt`)
  lignes.push(`,Bilan,,,,,,`)
  lignes.push(`,Compte de résultat,,,,,,`)
  lignes.push(`,Tableau des flux de trésorerie,,,,,,Nom de l'agent de la DGI ayant réceptionné le dépôt`)
  lignes.push(`,Notes annexées,,,,,,`)
  lignes.push(`,,,,,,,`)
  lignes.push(`FICHE D'IDENTIFICATION ET RENSEIGNEMENTS DIVERS,,,,,,,,,,,`)
  lignes.push(`,Dénomination sociale de l'entreprise :   ,,,,${etats.fiche.denomination},,,,,,`)
  lignes.push(`${etats.fiche.sigle},,,,,,,,Sigle usuel :,,,`)
  lignes.push(`,Adresse : ,,"${etats.fiche.adresse}",,,,,,,,`)
  lignes.push(`,N° d'identification fiscale : ,,,${etats.fiche.nineaNif},,Exercice clos le : ,${etats.fiche.dateCloture},,Durée (en mois) :,,${etats.fiche.dureeMois}`)
  lignes.push(`ZA,ZA,EXERCICE COMPTABLE : ,,,,DU : ,${etats.fiche.dateDebut},,AU : ,${etats.fiche.dateFin},`)
  lignes.push(`ZK,,Forme juridique :,,,,${etats.fiche.formeJuridiqueCode},,,,,,`)
  lignes.push(`ZL,,Régime fiscal :,,,,${etats.fiche.regimeFiscalCode},,,,,,,`)
  lignes.push(`ZM,,Pays du siège social :,,,,${etats.fiche.paysSiegeCode},,,,,,`)
  lignes.push(`ZI,ZI,Désignation précise de l'activité : ,,,,${etats.fiche.activitePrincipale},,,,,`)
  lignes.push(`,,,,,,,,,,,`)
  // Tableau de pointage des 36 Notes Annexées (FR4 officiel)
  lignes.push(`FICHE D'IDENTIFICATION ET RENSEIGNEMENTS DIVERS,,,`)
  lignes.push(`,,,`)
  lignes.push(`NOTES,INTITULES,A,N/A`)
  for (const n of etats.notesAnnexees) {
    const st = notesStatutOverride?.[n.id] ?? n.statut
    const colA = st === 'A' ? 'X' : ''
    const colNA = st === 'N/A' ? 'X' : ''
    lignes.push(`"${n.numero}","${n.nomNote.replace(/"/g, '""')}",${colA},${colNA}`)
  }
  lignes.push(`,,,`)

  // 3. Bilan Actif (Système Normal)
  lignes.push(`BILAN SYSTÈME NORMAL,BILAN DU SYSTÈME NORMAL - ACTIF,,,,,,,`)
  lignes.push(`Réf.,ACTIF,Note,,EXERCICE ${etats.exerciceN.libelle},,EXERCICE ${etats.exerciceN1?.libelle ?? 'N-1'}`)
  lignes.push(`,,,BRUT,AMORT/PROV,NET,NET`)
  for (const a of etats.bilanActif) {
    lignes.push(`"${a.ref}","${a.libelle}","${a.note}",${a.brutN},${a.amortN},${a.netN},${a.netN1}`)
  }
  lignes.push(`,,,,,,,`)

  // 4. Bilan Passif (Système Normal)
  lignes.push(`BILAN SYSTÈME NORMAL,BILAN DU SYSTÈME NORMAL - PASSIF,,,,,,,`)
  lignes.push(`Réf.,PASSIF,Note,EXERCICE ${etats.exerciceN.libelle},EXERCICE ${etats.exerciceN1?.libelle ?? 'N-1'}`)
  lignes.push(`,,,NET,NET`)
  for (const p of etats.bilanPassif) {
    lignes.push(`"${p.ref}","${p.libelle}","${p.note}",${p.netN},${p.netN1}`)
  }
  lignes.push(`,,,,,,,`)

  // 5. Compte de Résultat
  lignes.push(`COMPTE DE RESULTAT SYSTEME NORMAL DE L'EXERCICE DU ${etats.fiche.dateDebut} AU ${etats.fiche.dateFin},,,,`)
  lignes.push(`Ref.,LIBELLES,Note,EXERCICE ${etats.exerciceN.libelle},EXERCICE ${etats.exerciceN1?.libelle ?? 'N-1'}`)
  lignes.push(`,,,NET,NET`)
  for (const cr of etats.compteResultat) {
    lignes.push(`"${cr.ref}","${cr.libelle}","${cr.note}",${cr.montantN},${cr.montantN1}`)
  }
  lignes.push(`,,,,,`)

  // 6. Tableau des Flux de Trésorerie
  lignes.push(`,TABLEAU DES FLUX DE TRESORERIE,,,,,`)
  lignes.push(`Ref.,LIBELLES,Note,EXERCICE ${etats.exerciceN.libelle},EXERCICE ${etats.exerciceN1?.libelle ?? 'N-1'}`)
  for (const tf of etats.tft) {
    lignes.push(`"${tf.ref}","${tf.libelle}","${tf.note ?? ''}",${tf.montantN},${tf.montantN1}`)
  }
  lignes.push(`,,,,,`)

  // 7. Note 34 : Fiche de Synthèse des Indicateurs Financiers
  lignes.push(`NOTE 34 - FICHE DE SYNTHESE DES PRINCIPAUX INDICATEURS FINANCIERS,,,,,,Note`)
  lignes.push(`Code,Libellé,Exercice N,Exercice N-1,,,`)
  for (const ind of etats.indicateurs) {
    lignes.push(`"${ind.code}","${ind.libelle}","${ind.montantN}","${ind.montantN1}",,,`)
  }
  lignes.push(`,,,,,`)

  // 8. Les 36 Notes Annexées
  for (const note of etats.notesAnnexees) {
    const st = notesStatutOverride?.[note.id] ?? note.statut
    if (st !== 'A') continue
    lignes.push(`${note.numero} - ${note.nomNote},,,,,,,Note`)
    lignes.push(`Libellés,Exercice N,Exercice N-1,Détails,,,`)
    for (const item of note.items) {
      lignes.push(`"${item.intitule}","${item.montantN}","${item.montantN1 ?? ''}","${item.detail ?? ''}",,,`)
    }
    if (note.commentaires) {
      lignes.push(`Commentaires :,"${note.commentaires.replace(/"/g, '""')}",,,,,`)
    }
    lignes.push(`,,,,,`)
  }

  return lignes.join('\n')
}
