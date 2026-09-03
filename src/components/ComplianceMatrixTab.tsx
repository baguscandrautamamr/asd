import React, { useState } from 'react';
import { CalculationResults, CalculationParams } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Gauge,
  Activity,
  GitBranch,
  Search,
  Check,
  Zap,
} from 'lucide-react';

interface ComplianceMatrixTabProps {
  results: CalculationResults;
  params: CalculationParams;
}

export const ComplianceMatrixTab: React.FC<ComplianceMatrixTabProps> = ({
  results,
  params,
}) => {
  const [holeFilter, setHoleFilter] = useState('');
  const [selectedPipe, setSelectedPipe] = useState<string>('all');

  const filteredHoles = results.holes.filter((h) => {
    const matchesPipe = selectedPipe === 'all' || h.pipeName === selectedPipe;
    const matchesSearch =
      holeFilter === '' ||
      h.holeNumber.toString().includes(holeFilter) ||
      h.diameterMm.toString().includes(holeFilter);
    return matchesPipe && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Compliance Verdict Banner */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
          results.isCompliant
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/80 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              results.isCompliant ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {results.isCompliant ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-sm">
              {results.isCompliant
                ? 'NFPA 72 Standard Compliance Verified'
                : 'Engineering Attention Required (NFPA 72 Limit Threshold)'}
            </h4>
            <p className="text-xs opacity-85">
              {results.isCompliant
                ? `System passes all NFPA 72 Chapter 17 criteria for ${params.sensitivityClass}. Transport time is ${results.estimatedTransportTimeSec}s (rating: ${results.transportTimeRating}).`
                : 'One or more design parameters are near or exceeding permissible limits. Adjust pipe count or hole spacing.'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-mono uppercase font-bold text-slate-500 block">
            Flow Balance
          </span>
          <span className="text-xl font-mono font-extrabold text-slate-800">
            {results.flowBalanceRatioPercent}%
          </span>
        </div>
      </div>

      {/* Hydraulic & Transport Performance Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gauge 1: Transport Time */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-rose-600" />
              Smoke Transport Time
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                results.estimatedTransportTimeSec <= results.maxAllowedTransportTimeSec
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {results.transportTimeRating}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-mono font-extrabold text-slate-900">
              {results.estimatedTransportTimeSec}
            </span>
            <span className="text-xs font-medium text-slate-500">
              seconds (NFPA Max: {results.maxAllowedTransportTimeSec}s)
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                results.estimatedTransportTimeSec <= results.maxAllowedTransportTimeSec * 0.7
                  ? 'bg-emerald-500'
                  : results.estimatedTransportTimeSec <= results.maxAllowedTransportTimeSec
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  (results.estimatedTransportTimeSec / results.maxAllowedTransportTimeSec) * 100
                )}%`,
              }}
            />
          </div>
          <span className="text-[11px] text-slate-500 mt-1.5 block">
            Longest run: {results.maxBranchLengthM}m with {results.branches[0]?.holeCount || 0} ports
          </span>
        </div>

        {/* Gauge 2: End-of-Line Suction Pressure */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-rose-600" />
              End Port Suction Pressure
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                results.suctionPressureEndHolePa >= 25
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {results.suctionPressureEndHolePa >= 25 ? 'Adequate' : 'Low'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-mono font-extrabold text-slate-900">
              {results.suctionPressureEndHolePa}
            </span>
            <span className="text-xs font-medium text-slate-500">
              Pascal (Min: ≥ 25 Pa)
            </span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (results.suctionPressureEndHolePa / 120) * 100)}%`,
              }}
            />
          </div>
          <span className="text-[11px] text-slate-500 mt-1.5 block">
            Sufficient delta-P guarantees continuous smoke ingestion
          </span>
        </div>

        {/* Gauge 3: Hole Coverage Density */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-rose-600" />
              Area Density / Sampling Port
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
              NFPA 72
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-mono font-extrabold text-slate-900">
              {(results.roomAreaM2 / results.totalHolesCalculated).toFixed(1)}
            </span>
            <span className="text-xs font-medium text-slate-500">
              m²/port (Max: ≤ {results.recommendedMaxAreaPerHoleM2} m²)
            </span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  ((results.roomAreaM2 / results.totalHolesCalculated) /
                    results.recommendedMaxAreaPerHoleM2) *
                    100
                )}%`,
              }}
            />
          </div>
          <span className="text-[11px] text-slate-500 mt-1.5 block">
            Adjusted for room height of {params.height}m & {params.airChangesPerHour} ACH
          </span>
        </div>
      </div>

      {/* NFPA 72 Checklist Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
            NFPA 72 Standard Engineering Checklist
          </h4>
          <span className="text-xs text-slate-500">
            Reference: NFPA 72 (2022/2025 Edition) Chapter 17
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-3 font-semibold">Rule / Criteria</th>
                <th className="py-2.5 px-3 font-semibold">Standard Reference</th>
                <th className="py-2.5 px-3 font-semibold">Calculated Value</th>
                <th className="py-2.5 px-3 font-semibold">Allowable Threshold</th>
                <th className="py-2.5 px-3 font-semibold">Compliance Status</th>
                <th className="py-2.5 px-3 font-semibold">Engineering Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {results.complianceChecks.map((chk) => (
                <tr key={chk.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-900">{chk.rule}</td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                    {chk.standardRef}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                    {chk.actualValue}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{chk.limitValue}</td>
                  <td className="py-2.5 px-3">
                    {chk.status === 'pass' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <Check className="w-3 h-3" /> PASS
                      </span>
                    )}
                    {chk.status === 'warning' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3" /> WARNING
                      </span>
                    )}
                    {chk.status === 'fail' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                        <XCircle className="w-3 h-3" /> FAIL
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">{chk.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sampling Hole Drill Schedule Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Calibrated Sampling Hole Schedule ({results.totalHolesCalculated} Ports)
            </h4>
            <p className="text-[11px] text-slate-500">
              Tapered orifice sizing schedule for optimized hydraulic balance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedPipe}
              onChange={(e) => setSelectedPipe(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 bg-white"
            >
              <option value="all">All Pipe Branches</option>
              {results.branches.map((b) => (
                <option key={b.pipeName} value={b.pipeName}>
                  {b.pipeName} ({b.holeCount} holes)
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter hole #..."
                value={holeFilter}
                onChange={(e) => setHoleFilter(e.target.value)}
                className="text-xs pl-7 pr-2.5 py-1 rounded-lg border border-slate-300 w-32 focus:w-40 transition-all text-slate-800 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 z-10">
              <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2 px-3">Hole #</th>
                <th className="py-2 px-3">Pipe Branch</th>
                <th className="py-2 px-3">Position (X, Y)</th>
                <th className="py-2 px-3">Distance From ASD</th>
                <th className="py-2 px-3">Orifice Drill Size</th>
                <th className="py-2 px-3">Estimated Flow</th>
                <th className="py-2 px-3">Suction Pressure</th>
                <th className="py-2 px-3">Coverage Radius</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHoles.map((hole) => (
                <tr key={hole.id} className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 font-mono font-bold text-slate-900">
                    #{hole.holeNumber}
                  </td>
                  <td className="py-2 px-3 font-medium text-rose-600">{hole.pipeName}</td>
                  <td className="py-2 px-3 font-mono text-slate-600">
                    ({hole.x}m, {hole.y}m)
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-700">
                    {hole.distanceAlongPipe} m
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                      ø {hole.diameterMm} mm
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-700">
                    {hole.estimatedFlowRateLpm} L/min
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-700">
                    {hole.suctionPressurePa} Pa
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-500">
                    r = {hole.coverageRadiusM} m
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
