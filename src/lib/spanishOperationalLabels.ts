const unitSizeTranslations: Record<string, string> = {
  Studio: 'Estudio',
  Loft: 'Loft',
  '1 Bedroom': '1 Dormitorio',
  '2 Bedroom': '2 Dormitorios',
  '3 Bedroom': '3 Dormitorios',
  '3+ Bedroom': '3+ Dormitorios',
  '4 Bedroom': '4 Dormitorios',
  'Paint One Accent Wall': 'Pintar Una Pared de Acento',
  'Patch/Drywall/Ceiling': 'Parche/Drywall/Techo',
  'Paint Bedroom': 'Pintar Dormitorio',
  'Paint Bathroom': 'Pintar Baño',
  'Per Hour': 'Por Hora',
  Hourly: 'Por Hora',
  Other: 'Otro',
  Each: 'Cada Uno',
  'Per Room': 'Por Habitación',
  'Per Unit': 'Por Unidad',
};

const categoryTranslations: Record<string, string> = {
  'Regular Paint': 'Pintura Regular',
  'Painted Ceilings': 'Techos Pintados',
  'Painted Cabinets': 'Gabinetes Pintados',
  'Accent Wall': 'Pared de Acento',
  'Patch/Drywall/Ceiling': 'Parche/Drywall/Techo',
  'Extra Charges': 'Cargos Adicionales',
  'Paint One Accent Wall': 'Pintar Una Pared de Acento',
  'Exterior Paint': 'Pintura Exterior',
  'Trim Paint': 'Pintura de Moldura',
  'Door Paint': 'Pintura de Puerta',
  'Window Paint': 'Pintura de Ventana',
  'Cabinet Paint': 'Pintura de Gabinete',
  'Drywall Repair': 'Reparación de Drywall',
  'Ceiling Repair': 'Reparación de Techo',
  Other: 'Otro',
};

const billingItemTranslations: Record<string, string> = {
  ...unitSizeTranslations,
  ...categoryTranslations,
  'Paint Individual Ceiling': 'Pintar Techo Individual',
  'Paint Over': 'Pintar Encima',
  Custom: 'Personalizado',
};

export function translateUnitSizeToSpanish(label: string): string {
  return unitSizeTranslations[label] || label;
}

export function translateJobCategoryToSpanish(label: string): string {
  return categoryTranslations[label] || label;
}

export function translateBillingItemToSpanish(label: string): string {
  return billingItemTranslations[label] || label;
}
