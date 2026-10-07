import { describe, expect, it } from 'vitest';
import {
  translateBillingItemToSpanish,
  translateJobCategoryToSpanish,
  translateUnitSizeToSpanish,
} from '../src/lib/spanishOperationalLabels';

describe('Spanish operational labels', () => {
  it('translates known work-order dropdown labels', () => {
    expect(translateUnitSizeToSpanish('2 Bedroom')).toBe('2 Dormitorios');
    expect(translateJobCategoryToSpanish('Regular Paint')).toBe('Pintura Regular');
    expect(translateJobCategoryToSpanish('Extra Charges - Prep Work / Drywall Repairs'))
      .toBe('Cargos Adicionales - Preparación / Reparaciones de Drywall');
    expect(translateBillingItemToSpanish('Paint Individual Ceiling')).toBe('Pintar Techo Individual');
    expect(translateBillingItemToSpanish('Unit with High Ceilings')).toBe('Unidad con Techos Altos');
  });

  it('preserves custom database labels instead of guessing', () => {
    expect(translateUnitSizeToSpanish('Custom Floorplan A')).toBe('Custom Floorplan A');
    expect(translateJobCategoryToSpanish('Property Special')).toBe('Property Special');
    expect(translateBillingItemToSpanish('Custom Repair Package')).toBe('Custom Repair Package');
  });
});
