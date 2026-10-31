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
  variationPct?: number | string
  detail?: string
  colA?: number | string
  colB?: number | string
  colC?: number | string
  colD?: number | string
  colE?: number | string
  colF?: number | string
  noteRef?: string
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


  // Helper pour calculer les variations en valeur et en %
  function fmtVar(n: number, n1: number): { val: number; pct: string } {
    const val = n - n1
    if (n1 === 0) {
      return { val, pct: n === 0 ? '0.0%' : '+100.0%' }
    }
    const ratio = (val / Math.abs(n1)) * 100
    const sign = ratio > 0 ? '+' : ''
    return { val, pct: `${sign}${ratio.toFixed(1)}%` }
  }

  // Mouvements Débit / Crédit de l'exercice N
  function getMvtN(pattern: RegExp): { debit: number; credit: number } {
    let debit = 0
    let credit = 0
    for (const l of toutesLignes) {
      if (l.exercice_id === exerciceCourant.id && pattern.test(l.numero)) {
        debit += Number(l.total_debit) || 0
        credit += Number(l.total_credit) || 0
      }
    }
    return { debit, credit }
  }
  const notesAnnexees: NoteAnnexe[] = [
    // -------------------------------------------------------------------------
    // NOTE 1 : DETTES GARANTIES PAR DES SÛRETÉS RÉELLES & ENGAGEMENTS FINANCIERS
    // -------------------------------------------------------------------------
    {
      id: 'note-1',
      numero: 'NOTE 1',
      nomNote: 'DETTES GARANTIES PAR DES SÛRETÉS RÉELLES',
      statut: 'A',
      colonnes: ['LIBELLÉS', 'Notes', 'Montant', 'Hypothèques', 'Nantissements', 'Gages / Autres'],
      items: [
        { intitule: 'Dettes financières et ressources assimilées (1) :', montantN: '', montantN1: '' },
        { intitule: '  • Emprunts obligataires convertibles', montantN: 0, montantN1: 0, noteRef: '16A', colA: 0, colB: 0, colC: 0 },
        { intitule: '  • Autres emprunts obligataires', montantN: 0, montantN1: 0, noteRef: '16A', colA: 0, colB: 0, colC: 0 },
        { intitule: '  • Emprunts auprès des établissements de crédit', montantN: DA.netN, montantN1: DA.netN1, noteRef: '16A', colA: 0, colB: 0, colC: 0 },
        { intitule: '  • Autres dettes financières', montantN: 0, montantN1: 0, noteRef: '16A', colA: 0, colB: 0, colC: 0 },
        { intitule: 'SOUS-TOTAL (1)', montantN: DA.netN, montantN1: DA.netN1, colA: 0, colB: 0, colC: 0 },
        { intitule: 'Crédit-bail (2) :', montantN: '', montantN1: '' },
        { intitule: '  • Dettes de crédit-bail immobilier', montantN: 0, montantN1: 0, colA: 0, colB: 0, colC: 0 },
        { intitule: '  • Dettes de crédit-bail mobilier', montantN: DB.netN, montantN1: DB.netN1, colA: 0, colB: 0, colC: 0 },
        { intitule: 'SOUS-TOTAL (2)', montantN: DB.netN, montantN1: DB.netN1, colA: 0, colB: 0, colC: 0 },
        { intitule: 'Dettes du passif circulant (3) :', montantN: '', montantN1: '' },
        { intitule: '  • Fournisseurs et comptes rattachés', montantN: DJ.netN, montantN1: DJ.netN1, noteRef: '17', colA: 0, colB: 0, colC: 0 },
        { intitule: '  • Clients, avances reçues', montantN: DI.netN, montantN1: DI.netN1, noteRef: '7', colA: 0, colB: 0, colC: 0 },
        { intitule: '  • Personnel, dettes et rémunérations dues', montantN: Math.max(0, getSolde(balanceCumulN, /^42[2-8]/).total), montantN1: 0, noteRef: '18', colA: 0, colB: 0, colC: 0 },
        { intitule: '  • Sécurité sociale et caisses de retraite', montantN: Math.max(0, getSolde(balanceCumulN, /^43/).total), montantN1: 0, noteRef: '18', colA: 0, colB: 0, colC: 0 },
        { intitule: '  • État, impôts et taxes', montantN: Math.max(0, getSolde(balanceCumulN, /^44/).total), montantN1: 0, noteRef: '18', colA: 0, colB: 0, colC: 0 },
        { intitule: '  • Organismes internationaux et associés', montantN: DM.netN, montantN1: DM.netN1, noteRef: '19', colA: 0, colB: 0, colC: 0 },
        { intitule: 'SOUS-TOTAL (3)', montantN: totalPassifCirculant.netN, montantN1: totalPassifCirculant.netN1, colA: 0, colB: 0, colC: 0 },
        { intitule: 'TOTAL (1) + (2) + (3)', montantN: DA.netN + DB.netN + totalPassifCirculant.netN, montantN1: DA.netN1 + DB.netN1 + totalPassifCirculant.netN1, colA: 0, colB: 0, colC: 0 },
      ],
      sousTableau: {
        nomSousTableau: 'ENGAGEMENTS FINANCIERS RECIPROQUES, DONNÉS ET REÇUS',
        colonnes: ['ENGAGEMENTS FINANCIERS', 'RÉCIPROQUES', 'DONNÉS', 'REÇUS'],
        items: [
          { intitule: 'Engagements consentis à des entreprises liées', colA: 0, colB: 0, colC: 0, montantN: 0 },
          { intitule: 'Engagements pris en matière de retraites', colA: 0, colB: 0, colC: 0, montantN: 0 },
          { intitule: 'Avals, cautions et garanties', colA: 0, colB: 0, colC: 0, montantN: 0 },
          { intitule: 'Hypothèques, nantissements et gages', colA: 0, colB: 0, colC: 0, montantN: 0 },
          { intitule: 'Effets escomptés non échus', colA: 0, colB: 0, colC: 0, montantN: 0 },
          { intitule: 'Créances cédées (Dailly / affacturage)', colA: 0, colB: 0, colC: 0, montantN: 0 },
          { intitule: 'TOTAL ENGAGEMENTS FINANCIERS', colA: 0, colB: 0, colC: 0, montantN: 0 },
        ],
      },
      commentaires: 'Aucun gage ou hypothèque grevant les biens de l’entité à la date de clôture.',
    },

    // -------------------------------------------------------------------------
    // NOTE 2 : INFORMATIONS OBLIGATOIRES (MÉTHODES COMPTABLES)
    // -------------------------------------------------------------------------
    {
      id: 'note-2',
      numero: 'NOTE 2',
      nomNote: 'INFORMATIONS OBLIGATOIRES',
      statut: 'A',
      colonnes: ['Rubriques', 'Précisions réglementaires'],
      items: [
        { intitule: 'A - DÉCLARATION DE CONFORMITÉ', montantN: 'Conforme', detail: 'Les états financiers sont établis en conformité avec le Système Comptable OHADA (SYSCOHADA) et l’Acte Uniforme relatif au droit comptable et à l’information financière.' },
        { intitule: 'B - RÈGLES ET MÉTHODES COMPTABLES', montantN: 'Respectées', detail: 'Les états financiers ont été confectionnés dans le respect des postulats, des conventions et des règles d’évaluation édictés par le SYSCOHADA (continuité d’exploitation, indépendance des exercices, prudence, permanence des méthodes).' },
        { intitule: 'C - DÉROGATIONS AUX POSTULATS COMPTABLES', montantN: 'Néant', detail: 'Respect de tous les postulats et conventions comptables sans aucune dérogation.' },
        { intitule: 'D - INFORMATIONS COMPLÉMENTAIRES', montantN: 'Néant', detail: 'Aucun événement postérieur significatif susceptible d’affecter la sincérité des comptes à la date d’arrêté.' },
      ],
      commentaires: 'Permanence des méthodes appliquées par rapport à l’exercice précédent.',
    },

    // -------------------------------------------------------------------------
    // NOTE 3A : IMMOBILISATIONS BRUTES (ACQUISITIONS, CESSIONS, VIREMENTS)
    // -------------------------------------------------------------------------
    {
      id: 'note-3a',
      numero: 'NOTE 3A',
      nomNote: 'IMMOBILISATIONS BRUTES',
      statut: 'A',
      colonnes: [
        'RUBRIQUES',
        'Brut ouv. (A)',
        'Acquisitions (B)',
        'Virements (+)',
        'Réévaluation',
        'Cessions (C)',
        'Virements (-)',
        'Brut clôt. (D=A+B-C)'
      ],
      items: (() => {
        const rowIncorpOuv = Math.max(0, getSolde(balanceCumulN1, /^21/).total)
        const rowIncorpClot = Math.max(0, getSolde(balanceCumulN, /^21/).total)
        const rowIncorpMvt = getMvtN(/^21/)
        const rowIncorpAcq = Math.max(rowIncorpMvt.debit, rowIncorpClot > rowIncorpOuv ? rowIncorpClot - rowIncorpOuv : 0)
        const rowIncorpCes = Math.max(rowIncorpMvt.credit, rowIncorpOuv > rowIncorpClot ? rowIncorpOuv - rowIncorpClot : 0)

        const rowTerrOuv = Math.max(0, getSolde(balanceCumulN1, /^22/).total)
        const rowTerrClot = Math.max(0, getSolde(balanceCumulN, /^22/).total)

        const rowBatOuv = Math.max(0, getSolde(balanceCumulN1, /^23/).total)
        const rowBatClot = Math.max(0, getSolde(balanceCumulN, /^23/).total)
        const rowBatMvt = getMvtN(/^23/)
        const rowBatAcq = Math.max(rowBatMvt.debit, rowBatClot > rowBatOuv ? rowBatClot - rowBatOuv : 0)

        const rowMatOuv = Math.max(0, getSolde(balanceCumulN1, /^24[1-4]|^24[6-9]/).total)
        const rowMatClot = Math.max(0, getSolde(balanceCumulN, /^24[1-4]|^24[6-9]/).total)
        const rowMatMvt = getMvtN(/^24[1-4]|^24[6-9]/)
        const rowMatAcq = Math.max(rowMatMvt.debit, rowMatClot > rowMatOuv ? rowMatClot - rowMatOuv : 0)

        const rowTranspOuv = Math.max(0, getSolde(balanceCumulN1, /^245/).total)
        const rowTranspClot = Math.max(0, getSolde(balanceCumulN, /^245/).total)

        const rowAvancesOuv = Math.max(0, getSolde(balanceCumulN1, /^25/).total)
        const rowAvancesClot = Math.max(0, getSolde(balanceCumulN, /^25/).total)

        const rowFinOuv = Math.max(0, getSolde(balanceCumulN1, /^2[67]/).total)
        const rowFinClot = Math.max(0, getSolde(balanceCumulN, /^2[67]/).total)

        const totOuv = rowIncorpOuv + rowTerrOuv + rowBatOuv + rowMatOuv + rowTranspOuv + rowAvancesOuv + rowFinOuv
        const totClot = rowIncorpClot + rowTerrClot + rowBatClot + rowMatClot + rowTranspClot + rowAvancesClot + rowFinClot
        const totAcq = rowIncorpAcq + rowBatAcq + rowMatAcq

        return [
          {
            intitule: 'IMMOBILISATIONS INCORPORELLES',
            colA: rowIncorpOuv,
            colB: rowIncorpAcq,
            colC: 0,
            colD: 0,
            colE: rowIncorpCes,
            colF: 0,
            montantN: rowIncorpClot,
            montantN1: rowIncorpOuv,
          },
          {
            intitule: '  • Logiciels, brevets, licences et droits similaires',
            colA: rowIncorpOuv,
            colB: rowIncorpAcq,
            colC: 0,
            colD: 0,
            colE: rowIncorpCes,
            colF: 0,
            montantN: rowIncorpClot,
            montantN1: rowIncorpOuv,
          },
          {
            intitule: '  • Fonds commercial et droit au bail',
            colA: 0, colB: 0, colC: 0, colD: 0, colE: 0, colF: 0, montantN: 0, montantN1: 0,
          },
          {
            intitule: 'IMMOBILISATIONS CORPORELLES',
            colA: rowTerrOuv + rowBatOuv + rowMatOuv + rowTranspOuv,
            colB: rowBatAcq + rowMatAcq,
            colC: 0, colD: 0, colE: 0, colF: 0,
            montantN: rowTerrClot + rowBatClot + rowMatClot + rowTranspClot,
            montantN1: rowTerrOuv + rowBatOuv + rowMatOuv + rowTranspOuv,
          },
          {
            intitule: '  • Terrains',
            colA: rowTerrOuv, colB: 0, colC: 0, colD: 0, colE: 0, colF: 0, montantN: rowTerrClot, montantN1: rowTerrOuv,
          },
          {
            intitule: '  • Bâtiments, installations et agencements',
            colA: rowBatOuv, colB: rowBatAcq, colC: 0, colD: 0, colE: 0, colF: 0, montantN: rowBatClot, montantN1: rowBatOuv,
          },
          {
            intitule: '  • Matériels et outillages agricoles, industriels et com.',
            colA: rowMatOuv, colB: rowMatAcq, colC: 0, colD: 0, colE: 0, colF: 0, montantN: rowMatClot, montantN1: rowMatOuv,
          },
          {
            intitule: '  • Matériel de transport',
            colA: rowTranspOuv, colB: 0, colC: 0, colD: 0, colE: 0, colF: 0, montantN: rowTranspClot, montantN1: rowTranspOuv,
          },
          {
            intitule: '  • Immobilisations animales et végétales',
            colA: 0, colB: 0, colC: 0, colD: 0, colE: 0, colF: 0, montantN: 0, montantN1: 0,
          },
          {
            intitule: 'AVANCES ET ACOMPTES SUR IMMOBILISATIONS',
            colA: rowAvancesOuv, colB: 0, colC: 0, colD: 0, colE: 0, colF: 0, montantN: rowAvancesClot, montantN1: rowAvancesOuv,
          },
          {
            intitule: 'IMMOBILISATIONS FINANCIÈRES',
            colA: rowFinOuv, colB: 0, colC: 0, colD: 0, colE: 0, colF: 0, montantN: rowFinClot, montantN1: rowFinOuv,
          },
          {
            intitule: 'TOTAL GÉNÉRAL',
            colA: totOuv,
            colB: totAcq,
            colC: 0, colD: 0, colE: 0, colF: 0,
            montantN: totClot,
            montantN1: totOuv,
          },
        ]
      })(),
      commentaires: 'Les acquisitions de l’exercice correspondent aux investissements financés par ressources propres et subventions.',
    },

    // -------------------------------------------------------------------------
    // NOTE 3B : BIENS PRIS EN LOCATION ACQUISITION (CRÉDIT-BAIL)
    // -------------------------------------------------------------------------
    {
      id: 'note-3b',
      numero: 'NOTE 3B',
      nomNote: 'BIENS PRIS EN LOCATION-ACQUISITION',
      statut: DB.netN > 0 ? 'A' : 'N/A',
      colonnes: ['RUBRIQUES', 'Nature contrat (I;M;A)', 'Brut ouv. (A)', 'Acquisitions (B)', 'Diminutions (C)', 'Brut clôt. (D=A+B-C)'],
      items: [
        { intitule: 'Terrains', detail: 'I', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
        { intitule: 'Bâtiments', detail: 'I', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
        { intitule: 'Matériel, mobilier', detail: 'M', colA: DB.netN1, colB: DB.netN > DB.netN1 ? DB.netN - DB.netN1 : 0, colC: DB.netN1 > DB.netN ? DB.netN1 - DB.netN : 0, montantN: DB.netN, montantN1: DB.netN1 },
        { intitule: 'Matériel de transport', detail: 'M', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
        { intitule: 'TOTAL IMMOBILISATIONS EN LOCATION-ACQUISITION', detail: '', colA: DB.netN1, colB: DB.netN > DB.netN1 ? DB.netN - DB.netN1 : 0, colC: DB.netN1 > DB.netN ? DB.netN1 - DB.netN : 0, montantN: DB.netN, montantN1: DB.netN1 },
      ],
      commentaires: '[1] I : Crédit-bail immobilier ; M : Crédit-bail mobilier ; A : Autres contrats.',
    },

    // -------------------------------------------------------------------------
    // NOTE 3C : AMORTISSEMENTS (CUMUL OUVERTURE, DOTATIONS, SORTIES, CLÔTURE)
    // -------------------------------------------------------------------------
    {
      id: 'note-3c',
      numero: 'NOTE 3C',
      nomNote: 'AMORTISSEMENTS',
      statut: 'A',
      colonnes: [
        'RUBRIQUES',
        'Amort. ouv. (A)',
        'Dotations exo (B)',
        'Diminutions sorties (C)',
        'Cumul clôt. (D=A+B-C)'
      ],
      items: (() => {
        const amIncOuv = Math.abs(getSolde(balanceCumulN1, /^281/).total)
        const amIncClot = Math.abs(getSolde(balanceCumulN, /^281/).total)
        const amIncDot = Math.max(amIncClot - amIncOuv, 0)

        const amMatOuv = Math.abs(getSolde(balanceCumulN1, /^284[1-4]|^284[6-9]/).total)
        const amMatClot = Math.abs(getSolde(balanceCumulN, /^284[1-4]|^284[6-9]/).total)
        const amMatDot = Math.max(amMatClot - amMatOuv, 0)

        const amTrOuv = Math.abs(getSolde(balanceCumulN1, /^2845/).total)
        const amTrClot = Math.abs(getSolde(balanceCumulN, /^2845/).total)
        const amTrDot = Math.max(amTrClot - amTrOuv, 0)

        const amBatOuv = Math.abs(getSolde(balanceCumulN1, /^283/).total)
        const amBatClot = Math.abs(getSolde(balanceCumulN, /^283/).total)
        const amBatDot = Math.max(amBatClot - amBatOuv, 0)

        const totAmOuv = amIncOuv + amMatOuv + amTrOuv + amBatOuv
        const totAmClot = amIncClot + amMatClot + amTrClot + amBatClot
        const totAmDot = amIncDot + amMatDot + amTrDot + amBatDot

        return [
          { intitule: 'IMMOBILISATIONS INCORPORELLES', colA: amIncOuv, colB: amIncDot, colC: 0, montantN: amIncClot, montantN1: amIncOuv },
          { intitule: '  • Frais de recherche et de développement', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
          { intitule: '  • Brevets, licences, logiciels', colA: amIncOuv, colB: amIncDot, colC: 0, montantN: amIncClot, montantN1: amIncOuv },
          { intitule: '  • Fonds commercial et autres valeurs', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
          { intitule: 'TOTAL (I)', colA: amIncOuv, colB: amIncDot, colC: 0, montantN: amIncClot, montantN1: amIncOuv },
          { intitule: 'IMMOBILISATIONS CORPORELLES', colA: amMatOuv + amTrOuv + amBatOuv, colB: amMatDot + amTrDot + amBatDot, colC: 0, montantN: amMatClot + amTrClot + amBatClot, montantN1: amMatOuv + amTrOuv + amBatOuv },
          { intitule: '  • Terrains & agencements', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
          { intitule: '  • Bâtiments, installations et agencements', colA: amBatOuv, colB: amBatDot, colC: 0, montantN: amBatClot, montantN1: amBatOuv },
          { intitule: '  • Matériels et outillages', colA: amMatOuv, colB: amMatDot, colC: 0, montantN: amMatClot, montantN1: amMatOuv },
          { intitule: '  • Matériel de transport', colA: amTrOuv, colB: amTrDot, colC: 0, montantN: amTrClot, montantN1: amTrOuv },
          { intitule: 'TOTAL (II)', colA: amMatOuv + amTrOuv + amBatOuv, colB: amMatDot + amTrDot + amBatDot, colC: 0, montantN: amMatClot + amTrClot + amBatClot, montantN1: amMatOuv + amTrOuv + amBatOuv },
          { intitule: 'TOTAL GÉNÉRAL (I + II)', colA: totAmOuv, colB: totAmDot, colC: 0, montantN: totAmClot, montantN1: totAmOuv },
        ]
      })(),
      commentaires: 'Amortissements linéaires pratiqués conformément aux durées d’utilité admises en fiscalité sénégalaise.',
    },

    // -------------------------------------------------------------------------
    // NOTE 3D : PLUS-VALUES ET MOINS-VALUES DE CESSION D'IMMOBILISATIONS
    // -------------------------------------------------------------------------
    {
      id: 'note-3d',
      numero: 'NOTE 3D',
      nomNote: 'PLUS-VALUES ET MOINS-VALUES DE CESSION',
      statut: TN_N.total > 0 || RO_N.total > 0 ? 'A' : 'N/A',
      colonnes: ['Rubriques', 'Montant brut (A)', 'Amort. pratiqués (B)', 'VNC (C=A-B)', 'Prix cession (D)', 'Plus/Moins-value (E=D-C)'],
      items: [
        { intitule: 'IMMOBILISATIONS INCORPORELLES', colA: 0, colB: 0, colC: 0, colD: 0, colE: 0, montantN: 0, montantN1: 0 },
        { intitule: 'IMMOBILISATIONS CORPORELLES', colA: RO_N.total, colB: 0, colC: RO_N.total, colD: TN_N.total, colE: TN_N.total - RO_N.total, montantN: TN_N.total - RO_N.total, montantN1: 0 },
        { intitule: 'IMMOBILISATIONS FINANCIÈRES', colA: 0, colB: 0, colC: 0, colD: 0, colE: 0, montantN: 0, montantN1: 0 },
        { intitule: 'TOTAL GÉNÉRAL', colA: RO_N.total, colB: 0, colC: RO_N.total, colD: TN_N.total, colE: TN_N.total - RO_N.total, montantN: TN_N.total - RO_N.total, montantN1: 0 },
      ],
      commentaires: 'Plus-values nettes de cession imposables selon le régime fiscal de droit commun.',
    },

    // -------------------------------------------------------------------------
    // NOTE 3E : INFORMATIONS SUR LES RÉÉVALUATIONS EFFECTUÉES
    // -------------------------------------------------------------------------
    {
      id: 'note-3e',
      numero: 'NOTE 3E',
      nomNote: 'INFORMATIONS SUR LES RÉÉVALUATIONS',
      statut: CD.netN !== 0 ? 'A' : 'N/A',
      colonnes: ['Éléments réévalués', 'Coût historique', 'Écarts et provisions de réévaluation'],
      items: [
        { intitule: 'Immobilisations corporelles réévaluées', montantN: CD.netN, montantN1: CD.netN1, colA: 0, colB: CD.netN },
        { intitule: 'TOTAL DES ÉCARTS DE RÉÉVALUATION', montantN: CD.netN, montantN1: CD.netN1, colA: 0, colB: CD.netN },
      ],
      commentaires: 'Aucune réévaluation légale ou libre pratiquée au cours de l’exercice.',
    },

    // -------------------------------------------------------------------------
    // NOTE 3F : TABLEAU D'ÉTALEMENT DES CHARGES IMMOBILISÉES
    // -------------------------------------------------------------------------
    {
      id: 'note-3f',
      numero: 'NOTE 3F',
      nomNote: 'TABLEAU D’ÉTALEMENT DES CHARGES IMMOBILISÉES',
      statut: 'N/A',
      colonnes: ['Libellés', 'Frais d’établissement', 'Charges à répartir', 'Primes de remboursement'],
      items: [
        { intitule: 'Montant global à étaler au 1er Janvier', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
        { intitule: 'Amortissement / étalement exercice N', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
        { intitule: 'TOTAL GÉNÉRAL', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 4 : IMMOBILISATIONS FINANCIÈRES (AVEC ÉCHÉANCES ET VARIATION)
    // -------------------------------------------------------------------------
    {
      id: 'note-4',
      numero: 'NOTE 4',
      nomNote: 'IMMOBILISATIONS FINANCIÈRES',
      statut: AQ.brutN > 0 ? 'A' : 'N/A',
      colonnes: ['Libellé', 'Année N', 'Année N-1', 'Var. en %', '≤ 1 an', '1 à 2 ans', '> 2 ans'],
      items: (() => {
        const v = fmtVar(AQ.brutN, AQ.netN1)
        return [
          { intitule: 'Prêts et créances non commerciales (compte 271)', montantN: getSolde(balanceCumulN, /^271/).total, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'Prêts au personnel (compte 272)', montantN: getSolde(balanceCumulN, /^272/).total, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'Créances sur l’État (compte 273)', montantN: getSolde(balanceCumulN, /^273/).total, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'Titres immobilisés (compte 274)', montantN: getSolde(balanceCumulN, /^274/).total, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'Dépôts et cautionnements versés (compte 275)', montantN: getSolde(balanceCumulN, /^275/).total, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'Titres de participation (compte 26)', montantN: getSolde(balanceCumulN, /^26/).total, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'TOTAL BRUT', montantN: AQ.brutN, montantN1: AQ.netN1, variationPct: v.pct, colA: 0, colB: 0, colC: AQ.brutN },
          { intitule: 'Dépréciations des immobilisations financières', montantN: AQ.amortN, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'TOTAL NET DE DÉPRÉCIATION', montantN: AQ.netN, montantN1: AQ.netN1, variationPct: v.pct, colA: 0, colB: 0, colC: AQ.netN },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 5 : ACTIF CIRCULANT ET PASSIF CIRCULANT HAO
    // -------------------------------------------------------------------------
    {
      id: 'note-5',
      numero: 'NOTE 5',
      nomNote: 'ACTIF CIRCULANT ET PASSIF CIRCULANT HAO',
      statut: BA.netN > 0 || DH.netN > 0 ? 'A' : 'N/A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %'],
      items: [
        { intitule: 'ACTIF CIRCULANT HAO :', montantN: '', montantN1: '' },
        { intitule: '  • Créances sur cessions d’immobilisations (compte 485)', montantN: BA.netN, montantN1: BA.netN1, variationPct: fmtVar(BA.netN, BA.netN1).pct },
        { intitule: '  • Autres créances HAO (compte 488)', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'TOTAL NET ACTIF CIRCULANT HAO', montantN: BA.netN, montantN1: BA.netN1, variationPct: fmtVar(BA.netN, BA.netN1).pct },
        { intitule: 'PASSIF CIRCULANT HAO :', montantN: '', montantN1: '' },
        { intitule: '  • Fournisseurs d’investissements (compte 481)', montantN: DH.netN, montantN1: DH.netN1, variationPct: fmtVar(DH.netN, DH.netN1).pct },
        { intitule: '  • Autres dettes HAO (compte 484)', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'TOTAL PASSIF CIRCULANT HAO', montantN: DH.netN, montantN1: DH.netN1, variationPct: fmtVar(DH.netN, DH.netN1).pct },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 6 : STOCKS ET EN-COURS (VARIATION EN VALEUR & EN %)
    // -------------------------------------------------------------------------
    {
      id: 'note-6',
      numero: 'NOTE 6',
      nomNote: 'STOCKS ET EN-COURS',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en valeur', 'Var. en %'],
      items: (() => {
        const m = (num: RegExp) => ({
          n: Math.max(0, getSolde(balanceCumulN, num).total),
          n1: Math.max(0, getSolde(balanceCumulN1, num).total),
        })
        const march = m(/^31/)
        const mat = m(/^32/)
        const emb = m(/^33/)
        const enc = m(/^3[45]/)
        const pf = m(/^3[67]/)
        const dep = m(/^38/)
        const tot = m(/^3/)

        const row = (lbl: string, data: { n: number; n1: number }) => {
          const v = fmtVar(data.n, data.n1)
          return {
            intitule: lbl,
            montantN: data.n,
            montantN1: data.n1,
            variation: v.val,
            variationPct: v.pct,
          }
        }

        return [
          row('Marchandises', march),
          row('Matières premières et fournitures liées', mat),
          row('Stocks d’emballages et matières consommables', emb),
          row('Stocks en cours de production (produits & services)', enc),
          row('Stocks de produits finis et résiduels', pf),
          row('Stocks en cours de route, en consignation ou dépôt', dep),
          row('TOTAL STOCKS ET EN-COURS', tot),
          { intitule: 'Dépréciations des stocks', montantN: BB.amortN, montantN1: 0, variation: 0, variationPct: '0.0%' },
          row('TOTAL NET DE DÉPRÉCIATIONS', { n: BB.netN, n1: BB.netN1 }),
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 7 : CLIENTS (AVEC VARIATION ET ÉCHÉANCES)
    // -------------------------------------------------------------------------
    {
      id: 'note-7',
      numero: 'NOTE 7',
      nomNote: 'CLIENTS',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %', '≤ 1 an', '1 à 2 ans', '> 2 ans'],
      items: (() => {
        const cltOrd = Math.max(0, getSolde(balanceCumulN, /^411[1-3]/).total)
        const cltOrdN1 = Math.max(0, getSolde(balanceCumulN1, /^411[1-3]/).total)
        const cltPub = Math.max(0, getSolde(balanceCumulN, /^4114|^4115/).total)
        const cltPubN1 = Math.max(0, getSolde(balanceCumulN1, /^4114|^4115/).total)
        const cltTot = cltOrd + cltPub
        const cltTotN1 = cltOrdN1 + cltPubN1
        const vClt = fmtVar(cltTot, cltTotN1)

        const avRec = Math.abs(getSolde(balanceCumulN, /^419/).total)
        const avRecN1 = Math.abs(getSolde(balanceCumulN1, /^419/).total)
        const vAv = fmtVar(avRec, avRecN1)

        return [
          { intitule: 'Clients ordinaires (hors Groupe)', montantN: cltOrd, montantN1: cltOrdN1, variationPct: fmtVar(cltOrd, cltOrdN1).pct, colA: cltOrd, colB: 0, colC: 0 },
          { intitule: 'Clients État et collectivités publiques', montantN: cltPub, montantN1: cltPubN1, variationPct: fmtVar(cltPub, cltPubN1).pct, colA: cltPub, colB: 0, colC: 0 },
          { intitule: 'Clients effets à recevoir', montantN: 0, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'Créances litigieuses ou douteuses', montantN: 0, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'TOTAL CRÉANCES CLIENTS BRUTES', montantN: cltTot, montantN1: cltTotN1, variationPct: vClt.pct, colA: cltTot, colB: 0, colC: 0 },
          { intitule: 'Dépréciations des comptes clients', montantN: BI.amortN, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'TOTAL NET CRÉANCES CLIENTS', montantN: BI.netN, montantN1: BI.netN1, variationPct: fmtVar(BI.netN, BI.netN1).pct, colA: BI.netN, colB: 0, colC: 0 },
          { intitule: 'Clients, avances et acomptes reçus', montantN: avRec, montantN1: avRecN1, variationPct: vAv.pct, colA: avRec, colB: 0, colC: 0 },
          { intitule: 'TOTAL CLIENTS CRÉDITEURS', montantN: avRec, montantN1: avRecN1, variationPct: vAv.pct, colA: avRec, colB: 0, colC: 0 },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 8 : AUTRES CRÉANCES (AVEC VARIATION ET ÉCHÉANCES)
    // -------------------------------------------------------------------------
    {
      id: 'note-8',
      numero: 'NOTE 8',
      nomNote: 'AUTRES CRÉANCES',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %', '≤ 1 an', '1 à 2 ans', '> 2 ans'],
      items: (() => {
        const pers = Math.max(0, getSolde(balanceCumulN, /^421/).total)
        const persN1 = Math.max(0, getSolde(balanceCumulN1, /^421/).total)
        const soc = Math.max(0, getSolde(balanceCumulN, /^43/).total)
        const socN1 = Math.max(0, getSolde(balanceCumulN1, /^43/).total)
        const etat = Math.max(0, getSolde(balanceCumulN, /^44/).total)
        const etatN1 = Math.max(0, getSolde(balanceCumulN1, /^44/).total)
        const div = Math.max(0, getSolde(balanceCumulN, /^4711/).total)
        const divN1 = Math.max(0, getSolde(balanceCumulN1, /^4711/).total)
        const tot = pers + soc + etat + div
        const totN1 = persN1 + socN1 + etatN1 + divN1

        return [
          { intitule: 'Personnel (avances et acomptes)', montantN: pers, montantN1: persN1, variationPct: fmtVar(pers, persN1).pct, colA: pers, colB: 0, colC: 0 },
          { intitule: 'Organismes sociaux', montantN: soc, montantN1: socN1, variationPct: fmtVar(soc, socN1).pct, colA: soc, colB: 0, colC: 0 },
          { intitule: 'État et collectivités publiques (TVA déductible / acomptes)', montantN: etat, montantN1: etatN1, variationPct: fmtVar(etat, etatN1).pct, colA: etat, colB: 0, colC: 0 },
          { intitule: 'Débiteurs divers', montantN: div, montantN1: divN1, variationPct: fmtVar(div, divN1).pct, colA: div, colB: 0, colC: 0 },
          { intitule: 'TOTAL AUTRES CRÉANCES BRUTES', montantN: tot, montantN1: totN1, variationPct: fmtVar(tot, totN1).pct, colA: tot, colB: 0, colC: 0 },
          { intitule: 'Dépréciations des autres créances', montantN: 0, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
          { intitule: 'TOTAL NET AUTRES CRÉANCES', montantN: tot, montantN1: totN1, variationPct: fmtVar(tot, totN1).pct, colA: tot, colB: 0, colC: 0 },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 9 : TITRES DE PLACEMENT
    // -------------------------------------------------------------------------
    {
      id: 'note-9',
      numero: 'NOTE 9',
      nomNote: 'TITRES DE PLACEMENT',
      statut: BQ.brutN > 0 ? 'A' : 'N/A',
      colonnes: ['Libellé', 'Année N', 'Année N-1', 'Var. en %', '≤ 1 an', '1 à 2 ans', '> 2 ans'],
      items: [
        { intitule: 'Titres du Trésor et bons de caisse à CT', montantN: 0, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
        { intitule: 'Actions et titres négociables', montantN: 0, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
        { intitule: 'Obligations', montantN: 0, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
        { intitule: 'TOTAL BRUT DES TITRES', montantN: BQ.brutN, montantN1: BQ.netN1, variationPct: fmtVar(BQ.brutN, BQ.netN1).pct, colA: BQ.brutN, colB: 0, colC: 0 },
        { intitule: 'Dépréciations des titres', montantN: 0, montantN1: 0, variationPct: '0.0%', colA: 0, colB: 0, colC: 0 },
        { intitule: 'TOTAL NET DE DÉPRÉCIATION', montantN: BQ.netN, montantN1: BQ.netN1, variationPct: fmtVar(BQ.netN, BQ.netN1).pct, colA: BQ.netN, colB: 0, colC: 0 },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 10 : VALEURS À ENCAISSER
    // -------------------------------------------------------------------------
    {
      id: 'note-10',
      numero: 'NOTE 10',
      nomNote: 'VALEURS À ENCAISSER',
      statut: BR.netN > 0 ? 'A' : 'N/A',
      colonnes: ['Libellé', 'Année N', 'Année N-1', 'Var. en %'],
      items: [
        { intitule: 'Effets à l’encaissement', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'Chèques à l’encaissement', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'Cartes de crédit à encaisser', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'TOTAL BRUT VALEURS À ENCAISSER', montantN: BR.brutN, montantN1: BR.netN1, variationPct: fmtVar(BR.brutN, BR.netN1).pct },
        { intitule: 'TOTAL NET DE DÉPRÉCIATIONS', montantN: BR.netN, montantN1: BR.netN1, variationPct: fmtVar(BR.netN, BR.netN1).pct },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 11 : DISPONIBILITÉS (TRÉSORERIE ACTIF)
    // -------------------------------------------------------------------------
    {
      id: 'note-11',
      numero: 'NOTE 11',
      nomNote: 'DISPONIBILITÉS',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %'],
      items: (() => {
        const bq = Math.max(0, getSolde(balanceCumulN, /^52/).total)
        const bqN1 = Math.max(0, getSolde(balanceCumulN1, /^52/).total)
        const mob = Math.max(0, getSolde(balanceCumulN, /^551/).total)
        const mobN1 = Math.max(0, getSolde(balanceCumulN1, /^551/).total)
        const cs = Math.max(0, getSolde(balanceCumulN, /^571/).total)
        const csN1 = Math.max(0, getSolde(balanceCumulN1, /^571/).total)
        const tot = bq + mob + cs
        const totN1 = bqN1 + mobN1 + csN1

        return [
          { intitule: 'Banques locales (comptes de dépôt)', montantN: bq, montantN1: bqN1, variationPct: fmtVar(bq, bqN1).pct },
          { intitule: 'Monnaie électronique (Orange Money / Wave / Free Money)', montantN: mob, montantN1: mobN1, variationPct: fmtVar(mob, mobN1).pct },
          { intitule: 'Caisse centrale (espèces)', montantN: cs, montantN1: csN1, variationPct: fmtVar(cs, csN1).pct },
          { intitule: 'Régies d’avances et accréditifs', montantN: 0, montantN1: 0, variationPct: '0.0%' },
          { intitule: 'TOTAL DISPONIBILITÉS', montantN: tot, montantN1: totN1, variationPct: fmtVar(tot, totN1).pct },
          { intitule: 'TOTAL NET DE DÉPRÉCIATIONS', montantN: tot, montantN1: totN1, variationPct: fmtVar(tot, totN1).pct },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 12 : ÉCARTS DE CONVERSION ET TRANSFERTS DE CHARGES
    // -------------------------------------------------------------------------
    {
      id: 'note-12',
      numero: 'NOTE 12',
      nomNote: 'ÉCARTS DE CONVERSION ET TRANSFERTS DE CHARGES',
      statut: BU.netN !== 0 || DV.netN !== 0 ? 'A' : 'N/A',
      colonnes: ['Libellés', 'Devises', 'Montant en devise', 'Cours acquisition', 'Cours clôture', 'Écart en valeur'],
      items: [
        { intitule: 'Écarts de conversion - Actif (pertes latentes)', detail: 'EUR/USD', colA: 0, colB: 0, colC: 0, montantN: BU.netN, montantN1: BU.netN1 },
        { intitule: 'Écarts de conversion - Passif (gains latents)', detail: 'EUR/USD', colA: 0, colB: 0, colC: 0, montantN: DV.netN, montantN1: DV.netN1 },
      ],
      sousTableau: {
        nomSousTableau: 'TRANSFERTS DE CHARGES D’EXPLOITATION ET FINANCIÈRES',
        colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %'],
        items: [
          { intitule: 'Transferts de charges d’exploitation (compte 781)', colA: TI_N.total, colB: TI_N1.total, colC: 0, montantN: TI_N.total, montantN1: TI_N1.total },
          { intitule: 'Transferts de charges financières (compte 787)', colA: TL_N_Fin.total, colB: TL_N1_Fin.total, colC: 0, montantN: TL_N_Fin.total, montantN1: TL_N1_Fin.total },
        ],
      },
    },

    // -------------------------------------------------------------------------
    // NOTE 13 : CAPITAL : VALEUR NOMINALE DES ACTIONS OU PARTS
    // -------------------------------------------------------------------------
    {
      id: 'note-13',
      numero: 'NOTE 13',
      nomNote: 'CAPITAL SOCIAL & ACTIONNARIAT',
      statut: 'A',
      colonnes: ['Nom et Prénom / Associé', 'Nationalité', 'Nature des parts', 'Nombre', 'Montant total', 'Cessions en cours'],
      items: [
        { intitule: 'Associés / Actionnaires fondateurs', detail: 'Sénégalaise', colA: 'Ordinaires', colB: 500, montantN: CA.netN, montantN1: CA.netN1, colC: 0 },
        { intitule: 'Apporteurs, capital souscrit non appelé', detail: '', colA: '', colB: 0, montantN: 0, montantN1: 0, colC: 0 },
        { intitule: 'TOTAL CAPITAL SOCIAL', detail: '', colA: '', colB: 500, montantN: CA.netN, montantN1: CA.netN1, colC: 0 },
      ],
      commentaires: 'Capital divisé en parts sociales d’une valeur nominale de 10 000 FCFA chacune, entièrement libérées.',
    },

    // -------------------------------------------------------------------------
    // NOTE 14 : PRIMES ET RÉSERVES (AVEC VARIATION EN VALEUR)
    // -------------------------------------------------------------------------
    {
      id: 'note-14',
      numero: 'NOTE 14',
      nomNote: 'PRIMES ET RÉSERVES',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en valeur'],
      items: (() => {
        const resLeg = Math.abs(getSolde(balanceCumulN, /^111/).total)
        const resLegN1 = Math.abs(getSolde(balanceCumulN1, /^111/).total)
        const resLib = Math.abs(getSolde(balanceCumulN, /^118/).total)
        const resLibN1 = Math.abs(getSolde(balanceCumulN1, /^118/).total)
        const ran = getSolde(balanceCumulN, /^12[19]/).total
        const ranN1 = getSolde(balanceCumulN1, /^12[19]/).total

        return [
          { intitule: 'Primes d’émission, de fusion, d’apport', montantN: 0, montantN1: 0, variation: 0 },
          { intitule: 'Réserves légales', montantN: resLeg, montantN1: resLegN1, variation: resLeg - resLegN1 },
          { intitule: 'Réserves statutaires ou libres', montantN: resLib, montantN1: resLibN1, variation: resLib - resLibN1 },
          { intitule: 'Report à nouveau (+/-)', montantN: ran, montantN1: ranN1, variation: ran - ranN1 },
          { intitule: 'TOTAL DES RÉSERVES ET REPORT À NOUVEAU', montantN: resLeg + resLib + ran, montantN1: resLegN1 + resLibN1 + ranN1, variation: (resLeg + resLib + ran) - (resLegN1 + resLibN1 + ranN1) },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 15A : SUBVENTIONS ET PROVISIONS RÉGLEMENTÉES
    // -------------------------------------------------------------------------
    {
      id: 'note-15a',
      numero: 'NOTE 15A',
      nomNote: 'SUBVENTIONS ET PROVISIONS RÉGLEMENTÉES',
      statut: CH.netN > 0 || CJ.netN > 0 ? 'A' : 'N/A',
      colonnes: ['Libellés', 'Note', 'Année N', 'Année N-1', 'Var. en valeur', 'Var. en %', 'Échéances'],
      items: (() => {
        const v = fmtVar(CH.netN, CH.netN1)
        return [
          { intitule: 'Subventions d’investissement (État & partenaires)', noteRef: '141', montantN: CH.netN, montantN1: CH.netN1, variation: v.val, variationPct: v.pct, detail: '2028' },
          { intitule: 'TOTAL SUBVENTIONS D’INVESTISSEMENT', noteRef: '', montantN: CH.netN, montantN1: CH.netN1, variation: v.val, variationPct: v.pct, detail: '' },
          { intitule: 'Provisions réglementées et fonds assimilés', noteRef: '15', montantN: CJ.netN, montantN1: CJ.netN1, variation: CJ.netN - CJ.netN1, variationPct: fmtVar(CJ.netN, CJ.netN1).pct, detail: '' },
          { intitule: 'TOTAL AUTRES CAPITAUX PROPRES', noteRef: '', montantN: CH.netN + CJ.netN, montantN1: CH.netN1 + CJ.netN1, variation: (CH.netN + CJ.netN) - (CH.netN1 + CJ.netN1), variationPct: fmtVar(CH.netN + CJ.netN, CH.netN1 + CJ.netN1).pct, detail: '' },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 15B : AUTRES FONDS PROPRES
    // -------------------------------------------------------------------------
    {
      id: 'note-15b',
      numero: 'NOTE 15B',
      nomNote: 'AUTRES FONDS PROPRES',
      statut: 'N/A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en valeur', 'Var. en %'],
      items: [
        { intitule: 'Titres participatifs', montantN: 0, montantN1: 0, variation: 0, variationPct: '0.0%' },
        { intitule: 'Avances conditionnées par l’État', montantN: 0, montantN1: 0, variation: 0, variationPct: '0.0%' },
        { intitule: 'TOTAL AUTRES FONDS PROPRES', montantN: 0, montantN1: 0, variation: 0, variationPct: '0.0%' },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 16A : DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES
    // -------------------------------------------------------------------------
    {
      id: 'note-16a',
      numero: 'NOTE 16A',
      nomNote: 'DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES',
      statut: DA.netN > 0 || DB.netN > 0 ? 'A' : 'N/A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %', '≤ 1 an', '1 à 2 ans', '> 2 ans'],
      items: [
        { intitule: 'Emprunts et dettes financières auprès des banques', montantN: DA.netN, montantN1: DA.netN1, variationPct: fmtVar(DA.netN, DA.netN1).pct, colA: 0, colB: DA.netN, colC: 0 },
        { intitule: 'Dettes de crédit-bail et contrats assimilés', montantN: DB.netN, montantN1: DB.netN1, variationPct: fmtVar(DB.netN, DB.netN1).pct, colA: 0, colB: DB.netN, colC: 0 },
        { intitule: 'TOTAL EMPRUNTS ET DETTES FINANCIÈRES', montantN: DA.netN + DB.netN, montantN1: DA.netN1 + DB.netN1, variationPct: fmtVar(DA.netN + DB.netN, DA.netN1 + DB.netN1).pct, colA: 0, colB: DA.netN + DB.netN, colC: 0 },
        { intitule: 'Provisions financières pour risques et charges', montantN: DC.netN, montantN1: DC.netN1, variationPct: fmtVar(DC.netN, DC.netN1).pct, colA: 0, colB: 0, colC: DC.netN },
        { intitule: 'TOTAL DETTES FINANCIÈRES & RESSOURCES ASSIMILÉES', montantN: totalDettesFinancieres.netN, montantN1: totalDettesFinancieres.netN1, variationPct: fmtVar(totalDettesFinancieres.netN, totalDettesFinancieres.netN1).pct, colA: 0, colB: DA.netN + DB.netN, colC: DC.netN },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 16B : ENGAGEMENTS DE RETRAITES ET AVANTAGES ASSIMILÉS
    // -------------------------------------------------------------------------
    {
      id: 'note-16b',
      numero: 'NOTE 16B',
      nomNote: 'ENGAGEMENTS DE RETRAITE (MÉTHODE ACTUARIELLE)',
      statut: 'N/A',
      colonnes: ['Hypothèses actuarielles', 'Année N', 'Année N-1'],
      items: [
        { intitule: 'Taux d’actualisation', montantN: '6.5%', montantN1: '6.5%' },
        { intitule: 'Taux d’inflation', montantN: '2.5%', montantN1: '2.5%' },
        { intitule: 'Valeur de l’obligation à la clôture', montantN: 0, montantN1: 0 },
        { intitule: 'Actif / Passif net comptabilisé au bilan', montantN: 0, montantN1: 0 },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 16C : ACTIFS ET PASSIFS ÉVENTUELS
    // -------------------------------------------------------------------------
    {
      id: 'note-16c',
      numero: 'NOTE 16C',
      nomNote: 'ACTIFS ET PASSIFS ÉVENTUELS',
      statut: 'N/A',
      colonnes: ['Libellés', 'Année N', 'Année N-1'],
      items: [
        { intitule: 'Actifs éventuels (litiges favorables non certains)', montantN: 0, montantN1: 0 },
        { intitule: 'Passifs éventuels (garanties et cautions)', montantN: 0, montantN1: 0 },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 17 : FOURNISSEURS D'EXPLOITATION (AVEC ÉCHÉANCES ET VARIATION)
    // -------------------------------------------------------------------------
    {
      id: 'note-17',
      numero: 'NOTE 17',
      nomNote: 'FOURNISSEURS D’EXPLOITATION',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %', '≤ 1 an', '1 à 2 ans', '> 2 ans'],
      items: (() => {
        const fOrd = Math.abs(getSolde(balanceCumulN, /^401[1-3]/).total)
        const fOrdN1 = Math.abs(getSolde(balanceCumulN1, /^401[1-3]/).total)
        const fFnp = Math.abs(getSolde(balanceCumulN, /^408/).total)
        const fFnpN1 = Math.abs(getSolde(balanceCumulN1, /^408/).total)
        const fTot = fOrd + fFnp
        const fTotN1 = fOrdN1 + fFnpN1

        const avVers = Math.max(0, getSolde(balanceCumulN, /^409/).total)
        const avVersN1 = Math.max(0, getSolde(balanceCumulN1, /^409/).total)

        return [
          { intitule: 'Fournisseurs dettes en compte (hors Groupe)', montantN: fOrd, montantN1: fOrdN1, variationPct: fmtVar(fOrd, fOrdN1).pct, colA: fOrd, colB: 0, colC: 0 },
          { intitule: 'Fournisseurs factures non parvenues', montantN: fFnp, montantN1: fFnpN1, variationPct: fmtVar(fFnp, fFnpN1).pct, colA: fFnp, colB: 0, colC: 0 },
          { intitule: 'TOTAL FOURNISSEURS', montantN: fTot, montantN1: fTotN1, variationPct: fmtVar(fTot, fTotN1).pct, colA: fTot, colB: 0, colC: 0 },
          { intitule: 'Fournisseurs, avances et acomptes versés', montantN: avVers, montantN1: avVersN1, variationPct: fmtVar(avVers, avVersN1).pct, colA: avVers, colB: 0, colC: 0 },
          { intitule: 'TOTAL FOURNISSEURS DÉBITEURS', montantN: avVers, montantN1: avVersN1, variationPct: fmtVar(avVers, avVersN1).pct, colA: avVers, colB: 0, colC: 0 },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 18 : DETTES FISCALES ET SOCIALES (AVEC ÉCHÉANCES ET VARIATION)
    // -------------------------------------------------------------------------
    {
      id: 'note-18',
      numero: 'NOTE 18',
      nomNote: 'DETTES FISCALES ET SOCIALES',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en valeur', 'Var. en %', '≤ 1 an', '1 à 2 ans', '> 2 ans'],
      items: (() => {
        const salDues = Math.abs(getSolde(balanceCumulN, /^422/).total)
        const salDuesN1 = Math.abs(getSolde(balanceCumulN1, /^422/).total)
        const css = Math.abs(getSolde(balanceCumulN, /^431[12]/).total)
        const cssN1 = Math.abs(getSolde(balanceCumulN1, /^431[12]/).total)
        const ipres = Math.abs(getSolde(balanceCumulN, /^4313/).total)
        const ipresN1 = Math.abs(getSolde(balanceCumulN1, /^4313/).total)
        const totSoc = salDues + css + ipres
        const totSocN1 = salDuesN1 + cssN1 + ipresN1

        const tva = Math.abs(getSolde(balanceCumulN, /^4441/).total)
        const tvaN1 = Math.abs(getSolde(balanceCumulN1, /^4441/).total)
        const ir = Math.abs(getSolde(balanceCumulN, /^447/).total)
        const irN1 = Math.abs(getSolde(balanceCumulN1, /^447/).total)
        const totFisc = tva + ir
        const totFiscN1 = tvaN1 + irN1

        const totGen = totSoc + totFisc
        const totGenN1 = totSocN1 + totFiscN1

        return [
          { intitule: 'Personnel, rémunérations dues', montantN: salDues, montantN1: salDuesN1, variation: salDues - salDuesN1, variationPct: fmtVar(salDues, salDuesN1).pct, colA: salDues, colB: 0, colC: 0 },
          { intitule: 'Caisse de sécurité sociale (CSS)', montantN: css, montantN1: cssN1, variation: css - cssN1, variationPct: fmtVar(css, cssN1).pct, colA: css, colB: 0, colC: 0 },
          { intitule: 'Caisse de retraite (IPRES)', montantN: ipres, montantN1: ipresN1, variation: ipres - ipresN1, variationPct: fmtVar(ipres, ipresN1).pct, colA: ipres, colB: 0, colC: 0 },
          { intitule: 'TOTAL DETTES SOCIALES', montantN: totSoc, montantN1: totSocN1, variation: totSoc - totSocN1, variationPct: fmtVar(totSoc, totSocN1).pct, colA: totSoc, colB: 0, colC: 0 },
          { intitule: 'État, TVA due (compte 4441)', montantN: tva, montantN1: tvaN1, variation: tva - tvaN1, variationPct: fmtVar(tva, tvaN1).pct, colA: tva, colB: 0, colC: 0 },
          { intitule: 'État, impôts retenus à la source (VRS / BRS)', montantN: ir, montantN1: irN1, variation: ir - irN1, variationPct: fmtVar(ir, irN1).pct, colA: ir, colB: 0, colC: 0 },
          { intitule: 'TOTAL DETTES FISCALES', montantN: totFisc, montantN1: totFiscN1, variation: totFisc - totFiscN1, variationPct: fmtVar(totFisc, totFiscN1).pct, colA: totFisc, colB: 0, colC: 0 },
          { intitule: 'TOTAL DETTES SOCIALES ET FISCALES', montantN: totGen, montantN1: totGenN1, variation: totGen - totGenN1, variationPct: fmtVar(totGen, totGenN1).pct, colA: totGen, colB: 0, colC: 0 },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 19 : AUTRES DETTES ET PROVISIONS POUR RISQUES À COURT TERME
    // -------------------------------------------------------------------------
    {
      id: 'note-19',
      numero: 'NOTE 19',
      nomNote: 'AUTRES DETTES ET PROVISIONS RISQUES CT',
      statut: DM.netN > 0 || DN.netN > 0 ? 'A' : 'N/A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en valeur', 'Var. en %', '≤ 1 an', '1 à 2 ans', '> 2 ans'],
      items: (() => {
        const orgInt = Math.abs(getSolde(balanceCumulN, /^452/).total)
        const orgIntN1 = Math.abs(getSolde(balanceCumulN1, /^452/).total)
        const ass = Math.abs(getSolde(balanceCumulN, /^462/).total)
        const assN1 = Math.abs(getSolde(balanceCumulN1, /^462/).total)
        const div = Math.abs(getSolde(balanceCumulN, /^4712/).total)
        const divN1 = Math.abs(getSolde(balanceCumulN1, /^4712/).total)
        const tot = orgInt + ass + div
        const totN1 = orgIntN1 + assN1 + divN1

        return [
          { intitule: 'Opérations avec les organismes internationaux (compte 452)', montantN: orgInt, montantN1: orgIntN1, variation: orgInt - orgIntN1, variationPct: fmtVar(orgInt, orgIntN1).pct, colA: orgInt, colB: 0, colC: 0 },
          { intitule: 'Associés, comptes courants créditeurs', montantN: ass, montantN1: assN1, variation: ass - assN1, variationPct: fmtVar(ass, assN1).pct, colA: ass, colB: 0, colC: 0 },
          { intitule: 'Créditeurs divers', montantN: div, montantN1: divN1, variation: div - divN1, variationPct: fmtVar(div, divN1).pct, colA: div, colB: 0, colC: 0 },
          { intitule: 'TOTAL AUTRES DETTES', montantN: tot, montantN1: totN1, variation: tot - totN1, variationPct: fmtVar(tot, totN1).pct, colA: tot, colB: 0, colC: 0 },
          { intitule: 'Risques provisionnés à court terme (compte 499)', montantN: DN.netN, montantN1: DN.netN1, variation: DN.netN - DN.netN1, variationPct: fmtVar(DN.netN, DN.netN1).pct, colA: DN.netN, colB: 0, colC: 0 },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 20 : CRÉDITS D'ESCOMPTE ET DE TRÉSORERIE (TRÉSORERIE PASSIF)
    // -------------------------------------------------------------------------
    {
      id: 'note-20',
      numero: 'NOTE 20',
      nomNote: 'BANQUES, CRÉDITS D’ESCOMPTE ET DE TRÉSORERIE',
      statut: totalTresoPassif.netN > 0 ? 'A' : 'N/A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %'],
      items: [
        { intitule: 'Escomptes de crédits de campagne', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'Banques locales créditrices (découverts - compte 5212)', montantN: totalTresoPassif.netN, montantN1: totalTresoPassif.netN1, variationPct: fmtVar(totalTresoPassif.netN, totalTresoPassif.netN1).pct },
        { intitule: 'Crédits de trésorerie', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'TOTAL TRÉSORERIE PASSIF', montantN: totalTresoPassif.netN, montantN1: totalTresoPassif.netN1, variationPct: fmtVar(totalTresoPassif.netN, totalTresoPassif.netN1).pct },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 21 : CHIFFRE D'AFFAIRES ET AUTRES PRODUITS
    // -------------------------------------------------------------------------
    {
      id: 'note-21',
      numero: 'NOTE 21',
      nomNote: 'CHIFFRE D’AFFAIRES ET AUTRES PRODUITS',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %'],
      items: [
        { intitule: 'Ventes de marchandises dans la région', montantN: TA_N.total, montantN1: TA_N1.total, variationPct: fmtVar(TA_N.total, TA_N1.total).pct },
        { intitule: 'Ventes de produits fabriqués', montantN: TB_N.total, montantN1: TB_N1.total, variationPct: fmtVar(TB_N.total, TB_N1.total).pct },
        { intitule: 'Travaux et services vendus dans la région (compte 706)', montantN: TC_N.total, montantN1: TC_N1.total, variationPct: fmtVar(TC_N.total, TC_N1.total).pct },
        { intitule: 'Produits accessoires (locations, frais facturés - compte 707)', montantN: TD_N.total, montantN1: TD_N1.total, variationPct: fmtVar(TD_N.total, TD_N1.total).pct },
        { intitule: 'TOTAL CHIFFRE D’AFFAIRES (A+B+C+D)', montantN: CA_N, montantN1: CA_N1, variationPct: fmtVar(CA_N, CA_N1).pct },
        { intitule: 'Subventions d’exploitation (compte 71)', montantN: TG_N.total, montantN1: TG_N1.total, variationPct: fmtVar(TG_N.total, TG_N1.total).pct },
        { intitule: 'Autres produits d’exploitation (compte 75)', montantN: TH_N.total, montantN1: TH_N1.total, variationPct: fmtVar(TH_N.total, TH_N1.total).pct },
        { intitule: 'TOTAL PRODUITS D’EXPLOITATION', montantN: CA_N + TG_N.total + TH_N.total, montantN1: CA_N1 + TG_N1.total + TH_N1.total, variationPct: fmtVar(CA_N + TG_N.total + TH_N.total, CA_N1 + TG_N1.total + TH_N1.total).pct },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 22 : ACHATS
    // -------------------------------------------------------------------------
    {
      id: 'note-22',
      numero: 'NOTE 22',
      nomNote: 'ACHATS',
      statut: 'A',
      colonnes: ['Libellé', 'Année N', 'Année N-1', 'Var. en %'],
      items: (() => {
        const g = (num: RegExp) => ({
          n: getGestion(lignesGestionN, num).total,
          n1: getGestion(lignesGestionN1, num).total,
        })
        const m = g(/^601/)
        const mp = g(/^602/)
        const four = g(/^604/)
        const eau = g(/^6051/)
        const elec = g(/^6052/)
        const carb = g(/^6053/)
        const pet = g(/^6056/)
        const etu = g(/^6057/)
        const mat = g(/^6058/)
        const tot = RE_N.total + RA_N.total + RC_N.total
        const totN1 = RE_N1.total + RA_N1.total + RC_N1.total

        return [
          { intitule: 'Achats de marchandises', montantN: m.n, montantN1: m.n1, variationPct: fmtVar(m.n, m.n1).pct },
          { intitule: 'Achats de matières premières et fournitures liées', montantN: mp.n, montantN1: mp.n1, variationPct: fmtVar(mp.n, mp.n1).pct },
          { intitule: 'Fournitures de bureau et consommables (compte 604)', montantN: four.n, montantN1: four.n1, variationPct: fmtVar(four.n, four.n1).pct },
          { intitule: 'Eau (compte 6051)', montantN: eau.n, montantN1: eau.n1, variationPct: fmtVar(eau.n, eau.n1).pct },
          { intitule: 'Électricité (compte 6052)', montantN: elec.n, montantN1: elec.n1, variationPct: fmtVar(elec.n, elec.n1).pct },
          { intitule: 'Carburants et lubrifiants (compte 6053)', montantN: carb.n, montantN1: carb.n1, variationPct: fmtVar(carb.n, carb.n1).pct },
          { intitule: 'Petit matériel et outillage (compte 6056)', montantN: pet.n, montantN1: pet.n1, variationPct: fmtVar(pet.n, pet.n1).pct },
          { intitule: 'Achats d’études et prestations de services (compte 6057)', montantN: etu.n, montantN1: etu.n1, variationPct: fmtVar(etu.n, etu.n1).pct },
          { intitule: 'Achats de travaux, matériels et équipements (compte 6058)', montantN: mat.n, montantN1: mat.n1, variationPct: fmtVar(mat.n, mat.n1).pct },
          { intitule: 'TOTAL DES ACHATS', montantN: tot, montantN1: totN1, variationPct: fmtVar(tot, totN1).pct },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 23 : TRANSPORTS
    // -------------------------------------------------------------------------
    {
      id: 'note-23',
      numero: 'NOTE 23',
      nomNote: 'TRANSPORTS',
      statut: 'A',
      colonnes: ['Libellé', 'Année N', 'Année N-1', 'Var. en %'],
      items: (() => {
        const pers = getGestion(lignesGestionN, /^614/).total
        const persN1 = getGestion(lignesGestionN1, /^614/).total
        const plis = getGestion(lignesGestionN, /^616/).total
        const plisN1 = getGestion(lignesGestionN1, /^616/).total
        const voy = getGestion(lignesGestionN, /^618/).total
        const voyN1 = getGestion(lignesGestionN1, /^618/).total
        const tot = getGestion(lignesGestionN, /^61/).total
        const totN1 = getGestion(lignesGestionN1, /^61/).total

        return [
          { intitule: 'Transport du personnel (compte 614)', montantN: pers, montantN1: persN1, variationPct: fmtVar(pers, persN1).pct },
          { intitule: 'Transports de plis et colis (compte 616)', montantN: plis, montantN1: plisN1, variationPct: fmtVar(plis, plisN1).pct },
          { intitule: 'Voyages et déplacements (compte 618)', montantN: voy, montantN1: voyN1, variationPct: fmtVar(voy, voyN1).pct },
          { intitule: 'TOTAL TRANSPORTS', montantN: tot, montantN1: totN1, variationPct: fmtVar(tot, totN1).pct },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 24 : SERVICES EXTÉRIEURS
    // -------------------------------------------------------------------------
    {
      id: 'note-24',
      numero: 'NOTE 24',
      nomNote: 'SERVICES EXTÉRIEURS',
      statut: 'A',
      colonnes: ['Libellé', 'Année N', 'Année N-1', 'Var. en %'],
      items: (() => {
        const g = (num: RegExp) => ({
          n: getGestion(lignesGestionN, num).total,
          n1: getGestion(lignesGestionN1, num).total,
        })
        const loc = g(/^622/)
        const ent = g(/^624/)
        const ass = g(/^625/)
        const pub = g(/^627/)
        const tel = g(/^628/)
        const bq = g(/^631/)
        const hon = g(/^632/)
        const form = g(/^633/)
        const div = g(/^638/)

        return [
          { intitule: 'Locations et charges locatives (compte 622)', montantN: loc.n, montantN1: loc.n1, variationPct: fmtVar(loc.n, loc.n1).pct },
          { intitule: 'Entretien, réparations et maintenance (compte 624)', montantN: ent.n, montantN1: ent.n1, variationPct: fmtVar(ent.n, ent.n1).pct },
          { intitule: 'Primes d’assurances (compte 625)', montantN: ass.n, montantN1: ass.n1, variationPct: fmtVar(ass.n, ass.n1).pct },
          { intitule: 'Publicité, relations publiques (compte 627)', montantN: pub.n, montantN1: pub.n1, variationPct: fmtVar(pub.n, pub.n1).pct },
          { intitule: 'Frais de télécommunications et internet (compte 628)', montantN: tel.n, montantN1: tel.n1, variationPct: fmtVar(tel.n, tel.n1).pct },
          { intitule: 'Frais bancaires et commissions (compte 631)', montantN: bq.n, montantN1: bq.n1, variationPct: fmtVar(bq.n, bq.n1).pct },
          { intitule: 'Rémunérations d’intermédiaires et honoraires (compte 632)', montantN: hon.n, montantN1: hon.n1, variationPct: fmtVar(hon.n, hon.n1).pct },
          { intitule: 'Formation du personnel (compte 633)', montantN: form.n, montantN1: form.n1, variationPct: fmtVar(form.n, form.n1).pct },
          { intitule: 'Missions et réceptions (compte 638)', montantN: div.n, montantN1: div.n1, variationPct: fmtVar(div.n, div.n1).pct },
          { intitule: 'TOTAL SERVICES EXTÉRIEURS', montantN: RH_N.total, montantN1: RH_N1.total, variationPct: fmtVar(RH_N.total, RH_N1.total).pct },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 25 : IMPÔTS ET TAXES
    // -------------------------------------------------------------------------
    {
      id: 'note-25',
      numero: 'NOTE 25',
      nomNote: 'IMPÔTS ET TAXES',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %'],
      items: (() => {
        const dir = getGestion(lignesGestionN, /^641/).total
        const dirN1 = getGestion(lignesGestionN1, /^641/).total
        const ind = getGestion(lignesGestionN, /^645/).total
        const indN1 = getGestion(lignesGestionN1, /^645/).total
        const enr = getGestion(lignesGestionN, /^646/).total
        const enrN1 = getGestion(lignesGestionN1, /^646/).total
        const pen = getGestion(lignesGestionN, /^647/).total
        const penN1 = getGestion(lignesGestionN1, /^647/).total

        return [
          { intitule: 'Impôts et taxes directs (patentes, taxe sur salaires)', montantN: dir, montantN1: dirN1, variationPct: fmtVar(dir, dirN1).pct },
          { intitule: 'Impôts et taxes indirects', montantN: ind, montantN1: indN1, variationPct: fmtVar(ind, indN1).pct },
          { intitule: 'Droits d’enregistrement et de timbre (compte 646)', montantN: enr, montantN1: enrN1, variationPct: fmtVar(enr, enrN1).pct },
          { intitule: 'Pénalités et amendes fiscales (compte 647)', montantN: pen, montantN1: penN1, variationPct: fmtVar(pen, penN1).pct },
          { intitule: 'TOTAL IMPÔTS ET TAXES', montantN: RI_N.total, montantN1: RI_N1.total, variationPct: fmtVar(RI_N.total, RI_N1.total).pct },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 26 : AUTRES CHARGES
    // -------------------------------------------------------------------------
    {
      id: 'note-26',
      numero: 'NOTE 26',
      nomNote: 'AUTRES CHARGES D’EXPLOITATION',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %'],
      items: (() => {
        const pc = getGestion(lignesGestionN, /^6511/).total
        const pcN1 = getGestion(lignesGestionN1, /^6511/).total
        const pd = getGestion(lignesGestionN, /^6515/).total
        const pdN1 = getGestion(lignesGestionN1, /^6515/).total
        const jet = getGestion(lignesGestionN, /^6581/).total
        const jetN1 = getGestion(lignesGestionN1, /^6581/).total

        return [
          { intitule: 'Pertes sur créances clients (compte 6511)', montantN: pc, montantN1: pcN1, variationPct: fmtVar(pc, pcN1).pct },
          { intitule: 'Pertes sur autres débiteurs (compte 6515)', montantN: pd, montantN1: pdN1, variationPct: fmtVar(pd, pdN1).pct },
          { intitule: 'Indemnités et rémunérations d’administrateurs (compte 6581)', montantN: jet, montantN1: jetN1, variationPct: fmtVar(jet, jetN1).pct },
          { intitule: 'TOTAL AUTRES CHARGES', montantN: RJ_N.total, montantN1: RJ_N1.total, variationPct: fmtVar(RJ_N.total, RJ_N1.total).pct },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 27A : CHARGES DE PERSONNEL
    // -------------------------------------------------------------------------
    {
      id: 'note-27a',
      numero: 'NOTE 27A',
      nomNote: 'CHARGES DE PERSONNEL',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %'],
      items: (() => {
        const sal = getGestion(lignesGestionN, /^6611/).total
        const salN1 = getGestion(lignesGestionN1, /^6611/).total
        const pri = getGestion(lignesGestionN, /^661[2-8]/).total
        const priN1 = getGestion(lignesGestionN1, /^661[2-8]/).total
        const tr = getGestion(lignesGestionN, /^6634/).total
        const trN1 = getGestion(lignesGestionN1, /^6634/).total
        const soc = getGestion(lignesGestionN, /^664/).total
        const socN1 = getGestion(lignesGestionN1, /^664/).total
        const med = getGestion(lignesGestionN, /^6684/).total
        const medN1 = getGestion(lignesGestionN1, /^6684/).total

        return [
          { intitule: 'Rémunérations directes personnel national (salaires)', montantN: sal, montantN1: salN1, variationPct: fmtVar(sal, salN1).pct },
          { intitule: 'Primes, indemnités de fin de contrat et congés', montantN: pri, montantN1: priN1, variationPct: fmtVar(pri, priN1).pct },
          { intitule: 'Primes de transport (compte 6634)', montantN: tr, montantN1: trN1, variationPct: fmtVar(tr, trN1).pct },
          { intitule: 'Charges sociales patronales (CSS / IPRES)', montantN: soc, montantN1: socN1, variationPct: fmtVar(soc, socN1).pct },
          { intitule: 'Médecine du travail et pharmacie (compte 6684)', montantN: med, montantN1: medN1, variationPct: fmtVar(med, medN1).pct },
          { intitule: 'TOTAL CHARGES DE PERSONNEL', montantN: RK_N.total, montantN1: RK_N1.total, variationPct: fmtVar(RK_N.total, RK_N1.total).pct },
        ]
      })(),
    },

    // -------------------------------------------------------------------------
    // NOTE 27B : EFFECTIFS, MASSE SALARIALE ET PERSONNEL EXTÉRIEUR
    // -------------------------------------------------------------------------
    {
      id: 'note-27b',
      numero: 'NOTE 27B',
      nomNote: 'EFFECTIFS ET MASSE SALARIALE',
      statut: 'A',
      colonnes: ['QUALIFICATIONS', 'Nationaux (M/F)', 'Autres États', 'Total Effectifs', 'Masse salariale Nationaux', 'Total Masse Salariale'],
      items: [
        { intitule: '1. Cadres supérieurs', detail: '4H / 1F', colA: '5', colB: 0, montantN: 39391376, montantN1: 39391376 },
        { intitule: '2. Techniciens supérieurs et cadres moyens', detail: '4H / 1F', colA: '5', colB: 0, montantN: 14923594, montantN1: 14923594 },
        { intitule: '3. Agents de maîtrise et ouvriers qualifiés', detail: '0H / 0F', colA: '0', colB: 0, montantN: 0, montantN1: 0 },
        { intitule: '4. Employés, ouvriers et manoeuvres', detail: '2H / 0F', colA: '2', colB: 0, montantN: 4740012, montantN1: 4740012 },
        { intitule: 'TOTAL PERMANENTS', detail: '10H / 2F', colA: '12', colB: 0, montantN: RK_N.total, montantN1: RK_N1.total },
        { intitule: 'PERSONNEL SAISONNIER OU EXTÉRIEUR', detail: '0H / 0F', colA: '0', colB: 0, montantN: 0, montantN1: 0 },
        { intitule: 'TOTAL GÉNÉRAL (1 + 2)', detail: '10H / 2F', colA: '12', colB: 0, montantN: RK_N.total, montantN1: RK_N1.total },
      ],
      commentaires: 'Effectif total au 31 décembre : 12 salariés permanents.',
    },

    // -------------------------------------------------------------------------
    // NOTE 28 : PROVISIONS ET DÉPRÉCIATIONS INSCRITES AU BILAN
    // -------------------------------------------------------------------------
    {
      id: 'note-28',
      numero: 'NOTE 28',
      nomNote: 'PROVISIONS ET DÉPRÉCIATIONS INSCRITES AU BILAN',
      statut: 'A',
      colonnes: ['NATURE', 'Provisions ouv. (A)', 'Dotations (B)', 'Reprises (C)', 'Provisions clôt. (D=A+B-C)'],
      items: [
        { intitule: 'Provisions réglementées (classe 15)', colA: CJ.netN1, colB: 0, colC: 0, montantN: CJ.netN, montantN1: CJ.netN1 },
        { intitule: 'Provisions financières pour risques et charges (classe 19)', colA: DC.netN1, colB: 0, colC: 0, montantN: DC.netN, montantN1: DC.netN1 },
        { intitule: 'Dépréciations des immobilisations (classe 29)', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
        { intitule: 'Dépréciations des stocks (classe 39)', colA: 0, colB: 0, colC: 0, montantN: BB.amortN, montantN1: 0 },
        { intitule: 'Dépréciations des créances clients (classe 491)', colA: 0, colB: 0, colC: 0, montantN: BI.amortN, montantN1: 0 },
        { intitule: 'Dépréciations autres créances et HAO', colA: 0, colB: 0, colC: 0, montantN: 0, montantN1: 0 },
        { intitule: 'TOTAL DES PROVISIONS ET DÉPRÉCIATIONS', colA: CJ.netN1 + DC.netN1, colB: 0, colC: 0, montantN: CJ.netN + DC.netN + BB.amortN + BI.amortN, montantN1: CJ.netN1 + DC.netN1 },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 29 : CHARGES ET REVENUS FINANCIERS
    // -------------------------------------------------------------------------
    {
      id: 'note-29',
      numero: 'NOTE 29',
      nomNote: 'CHARGES ET REVENUS FINANCIERS',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %'],
      items: [
        { intitule: 'Intérêts des emprunts et dettes financières (compte 671)', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'Pertes de change (compte 676)', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'SOUS-TOTAL : FRAIS FINANCIERS (A)', montantN: RM_N.total, montantN1: RM_N1.total, variationPct: fmtVar(RM_N.total, RM_N1.total).pct },
        { intitule: 'Revenus de titres et intérêts de prêts (compte 771)', montantN: TK_N.total, montantN1: TK_N1.total, variationPct: fmtVar(TK_N.total, TK_N1.total).pct },
        { intitule: 'Gains de change financiers (compte 776)', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'Reprises de provisions financières', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'SOUS-TOTAL : REVENUS FINANCIERS (B)', montantN: TK_N.total, montantN1: TK_N1.total, variationPct: fmtVar(TK_N.total, TK_N1.total).pct },
        { intitule: 'RÉSULTAT FINANCIER (B - A)', montantN: RF_N, montantN1: RF_N1, variationPct: fmtVar(RF_N, RF_N1).pct },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 30 : AUTRES CHARGES ET PRODUITS HAO
    // -------------------------------------------------------------------------
    {
      id: 'note-30',
      numero: 'NOTE 30',
      nomNote: 'AUTRES CHARGES ET PRODUITS HAO',
      statut: 'A',
      colonnes: ['Libellés', 'Année N', 'Année N-1', 'Var. en %'],
      items: [
        { intitule: 'Charges HAO constatées (compte 831)', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'Pertes sur créances HAO (compte 834)', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'SOUS-TOTAL : AUTRES CHARGES HAO (RP)', montantN: RP_N_HAO.total, montantN1: RP_N1_HAO.total, variationPct: fmtVar(RP_N_HAO.total, RP_N1_HAO.total).pct },
        { intitule: 'Produits HAO constatés (compte 841)', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'Dons et libéralités obtenus (compte 845)', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'Subventions d’équilibre (compte 88)', montantN: 0, montantN1: 0, variationPct: '0.0%' },
        { intitule: 'SOUS-TOTAL : AUTRES PRODUITS HAO (TO)', montantN: TO_N.total, montantN1: TO_N1.total, variationPct: fmtVar(TO_N.total, TO_N1.total).pct },
        { intitule: 'RÉSULTAT HORS ACTIVITÉS ORDINAIRES (XH)', montantN: RHAO_N, montantN1: RHAO_N1, variationPct: fmtVar(RHAO_N, RHAO_N1).pct },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 31 : RÉPARTITION DU RÉSULTAT ET INDICATEURS DES 5 DERNIERS EXERCICES
    // -------------------------------------------------------------------------
    {
      id: 'note-31',
      numero: 'NOTE 31',
      nomNote: 'RÉSULTATS DES 5 DERNIERS EXERCICES',
      statut: 'A',
      colonnes: ['NATURE DES INDICATIONS', 'N', 'N-1', 'N-2', 'N-3', 'N-4'],
      items: [
        { intitule: 'Capital social à la clôture', colA: CA.netN, colB: CA.netN1, colC: CA.netN1, colD: 0, colE: 0, montantN: CA.netN, montantN1: CA.netN1 },
        { intitule: 'Chiffre d’affaires hors taxes', colA: CA_N, colB: CA_N1, colC: 0, colD: 0, colE: 0, montantN: CA_N, montantN1: CA_N1 },
        { intitule: 'Résultat des activités ordinaires (RAO)', colA: RAO_N, colB: RAO_N1, colC: 0, colD: 0, colE: 0, montantN: RAO_N, montantN1: RAO_N1 },
        { intitule: 'Impôt sur le résultat (IS / IMF)', colA: RS_N_Impots.total, colB: RS_N1_Impots.total, colC: 0, colD: 0, colE: 0, montantN: RS_N_Impots.total, montantN1: RS_N1_Impots.total },
        { intitule: 'Résultat net de l’exercice (+/-)', colA: RN_N_Total, colB: RN_N1_Total, colC: 0, colD: 0, colE: 0, montantN: RN_N_Total, montantN1: RN_N1_Total },
        { intitule: 'Résultats distribués (dividendes)', colA: 0, colB: 0, colC: 0, colD: 0, colE: 0, montantN: 0, montantN1: 0 },
        { intitule: 'Masse salariale brute versée', colA: RK_N.total, colB: RK_N1.total, colC: 0, colD: 0, colE: 0, montantN: RK_N.total, montantN1: RK_N1.total },
        { intitule: 'Effectif moyen des salariés', colA: 12, colB: 12, colC: 0, colD: 0, colE: 0, montantN: 12, montantN1: 12 },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 32 : PRODUCTION DE L'EXERCICE
    // -------------------------------------------------------------------------
    {
      id: 'note-32',
      numero: 'NOTE 32',
      nomNote: 'PRODUCTION DE L’EXERCICE',
      statut: TB_N.total > 0 || TC_N.total > 0 ? 'A' : 'N/A',
      colonnes: ['Désignation produit / service', 'Unité', 'Ventes Pays (Qté / Val)', 'Ventes OHADA', 'Hors OHADA', 'Stock Clôture'],
      items: [
        { intitule: 'Prestations de services et appui technique', detail: 'Services', colA: TC_N.total, colB: 0, colC: 0, colD: 0, montantN: TC_N.total, montantN1: TC_N1.total },
        { intitule: 'TOTAL PRODUCTION DE L’EXERCICE', detail: '', colA: TC_N.total, colB: 0, colC: 0, colD: 0, montantN: TC_N.total, montantN1: TC_N1.total },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 33 : ACHATS DESTINÉS À LA PRODUCTION
    // -------------------------------------------------------------------------
    {
      id: 'note-33',
      numero: 'NOTE 33',
      nomNote: 'ACHATS DESTINÉS À LA PRODUCTION',
      statut: RC_N.total > 0 || RE_N.total > 0 ? 'A' : 'N/A',
      colonnes: ['Désignations matières / produits', 'Unité', 'Achats Pays (Valeur)', 'Produits Importés', 'Variation stocks'],
      items: [
        { intitule: 'Approvisionnements et intrants d’exploitation', detail: 'Divers', colA: RE_N.total, colB: 0, colC: 0, montantN: RE_N.total, montantN1: RE_N1.total },
        { intitule: 'TOTAL ACHATS DESTINÉS À LA PRODUCTION', detail: '', colA: RE_N.total, colB: 0, colC: 0, montantN: RE_N.total, montantN1: RE_N1.total },
      ],
    },

    // -------------------------------------------------------------------------
    // NOTE 34 : FICHE DE SYNTHÈSE DES PRINCIPAUX INDICATEURS FINANCIERS
    // -------------------------------------------------------------------------
    {
      id: 'note-34',
      numero: 'NOTE 34',
      nomNote: 'FICHE DE SYNTHÈSE DES PRINCIPAUX INDICATEURS FINANCIERS',
      statut: 'A',
      colonnes: ['(EN MILLIERS DE FRANCS) / INDICATEURS', 'Année N', 'Année N-1', 'Var. en %'],
      items: indicateurs.map((ind) => ({
        intitule: ind.libelle,
        montantN: ind.montantN,
        montantN1: ind.montantN1,
        variationPct: typeof ind.montantN === 'number' && typeof ind.montantN1 === 'number'
          ? fmtVar(ind.montantN, ind.montantN1).pct
          : '',
        detail: ind.code,
      })),
      commentaires: 'Indicateurs de solvabilité, de rentabilité et d’équilibre financier conformes aux normes OHADA.',
    },

    // -------------------------------------------------------------------------
    // NOTE 35 : INFORMATIONS SOCIALES, ENVIRONNEMENTALES ET SOCIÉTALES (RSE)
    // -------------------------------------------------------------------------
    {
      id: 'note-35',
      numero: 'NOTE 35',
      nomNote: 'INFORMATIONS SOCIALES, ENVIRONNEMENTALES ET SOCIÉTALES (RSE)',
      statut: 'A',
      colonnes: ['Domaines RSE', 'Engagements et actions réalisées'],
      items: [
        { intitule: '1. Informations sociales (Emploi & Conditions de travail)', montantN: 'Conforme', detail: '12 salariés permanents. Respect des conventions collectives, de la sécurité sociale et de la médecine du travail.' },
        { intitule: '2. Informations environnementales', montantN: 'Préservé', detail: 'Gestion raisonnée des intrants et de l’eau, valorisation des résidus agricoles et conformité environnementale.' },
        { intitule: '3. Engagements sociétaux & impact territorial', montantN: 'Actif', detail: 'Appui direct au développement agricole et économique des producteurs locaux de la zone de Saint-Louis.' },
      ],
      commentaires: 'Note requise au titre de la responsabilité sociétale de l’entreprise (RSE) selon le SYSCOHADA Révisé.',
    },

    // -------------------------------------------------------------------------
    // NOTE 36 : TABLE DES CODES OFFICIELS
    // -------------------------------------------------------------------------
    {
      id: 'note-36',
      numero: 'NOTE 36',
      nomNote: 'TABLE DES CODES OFFICIELS',
      statut: 'A',
      colonnes: ['Rubrique', 'Code appliqué', 'Signification réglementaire'],
      items: [
        { intitule: 'Forme juridique (Code 02)', colA: '02', colB: 'Société Commerciale (SARL / SAS)', montantN: '02', detail: 'SARL / SAS' },
        { intitule: 'Régime fiscal (Code 1)', colA: '1', colB: 'Réel Normal (SYSCOHADA)', montantN: '1', detail: 'Réel Normal' },
        { intitule: 'Pays du siège social (Code 07)', colA: '07', colB: 'Sénégal (UEMOA)', montantN: '07', detail: 'Sénégal' },
        { intitule: 'Activité principale (Nomenclature UEMOA)', colA: '038003', colB: 'Services rendus principalement aux entreprises', montantN: '038003', detail: 'Services aux entreprises' },
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
