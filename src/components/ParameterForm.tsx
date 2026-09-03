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
import {
  Sliders,
  Wind,
  Box,
  Cpu,
  Activity,
  Maximize,
  ShieldAlert,
  Settings2,
} from 'lucide-react';

interface ParameterFormProps {
  params: CalculationParams;
  onChange: (newParams: CalculationParams) => void;
  onQuickPreset: (presetName: string) => void;
}

export const ParameterForm: React.FC<ParameterFormProps> = ({
  params,
  onChange,
  onQuickPreset,
}) => {
  const updateField = <K extends keyof CalculationParams>(
    field: K,
    value: CalculationParams[K]
  ) => {
    onChange({
      ...params,
      [field]: value,
    });
  };

  return (
    <div className="flex flex-col gap-5 text-slate-800 text-sm">
      {/* Quick Presets */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
          NFPA 72 Quick Facility Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onQuickPreset('data_center')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition-all border ${
              params.roomType === 'data_center'
                ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            🏢 Data Center Hall
          </button>
          <button
            type="button"
            onClick={() => onQuickPreset('clean_room')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition-all border ${
              params.roomType === 'clean_room'
                ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            🧪 Cleanroom ISO 5
          </button>
          <button
            type="button"
            onClick={() => onQuickPreset('warehouse')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition-all border ${
              params.roomType === 'warehouse'
                ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            🏭 High-Bay Warehouse
          </button>
          <button
            type="button"
            onClick={() => onQuickPreset('commercial')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition-all border ${
              params.roomType === 'general_commercial'
                ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            🏦 Commercial Office
          </button>
        </div>
      </div>

      {/* 1. Room Dimensions & Geometry */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5">
          <Maximize className="w-3.5 h-3.5 text-rose-600" />
          1. Room Geometry & Structure
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Length (m)
            </label>
            <input
              type="number"
              min="4"
              max="120"
              step="0.5"
              value={params.length}
              onChange={(e) => updateField('length', Math.max(4, parseFloat(e.target.value) || 4))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-mono text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Width (m)
            </label>
            <input
              type="number"
              min="3"
              max="80"
              step="0.5"
              value={params.width}
              onChange={(e) => updateField('width', Math.max(3, parseFloat(e.target.value) || 3))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-mono text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Height (m)
            </label>
            <input
              type="number"
              min="2.0"
              max="25"
              step="0.1"
              value={params.height}
              onChange={(e) => updateField('height', Math.max(2.0, parseFloat(e.target.value) || 2.0))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-mono text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Ceiling Profile
            </label>
            <select
              value={params.ceilingType}
              onChange={(e) => updateField('ceilingType', e.target.value as CeilingType)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-xs bg-white"
            >
              <option value="flat">Flat Ceiling (Smooth)</option>
              <option value="suspended_grid">Suspended Grid / Acoustic Tile</option>
              <option value="open_beam">Open Beam / Joist</option>
              <option value="sloped">Sloped / Pitched Roof</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Room Hazard Type
            </label>
            <select
              value={params.roomType}
              onChange={(e) => updateField('roomType', e.target.value as RoomType)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-xs bg-white"
            >
              <option value="data_center">Data Center / Server Hall</option>
              <option value="clean_room">Cleanroom / Pharma ISO</option>
              <option value="telecom">Telecommunication Switch</option>
              <option value="warehouse">Warehouse & Logistics</option>
              <option value="archive">Library / Document Archive</option>
              <option value="general_commercial">Commercial Office</option>
              <option value="cold_storage">Cold Storage Facility</option>
              <option value="high_ceiling">High-Ceiling Atrium</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Airflow & Ventilation Dynamics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5">
          <Wind className="w-3.5 h-3.5 text-rose-600" />
          2. Airflow Dynamics (NFPA 72 Sec. 17.7.6)
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-slate-600">
                Air Changes/Hour (ACH)
              </label>
              <span className="text-xs font-mono font-bold text-rose-600">
                {params.airChangesPerHour} ACH
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={params.airChangesPerHour}
              onChange={(e) => updateField('airChangesPerHour', parseInt(e.target.value) || 1)}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block">
              {params.airChangesPerHour > 15
                ? '⚡ High Airflow (Reduced hole spacing required)'
                : 'Standard airflow ventilation'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Air Velocity (m/s)
            </label>
            <input
              type="number"
              min="0.1"
              max="15.0"
              step="0.1"
              value={params.airflowVelocity}
              onChange={(e) =>
                updateField('airflowVelocity', Math.max(0.1, parseFloat(e.target.value) || 0.1))
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-mono text-sm bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Sensitivity Classification
          </label>
          <select
            value={params.sensitivityClass}
            onChange={(e) => updateField('sensitivityClass', e.target.value as SensitivityClass)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-xs bg-white font-medium"
          >
            <option value="Class A (High Sensitivity)">
              Class A: High Sensitivity (Transport ≤ 60s, Data Center / Cleanroom)
            </option>
            <option value="Class B (Enhanced)">
              Class B: Enhanced Sensitivity (Transport ≤ 90s, Archive / Equipment)
            </option>
            <option value="Class C (Standard)">
              Class C: Standard Sensitivity (Transport ≤ 120s, NFPA 72 Baseline)
            </option>
          </select>
        </div>
      </div>

      {/* 3. ASD Detector & Hardware Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5">
          <Cpu className="w-3.5 h-3.5 text-rose-600" />
          3. ASD Detector & Piping Specification
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              ASD Detector Model
            </label>
            <select
              value={params.detectorModel}
              onChange={(e) => {
                const model = e.target.value as DetectorModel;
                let pipes = params.pipeCount;
                if (model.includes('4-Pipe')) pipes = 4;
                else if (model.includes('2-Pipe')) pipes = 2;
                else if (model.includes('Single Pipe')) pipes = 1;
                onChange({
                  ...params,
                  detectorModel: model,
                  pipeCount: pipes,
                });
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-xs bg-white font-medium"
            >
              <option value="VESDA VEP-A00-P (4-Pipe)">VESDA VEP-A00-P (4-Pipe)</option>
              <option value="VESDA VEU-A00 (High-Sensitivity 4-Pipe)">
                VESDA VEU-A00 (Ultra High Sensitivity)
              </option>
              <option value="VESDA VLS (4-Pipe Sector)">VESDA VLS (4-Pipe Sector Scan)</option>
              <option value="VESDA VLC (Single Pipe)">VESDA VLC (Compact Single Pipe)</option>
              <option value="Securiton ASD 535 (2-Pipe)">Securiton ASD 535 (2-Pipe High Power)</option>
              <option value="Wagner TITANUS (2-Pipe)">Wagner TITANUS (2-Pipe High Airflow)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Active Pipe Branches
            </label>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden">
              {[1, 2, 3, 4].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => updateField('pipeCount', cnt)}
                  className={`flex-1 py-1.5 text-xs font-bold transition-colors ${
                    params.pipeCount === cnt
                      ? 'bg-rose-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cnt} Pipe{cnt > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Aspirator Fan Speed
            </label>
            <select
              value={params.aspiratorSpeed}
              onChange={(e) =>
                updateField('aspiratorSpeed', e.target.value as 'low' | 'medium' | 'high')
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-xs bg-white font-medium"
            >
              <option value="high">High Speed (~3.4 m/s airflow)</option>
              <option value="medium">Medium Speed (~2.8 m/s airflow)</option>
              <option value="low">Low Speed (~2.2 m/s airflow)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Pipe Material
            </label>
            <select
              value={params.pipeMaterial}
              onChange={(e) => updateField('pipeMaterial', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-xs bg-white"
            >
              <option value='CPVC Red Fire Alarm 25mm (3/4")'>CPVC Red Fire Alarm 25mm (3/4")</option>
              <option value="ABS Red 25mm">ABS Fire Retardant Red 25mm</option>
              <option value="UPVC Flame Retardant 25mm">UPVC Flame Retardant 25mm</option>
            </select>
          </div>
        </div>

        {/* Detector Mount Location */}
        <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              ASD Panel Wall Mount
            </label>
            <select
              value={params.detectorLocation.wall}
              onChange={(e) =>
                updateField('detectorLocation', {
                  ...params.detectorLocation,
                  wall: e.target.value as WallLocation,
                })
              }
              className="w-full px-2 py-1 rounded border border-slate-300 text-slate-900 text-xs bg-white"
            >
              <option value="west">West Wall</option>
              <option value="north">North Wall</option>
              <option value="east">East Wall</option>
              <option value="south">South Wall</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Pipe Orientation
            </label>
            <select
              value={params.pipeRunOrientation}
              onChange={(e) =>
                updateField('pipeRunOrientation', e.target.value as PipeOrientation)
              }
              className="w-full px-2 py-1 rounded border border-slate-300 text-slate-900 text-xs bg-white"
            >
              <option value="lengthwise">Lengthwise (Parallel to Length)</option>
              <option value="widthwise">Widthwise (Parallel to Width)</option>
            </select>
          </div>
        </div>

        {/* Capillary Drop Checkbox */}
        <div className="pt-1">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={params.capillaryDropEnabled}
              onChange={(e) => updateField('capillaryDropEnabled', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500"
            />
            <div>
              <span className="text-xs font-medium text-slate-800">
                Enable Capillary Drop Tubes (Through False Ceiling)
              </span>
              <p className="text-[11px] text-slate-500">
                Pipes run above ceiling with 10mm capillary tubes dropping down to flush sampling points.
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};
