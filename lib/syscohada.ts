/**
 * Moteur des États Financiers SYSCOHADA Révisé — Système Normal
 * Conforme aux normes OHADA pour l'Agrobusiness et les entreprises d'Afrique de l'Ouest et Centrale.
 * 
 * Génère :
 * 1. Bilan Actif (Brut, Amortissements/Dépréciations, Net N, Net N-1)
 * 2. Bilan Passif (Net N, Net N-1)
 * 3. Compte de Résultat en cascade (SIG : Marge, CA, VA, EBE, REX, RF, RAO, RHAO, RN)
 * 4. Tableau des Flux de Trésorerie (TFT : Activités Opérationnelles, Investissement, Financement)
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

export type EtatsFinanciersSyscohada = {
  exerciceN: ExerciceComptable
  exerciceN1?: ExerciceComptable
  bilanActif: PosteBilanActif[]
  totalActifN: { brut: number; amort: number; net: number }
  totalActifN1: { net: number }
  bilanPassif: PosteBilanPassif[]
  totalPassifN: number
  totalPassifN1: number
  compteResultat: PosteCompteResultat[]
  tft: LigneTFT[]
  controles: {
    equilibreBilanN: number
    equilibreBilanN1: number
    resultatNetN: number
    resultatNetN1: number
    tresorerieNetteN: number
    tresorerieNetteN1: number
    variationTresorerieN: number
    ecartBouclageTFT: number
  }
}

/**
 * Calculateur central des états financiers SYSCOHADA
 */
