/**
 * Phase 2: Extra Charges Section Component
 * Allows adding structured extra charges with categories and line items to work orders
 */

import React, { useState } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import { ExtraChargeLineItem } from '../types/extraCharges';
import { useExtraCharges } from '../hooks/useExtraCharges';
import {
  calculateLineItemAmounts,
  generateTempId,
} from '../utils/extraChargesCalculations';
import { validateExtraChargeLineItem } from '../utils/extraChargesValidation';

interface ExtraChargesSectionProps {
  propertyId: string | null;
  lineItems: ExtraChargeLineItem[];
  onAddLineItem: (item: ExtraChargeLineItem) => void;
  onRemoveLineItem: (id: string) => void;
  language?: 'en' | 'es';
  disabled?: boolean;
}

export default function ExtraChargesSection({
  propertyId,
  lineItems,
  onAddLineItem,
  onRemoveLineItem,
  language = 'en',
  disabled = false,
}: ExtraChargesSectionProps) {
  const text = {
    en: {
      infoTitle: 'Extra Charges -',
      infoBody: 'Add any additional charges not already included',
      addedTitle: 'Added Extra Charges:',
      addTitle: 'Add Extra Charge:',
      categoryLabel: 'Category *',
      categoryPlaceholder: 'Select category...',
      lineItemLabel: 'Line Item *',
      lineItemPlaceholder: 'Select line item...',
      hoursLabel: 'Hours',
      qtyLabel: 'Quantity',
      hoursPlaceholder: 'Enter hours',
      qtyPlaceholder: 'Enter quantity',
      notesLabel: 'Notes (Optional)',
      notesPlaceholder: 'Add any additional notes...',
      addButton: 'Add Charge',
      cancelButton: 'Cancel',
      addAnother: 'Add Extra Charge',
      quantity: 'Quantity',
      hours: 'hours',
      units: 'units',
      notes: 'Notes',
      remove: 'Remove',
      noProperty: 'Please select a property first to add extra charges.',
      loading: 'Loading extra charges...',
      error: 'Error loading extra charges:',
      noCategoriesTitle: 'No extra charge categories configured',
      noCategoriesBody:
        'Please set up extra charge categories in this property\'s billing settings first. Go to Property Details → Billing Settings and check the "Extra Charge" box for relevant categories.',
      selectCategoryAndItem: 'Please select both a category and line item option',
    },
    es: {
      infoTitle: 'Cargos Adicionales -',
      infoBody: 'Agregue cargos adicionales no incluidos',
      addedTitle: 'Cargos Adicionales Agregados:',
      addTitle: 'Agregar Cargo Adicional:',
      categoryLabel: 'Categoría *',
      categoryPlaceholder: 'Seleccionar categoría...',
      lineItemLabel: 'Partida *',
      lineItemPlaceholder: 'Seleccionar partida...',
      hoursLabel: 'Horas',
      qtyLabel: 'Cantidad',
      hoursPlaceholder: 'Ingresar horas',
      qtyPlaceholder: 'Ingresar cantidad',
      notesLabel: 'Notas (Opcional)',
      notesPlaceholder: 'Agregue notas adicionales...',
      addButton: 'Agregar Cargo',
      cancelButton: 'Cancelar',
      addAnother: 'Agregar Cargo Adicional',
      quantity: 'Cantidad',
      hours: 'horas',
      units: 'unidades',
      notes: 'Notas',
      remove: 'Eliminar',
      noProperty: 'Seleccione una propiedad primero para agregar cargos adicionales.',
      loading: 'Cargando cargos adicionales...',
      error: 'Error al cargar cargos adicionales:',
      noCategoriesTitle: 'No hay categorías de cargos adicionales configuradas',
      noCategoriesBody:
        'Configure las categorías de cargos adicionales en la facturación de esta propiedad. Vaya a Detalles de la Propiedad → Configuración de Facturación y marque "Extra Charge" en las categorías.',
      selectCategoryAndItem: 'Seleccione una categoría y una partida',
    },
  }[language];
  const { categories, isLoading, error } = useExtraCharges(propertyId);

  // Form state for adding new charge
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedDetailId, setSelectedDetailId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Get selected category and detail
  const selectedCategory = categories.find((cat) => cat.categoryId === selectedCategoryId);
  const selectedDetail = selectedCategory?.lineItems.find((item) => item.id === selectedDetailId);

  // Calculate amounts in real-time
  const calculatedAmounts = selectedDetail
    ? calculateLineItemAmounts(
        parseFloat(quantity) || 0,
        selectedDetail.billAmount,
        selectedDetail.subAmount
      )
    : { billAmount: 0, subAmount: 0 };

  // Handle adding new charge
  const handleAddCharge = () => {
    if (!selectedCategory || !selectedDetail) {
      setFormErrors([text.selectCategoryAndItem]);
      return;
    }

    const newItem: ExtraChargeLineItem = {
      id: generateTempId(),
      categoryId: selectedCategory.categoryId,
      categoryName: selectedCategory.categoryName,
      detailId: selectedDetail.id,
      detailName: selectedDetail.name,
      quantity: parseFloat(quantity) || 0,
      billRate: selectedDetail.billAmount,
      subRate: selectedDetail.subAmount,
      isHourly: selectedDetail.isHourly,
      jobBillingCategory: 'owner',
      notes: notes.trim(),
      calculatedBillAmount: calculatedAmounts.billAmount,
      calculatedSubAmount: calculatedAmounts.subAmount,
    };

    // Validate
    const errors = validateExtraChargeLineItem(newItem, lineItems.length);
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    // Add to list
    onAddLineItem(newItem);

    // Reset form
    setSelectedCategoryId('');
    setSelectedDetailId('');
    setQuantity('1');
    setNotes('');
    setFormErrors([]);
    setIsAddingNew(false);
  };

  if (!propertyId) {
    return (
      <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {text.noProperty}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{text.loading}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{text.error} {error}</p>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium mb-1">{text.noCategoriesTitle}</p>
            <p>{text.noCategoriesBody}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>{text.infoTitle}</strong> {text.infoBody}
        </p>
      </div>

      {/* Added Charges List */}
      {lineItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{text.addedTitle}</h4>
          {lineItems.map((item, index) => (
            <div
              key={item.id}
              className="flex items-start gap-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {index + 1}. Extra Charges - {item.categoryName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">→</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{item.detailName}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <span>
                    {text.quantity}: {item.quantity} {item.isHourly ? text.hours : text.units}
                  </span>
                </div>
                {item.notes && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">{text.notes}: {item.notes}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemoveLineItem(item.id)}
                disabled={disabled}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                title={text.remove}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}

        </div>
      )}

      {/* Add New Charge Form */}
      {isAddingNew ? (
        <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{text.addTitle}</h4>

          {/* Show validation errors */}
          {formErrors.length > 0 && (
            <div className="rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3">
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                {formErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Category Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {text.categoryLabel}
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setSelectedDetailId(''); // Reset detail when category changes
              }}
              disabled={disabled}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{text.categoryPlaceholder}</option>
              {categories.map((cat) => (
                <option key={cat.categoryId} value={cat.categoryId}>
                  {cat.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Line Item Dropdown */}
          {selectedCategory && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {text.lineItemLabel}
              </label>
              <select
                value={selectedDetailId}
                onChange={(e) => setSelectedDetailId(e.target.value)}
                disabled={disabled}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{text.lineItemPlaceholder}</option>
                {selectedCategory.lineItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity */}
          {selectedDetail && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {selectedDetail.isHourly ? text.hoursLabel : text.qtyLabel} *
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min={selectedDetail.isHourly ? '0.25' : '0.01'}
                  step={selectedDetail.isHourly ? '0.25' : '1'}
                  disabled={disabled}
                  inputMode={selectedDetail.isHourly ? 'decimal' : 'decimal'}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={selectedDetail.isHourly ? text.hoursPlaceholder : text.qtyPlaceholder}
                />
              </div>

            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {text.notesLabel}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={disabled}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={text.notesPlaceholder}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{notes.length}/500 characters</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddCharge}
              disabled={disabled}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {text.addButton}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false);
                setFormErrors([]);
                setSelectedCategoryId('');
                setSelectedDetailId('');
                setQuantity('1');
                setNotes('');
              }}
              disabled={disabled}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {text.cancelButton}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAddingNew(true)}
          disabled={disabled}
          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {text.addAnother}
        </button>
      )}
    </div>
  );
}
