import { formatCurrency } from '../lib/utils/formatUtils';

export interface MiscAdditionalCostItem {
  id: string;
  description: string;
  price: number;
  subPay?: number | null;
}

interface MiscAdditionalCostsSectionProps {
  items: MiscAdditionalCostItem[];
  language: 'en' | 'es';
  disabled?: boolean;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<Pick<MiscAdditionalCostItem, 'description' | 'subPay'>>) => void;
  onRemove: (id: string) => void;
}

const copy = {
  en: {
    title: 'Miscellaneous Additional Cost',
    description: 'If any miscellaneous additional costs apply to this job, add each item below with a description and amount.',
    empty: 'No miscellaneous additional costs added.',
    item: 'Item',
    remove: 'Remove',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Describe the additional cost',
    amount: 'Amount',
    total: 'Total',
    add: 'Add Miscellaneous Cost',
    notice: 'Miscellaneous additional costs will be reviewed by admin. They will set billing amounts and send approval if needed.',
  },
  es: {
    title: 'Costo Adicional Misceláneo',
    description: 'Si este trabajo tiene costos adicionales misceláneos, agregue cada artículo con una descripción y un monto.',
    empty: 'No se agregaron costos adicionales misceláneos.',
    item: 'Artículo',
    remove: 'Eliminar',
    descriptionLabel: 'Descripción',
    descriptionPlaceholder: 'Describa el costo adicional',
    amount: 'Monto',
    total: 'Total',
    add: 'Agregar Costo Misceláneo',
    notice: 'Los costos adicionales misceláneos serán revisados por la administración. Ellos establecerán los montos de facturación y enviarán una aprobación si es necesario.',
  },
} as const;

export default function MiscAdditionalCostsSection({
  items,
  language,
  disabled = false,
  onAdd,
  onChange,
  onRemove,
}: MiscAdditionalCostsSectionProps) {
  const text = copy[language];
  const total = items.reduce((sum, item) => sum + (Number(item.subPay ?? item.price) || 0), 0);

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 px-6 py-4">
        <h2 className="text-xl font-semibold text-white">{text.title}</h2>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{text.description}</p>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-[#2D3B4E] p-4 text-sm text-gray-500 dark:text-gray-400">
            {text.empty}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-gray-200 dark:border-[#2D3B4E] p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{text.item} {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    disabled={disabled}
                    className="px-2 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                  >
                    {text.remove}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{text.descriptionLabel}</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(event) => onChange(item.id, { description: event.target.value })}
                      disabled={disabled}
                      placeholder={text.descriptionPlaceholder}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{text.amount}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={(item.subPay ?? item.price) === 0 ? '' : (item.subPay ?? item.price)}
                        onChange={(event) => onChange(item.id, { subPay: event.target.value === '' ? 0 : parseFloat(event.target.value) || 0 })}
                        disabled={disabled}
                        placeholder="0.00"
                        className="w-full pl-7 pr-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-200 border-t border-gray-200 dark:border-[#2D3B4E] pt-3">
              <span>{text.total}</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="inline-flex items-center px-4 py-2 text-sm font-semibold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
        >
          {text.add}
        </button>

        {items.length > 0 && (
          <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <span aria-hidden="true">ℹ</span>
            <span>{text.notice}</span>
          </p>
        )}
      </div>
    </div>
  );
}