export function genererEtatsFinanciersSyscohada(
  toutesLignes: LigneBalance[],
  exerciceCourant: ExerciceComptable,
  exercicesTous: ExerciceComptable[]
): EtatsFinanciersSyscohada {
  // 1. Identifier l'exercice précédent N-1
  const exercicePrecedent = exercicesTous.find((e) => e.date_fin < exerciceCourant.date_debut)

  // 2. Définir les périmètres de cumul pour le bilan
  // Les comptes de bilan (classes 1 à 5) se cumulent jusqu'à la date de fin de l'exercice
  const idsCumulN = new Set(
    exercicesTous.filter((e) => e.date_fin <= exerciceCourant.date_fin).map((e) => e.id)
  )
  const idsCumulN1 = new Set(
    exercicePrecedent
      ? exercicesTous.filter((e) => e.date_fin <= exercicePrecedent.date_fin).map((e) => e.id)
      : []
  )

  // Agréger les soldes par numéro de compte pour le bilan N
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

  // Agréger les soldes par numéro de compte pour le bilan N-1
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

  // Gestion / Compte de résultat pour N uniquement
  const lignesGestionN = toutesLignes.filter((l) => l.exercice_id === exerciceCourant.id && l.classe >= 6)
  // Gestion pour N-1 uniquement
  const lignesGestionN1 = exercicePrecedent
    ? toutesLignes.filter((l) => l.exercice_id === exercicePrecedent.id && l.classe >= 6)
    : []

  // Aides pour filtrer les comptes par regex de numéro
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
        // En classe 7 & 8 créditeur, le solde créditeur naturel est un produit
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
  // 1. CALCUL DU COMPTE DE RÉSULTAT (SYSCOHADA SYSTÈME NORMAL)
  // =========================================================================

  // Produits d'exploitation
  const TA_N = getGestion(lignesGestionN, /^701/)
  const TA_N1 = getGestion(lignesGestionN1, /^701/)

  const TB_N = getGestion(lignesGestionN, /^70[2-6]/)
  const TB_N1 = getGestion(lignesGestionN1, /^70[2-6]/)

  const TC_N = getGestion(lignesGestionN, /^707/)
  const TC_N1 = getGestion(lignesGestionN1, /^707/)

  const TD_N = getGestion(lignesGestionN, /^708|^71/)
  const TD_N1 = getGestion(lignesGestionN1, /^708|^71/)

  // Chiffre d'Affaires (A)
  const CA_N = TA_N.total + TB_N.total + TC_N.total + TD_N.total
  const CA_N1 = TA_N1.total + TB_N1.total + TC_N1.total + TD_N1.total

  // Charges d'exploitation de marchandises
  const RA_N = getGestion(lignesGestionN, /^601/)
  const RA_N1 = getGestion(lignesGestionN1, /^601/)

  const RB_N = getGestion(lignesGestionN, /^6031/)
  const RB_N1 = getGestion(lignesGestionN1, /^6031/)

  // Marge Commerciale (1)
  const MargeComm_N = TA_N.total - (RA_N.total + RB_N.total)
  const MargeComm_N1 = TA_N1.total - (RA_N1.total + RB_N1.total)

  // Autres produits d'exploitation
  const TE_N = getGestion(lignesGestionN, /^73/) // Production stockée
  const TE_N1 = getGestion(lignesGestionN1, /^73/)

  const TF_N = getGestion(lignesGestionN, /^72/) // Production immobilisée
  const TF_N1 = getGestion(lignesGestionN1, /^72/)

  const TG_N = getGestion(lignesGestionN, /^71/) // Subventions d'exploitation
  const TG_N1 = getGestion(lignesGestionN1, /^71/)

  const TH_N = getGestion(lignesGestionN, /^75/) // Autres produits
  const TH_N1 = getGestion(lignesGestionN1, /^75/)

  // Consommations de l'exercice
  const RC_N = getGestion(lignesGestionN, /^602/) // Matières premières
  const RC_N1 = getGestion(lignesGestionN1, /^602/)

  const RD_N = getGestion(lignesGestionN, /^6032/) // Var. stock matières
  const RD_N1 = getGestion(lignesGestionN1, /^6032/)

  const RE_N = getGestion(lignesGestionN, /^60[458]/) // Autres achats
  const RE_N1 = getGestion(lignesGestionN1, /^60[458]/)

  const ChargeTransport_N = getGestion(lignesGestionN, /^61/) // Transports
  const ChargeTransport_N1 = getGestion(lignesGestionN1, /^61/)

  const RG_N = getGestion(lignesGestionN, /^6[23]/) // Services extérieurs
  const RG_N1 = getGestion(lignesGestionN1, /^6[23]/)

  const RH_N = getGestion(lignesGestionN, /^64/) // Impôts et taxes
  const RH_N1 = getGestion(lignesGestionN1, /^64/)

  const RJ_N = getGestion(lignesGestionN, /^65/) // Autres charges
  const RJ_N1 = getGestion(lignesGestionN1, /^65/)

  // Valeur Ajoutée (2)
  const VA_N =
    MargeComm_N +
    (TB_N.total + TC_N.total + TD_N.total + TE_N.total + TF_N.total + TG_N.total + TH_N.total) -
    (RC_N.total + RD_N.total + RE_N.total + ChargeTransport_N.total + RG_N.total + RH_N.total + RJ_N.total)
  const VA_N1 =
    MargeComm_N1 +
    (TB_N1.total + TC_N1.total + TD_N1.total + TE_N1.total + TF_N1.total + TG_N1.total + TH_N1.total) -
    (RC_N1.total + RD_N1.total + RE_N1.total + ChargeTransport_N1.total + RG_N1.total + RH_N1.total + RJ_N1.total)

  // Charges de personnel
  const RK_N = getGestion(lignesGestionN, /^66/)
  const RK_N1 = getGestion(lignesGestionN1, /^66/)

  // Excédent Brut d'Exploitation (EBE) (3)
  const EBE_N = VA_N - RK_N.total
  const EBE_N1 = VA_N1 - RK_N1.total

  // Dotations & Reprises d'exploitation
  const TJ_N = getGestion(lignesGestionN, /^791|^798/)
  const TJ_N1 = getGestion(lignesGestionN1, /^791|^798/)

  const RL_N = getGestion(lignesGestionN, /^681|^691/)
  const RL_N1 = getGestion(lignesGestionN1, /^681|^691/)

  // Résultat d'Exploitation (4)
  const REX_N = EBE_N + TJ_N.total - RL_N.total
  const REX_N1 = EBE_N1 + TJ_N1.total - RL_N1.total

  // Financier
  const TK_N = getGestion(lignesGestionN, /^77|^797/)
  const TK_N1 = getGestion(lignesGestionN1, /^77|^797/)

  const RM_N = getGestion(lignesGestionN, /^67|^697/)
  const RM_N1 = getGestion(lignesGestionN1, /^67|^697/)

  // Résultat Financier (5)
  const RF_N = TK_N.total - RM_N.total
  const RF_N1 = TK_N1.total - RM_N1.total

  // Résultat des Activités Ordinaires (RAO) (6)
  const RAO_N = REX_N + RF_N
  const RAO_N1 = REX_N1 + RF_N1

  // Hors Activités Ordinaires (H.A.O.)
  const TL_N = getGestion(lignesGestionN, /^82|^84|^86|^88/)
  const TL_N1 = getGestion(lignesGestionN1, /^82|^84|^86|^88/)

  const RN_N = getGestion(lignesGestionN, /^81|^83|^85/)
  const RN_N1 = getGestion(lignesGestionN1, /^81|^83|^85/)

  // Résultat H.A.O. (7)
  const RHAO_N = TL_N.total - RN_N.total
  const RHAO_N1 = TL_N1.total - RN_N1.total

  // Participation & Impôts
  const RP_N = getGestion(lignesGestionN, /^87/)
  const RP_N1 = getGestion(lignesGestionN1, /^87/)

  const RQ_N = getGestion(lignesGestionN, /^89/)
  const RQ_N1 = getGestion(lignesGestionN1, /^89/)

  // RÉSULTAT NET (8)
  const RN_N_Total = RAO_N + RHAO_N - RP_N.total - RQ_N.total
  const RN_N1_Total = RAO_N1 + RHAO_N1 - RP_N1.total - RQ_N1.total

  // Construction du tableau du Compte de Résultat
  const compteResultat: PosteCompteResultat[] = [
    { ref: 'TA', libelle: 'Ventes de marchandises', note: 'Note 21', montantN: TA_N.total, montantN1: TA_N1.total, type: 'poste', comptesN: TA_N.comptes },
    { ref: 'RA', libelle: 'Achats de marchandises', note: 'Note 22', montantN: RA_N.total, montantN1: RA_N1.total, type: 'poste', comptesN: RA_N.comptes },
    { ref: 'RB', libelle: 'Variation de stocks de marchandises', note: 'Note 6', montantN: RB_N.total, montantN1: RB_N1.total, type: 'poste', comptesN: RB_N.comptes },
    { ref: 'XA', libelle: 'MARGE COMMERCIALE (Somme TA à RB)', note: '', montantN: MargeComm_N, montantN1: MargeComm_N1, type: 'sig', estTotal: true },

    { ref: 'TB', libelle: 'Ventes de produits fabriqués et activités agricoles', note: 'Note 21', montantN: TB_N.total, montantN1: TB_N1.total, type: 'poste', comptesN: TB_N.comptes },
    { ref: 'TC', libelle: 'Travaux, services vendus', note: 'Note 21', montantN: TC_N.total, montantN1: TC_N1.total, type: 'poste', comptesN: TC_N.comptes },
    { ref: 'TD', libelle: 'Produits accessoires', note: 'Note 21', montantN: TD_N.total, montantN1: TD_N1.total, type: 'poste', comptesN: TD_N.comptes },
    { ref: 'XB', libelle: 'CHIFFRE D’AFFAIRES (TA + TB + TC + TD)', note: '', montantN: CA_N, montantN1: CA_N1, type: 'sig', estTotal: true },

    { ref: 'TE', libelle: 'Production stockée (ou déstockage)', note: 'Note 6', montantN: TE_N.total, montantN1: TE_N1.total, type: 'poste', comptesN: TE_N.comptes },
    { ref: 'TF', libelle: 'Production immobilisée', note: 'Note 21', montantN: TF_N.total, montantN1: TF_N1.total, type: 'poste', comptesN: TF_N.comptes },
    { ref: 'TG', libelle: 'Subventions d’exploitation', note: 'Note 23', montantN: TG_N.total, montantN1: TG_N1.total, type: 'poste', comptesN: TG_N.comptes },
    { ref: 'TH', libelle: 'Autres produits d’exploitation', note: 'Note 23', montantN: TH_N.total, montantN1: TH_N1.total, type: 'poste', comptesN: TH_N.comptes },

    { ref: 'RC', libelle: 'Achats de matières premières et fournitures liées', note: 'Note 22', montantN: RC_N.total, montantN1: RC_N1.total, type: 'poste', comptesN: RC_N.comptes },
    { ref: 'RD', libelle: 'Variation de stocks de matières premières et fournitures', note: 'Note 6', montantN: RD_N.total, montantN1: RD_N1.total, type: 'poste', comptesN: RD_N.comptes },
    { ref: 'RE', libelle: 'Autres achats', note: 'Note 22', montantN: RE_N.total, montantN1: RE_N1.total, type: 'poste', comptesN: RE_N.comptes },
    { ref: 'RF', libelle: 'Transports', note: 'Note 24', montantN: ChargeTransport_N.total, montantN1: ChargeTransport_N1.total, type: 'poste', comptesN: ChargeTransport_N.comptes },
    { ref: 'RG', libelle: 'Services extérieurs', note: 'Note 24', montantN: RG_N.total, montantN1: RG_N1.total, type: 'poste', comptesN: RG_N.comptes },
    { ref: 'RH', libelle: 'Impôts et taxes', note: 'Note 25', montantN: RH_N.total, montantN1: RH_N1.total, type: 'poste', comptesN: RH_N.comptes },
    { ref: 'RJ', libelle: 'Autres charges d’exploitation', note: 'Note 26', montantN: RJ_N.total, montantN1: RJ_N1.total, type: 'poste', comptesN: RJ_N.comptes },
    { ref: 'XC', libelle: 'VALEUR AJOUTÉE', note: '', montantN: VA_N, montantN1: VA_N1, type: 'sig', estTotal: true },

    { ref: 'RK', libelle: 'Charges de personnel', note: 'Note 27', montantN: RK_N.total, montantN1: RK_N1.total, type: 'poste', comptesN: RK_N.comptes },
    { ref: 'XD', libelle: 'EXCÉDENT BRUT D’EXPLOITATION (EBE)', note: '', montantN: EBE_N, montantN1: EBE_N1, type: 'sig', estTotal: true },

    { ref: 'TJ', libelle: 'Reprises d’amortissements, dépréciations et provisions', note: 'Note 28', montantN: TJ_N.total, montantN1: TJ_N1.total, type: 'poste', comptesN: TJ_N.comptes },
    { ref: 'RL', libelle: 'Dotations aux amortissements, dépréciations et provisions', note: 'Note 28', montantN: RL_N.total, montantN1: RL_N1.total, type: 'poste', comptesN: RL_N.comptes },
    { ref: 'XE', libelle: 'RÉSULTAT D’EXPLOITATION', note: '', montantN: REX_N, montantN1: REX_N1, type: 'sig', estTotal: true },

    { ref: 'TK', libelle: 'Produits financiers', note: 'Note 29', montantN: TK_N.total, montantN1: TK_N1.total, type: 'poste', comptesN: TK_N.comptes },
    { ref: 'RM', libelle: 'Charges financières', note: 'Note 29', montantN: RM_N.total, montantN1: RM_N1.total, type: 'poste', comptesN: RM_N.comptes },
    { ref: 'XF', libelle: 'RÉSULTAT FINANCIER', note: '', montantN: RF_N, montantN1: RF_N1, type: 'sig', estTotal: true },
    { ref: 'XG', libelle: 'RÉSULTAT DES ACTIVITÉS ORDINAIRES (RAO)', note: '', montantN: RAO_N, montantN1: RAO_N1, type: 'sig', estTotal: true },

    { ref: 'TL', libelle: 'Produits des cessions d’immobilisations et H.A.O.', note: 'Note 30', montantN: TL_N.total, montantN1: TL_N1.total, type: 'poste', comptesN: TL_N.comptes },
    { ref: 'RN', libelle: 'Valeurs comptables des cessions d’immo. et charges H.A.O.', note: 'Note 30', montantN: RN_N.total, montantN1: RN_N1.total, type: 'poste', comptesN: RN_N.comptes },
    { ref: 'XH', libelle: 'RÉSULTAT HORS ACTIVITÉS ORDINAIRES (RHAO)', note: '', montantN: RHAO_N, montantN1: RHAO_N1, type: 'sig', estTotal: true },

    { ref: 'RP', libelle: 'Participation des travailleurs', note: 'Note 31', montantN: RP_N.total, montantN1: RP_N1.total, type: 'poste', comptesN: RP_N.comptes },
    { ref: 'RQ', libelle: 'Impôts sur le résultat', note: 'Note 32', montantN: RQ_N.total, montantN1: RQ_N1.total, type: 'poste', comptesN: RQ_N.comptes },
    { ref: 'XI', libelle: 'RÉSULTAT NET DE L’EXERCICE (Bénéfice + ou Perte -)', note: '', montantN: RN_N_Total, montantN1: RN_N1_Total, type: 'sig', estTotal: true },
  ]

  // =========================================================================
  // 2. CALCUL DU BILAN ACTIF (SYSCOHADA SYSTÈME NORMAL)
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

    // Les amortissements (comptes 28, 29, 39, 49) ont naturellement un solde créditeur (négatif dans notre balance).
    // On prend leur valeur absolue positive pour la colonne Amortissements/Dépréciations.
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
  const AD = ligneActif('AD', 'Charges immobilisées', 'Note 3', /^20/, /^280/)
  const AE = ligneActif('AE', 'Immobilisations incorporelles', 'Note 3', /^21/, /^281|^291/)
  const AF = ligneActif('AF', 'Terrains (dont terrains agricoles et agencements)', 'Note 4', /^22/, /^292/)
  const AG = ligneActif('AG', 'Bâtiments', 'Note 4', /^23[1-7]/, /^283[1-7]|^293[1-7]/)
  const AH = ligneActif('AH', 'Aménagements, agencements et installations', 'Note 4', /^238|^239/, /^2838/)
  const AI = ligneActif('AI', 'Matériel, mobilier et actifs biologiques (cheptel, plantations)', 'Note 4', /^24[1-4]|^24[6-9]/, /^284[1-4]|^284[6-9]|^294/)
  const AJ = ligneActif('AJ', 'Matériel de transport', 'Note 4', /^245/, /^2845/)
  const AK = ligneActif('AK', 'Avances et acomptes versés sur immobilisations', 'Note 4', /^25/, /^295/)
  const AL = ligneActif('AL', 'Titres de participation', 'Note 5', /^26/, /^296/)
  const AM = ligneActif('AM', 'Autres immobilisations financières (dépôts, prêts)', 'Note 5', /^27/, /^297/)

  const totalActifImmo = {
    ref: 'AZ',
    libelle: 'TOTAL ACTIF IMMOBILISÉ (I)',
    note: '',
    brutN: AD.brutN + AE.brutN + AF.brutN + AG.brutN + AH.brutN + AI.brutN + AJ.brutN + AK.brutN + AL.brutN + AM.brutN,
    amortN: AD.amortN + AE.amortN + AF.amortN + AG.amortN + AH.amortN + AI.amortN + AJ.amortN + AK.amortN + AL.amortN + AM.amortN,
    netN: AD.netN + AE.netN + AF.netN + AG.netN + AH.netN + AI.netN + AJ.netN + AK.netN + AL.netN + AM.netN,
    netN1: AD.netN1 + AE.netN1 + AF.netN1 + AG.netN1 + AH.netN1 + AI.netN1 + AJ.netN1 + AK.netN1 + AL.netN1 + AM.netN1,
    estTotal: true,
  }

  // Actif Circulant
  const BA = ligneActif('BA', 'Actif circulant H.A.O.', 'Note 7', /^485/, /^498/)
  const BB = ligneActif('BB', 'Matières premières et approvisionnements', 'Note 6', /^31|^32|^33/, /^391|^392|^393/)
  const BG = ligneActif('BG', 'En-cours de production agricole et usine', 'Note 6', /^34|^35/, /^394|^395/)
  const BH = ligneActif('BH', 'Produits fabriqués', 'Note 6', /^36|^37/, /^396|^397/)
  const BI = ligneActif('BI', 'Marchandises', 'Note 6', /^38/, /^398/)
  const BJ = ligneActif('BJ', 'Fournisseurs avances et acomptes versés', 'Note 8', /^409/, /^490/)
  const BK = ligneActif('BK', 'Clients et comptes rattachés', 'Note 8', /^41[1-8]/, /^491/)
  const BL = ligneActif('BL', 'Autres créances (personnel, État, associés, débiteurs)', 'Note 9', /^42[1-8]|^43[1-8]|^44[1-8]|^45|^46|^47[1-7]/, /^49[2-7]/)

  const totalActifCirculant = {
    ref: 'BK_TOT',
    libelle: 'TOTAL ACTIF CIRCULANT (II)',
    note: '',
    brutN: BA.brutN + BB.brutN + BG.brutN + BH.brutN + BI.brutN + BJ.brutN + BK.brutN + BL.brutN,
    amortN: BA.amortN + BB.amortN + BG.amortN + BH.amortN + BI.amortN + BJ.amortN + BK.amortN + BL.amortN,
    netN: BA.netN + BB.netN + BG.netN + BH.netN + BI.netN + BJ.netN + BK.netN + BL.netN,
    netN1: BA.netN1 + BB.netN1 + BG.netN1 + BH.netN1 + BI.netN1 + BJ.netN1 + BK.netN1 + BL.netN1,
    estTotal: true,
  }

  // Trésorerie Actif
  const BQ = ligneActif('BQ', 'Titres de placement', 'Note 10', /^50/, /^590/)
  const BR = ligneActif('BR', 'Valeurs à encaisser', 'Note 11', /^51/, /^591/)
  // Banques, chèques postaux et caisse : uniquement soldes débiteurs
  const debiteursTresoN = [...balanceCumulN.values()].filter((l) => /^5[23478]/.test(l.numero) && l.solde > 0)
  const debiteursTresoN1 = [...balanceCumulN1.values()].filter((l) => /^5[23478]/.test(l.numero) && l.solde > 0)
  const bsN = debiteursTresoN.reduce((s, l) => s + l.solde, 0)
  const bsN1 = debiteursTresoN1.reduce((s, l) => s + l.solde, 0)
  const BS: PosteBilanActif = {
    ref: 'BS',
    libelle: 'Banques, établissements financiers et caisse',
    note: 'Note 12',
    brutN: bsN,
    amortN: 0,
    netN: bsN,
    netN1: bsN1,
    comptesN: debiteursTresoN.map((c) => ({ numero: c.numero, libelle: c.libelle, solde: c.solde })),
  }

  const totalTresoActif = {
    ref: 'BT_TOT',
    libelle: 'TOTAL TRÉSORERIE ACTIF (III)',
    note: '',
    brutN: BQ.brutN + BR.brutN + BS.brutN,
    amortN: BQ.amortN + BR.amortN + BS.amortN,
    netN: BQ.netN + BR.netN + BS.netN,
    netN1: BQ.netN1 + BR.netN1 + BS.netN1,
    estTotal: true,
  }

  // Écart de conversion Actif
  const BU = ligneActif('BU', 'Écart de conversion Actif (pertes probables de change)', 'Note 13', /^478/, /^4978/)

  // TOTAL GÉNÉRAL ACTIF
  const totalActifN = {
    brut: totalActifImmo.brutN + totalActifCirculant.brutN + totalTresoActif.brutN + BU.brutN,
    amort: totalActifImmo.amortN + totalActifCirculant.amortN + totalTresoActif.amortN + BU.amortN,
    net: totalActifImmo.netN + totalActifCirculant.netN + totalTresoActif.netN + BU.netN,
  }
  const totalActifN1 = {
    net: totalActifImmo.netN1 + totalActifCirculant.netN1 + totalTresoActif.netN1 + BU.netN1,
  }

  const bilanActif: PosteBilanActif[] = [
    AD, AE, AF, AG, AH, AI, AJ, AK, AL, AM, totalActifImmo,
    BA, BB, BG, BH, BI, BJ, BK, BL, totalActifCirculant,
    BQ, BR, BS, totalTresoActif,
    BU,
    {
      ref: 'BZ',
      libelle: 'TOTAL GÉNÉRAL ACTIF (I + II + III + IV)',
      note: '',
      brutN: totalActifN.brut,
      amortN: totalActifN.amort,
      netN: totalActifN.net,
      netN1: totalActifN1.net,
      estTotal: true,
    },
  ]

  // =========================================================================
  // 3. CALCUL DU BILAN PASSIF (SYSCOHADA SYSTÈME NORMAL)
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
    // Au passif, les soldes créditeurs (négatifs en base) sont convertis en positif (multiplicateur = -1)
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
  const CA = lignePassif('CA', 'Capital social ou personnel', 'Note 14', /^10[1-4]/)
  const CB = lignePassif('CB', 'Actionnaires, capital souscrit non appelé', 'Note 14', /^109/, 1) // Débiteur soustrait
  const CD = lignePassif('CD', 'Primes liées au capital social', 'Note 14', /^11/)
  const CE = lignePassif('CE', 'Écarts de réévaluation', 'Note 15', /^12/)
  const CF = lignePassif('CF', 'Réserves indisponibles', 'Note 16', /^13/)
  const CG = lignePassif('CG', 'Réserves libres', 'Note 16', /^14/)

  // Report à nouveau : solde du compte 15 + résultats antérieurs non clos
  const s15_N = getSolde(balanceCumulN, /^15/)
  const s15_N1 = getSolde(balanceCumulN1, /^15/)
  // Calcul des résultats antérieurs accumulés (somme des classes 6, 7, 8 antérieures)
  const resultatsAnterieursN = -toutesLignes
    .filter((l) => l.exercice_id !== exerciceCourant.id && idsCumulN.has(l.exercice_id) && l.classe >= 6)
    .reduce((s, l) => s + Number(l.solde), 0)
  const resultatsAnterieursN1 = exercicePrecedent
    ? -toutesLignes
        .filter((l) => l.exercice_id !== exercicePrecedent.id && idsCumulN1.has(l.exercice_id) && l.classe >= 6)
        .reduce((s, l) => s + Number(l.solde), 0)
    : 0

  const CH: PosteBilanPassif = {
    ref: 'CH',
    libelle: 'Report à nouveau (+ ou −)',
    note: 'Note 16',
    netN: -s15_N.total + resultatsAnterieursN,
    netN1: -s15_N1.total + resultatsAnterieursN1,
    comptesN: s15_N.comptes,
  }

  // Résultat net de l'exercice
  const CJ: PosteBilanPassif = {
    ref: 'CJ',
    libelle: 'Résultat net de l’exercice (bénéfice + ou perte −)',
    note: 'Note 17',
    netN: RN_N_Total,
    netN1: RN_N1_Total,
  }

  const CL = lignePassif('CL', 'Subventions d’investissement', 'Note 18', /^16/)
  const CM = lignePassif('CM', 'Provisions réglementées', 'Note 19', /^17/)

  const totalCapitauxPropres: PosteBilanPassif = {
    ref: 'CP',
    libelle: 'TOTAL CAPITAUX PROPRES ET RESSOURCES ASSIMILÉES (I)',
    note: '',
    netN: CA.netN + CB.netN + CD.netN + CE.netN + CF.netN + CG.netN + CH.netN + CJ.netN + CL.netN + CM.netN,
    netN1: CA.netN1 + CB.netN1 + CD.netN1 + CE.netN1 + CF.netN1 + CG.netN1 + CH.netN1 + CJ.netN1 + CL.netN1 + CM.netN1,
    estTotal: true,
  }

  // Dettes financières
  const DA = lignePassif('DA', 'Emprunts et dettes financières diverses', 'Note 20', /^18|^16[1-9]/)
  const DB = lignePassif('DB', 'Dettes de location acquisition (crédit-bail)', 'Note 20', /^17[23]/)
  const DC = lignePassif('DC', 'Provisions pour risques et charges durables', 'Note 19', /^19/)

  const totalDettesFinancieres: PosteBilanPassif = {
    ref: 'DP',
    libelle: 'TOTAL DETTES FINANCIÈRES ET ASSIMILÉES (II)',
    note: '',
    netN: DA.netN + DB.netN + DC.netN,
    netN1: DA.netN1 + DB.netN1 + DC.netN1,
    estTotal: true,
  }

  const totalRessourcesDurables: PosteBilanPassif = {
    ref: 'DT',
    libelle: 'TOTAL RESSOURCES DURABLES (I + II)',
    note: '',
    netN: totalCapitauxPropres.netN + totalDettesFinancieres.netN,
    netN1: totalCapitauxPropres.netN1 + totalDettesFinancieres.netN1,
    estTotal: true,
  }

  // Passif Circulant
  const DF = lignePassif('DF', 'Dettes circulantes H.A.O.', 'Note 7', /^48[1-4]/)
  const DG = lignePassif('DG', 'Clients, avances et acomptes reçus', 'Note 8', /^419/)
  const DH = lignePassif('DH', 'Fournisseurs d’exploitation', 'Note 8', /^40[1-8]/)

  // Dettes fiscales et sociales : soldes créditeurs des comptes 42, 43, 44
  const crediteursDettesFiscalesN = [...balanceCumulN.values()].filter(
    (l) => /^4[234]/.test(l.numero) && l.solde < 0
  )
  const crediteursDettesFiscalesN1 = [...balanceCumulN1.values()].filter(
    (l) => /^4[234]/.test(l.numero) && l.solde < 0
  )
  const diN = crediteursDettesFiscalesN.reduce((s, l) => s - l.solde, 0)
  const diN1 = crediteursDettesFiscalesN1.reduce((s, l) => s - l.solde, 0)
  const DI: PosteBilanPassif = {
    ref: 'DI',
    libelle: 'Dettes fiscales et sociales',
    note: 'Note 9',
    netN: diN,
    netN1: diN1,
    comptesN: crediteursDettesFiscalesN.map((c) => ({ numero: c.numero, libelle: c.libelle, solde: -c.solde })),
  }

  // Autres dettes : soldes créditeurs comptes 45, 46, 47
  const crediteursAutresN = [...balanceCumulN.values()].filter(
    (l) => /^4[567]/.test(l.numero) && l.solde < 0
  )
  const crediteursAutresN1 = [...balanceCumulN1.values()].filter(
    (l) => /^4[567]/.test(l.numero) && l.solde < 0
  )
  const djN = crediteursAutresN.reduce((s, l) => s - l.solde, 0)
  const djN1 = crediteursAutresN1.reduce((s, l) => s - l.solde, 0)
  const DJ: PosteBilanPassif = {
    ref: 'DJ',
    libelle: 'Autres dettes et créditeurs divers',
    note: 'Note 9',
    netN: djN,
    netN1: djN1,
    comptesN: crediteursAutresN.map((c) => ({ numero: c.numero, libelle: c.libelle, solde: -c.solde })),
  }

  const DK = lignePassif('DK', 'Provisions pour risques à court terme', 'Note 19', /^499/)

  const totalPassifCirculant: PosteBilanPassif = {
    ref: 'DX',
    libelle: 'TOTAL PASSIF CIRCULANT (III)',
    note: '',
    netN: DF.netN + DG.netN + DH.netN + DI.netN + DJ.netN + DK.netN,
    netN1: DF.netN1 + DG.netN1 + DH.netN1 + DI.netN1 + DJ.netN1 + DK.netN1,
    estTotal: true,
  }

  // Trésorerie Passif : crédits de trésorerie (56) et soldes créditeurs des comptes de trésorerie
  const crediteursTresoN = [...balanceCumulN.values()].filter(
    (l) => (/^56/.test(l.numero) || /^5[23478]/.test(l.numero)) && l.solde < 0
  )
  const crediteursTresoN1 = [...balanceCumulN1.values()].filter(
    (l) => (/^56/.test(l.numero) || /^5[23478]/.test(l.numero)) && l.solde < 0
  )
  const dyN = crediteursTresoN.reduce((s, l) => s - l.solde, 0)
  const dyN1 = crediteursTresoN1.reduce((s, l) => s - l.solde, 0)

  const DY: PosteBilanPassif = {
    ref: 'DY',
    libelle: 'Banques, crédits d’escompte et de trésorerie',
    note: 'Note 12',
    netN: dyN,
    netN1: dyN1,
    comptesN: crediteursTresoN.map((c) => ({ numero: c.numero, libelle: c.libelle, solde: -c.solde })),
  }

  const totalTresoPassif: PosteBilanPassif = {
    ref: 'DY_TOT',
    libelle: 'TOTAL TRÉSORERIE PASSIF (IV)',
    note: '',
    netN: DY.netN,
    netN1: DY.netN1,
    estTotal: true,
  }

  // Écart de conversion Passif
  const DZ = lignePassif('DZ', 'Écart de conversion Passif (gains probables de change)', 'Note 13', /^479/)

  const totalPassifN = totalRessourcesDurables.netN + totalPassifCirculant.netN + totalTresoPassif.netN + DZ.netN
  const totalPassifN1 = totalRessourcesDurables.netN1 + totalPassifCirculant.netN1 + totalTresoPassif.netN1 + DZ.netN1

  const bilanPassif: PosteBilanPassif[] = [
    CA, CB, CD, CE, CF, CG, CH, CJ, CL, CM, totalCapitauxPropres,
    DA, DB, DC, totalDettesFinancieres, totalRessourcesDurables,
    DF, DG, DH, DI, DJ, DK, totalPassifCirculant,
    DY, totalTresoPassif,
    DZ,
    {
      ref: 'DF_TOT',
      libelle: 'TOTAL GÉNÉRAL PASSIF (I + II + III + IV + V)',
      note: '',
      netN: totalPassifN,
      netN1: totalPassifN1,
      estTotal: true,
    },
  ]

  // =========================================================================
  // 4. CALCUL DU TABLEAU DES FLUX DE TRÉSORERIE (TFT SYSCOHADA)
  // =========================================================================

  // Trésorerie nette d'ouverture et de clôture
  const tresoNetteCloture = totalTresoActif.netN - totalTresoPassif.netN
  const tresoNetteOuverture = totalTresoActif.netN1 - totalTresoPassif.netN1
  const variationTresorerieNette = tresoNetteCloture - tresoNetteOuverture

  // CAFG (Capacité d'Autofinancement Globale)
  // Résultat net + Dotations nettes de reprises + Moins-values cessions - Plus-values cessions
  const dotationsN = RL_N.total
  const dotationsN1 = RL_N1.total
  const reprisesN = TJ_N.total
  const reprisesN1 = TJ_N1.total

  const cafgN = RN_N_Total + (dotationsN - reprisesN)
  const cafgN1 = RN_N1_Total + (dotationsN1 - reprisesN1)

  // Variation du BFR
  // Δ Stocks = Stocks N − Stocks N-1
  const deltaStocksN =
    (BB.netN + BG.netN + BH.netN + BI.netN) - (BB.netN1 + BG.netN1 + BH.netN1 + BI.netN1)
  const deltaStocksN1 = 0

  // Δ Créances d'exploitation = Créances N − Créances N-1
  const deltaCreancesN = (BJ.netN + BK.netN + BL.netN) - (BJ.netN1 + BK.netN1 + BL.netN1)
  const deltaCreancesN1 = 0

  // Δ Dettes d'exploitation = Dettes N − Dettes N-1
  const deltaDettesN = (DG.netN + DH.netN + DI.netN + DJ.netN) - (DG.netN1 + DH.netN1 + DI.netN1 + DJ.netN1)
  const deltaDettesN1 = 0

  // Variation nette du BFR (ressource = + ; besoin = -)
  const variationBFR_N = -deltaStocksN - deltaCreancesN + deltaDettesN
  const variationBFR_N1 = 0

  // Flux net d'exploitation (A)
  const fluxA_N = cafgN + variationBFR_N
  const fluxA_N1 = cafgN1 + variationBFR_N1

  // B. Activités d'investissement
  // Acquisitions d'immobilisations (variation brute de l'actif immobilisé si positive)
  const variationBruteImmoN = Math.max(0, totalActifImmo.brutN - totalActifImmo.netN1)
  const acquisitionsImmoN = -variationBruteImmoN
  const acquisitionsImmoN1 = 0

  // Cessions d'immobilisations (produits des cessions : compte 82)
  const cessionsImmoN = TL_N.total
  const cessionsImmoN1 = TL_N1.total

  // Flux net d'investissement (B)
  const fluxB_N = acquisitionsImmoN + cessionsImmoN
  const fluxB_N1 = acquisitionsImmoN1 + cessionsImmoN1

  // C. Activités de financement
  // Augmentations de capital
  const deltaCapitalN = Math.max(0, CA.netN - CA.netN1)
  const deltaCapitalN1 = 0

  // Subventions d'investissement reçues
  const deltaSubvN = Math.max(0, CL.netN - CL.netN1)
  const deltaSubvN1 = 0

  // Nouveaux emprunts / Remboursements d'emprunts
  const deltaDettesFinN = totalDettesFinancieres.netN - totalDettesFinancieres.netN1
  const deltaDettesFinN1 = 0

  // Flux net de financement (C)
  const fluxC_N = deltaCapitalN + deltaSubvN + deltaDettesFinN
  const fluxC_N1 = deltaCapitalN1 + deltaSubvN1 + deltaDettesFinN1

  // Total variation TFT
  const totalFluxTFT_N = fluxA_N + fluxB_N + fluxC_N
  const totalFluxTFT_N1 = fluxA_N1 + fluxB_N1 + fluxC_N1

  const ecartBouclageTFT = totalFluxTFT_N - variationTresorerieNette

  const tft: LigneTFT[] = [
    { ref: 'FA', libelle: 'Capacité d’Autofinancement Globale (CAFG)', note: '', montantN: cafgN, montantN1: cafgN1, type: 'rubrique' },
    { ref: 'FB', libelle: 'Variation des stocks d’exploitation', note: '', montantN: -deltaStocksN, montantN1: -deltaStocksN1, type: 'rubrique' },
    { ref: 'FC', libelle: 'Variation des créances et emplois assimilés', note: '', montantN: -deltaCreancesN, montantN1: -deltaCreancesN1, type: 'rubrique' },
    { ref: 'FD', libelle: 'Variation des dettes d’exploitation', note: '', montantN: deltaDettesN, montantN1: deltaDettesN1, type: 'rubrique' },
    { ref: 'FE', libelle: 'Variation du Besoin en Fonds de Roulement (BFR)', note: '', montantN: variationBFR_N, montantN1: variationBFR_N1, type: 'sous_total' },
    { ref: 'ZA', libelle: 'FLUX DE TRÉSORERIE DES ACTIVITÉS OPÉRATIONNELLES (A)', note: '', montantN: fluxA_N, montantN1: fluxA_N1, type: 'total' },

    { ref: 'FF', libelle: 'Décaissements liés aux acquisitions d’immobilisations', note: '', montantN: acquisitionsImmoN, montantN1: acquisitionsImmoN1, type: 'rubrique' },
    { ref: 'FG', libelle: 'Encaissements liés aux cessions d’immobilisations', note: '', montantN: cessionsImmoN, montantN1: cessionsImmoN1, type: 'rubrique' },
    { ref: 'ZB', libelle: 'FLUX DE TRÉSORERIE DES ACTIVITÉS D’INVESTISSEMENT (B)', note: '', montantN: fluxB_N, montantN1: fluxB_N1, type: 'total' },

    { ref: 'FH', libelle: 'Augmentations de capital en numéraire', note: '', montantN: deltaCapitalN, montantN1: deltaCapitalN1, type: 'rubrique' },
    { ref: 'FI', libelle: 'Subventions d’investissement reçues', note: '', montantN: deltaSubvN, montantN1: deltaSubvN1, type: 'rubrique' },
    { ref: 'FJ', libelle: 'Variation des emprunts et dettes financières', note: '', montantN: deltaDettesFinN, montantN1: deltaDettesFinN1, type: 'rubrique' },
    { ref: 'ZC', libelle: 'FLUX DE TRÉSORERIE DES ACTIVITÉS DE FINANCEMENT (C)', note: '', montantN: fluxC_N, montantN1: fluxC_N1, type: 'total' },

    { ref: 'ZD', libelle: 'VARIATION DE LA TRÉSORERIE NETTE DE LA PÉRIODE (A + B + C)', note: '', montantN: totalFluxTFT_N, montantN1: totalFluxTFT_N1, type: 'total' },
    { ref: 'ZE', libelle: 'Trésorerie nette en début d’exercice', note: '', montantN: tresoNetteOuverture, montantN1: 0, type: 'rubrique' },
    { ref: 'ZF', libelle: 'Trésorerie nette en fin d’exercice', note: '', montantN: tresoNetteCloture, montantN1: tresoNetteOuverture, type: 'rubrique' },
    { ref: 'ZG', libelle: 'Contrôle de bouclage de trésorerie (Fin − Début)', note: '', montantN: variationTresorerieNette, montantN1: 0, type: 'total' },
  ]

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
  }

  return {
    exerciceN: exerciceCourant,
    exerciceN1: exercicePrecedent,
    bilanActif,
    totalActifN,
    totalActifN1,
    bilanPassif,
    totalPassifN,
    totalPassifN1,
    compteResultat,
    tft,
    controles,
  }
}
