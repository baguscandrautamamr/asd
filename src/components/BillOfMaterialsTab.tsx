import React, { useState } from 'react';
import { CalculationResults, CalculationParams, BOMCategory } from '../types';
import { Check, Copy, Filter, Package } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { bomCategoryKey, materialKey } from '../i18n/labels';

interface BillOfMaterialsTabProps {
  results: CalculationResults;
  params: CalculationParams;
}

const CATEGORIES: BOMCategory[] = ['detector', 'pipe', 'fittings', 'hardware', 'accessories'];

export const BillOfMaterialsTab: React.FC<BillOfMaterialsTabProps> = ({ results, params }) => {
  const { t, n } = useI18n();
  const [copied, setCopied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredItems = results.billOfMaterials.filter((item) =>
    selectedCategory === 'all' ? true : item.category === selectedCategory
  );

  const quantityOf = (code: string) =>
    results.billOfMaterials.find((item) => item.itemCode === code)?.quantity ?? 0;

  const copyToClipboard = async () => {
    const header = [
      t('boq.colCode'),
      t('boq.colCategory'),
      t('boq.colDescription'),
      t('boq.colQty'),
      t('boq.colUnit'),
      t('boq.colNotes'),
    ].join('\t');

    const rows = results.billOfMaterials.map((item) =>
      [
        item.itemCode,
        t(bomCategoryKey[item.category]),
        t(item.descKey, item.descVars),
        item.quantity,
        t(item.unitKey),
        item.remarkKey ? t(item.remarkKey, item.remarkVars) : '',
      ].join('\t')
    );

    try {
      await navigator.clipboard.writeText([header, ...rows].join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  const material = materialKey(params.pipeMaterial);

  const summary = [
    {
      label: t('boq.sumSticks'),
      value: `${n(quantityOf('PIP-CPVC-25'))} ${t('boq.sumSticksUnit')}`,
      sub: t('boq.sumSticksSub'),
    },
    {
      label: t('boq.sumElbows'),
      value: `${n(quantityOf('FIT-ELB-90'))} ${t('boq.pcs')}`,
      sub: t('boq.sumElbowsSub'),
    },
    {
      label: t('boq.sumClips'),
      value: `${n(quantityOf('HRD-CLP-25'))} ${t('boq.pcs')}`,
      sub: t('boq.sumClipsSub'),
    },
    {
      label: t('boq.sumLabels'),
      value: `${n(quantityOf('LBL-SAM-01'))} ${t('boq.pcs')}`,
      sub: t('boq.sumLabelsSub'),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="surface-card surface-raised p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-brand-wash text-brand flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </span>
          <div>
            <h4 className="font-bold text-sm text-ink">{t('boq.title')}</h4>
            <p className="text-xs text-ink-3">
              {t('boq.subtitle', {
                len: n(results.totalPipeLengthM, 1),
                material: material ? t(material) : params.pipeMaterial,
                n: results.totalHolesCalculated,
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="field text-xs w-auto"
            >
              <option value="all">{t('boq.allCategories')}</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t(bomCategoryKey[category])}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-ink-2 transition-colors border border-line"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-ok" />
                {t('boq.copied')}
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                {t('boq.copy')}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summary.map((card) => (
          <div key={card.label} className="surface-card surface-raised lift p-3">
            <span className="text-[11px] font-semibold text-ink-3 uppercase block">
              {card.label}
            </span>
            <span className="text-xl font-mono font-bold text-ink">{card.value}</span>
            <span className="text-[10px] text-ink-3 block">{card.sub}</span>
          </div>
        ))}
      </div>

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-3 border-b border-line text-ink-2 font-semibold">
                <th className="py-2.5 px-3">{t('boq.colCode')}</th>
                <th className="py-2.5 px-3">{t('boq.colCategory')}</th>
                <th className="py-2.5 px-3">{t('boq.colDescription')}</th>
                <th className="py-2.5 px-3 text-right">{t('boq.colQty')}</th>
                <th className="py-2.5 px-3">{t('boq.colUnit')}</th>
                <th className="py-2.5 px-3">{t('boq.colNotes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredItems.map((item) => (
                <tr key={item.itemCode} className="hover:bg-surface-2 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-ink-2">{item.itemCode}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface-3 text-ink-3">
                      {t(bomCategoryKey[item.category])}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-ink max-w-sm">
                    {t(item.descKey, item.descVars)}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-extrabold text-ink text-right">
                    {n(item.quantity)}
                  </td>
                  <td className="py-2.5 px-3 text-ink-2">{t(item.unitKey)}</td>
                  <td className="py-2.5 px-3 text-ink-3 text-[11px]">
                    {item.remarkKey ? t(item.remarkKey, item.remarkVars) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
