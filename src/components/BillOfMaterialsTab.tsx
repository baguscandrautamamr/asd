import React, { useState } from 'react';
import { BOMItem, CalculationResults, CalculationParams } from '../types';
import {
  Package,
  Copy,
  Check,
  Filter,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

interface BillOfMaterialsTabProps {
  results: CalculationResults;
  params: CalculationParams;
}

export const BillOfMaterialsTab: React.FC<BillOfMaterialsTabProps> = ({
  results,
  params,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredItems = results.billOfMaterials.filter((item) =>
    selectedCategory === 'all' ? true : item.category === selectedCategory
  );

  const copyToClipboard = () => {
    const header = 'Item Code\tCategory\tDescription\tQty\tUnit\tRemarks\n';
    const rows = results.billOfMaterials
      .map(
        (i) =>
          `${i.itemCode}\t${i.category}\t${i.description}\t${i.quantity}\t${i.unit}\t${i.remarks || ''}`
      )
      .join('\n');
    navigator.clipboard.writeText(header + rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Top Controls & Category Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-rose-600" />
          <div>
            <h4 className="font-bold text-sm text-slate-800">
              Bill of Materials & Material Take-Off (BoQ)
            </h4>
            <p className="text-xs text-slate-500">
              Procurement schedule for {results.totalPipeLengthM}m of {params.pipeMaterial} with {results.totalHolesCalculated} sampling points.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
            >
              <option value="all">All Categories</option>
              <option value="detector">Detector Units</option>
              <option value="pipe">Pipes & Conduits</option>
              <option value="fittings">Fittings & Bends</option>
              <option value="hardware">Hardware & Brackets</option>
              <option value="accessories">Sampling Accessories</option>
            </select>
          </div>

          <button
            type="button"
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied BoQ!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy to Clipboard
              </>
            )}
          </button>
        </div>
      </div>

      {/* BoQ Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            CPVC 25mm Sticks (3m)
          </span>
          <span className="text-xl font-mono font-bold text-slate-900">
            {results.billOfMaterials.find((i) => i.itemCode === 'PIP-CPVC-25')?.quantity || 0}{' '}
            sticks
          </span>
          <span className="text-[10px] text-slate-500 block">
            Includes 10% cutting waste
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            90° Sweep Elbows
          </span>
          <span className="text-xl font-mono font-bold text-slate-900">
            {results.billOfMaterials.find((i) => i.itemCode === 'FIT-ELB-90')?.quantity || 0} pcs
          </span>
          <span className="text-[10px] text-slate-500 block">Low pressure drop sweep</span>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            Pipe Clips / Hangers
          </span>
          <span className="text-xl font-mono font-bold text-slate-900">
            {results.billOfMaterials.find((i) => i.itemCode === 'HRD-CLP-25')?.quantity || 0} pcs
          </span>
          <span className="text-[10px] text-slate-500 block">1 hanger per 1.5m run</span>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            Warning / ID Decals
          </span>
          <span className="text-xl font-mono font-bold text-slate-900">
            {results.billOfMaterials.find((i) => i.itemCode === 'LBL-SAM-01')?.quantity || 0} pcs
          </span>
          <span className="text-[10px] text-slate-500 block">Required by NFPA 72</span>
        </div>
      </div>

      {/* Main BoQ Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Item Code</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3">Engineering Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <tr key={item.itemCode} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                    {item.itemCode}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-600">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900 max-w-sm">
                    {item.description}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900 text-right">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{item.unit}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">{item.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
