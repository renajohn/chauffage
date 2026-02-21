interface ErrorTranslation {
  label: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  advice: string
}

/**
 * Dictionnaire des erreurs Luxtronik2 (Alpha Innotec).
 * Les clés sont des fragments allemands matchés contre le code ou la description.
 */
const errorMap: Array<{ pattern: RegExp; translation: ErrorTranslation }> = [
  // --- Haute pression ---
  {
    pattern: /Hochdruck/i,
    translation: {
      label: 'Défaut haute pression',
      description: 'La pression côté haute pression du circuit frigorifique a dépassé le seuil de sécurité. Le compresseur est arrêté.',
      severity: 'critical',
      advice: 'Contacter votre installateur. Vérifier le circuit de chauffage (vannes fermées, pompe en panne, air dans le circuit).',
    },
  },
  // --- Basse pression ---
  {
    pattern: /Niederdruck/i,
    translation: {
      label: 'Défaut basse pression',
      description: 'La pression côté basse pression est trop faible. Possible manque de fluide frigorigène ou problème sur le circuit source.',
      severity: 'critical',
      advice: 'Contacter votre installateur. Vérifier la pompe saumure et le niveau de pression du circuit géothermique.',
    },
  },
  // --- Gaz chaud (surchauffe) ---
  {
    pattern: /Heissgas|Hei(ss|ß)gas/i,
    translation: {
      label: 'Surchauffe gaz chaud',
      description: 'La température de refoulement du compresseur est trop élevée. Protection thermique activée.',
      severity: 'critical',
      advice: 'Contacter votre installateur. Peut indiquer un manque de fluide ou un débit insuffisant.',
    },
  },
  // --- Protection moteur ---
  {
    pattern: /Motorschutz/i,
    translation: {
      label: 'Protection moteur',
      description: 'Le disjoncteur de protection du compresseur s\'est déclenché (surintensité).',
      severity: 'critical',
      advice: 'Contacter votre installateur. Ne pas réarmer sans diagnostic professionnel.',
    },
  },
  // --- Protection antigel ---
  {
    pattern: /Frostschutz|Frost/i,
    translation: {
      label: 'Protection antigel',
      description: 'La température du circuit est descendue trop bas. Le mode antigel s\'est activé pour protéger l\'installation.',
      severity: 'warning',
      advice: 'Vérifier la température extérieure et les réglages de la courbe de chauffe. Peut se résoudre automatiquement.',
    },
  },
  // --- Dégivrage ---
  {
    pattern: /Abtau/i,
    translation: {
      label: 'Dégivrage',
      description: 'Cycle de dégivrage en cours ou erreur liée au dégivrage (rare en géothermie).',
      severity: 'info',
      advice: 'Normal en PAC air/eau. En géothermie, contacter l\'installateur si fréquent.',
    },
  },
  // --- Défaut de débit / circulation ---
  {
    pattern: /Durchfluss|Str(ö|oe)mung/i,
    translation: {
      label: 'Défaut de débit',
      description: 'Le débit d\'eau dans le circuit est insuffisant. Le pressostat de débit s\'est déclenché.',
      severity: 'critical',
      advice: 'Vérifier les pompes de circulation, les vannes et la pression du circuit de chauffage. Purger si nécessaire.',
    },
  },
  // --- Pression saumure ---
  {
    pattern: /Soledruck|Sole/i,
    translation: {
      label: 'Défaut pression saumure',
      description: 'La pression dans le circuit de saumure (géothermie) est trop basse.',
      severity: 'warning',
      advice: 'Vérifier la pression du circuit géothermique et faire l\'appoint si nécessaire. Contacter l\'installateur si récurrent.',
    },
  },
  // --- Capteur / sonde défectueux ---
  {
    pattern: /F(ü|ue)hler|Sensor/i,
    translation: {
      label: 'Défaut sonde de température',
      description: 'Une sonde de température renvoie une valeur hors limites ou est déconnectée.',
      severity: 'warning',
      advice: 'Vérifier les connexions des sondes. Contacter l\'installateur pour remplacement si nécessaire.',
    },
  },
  // --- Erreur de communication ---
  {
    pattern: /Kommunikation|Bus/i,
    translation: {
      label: 'Erreur de communication',
      description: 'Le contrôleur ne communique plus avec un module (carte E/S, régulation, etc.).',
      severity: 'warning',
      advice: 'Vérifier les câbles de communication. Redémarrer le contrôleur. Contacter l\'installateur si persistant.',
    },
  },
  // --- Erreur système générique ---
  {
    pattern: /Anlagefehler|Anlage/i,
    translation: {
      label: 'Erreur système',
      description: 'Erreur générale du système de la pompe à chaleur.',
      severity: 'critical',
      advice: 'Contacter votre installateur pour un diagnostic.',
    },
  },
  // --- Phase / alimentation électrique ---
  {
    pattern: /Phase|Netz/i,
    translation: {
      label: 'Défaut alimentation électrique',
      description: 'Problème d\'alimentation électrique détecté (phase manquante, surtension, etc.).',
      severity: 'critical',
      advice: 'Vérifier le tableau électrique et le disjoncteur dédié à la PAC.',
    },
  },
  // --- EVU / blocage tarif ---
  {
    pattern: /EVU|Sperre/i,
    translation: {
      label: 'Blocage tarif électrique (EVU)',
      description: 'Le fournisseur d\'électricité a activé le blocage heures pleines. La PAC est temporairement arrêtée.',
      severity: 'info',
      advice: 'Normal : la PAC redémarrera automatiquement à la fin de la période de blocage.',
    },
  },
  // --- "Bitte Inst rufen" (appeler installateur) ---
  {
    pattern: /Inst\.?\s*rufen|Installateur/i,
    translation: {
      label: 'Appel installateur requis',
      description: 'Le contrôleur demande l\'intervention d\'un professionnel.',
      severity: 'critical',
      advice: 'Contacter votre installateur dès que possible.',
    },
  },
  // --- Thermique / surchauffe générique ---
  {
    pattern: /Thermisch|Übertemperatur|Uebertemperatur/i,
    translation: {
      label: 'Surchauffe',
      description: 'Une température a dépassé le seuil de sécurité.',
      severity: 'critical',
      advice: 'Contacter votre installateur.',
    },
  },
  // --- Verrouillage compresseur ---
  {
    pattern: /Verdichter|Kompressor/i,
    translation: {
      label: 'Défaut compresseur',
      description: 'Le compresseur est en erreur ou verrouillé.',
      severity: 'critical',
      advice: 'Contacter votre installateur. Ne pas tenter de réarmer soi-même.',
    },
  },
]

export interface TranslatedError {
  label: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  advice: string
  originalMessage: string
}

/**
 * Traduit un code/description d'erreur Luxtronik2 (allemand) en français.
 * Combine le code et la description pour maximiser les chances de match.
 */
export function translateError(code: string, description: string): TranslatedError {
  const combined = `${code} ${description}`

  for (const { pattern, translation } of errorMap) {
    if (pattern.test(combined)) {
      return {
        ...translation,
        originalMessage: description || code,
      }
    }
  }

  // Fallback : erreur non reconnue
  return {
    label: 'Erreur',
    description: description || code,
    severity: 'warning',
    advice: 'Consulter la documentation ou contacter votre installateur.',
    originalMessage: description || code,
  }
}
