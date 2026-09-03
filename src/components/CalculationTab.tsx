import React, { useMemo, useState } from 'react';
import { CalculationGroup, CalculationParams, CalculationResults } from '../types';
import { AlertTriangle, Check, Copy, FunctionSquare } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import {
  ceilingKey,
  detectorKey,
  materialKey,
  roomTypeKey,
  sensitivityKey,
  speedKey,
  wallKey,
} from '../i18n/labels';
import type { TranslationKey } from '../i18n/translations';

interface CalculationTabProps {
  results: CalculationResults;
  params: CalculationParams;
}

const GROUP_ORDER: CalculationGroup[] = [
  'geometry',
  'spacing',
  'layout',
  'hydraulic',
  'transport',
];

const GROUP_KEYS: Record<CalculationGroup, TranslationKey> = {
  geometry: 'calc.group.geometry',
  spacing: 'calc.group.spacing',
  layout: 'calc.group.layout',
  hydraulic: 'calc.group.hydraulic',
  transport: 'calc.group.transport',
};

export const CalculationTab: React.FC<CalculationTabProps> = ({ results, params }) => {
  const { t, n } = useI18n();
  const [copied, setCopied] = useState(false);

  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        steps: results.derivation.filter((step) => step.group === group),
      })).filter((entry) => entry.steps.length > 0),
    [results.derivation]
  );

  const material = materialKey(params.pipeMaterial);

  const inputs: [string, string][] = [
    [t('form.length'), `${n(params.length, 1)} m`],
    [t('form.width'), `${n(params.width, 1)} m`],
    [t('form.height'), `${n(params.height, 1)} m`],
    [t('form.roomType'), t(roomTypeKey[params.roomType])],
    [t('form.ceilingProfile'), t(ceilingKey[params.ceilingType])],
    [t('form.ach'), `${params.airChangesPerHour} ACH`],
    [t('form.velocity'), `${n(params.airflowVelocity, 1)} m/s`],
    [t('form.sensitivity'), t(sensitivityKey[params.sensitivityClass])],
    [t('form.detectorModel'), t(detectorKey[params.detectorModel])],
    [t('form.pipeBranches'), String(params.pipeCount)],
    [t('form.aspirator'), t(speedKey[params.aspiratorSpeed])],
    [t('form.pipeMaterial'), material ? t(material) : params.pipeMaterial],
    [t('form.wallMount'), t(wallKey[params.detectorLocation.wall])],
    [
      t('form.capillaryLength'),
      params.capillaryDropEnabled ? `${n(params.capillaryTubeLength, 1)} m` : '—',
    ],
  ];

  const copyCalculation = async () => {
    const lines: string[] = [t('calc.title'), ''];
    lines.push(t('calc.inputsTitle'));
    inputs.forEach(([label, value]) => lines.push(`  ${label}: ${value}`));
    lines.push('');

    grouped.forEach(({ group, steps }) => {
      lines.push(t(GROUP_KEYS[group]));
      steps.forEach((step, index) => {
        lines.push(`  ${index + 1}. ${t(step.titleKey)}`);
        lines.push(`     ${step.formula}`);
        lines.push(`     ${step.substitution} = ${step.result}`);
        if (step.reference) lines.push(`     [${step.reference}]`);
      });
      lines.push('');
    });
    lines.push(t('calc.disclaimer'));

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  let stepNumber = 0;

  return (
    <div className="space-y-4">
      <div className="surface-card p-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-brand-wash text-brand flex items-center justify-center shrink-0">
            <FunctionSquare className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-ink">{t('calc.title')}</h4>
            <p className="text-xs text-ink-3 max-w-3xl leading-relaxed">{t('calc.subtitle')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={copyCalculation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-ink-2 border border-line transition-colors shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-ok" />
              {t('calc.copied')}
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              {t('calc.copy')}
            </>
          )}
        </button>
      </div>

      {/* Inputs the derivation starts from — so a reader can check the premises
          before checking the arithmetic. */}
      <div className="surface-card overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-2 border-b border-line">
          <h4 className="font-bold text-xs uppercase tracking-wider text-ink-2">
            {t('calc.inputsTitle')}
          </h4>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-1.5 p-4 text-xs">
          {inputs.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-ink-3 truncate">{label}</dt>
              <dd className="font-mono font-semibold text-ink truncate">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {grouped.map(({ group, steps }) => (
        <div key={group} className="surface-card overflow-hidden">
          <div className="px-4 py-2.5 bg-surface-2 border-b border-line">
            <h4 className="font-bold text-xs uppercase tracking-wider text-brand-ink">
              {t(GROUP_KEYS[group])}
            </h4>
          </div>

          <div className="divide-y divide-line">
            {steps.map((step) => {
              stepNumber += 1;
              return (
                <div key={step.id} className="p-4 hover:bg-surface-2/60 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="step-badge mt-0.5">{stepNumber}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                        <span className="font-bold text-sm text-ink">{t(step.titleKey)}</span>
                        {step.reference && (
                          <span className="text-2xs font-mono text-ink-3">{step.reference}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-2 md:gap-3 items-center">
                        <code className="text-xs font-mono bg-surface-3 text-ink-2 rounded-md px-2 py-1.5 block overflow-x-auto whitespace-nowrap">
                          {step.formula}
                        </code>
                        <code className="text-xs font-mono bg-surface-2 text-ink rounded-md px-2 py-1.5 block overflow-x-auto whitespace-nowrap border border-line">
                          {step.substitution}
                        </code>
                        <span className="text-sm font-mono font-extrabold text-brand-ink bg-brand-wash border border-brand/25 rounded-md px-2.5 py-1.5 text-center whitespace-nowrap">
                          = {step.result}
                        </span>
                      </div>

                      {step.noteKey && (
                        <p className="text-xs text-ink-3 mt-2 leading-relaxed">
                          {t(step.noteKey, step.noteVars)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-warn-wash border border-warn/30 text-xs text-ink-2">
        <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
        <p className="leading-relaxed">{t('calc.disclaimer')}</p>
      </div>
    </div>
  );
};
