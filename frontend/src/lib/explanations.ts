interface Explanation {
  label: string
  description: string
  range?: string
}

export const explanations: Record<string, Explanation> = {
  // Températures
  outdoor: {
    label: 'Température extérieure',
    description: 'Température mesurée par la sonde murale extérieure. Influence directement la courbe de chauffe et le calcul de la consigne.',
    range: '-20°C à +40°C',
  },
  outdoorAvg24h: {
    label: 'Moy. extérieure 24h',
    description: 'Moyenne glissante sur 24 heures de la température extérieure. Utilisée pour lisser les variations et éviter les mises en route intempestives.',
    range: '-20°C à +40°C',
  },
  heatingFlow: {
    label: 'Départ chauffage',
    description: "Température de l'eau quittant la PAC vers le circuit de chauffage (plancher chauffant ou radiateurs).",
    range: '20°C à 55°C',
  },
  heatingReturn: {
    label: 'Retour chauffage',
    description: "Température de l'eau revenant du circuit de chauffage. L'écart avec le départ indique le transfert thermique.",
    range: '20°C à 45°C',
  },
  heatingReturnTarget: {
    label: 'Consigne retour',
    description: 'Température cible calculée par la PAC selon la courbe de chauffe et la température extérieure.',
    range: '20°C à 50°C',
  },
  hotWater: {
    label: 'Eau chaude (ECS)',
    description: "Température de l'eau dans le ballon d'eau chaude sanitaire. La PAC chauffe l'ECS quand elle descend sous la consigne.",
    range: '30°C à 65°C',
  },
  sourceIn: {
    label: 'Source entrée (saumure)',
    description: 'Température de la saumure (mélange eau-glycol) revenant des capteurs géothermiques dans le sol. Reflète la chaleur extraite du terrain.',
    range: '-5°C à +20°C',
  },
  sourceOut: {
    label: 'Source sortie (saumure)',
    description: "Température de la saumure partant vers les capteurs géothermiques. L'écart avec l'entrée indique l'énergie extraite.",
    range: '-5°C à +15°C',
  },
  hotGas: {
    label: 'Gaz chaud',
    description: "Température de refoulement du compresseur. Valeur haute (>100°C) normale en fonctionnement. Une valeur très élevée peut indiquer un problème.",
    range: '40°C à 130°C',
  },
  // Sorties système
  compressor: {
    label: 'Compresseur',
    description: 'Le compresseur est le cœur de la PAC. Il comprime le fluide frigorigène pour augmenter sa température.',
  },
  heatingPump: {
    label: 'Pompe chauffage (HUP)',
    description: "Pompe de circulation qui fait circuler l'eau dans le circuit de chauffage (plancher chauffant, radiateurs).",
  },
  brinePump: {
    label: 'Pompe saumure (VBO)',
    description: 'Pompe qui fait circuler la saumure dans les capteurs géothermiques enterrés pour extraire la chaleur du sol.',
  },
  hotWaterValve: {
    label: 'Vanne ECS (BUP)',
    description: "Vanne qui dirige l'eau chaude vers le ballon d'eau chaude sanitaire lorsque la PAC produit de l'ECS.",
  },
  recirculationPump: {
    label: 'Pompe bouclage (ZUP)',
    description: "Pompe de bouclage qui maintient l'eau chaude disponible immédiatement aux points de puisage.",
  },
  defrostValve: {
    label: 'Vanne dégivrage',
    description: "Vanne 4 voies pour le cycle de dégivrage (rare en géothermie, plus courant sur les PAC air/eau).",
  },
  // Modes
  heatingMode: {
    label: 'Mode chauffage',
    description: 'Auto : la PAC gère selon la courbe de chauffe. Fête : maintient la consigne jour en continu. Vacances : réduit la consigne. Off : chauffage coupé.',
  },
  hotWaterMode: {
    label: 'Mode eau chaude',
    description: "Auto : production d'ECS selon les plages horaires programmées. Fête : production continue. Vacances : production réduite. Off : pas d'ECS.",
  },
  heatingTargetTemp: {
    label: 'Décalage chauffage',
    description: 'Décalage parallèle de la courbe de chauffe. Une valeur positive (+) augmente la température de consigne, une valeur négative (-) la diminue. 0 = courbe de base.',
    range: '-10°C à +10°C',
  },
  hotWaterTargetTemp: {
    label: 'Consigne ECS',
    description: "Température cible du ballon d'eau chaude sanitaire. La PAC chauffe l'eau jusqu'à cette température.",
    range: '30°C à 65°C',
  },
  // Pressions
  pressureHigh: {
    label: 'Pression haute',
    description: 'Pression côté haute pression du circuit frigorifique (après le compresseur). Dépend de la température de condensation.',
    range: '10 à 30 bar',
  },
  pressureLow: {
    label: 'Pression basse',
    description: "Pression côté basse pression du circuit frigorifique (avant le compresseur). Dépend de la température d'évaporation.",
    range: '2 à 8 bar',
  },
  // Runtime
  compressorHours: {
    label: 'Heures compresseur',
    description: "Nombre total d'heures de fonctionnement du compresseur depuis la mise en service.",
  },
  compressorImpulses: {
    label: 'Impulsions compresseur',
    description: "Nombre de démarrages du compresseur. Un nombre élevé par rapport aux heures peut indiquer un cycle court (problème de dimensionnement ou de régulation).",
  },
}
