import React, { useMemo, useState } from 'react';
import { CalculationResults, CalculationParams } from '../types';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  GitBranch,
  Gauge,
  Lightbulb,
  Search,
  XCircle,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { ratingKey, sensitivityKey } from '../i18n/labels';

interface ComplianceMatrixTabProps {
  results: CalculationResults;
  params: CalculationParams;
}

const Gauge3D: React.FC<{
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  value: string;
  unit: string;
  percent: number;
  barClass: string;
  footer: string;
}> = ({ icon, title, badge, value, unit, percent, barClass, footer }) => (
  <div className="surface-card surface-raised lift p-4">
    <div className="flex items-center justify-between mb-2 gap-2">
      <span className="text-[11px] font-semibold text-ink-3 uppercase flex items-center gap-1.5">
        <span className="text-brand">{icon}</span>
        {title}
      </span>
      {badge}
    </div>

    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-2xl font-mono font-extrabold text-ink">{value}</span>
      <span className="text-xs font-medium text-ink-3">{unit}</span>
    </div>

    <div className="w-full bg-surface-3 h-2.5 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${barClass}`}
        style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
      />
    </div>
    <span className="text-[11px] text-ink-3 mt-1.5 block">{footer}</span>
  </div>
);

export const ComplianceMatrixTab: React.FC<ComplianceMatrixTabProps> = ({ results, params }) => {
  const { t, n } = useI18n();
  const [holeFilter, setHoleFilter] = useState('');
  const [selectedPipe, setSelectedPipe] = useState<string>('all');

  const filteredHoles = useMemo(
    () =>
      results.holes.filter((hole) => {
        const matchesPipe = selectedPipe === 'all' || hole.pipeName === selectedPipe;
        const matchesSearch =
          holeFilter === '' ||
          hole.holeNumber.toString().includes(holeFilter) ||
          hole.diameterMm.toString().includes(holeFilter);
        return matchesPipe && matchesSearch;
      }),
    [results.holes, selectedPipe, holeFilter]
  );

  const areaPerPort = results.roomAreaM2 / Math.max(1, results.totalHolesCalculated);
  const transportOk = results.estimatedTransportTimeSec <= results.maxAllowedTransportTimeSec;
  const pressureOk = results.suctionPressureEndHolePa >= 25;

  return (
    <div className="space-y-6">
      {/* Verdict banner */}
      <div
        className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
          results.isCompliant
            ? 'bg-ok-wash border-ok/40'
            : 'bg-warn-wash border-warn/40'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
              results.isCompliant ? 'bg-ok' : 'bg-warn'
            }`}
          >
            {results.isCompliant ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-sm text-ink">
              {results.isCompliant ? t('comp.verifiedTitle') : t('comp.attentionTitle')}
            </h4>
            <p className="text-xs text-ink-2 mt-0.5 max-w-2xl">
              {results.isCompliant
                ? t('comp.verifiedBody', {
                    class: t(sensitivityKey[params.sensitivityClass]),
                    t: n(results.estimatedTransportTimeSec, 1),
                    rating: t(ratingKey[results.transportTimeRating]),
                  })
                : t('comp.attentionBody')}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-mono uppercase font-bold text-ink-3 block">
            {t('comp.flowBalance')}
          </span>
          <span className="text-xl font-mono font-extrabold text-ink">
            {n(results.flowBalanceRatioPercent, 1)}%
          </span>
        </div>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Gauge3D
          icon={<Gauge className="w-3.5 h-3.5" />}
          title={t('comp.gaugeTransport')}
          badge={
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                transportOk ? 'bg-ok-wash text-ok' : 'bg-bad-wash text-bad'
              }`}
            >
              {t(ratingKey[results.transportTimeRating])}
            </span>
          }
          value={n(results.estimatedTransportTimeSec, 1)}
          unit={t('comp.gaugeTransportSub', { v: results.maxAllowedTransportTimeSec })}
          percent={
            (results.estimatedTransportTimeSec / results.maxAllowedTransportTimeSec) * 100
          }
          barClass={
            results.estimatedTransportTimeSec <= results.maxAllowedTransportTimeSec * 0.7
              ? 'bg-ok'
              : transportOk
              ? 'bg-warn'
              : 'bg-bad'
          }
          footer={t('comp.gaugeTransportFoot', {
            v: n(results.maxBranchLengthM, 1),
            n: results.branches[0]?.holeCount ?? 0,
          })}
        />

        <Gauge3D
          icon={<Activity className="w-3.5 h-3.5" />}
          title={t('comp.gaugePressure')}
          badge={
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                pressureOk ? 'bg-ok-wash text-ok' : 'bg-warn-wash text-warn'
              }`}
            >
              {pressureOk ? t('comp.adequate') : t('comp.low')}
            </span>
          }
          value={n(results.suctionPressureEndHolePa)}
          unit={t('comp.gaugePressureSub')}
          percent={(results.suctionPressureEndHolePa / 120) * 100}
          barClass="bg-info"
          footer={t('comp.gaugePressureFoot')}
        />

        <Gauge3D
          icon={<GitBranch className="w-3.5 h-3.5" />}
          title={t('comp.gaugeDensity')}
          badge={
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-surface-3 text-ink-2">
              NFPA 72
            </span>
          }
          value={n(areaPerPort, 1)}
          unit={t('comp.gaugeDensitySub', { v: n(results.recommendedMaxAreaPerHoleM2, 1) })}
          percent={(areaPerPort / results.recommendedMaxAreaPerHoleM2) * 100}
          barClass={areaPerPort <= results.recommendedMaxAreaPerHoleM2 ? 'bg-ok' : 'bg-warn'}
          footer={t('comp.gaugeDensityFoot', {
            h: n(params.height, 1),
            ach: params.airChangesPerHour,
          })}
        />
      </div>

      {/* Checklist */}
      <div className="surface-card overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold text-[11px] uppercase tracking-wider text-ink-2">
            {t('comp.checklistTitle')}
          </h4>
          <span className="text-xs text-ink-3">{t('comp.checklistRef')}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-3 border-b border-line text-ink-2">
                <th className="py-2.5 px-3 font-semibold">{t('comp.colRule')}</th>
                <th className="py-2.5 px-3 font-semibold">{t('comp.colRef')}</th>
                <th className="py-2.5 px-3 font-semibold">{t('comp.colActual')}</th>
                <th className="py-2.5 px-3 font-semibold">{t('comp.colLimit')}</th>
                <th className="py-2.5 px-3 font-semibold">{t('comp.colStatus')}</th>
                <th className="py-2.5 px-3 font-semibold">{t('comp.colNote')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {results.complianceChecks.map((check) => (
                <tr key={check.id} className="hover:bg-surface-2 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-ink">{t(check.ruleKey)}</td>
                  <td className="py-2.5 px-3 text-ink-3 font-mono text-[11px]">
                    {check.standardRef}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-ink">{check.actualValue}</td>
                  <td className="py-2.5 px-3 font-mono text-ink-2">{check.limitValue}</td>
                  <td className="py-2.5 px-3">
                    {check.status === 'pass' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-ok-wash text-ok">
                        <Check className="w-3 h-3" /> {t('comp.pass')}
                      </span>
                    )}
                    {check.status === 'warning' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-warn-wash text-warn">
                        <AlertTriangle className="w-3 h-3" /> {t('comp.warning')}
                      </span>
                    )}
                    {check.status === 'fail' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-bad-wash text-bad">
                        <XCircle className="w-3 h-3" /> {t('comp.fail')}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-ink-3 text-2xs max-w-sm">
                    {t(check.noteKey, check.noteVars)}
                    {check.adviceKey && (
                      <span className="mt-1.5 flex items-start gap-1.5 rounded-md bg-brand-wash border border-brand/25 px-2 py-1.5 text-ink-2">
                        <Lightbulb className="w-3 h-3 text-brand shrink-0 mt-0.5" />
                        <span>
                          <strong className="font-bold text-brand-ink">{t('comp.advice')}: </strong>
                          {t(check.adviceKey, check.adviceVars)}
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill schedule */}
      <div className="surface-card overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-line flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-wider text-ink-2">
              {t('comp.scheduleTitle', { n: results.totalHolesCalculated })}
            </h4>
            <p className="text-[11px] text-ink-3">{t('comp.scheduleSub')}</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedPipe}
              onChange={(e) => setSelectedPipe(e.target.value)}
              className="field text-xs w-auto"
            >
              <option value="all">{t('comp.allBranches')}</option>
              {results.branches.map((branch) => (
                <option key={branch.pipeName} value={branch.pipeName}>
                  {t('comp.branchOption', { name: branch.pipeName, n: branch.holeCount })}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-ink-3 pointer-events-none" />
              <input
                type="text"
                placeholder={t('comp.filterHole')}
                value={holeFilter}
                onChange={(e) => setHoleFilter(e.target.value)}
                className="field text-xs pl-7 w-36"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface-3 border-b border-line text-ink-2 font-semibold">
                <th className="py-2 px-3">{t('comp.colHole')}</th>
                <th className="py-2 px-3">{t('comp.colBranch')}</th>
                <th className="py-2 px-3">{t('comp.colPos')}</th>
                <th className="py-2 px-3">{t('comp.colDistance')}</th>
                <th className="py-2 px-3">{t('comp.colDrill')}</th>
                <th className="py-2 px-3">{t('comp.colFlow')}</th>
                <th className="py-2 px-3">{t('comp.colSuction')}</th>
                <th className="py-2 px-3">{t('comp.colRadius')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredHoles.map((hole) => (
                <tr key={hole.id} className="hover:bg-surface-2 transition-colors">
                  <td className="py-2 px-3 font-mono font-bold text-ink">#{hole.holeNumber}</td>
                  <td className="py-2 px-3 font-medium text-brand">{hole.pipeName}</td>
                  <td className="py-2 px-3 font-mono text-ink-2">
                    ({n(hole.x, 2)} m, {n(hole.y, 2)} m)
                  </td>
                  <td className="py-2 px-3 font-mono text-ink-2">
                    {n(hole.distanceAlongPipe, 1)} m
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-warn-wash text-warn border border-warn/30">
                      ø {n(hole.diameterMm, 1)} mm
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-ink-2">
                    {n(hole.estimatedFlowRateLpm, 1)} L/min
                  </td>
                  <td className="py-2 px-3 font-mono text-ink-2">{n(hole.suctionPressurePa)} Pa</td>
                  <td className="py-2 px-3 font-mono text-ink-3">r = {n(hole.coverageRadiusM, 2)} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
