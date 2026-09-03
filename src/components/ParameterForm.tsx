import React from 'react';
import {
  CalculationParams,
  RoomType,
  CeilingType,
  SensitivityClass,
  DetectorModel,
  WallLocation,
  PipeOrientation,
} from '../types';
import { NumberField } from './NumberField';
import { useI18n } from '../context/I18nContext';
import {
  ABS_MATERIAL,
  CPVC_MATERIAL,
  UPVC_MATERIAL,
  ceilingKey,
  detectorKey,
  orientationKey,
  roomTypeKey,
  sensitivityKey,
  speedKey,
  wallKey,
} from '../i18n/labels';
import type { TranslationKey } from '../i18n/translations';

interface ParameterFormProps {
  params: CalculationParams;
  onChange: (newParams: CalculationParams) => void;
  onQuickPreset: (presetName: string) => void;
}

const CEILING_TYPES: CeilingType[] = ['flat', 'suspended_grid', 'open_beam', 'sloped'];
const ROOM_TYPES: RoomType[] = [
  'data_center',
  'clean_room',
  'telecom',
  'warehouse',
  'archive',
  'general_commercial',
  'cold_storage',
  'high_ceiling',
];
const SENSITIVITY_CLASSES: SensitivityClass[] = [
  'Class A (High Sensitivity)',
  'Class B (Enhanced)',
  'Class C (Standard)',
];
const DETECTOR_MODELS: DetectorModel[] = [
  'VESDA VEP-A00-P (4-Pipe)',
  'VESDA VEU-A00 (High-Sensitivity 4-Pipe)',
  'VESDA VLS (4-Pipe Sector)',
  'VESDA VLC (Single Pipe)',
  'Securiton ASD 535 (2-Pipe)',
  'Wagner TITANUS (2-Pipe)',
];
const WALLS: WallLocation[] = ['west', 'north', 'east', 'south'];
const ORIENTATIONS: PipeOrientation[] = ['lengthwise', 'widthwise'];
const MATERIALS: { value: string; key: TranslationKey }[] = [
  { value: CPVC_MATERIAL, key: 'opt.material.cpvc' },
  { value: ABS_MATERIAL, key: 'opt.material.abs' },
  { value: UPVC_MATERIAL, key: 'opt.material.upvc' },
];

const SectionHeading: React.FC<{ step: number; children: React.ReactNode }> = ({
  step,
  children,
}) => (
  <div className="flex items-center gap-2 border-b border-line pb-1.5">
    <span className="step-badge">{step}</span>
    <span className="text-xs font-bold text-ink uppercase tracking-wide">{children}</span>
  </div>
);

/** A select styled as a field-cell so it aligns with NumberField neighbours. */
const SelectField: React.FC<{
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ label, help, value, onChange, children }) => (
  <div className="field-cell">
    <label className="field-label">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="field text-xs">
      {children}
    </select>
    <p className="field-help">{help ?? ''}</p>
  </div>
);

