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
import { Cpu, Maximize, Wind } from 'lucide-react';
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

const SectionHeading: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <div className="flex items-center gap-2 text-[11px] font-bold text-ink-2 uppercase tracking-wider border-b border-line pb-1.5">
    <span className="text-brand">{icon}</span>
    {children}
  </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-medium text-ink-2 mb-1">{children}</label>
);

export const ParameterForm: React.FC<ParameterFormProps> = ({
  params,
  onChange,
  onQuickPreset,
}) => {
  const { t, n } = useI18n();

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
        <SectionHeading icon={<Maximize className="w-3.5 h-3.5" />}>
          {t('form.section1')}
        </SectionHeading>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <FieldLabel>{t('form.length')}</FieldLabel>
            <input
              type="number"
              min="4"
              max="120"
              step="0.5"
              value={params.length}
              onChange={(e) => updateField('length', Math.max(4, parseFloat(e.target.value) || 4))}
              className="field font-mono"
            />
          </div>
          <div>
            <FieldLabel>{t('form.width')}</FieldLabel>
            <input
              type="number"
              min="3"
              max="80"
              step="0.5"
              value={params.width}
              onChange={(e) => updateField('width', Math.max(3, parseFloat(e.target.value) || 3))}
              className="field font-mono"
            />
          </div>
          <div>
            <FieldLabel>{t('form.height')}</FieldLabel>
            <input
              type="number"
              min="2.0"
              max="25"
              step="0.1"
              value={params.height}
              onChange={(e) => updateField('height', Math.max(2, parseFloat(e.target.value) || 2))}
              className="field font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <FieldLabel>{t('form.ceilingProfile')}</FieldLabel>
            <select
              value={params.ceilingType}
              onChange={(e) => updateField('ceilingType', e.target.value as CeilingType)}
              className="field text-xs"
            >
              {CEILING_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(ceilingKey[value])}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>{t('form.roomType')}</FieldLabel>
            <select
              value={params.roomType}
              onChange={(e) => updateField('roomType', e.target.value as RoomType)}
              className="field text-xs"
            >
              {ROOM_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(roomTypeKey[value])}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Airflow */}
      <div className="space-y-3">
        <SectionHeading icon={<Wind className="w-3.5 h-3.5" />}>{t('form.section2')}</SectionHeading>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-ink-2">{t('form.ach')}</label>
              <span className="text-xs font-mono font-bold text-brand">
                {params.airChangesPerHour} ACH
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={params.airChangesPerHour}
              onChange={(e) => updateField('airChangesPerHour', parseInt(e.target.value, 10) || 1)}
              className="w-full accent-brand cursor-pointer"
            />
            <span className="text-[10px] text-ink-3 block mt-0.5">
              {params.airChangesPerHour > 15 ? t('form.achHigh') : t('form.achStandard')}
            </span>
          </div>

          <div>
            <FieldLabel>{t('form.velocity')}</FieldLabel>
            <input
              type="number"
              min="0.1"
              max="15.0"
              step="0.1"
              value={params.airflowVelocity}
              onChange={(e) =>
                updateField('airflowVelocity', Math.max(0.1, parseFloat(e.target.value) || 0.1))
              }
              className="field font-mono"
            />
          </div>
        </div>

        <div>
          <FieldLabel>{t('form.sensitivity')}</FieldLabel>
          <select
            value={params.sensitivityClass}
            onChange={(e) => updateField('sensitivityClass', e.target.value as SensitivityClass)}
            className="field text-xs font-medium"
          >
            {SENSITIVITY_CLASSES.map((value) => (
              <option key={value} value={value}>
                {t(sensitivityKey[value])}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Detector & piping */}
      <div className="space-y-3">
        <SectionHeading icon={<Cpu className="w-3.5 h-3.5" />}>{t('form.section3')}</SectionHeading>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <FieldLabel>{t('form.detectorModel')}</FieldLabel>
            <select
              value={params.detectorModel}
              onChange={(e) => {
                const model = e.target.value as DetectorModel;
                let pipes = params.pipeCount;
                if (model.includes('4-Pipe')) pipes = 4;
                else if (model.includes('2-Pipe')) pipes = 2;
                else if (model.includes('Single Pipe')) pipes = 1;
                onChange({ ...params, detectorModel: model, pipeCount: pipes });
              }}
              className="field text-xs font-medium"
            >
              {DETECTOR_MODELS.map((value) => (
                <option key={value} value={value}>
                  {t(detectorKey[value])}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>{t('form.pipeBranches')}</FieldLabel>
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
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <FieldLabel>{t('form.aspirator')}</FieldLabel>
            <select
              value={params.aspiratorSpeed}
              onChange={(e) =>
                updateField('aspiratorSpeed', e.target.value as 'low' | 'medium' | 'high')
              }
              className="field text-xs font-medium"
            >
              {(['high', 'medium', 'low'] as const).map((value) => (
                <option key={value} value={value}>
                  {t(speedKey[value])}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>{t('form.pipeMaterial')}</FieldLabel>
            <select
              value={params.pipeMaterial}
              onChange={(e) => updateField('pipeMaterial', e.target.value)}
              className="field text-xs"
            >
              {MATERIALS.map((material) => (
                <option key={material.value} value={material.value}>
                  {t(material.key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 bg-surface-2 p-2.5 rounded-lg border border-line">
          <div>
            <FieldLabel>{t('form.wallMount')}</FieldLabel>
            <select
              value={params.detectorLocation.wall}
              onChange={(e) =>
                updateField('detectorLocation', {
                  ...params.detectorLocation,
                  wall: e.target.value as WallLocation,
                })
              }
              className="field text-xs"
            >
              {WALLS.map((value) => (
                <option key={value} value={value}>
                  {t(wallKey[value])}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>{t('form.orientation')}</FieldLabel>
            <select
              value={params.pipeRunOrientation}
              onChange={(e) => updateField('pipeRunOrientation', e.target.value as PipeOrientation)}
              className="field text-xs"
            >
              {ORIENTATIONS.map((value) => (
                <option key={value} value={value}>
                  {t(orientationKey[value])}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-1 space-y-2.5">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={params.capillaryDropEnabled}
              onChange={(e) => updateField('capillaryDropEnabled', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-brand border-line-2"
            />
            <span>
              <span className="text-xs font-medium text-ink">{t('form.capillary')}</span>
              <span className="text-[11px] text-ink-3 block">{t('form.capillaryHelp')}</span>
            </span>
          </label>

          {params.capillaryDropEnabled && (
            <div className="pl-6 max-w-[12rem] animate-fadeIn">
              <FieldLabel>{t('form.capillaryLength')}</FieldLabel>
              <input
                type="number"
                min="0.1"
                max="3"
                step="0.1"
                value={params.capillaryTubeLength}
                onChange={(e) =>
                  updateField(
                    'capillaryTubeLength',
                    Math.min(3, Math.max(0.1, parseFloat(e.target.value) || 0.1))
                  )
                }
                className="field font-mono"
              />
              <span className="text-[10px] text-ink-3 block mt-1">
                {n(params.capillaryTubeLength, 1)} m
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
