import type {
  BOMCategory,
  CeilingType,
  DetectorModel,
  LayoutTopology,
  PipeOrientation,
  ProjectStatus,
  RoomType,
  SensitivityClass,
  WallLocation,
} from '../types';
import type { TranslationKey } from './translations';

/**
 * Maps the domain enums stored in a scenario onto translation keys, so a saved
 * project renders correctly in whichever language the reader has selected.
 */

export const ceilingKey: Record<CeilingType, TranslationKey> = {
  flat: 'opt.ceiling.flat',
  suspended_grid: 'opt.ceiling.suspended_grid',
  open_beam: 'opt.ceiling.open_beam',
  sloped: 'opt.ceiling.sloped',
};

export const roomTypeKey: Record<RoomType, TranslationKey> = {
  data_center: 'opt.room.data_center',
  clean_room: 'opt.room.clean_room',
  telecom: 'opt.room.telecom',
  warehouse: 'opt.room.warehouse',
  archive: 'opt.room.archive',
  general_commercial: 'opt.room.general_commercial',
  cold_storage: 'opt.room.cold_storage',
  high_ceiling: 'opt.room.high_ceiling',
};

export const sensitivityKey: Record<SensitivityClass, TranslationKey> = {
  'Class A (High Sensitivity)': 'opt.class.a',
  'Class B (Enhanced)': 'opt.class.b',
  'Class C (Standard)': 'opt.class.c',
};

export const detectorKey: Record<DetectorModel, TranslationKey> = {
  'VESDA VEP-A00-P (4-Pipe)': 'opt.detector.vep',
  'VESDA VEU-A00 (High-Sensitivity 4-Pipe)': 'opt.detector.veu',
  'VESDA VLS (4-Pipe Sector)': 'opt.detector.vls',
  'VESDA VLC (Single Pipe)': 'opt.detector.vlc',
  'Securiton ASD 535 (2-Pipe)': 'opt.detector.asd535',
  'Wagner TITANUS (2-Pipe)': 'opt.detector.titanus',
};

export const speedKey: Record<'low' | 'medium' | 'high', TranslationKey> = {
  high: 'opt.speed.high',
  medium: 'opt.speed.medium',
  low: 'opt.speed.low',
};

export const CPVC_MATERIAL = 'CPVC Red Fire Alarm 25mm (3/4")';
export const ABS_MATERIAL = 'ABS Red 25mm';
export const UPVC_MATERIAL = 'UPVC Flame Retardant 25mm';

const materialKeys: Record<string, TranslationKey> = {
  [CPVC_MATERIAL]: 'opt.material.cpvc',
  [ABS_MATERIAL]: 'opt.material.abs',
  [UPVC_MATERIAL]: 'opt.material.upvc',
};

/** Pipe material is a free-form string in saved scenarios, so fall back to it. */
export function materialKey(material: string): TranslationKey | null {
  return materialKeys[material] ?? null;
}

export const wallKey: Record<WallLocation, TranslationKey> = {
  north: 'opt.wall.north',
  south: 'opt.wall.south',
  east: 'opt.wall.east',
  west: 'opt.wall.west',
};

export const orientationKey: Record<PipeOrientation, TranslationKey> = {
  lengthwise: 'opt.orientation.lengthwise',
  widthwise: 'opt.orientation.widthwise',
};

export const statusKey: Record<ProjectStatus, TranslationKey> = {
  draft: 'opt.status.draft',
  review: 'opt.status.review',
  approved: 'opt.status.approved',
  'as-built': 'opt.status.as-built',
};

export const ratingKey: Record<string, TranslationKey> = {
  Excellent: 'opt.rating.Excellent',
  Good: 'opt.rating.Good',
  Marginal: 'opt.rating.Marginal',
  'Non-Compliant': 'opt.rating.Non-Compliant',
};

export const bomCategoryKey: Record<BOMCategory, TranslationKey> = {
  detector: 'boq.cat.detector',
  pipe: 'boq.cat.pipe',
  fittings: 'boq.cat.fittings',
  hardware: 'boq.cat.hardware',
  accessories: 'boq.cat.accessories',
};

export const topologyLabel: Record<LayoutTopology, string> = {
  linear: 'Linear',
  u_shape: 'U-Shape',
  h_shape: 'H-Shape',
};