export const ParameterForm: React.FC<ParameterFormProps> = ({
  params,
  onChange,
  onQuickPreset,
}) => {
  const { t } = useI18n();

  const updateField = <K extends keyof CalculationParams>(
    field: K,
    value: CalculationParams[K]
  ) => {
    onChange({ ...params, [field]: value });
  };

  const presets: { id: string; label: string; emoji: string; match: RoomType }[] = [
    { id: 'data_center', label: t('form.presets.dataCenter'), emoji: '🏢', match: 'data_center' },
    { id: 'clean_room', label: t('form.presets.cleanRoom'), emoji: '🧪', match: 'clean_room' },
    { id: 'warehouse', label: t('form.presets.warehouse'), emoji: '🏭', match: 'warehouse' },
    {
      id: 'commercial',
      label: t('form.presets.commercial'),
      emoji: '🏦',
      match: 'general_commercial',
    },
  ];

  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* Quick presets */}
      <div className="bg-surface-2 p-3.5 rounded-xl border border-line">
        <span className="text-[11px] font-bold text-ink-3 uppercase tracking-wider block mb-2">
          {t('form.presets.title')}
        </span>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onQuickPreset(preset.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition-all border lift ${
                params.roomType === preset.match
                  ? 'bg-brand-wash border-brand text-brand font-semibold'
                  : 'bg-surface border-line text-ink-2 hover:border-line-2'
              }`}
            >
              <span aria-hidden="true">{preset.emoji}</span> {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Geometry */}
      <div className="space-y-3">
        <SectionHeading step={1}>{t('form.section1')}</SectionHeading>

        <div className="field-row grid-cols-3">
          <NumberField
            label={t('form.length')}
            value={params.length}
            onChange={(v) => updateField('length', v)}
            min={4}
            max={120}
            step={1}
            help={t('help.length', { min: 4, max: 120 })}
          />
          <NumberField
            label={t('form.width')}
            value={params.width}
            onChange={(v) => updateField('width', v)}
            min={3}
            max={80}
            step={1}
            help={t('help.width', { min: 3, max: 80 })}
          />
          <NumberField
            label={t('form.height')}
            value={params.height}
            onChange={(v) => updateField('height', v)}
            min={2}
            max={25}
            step={0.1}
            help={t('help.height', { min: 2, max: 25 })}
          />
        </div>

        <div className="field-row grid-cols-2">
          <SelectField
            label={t('form.ceilingProfile')}
            value={params.ceilingType}
            onChange={(v) => updateField('ceilingType', v as CeilingType)}
          >
            {CEILING_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(ceilingKey[value])}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={t('form.roomType')}
            value={params.roomType}
            onChange={(v) => updateField('roomType', v as RoomType)}
          >
            {ROOM_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(roomTypeKey[value])}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {/* 2. Airflow */}
      <div className="space-y-3">
        <SectionHeading step={2}>{t('form.section2')}</SectionHeading>

        <div className="field-row grid-cols-2">
          <NumberField
            label={t('form.ach')}
            value={params.airChangesPerHour}
            onChange={(v) => updateField('airChangesPerHour', Math.round(v))}
            min={1}
            max={60}
            step={1}
            help={t('help.ach')}
          />
          <NumberField
            label={t('form.velocity')}
            value={params.airflowVelocity}
            onChange={(v) => updateField('airflowVelocity', v)}
            min={0.1}
            max={15}
            step={0.1}
            help={t('help.velocity')}
          />
        </div>

        <div className="field-row grid-cols-1">
          <SelectField
            label={t('form.sensitivity')}
            help={t('help.sensitivity')}
            value={params.sensitivityClass}
            onChange={(v) => updateField('sensitivityClass', v as SensitivityClass)}
          >
            {SENSITIVITY_CLASSES.map((value) => (
              <option key={value} value={value}>
                {t(sensitivityKey[value])}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {/* 3. Detector & piping */}
      <div className="space-y-3">
        <SectionHeading step={3}>{t('form.section3')}</SectionHeading>

        <div className="field-row grid-cols-1">
          <SelectField
            label={t('form.detectorModel')}
            help={t('help.detector')}
            value={params.detectorModel}
            onChange={(v) => {
              const model = v as DetectorModel;
              let pipes = params.pipeCount;
              if (model.includes('4-Pipe')) pipes = 4;
              else if (model.includes('2-Pipe')) pipes = 2;
              else if (model.includes('Single Pipe')) pipes = 1;
              onChange({ ...params, detectorModel: model, pipeCount: pipes });
            }}
          >
            {DETECTOR_MODELS.map((value) => (
              <option key={value} value={value}>
                {t(detectorKey[value])}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="field-row grid-cols-2">
          <div className="field-cell">
            <label className="field-label">{t('form.pipeBranches')}</label>
            <div className="flex rounded-lg border border-line-2 overflow-hidden">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => updateField('pipeCount', count)}
                  title={t(count === 1 ? 'form.pipeCountOne' : 'form.pipeCountMany', { n: count })}
                  aria-label={t(count === 1 ? 'form.pipeCountOne' : 'form.pipeCountMany', {
                    n: count,
                  })}
                  className={`flex-1 py-1.5 text-xs font-bold font-mono transition-colors ${
                    params.pipeCount === count
                      ? 'bg-brand text-white'
                      : 'bg-surface-2 text-ink-2 hover:bg-surface-3'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            <p className="field-help" />
          </div>

          <SelectField
            label={t('form.aspirator')}
            value={params.aspiratorSpeed}
            onChange={(v) => updateField('aspiratorSpeed', v as 'low' | 'medium' | 'high')}
          >
            {(['high', 'medium', 'low'] as const).map((value) => (
              <option key={value} value={value}>
                {t(speedKey[value])}
              </option>
            ))}
          </SelectField>
        </div>

        {/* Spacing drives the whole layout, so it is editable rather than
            hidden — and 0 hands the decision back to the NFPA 72 limit. */}
        <div className="field-row grid-cols-2">
          <NumberField
            label={t('form.pipeSpacingLabel')}
            value={params.pipeSpacingMeters}
            onChange={(v) => updateField('pipeSpacingMeters', v)}
            min={0}
            max={20}
            step={0.5}
            autoValue={0}
            autoLabel={t('form.auto')}
            help={t('help.pipeSpacing')}
          />
          <NumberField
            label={t('form.holeSpacingLabel')}
            value={params.holeSpacingMeters}
            onChange={(v) => updateField('holeSpacingMeters', v)}
            min={0}
            max={20}
            step={0.5}
            autoValue={0}
            autoLabel={t('form.auto')}
            help={t('help.holeSpacing')}
          />
        </div>

        <div className="field-row grid-cols-2">
          <SelectField
            label={t('form.pipeMaterial')}
            value={params.pipeMaterial}
            onChange={(v) => updateField('pipeMaterial', v)}
          >
            {MATERIALS.map((material) => (
              <option key={material.value} value={material.value}>
                {t(material.key)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={t('form.orientation')}
            value={params.pipeRunOrientation}
            onChange={(v) => updateField('pipeRunOrientation', v as PipeOrientation)}
          >
            {ORIENTATIONS.map((value) => (
              <option key={value} value={value}>
                {t(orientationKey[value])}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="field-row grid-cols-2">
          <SelectField
            label={t('form.wallMount')}
            value={params.detectorLocation.wall}
            onChange={(v) =>
              updateField('detectorLocation', {
                ...params.detectorLocation,
                wall: v as WallLocation,
              })
            }
          >
            {WALLS.map((value) => (
              <option key={value} value={value}>
                {t(wallKey[value])}
              </option>
            ))}
          </SelectField>

          {params.capillaryDropEnabled ? (
            <NumberField
              label={t('form.capillaryLength')}
              value={params.capillaryTubeLength}
              onChange={(v) => updateField('capillaryTubeLength', v)}
              min={0.1}
              max={3}
              step={0.1}
              help={t('help.capillary')}
            />
          ) : (
            <div className="field-cell" />
          )}
        </div>

        <label className="flex items-start gap-2 cursor-pointer pt-0.5">
          <input
            type="checkbox"
            checked={params.capillaryDropEnabled}
            onChange={(e) => updateField('capillaryDropEnabled', e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-brand border-line-2 shrink-0"
          />
          <span>
            <span className="text-xs font-semibold text-ink">{t('form.capillary')}</span>
            <span className="field-help block">{t('form.capillaryHelp')}</span>
          </span>
        </label>
      </div>
    </div>
  );
};
