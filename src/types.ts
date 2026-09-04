import type { TranslationKey } from './i18n/translations';

export type RoomType =
  | 'data_center'
  | 'clean_room'
  | 'telecom'
  | 'warehouse'
  | 'archive'
  | 'general_commercial'
  | 'cold_storage'
  | 'high_ceiling';

export type CeilingType = 'flat' | 'sloped' | 'suspended_grid' | 'open_beam';

export type SensitivityClass =
  | 'Class A (High Sensitivity)'
  | 'Class B (Enhanced)'
  | 'Class C (Standard)';

export type DetectorModel =
  | 'VESDA VEP-A00-P (4-Pipe)'
  | 'VESDA VEU-A00 (High-Sensitivity 4-Pipe)'
  | 'VESDA VLS (4-Pipe Sector)'
  | 'VESDA VLC (Single Pipe)'
  | 'Securiton ASD 535 (2-Pipe)'
  | 'Wagner TITANUS (2-Pipe)';

export type WallLocation = 'north' | 'south' | 'east' | 'west';

export type LayoutTopology = 'linear' | 'u_shape' | 'h_shape';

export type PipeOrientation = 'lengthwise' | 'widthwise';

export interface DetectorLocation {
  wall: WallLocation;
  positionOffsetRatio: number; // 0.0 to 1.0 along the wall
  heightFromFloor: number; // meters
  /**
   * Free placement in room coordinates, set by dragging the unit on the plan.
   * Overrides wall + offset when present; cleared when the unit is dropped
   * close enough to a wall to snap back onto it.
   */
  freePosition?: Point2D | null;
}

/** Per-branch overrides set from the 2D plan. */
export interface BranchSetting {
  /** False leaves the pipe in place but drills no sampling ports on it. */
  portsEnabled?: boolean;
  /** Port spacing for this branch only; 0 or absent follows the global value. */
  holeSpacingM?: number;
}

export interface CalculationParams {
  length: number; // meters
  width: number; // meters
  height: number; // meters
  ceilingType: CeilingType;
  ceilingPitchDegrees: number;
  roomType: RoomType;
  airChangesPerHour: number; // ACH
  airflowVelocity: number; // m/s
  sensitivityClass: SensitivityClass;
  detectorModel: DetectorModel;
  pipeCount: number; // 1, 2, 3, 4
  aspiratorSpeed: 'low' | 'medium' | 'high';
  detectorLocation: DetectorLocation;
  layoutTopology: LayoutTopology;
  pipeRunOrientation: PipeOrientation;
  pipeSpacingMeters: number; // 0 for auto
  holeSpacingMeters: number; // 0 for auto
  pipeMaterial: string;
  capillaryDropEnabled: boolean;
  capillaryTubeLength: number; // meters
  /**
   * Hand-drawn sampling runs, keyed by pipe index. Each polyline covers the
   * part of the branch that carries sampling holes; the manifold back to the
   * detector is still routed automatically. Absent keys fall back to the
   * automatic layout.
   */
  customRoutes?: Record<string, Point2D[]>;
  /** Per-branch port switches and spacing, keyed by pipe index. */
  branchSettings?: Record<string, BranchSetting>;
}

export interface HoleScheduleItem {
  id: string;
  holeNumber: number;
  pipeIndex: number;
  pipeName: string;
  x: number; // Room coordinates (m)
  y: number;
  distanceAlongPipe: number; // meters from detector
  diameterMm: number;
  estimatedFlowRateLpm: number;
  suctionPressurePa: number;
  coverageRadiusM: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface PipeBranchData {
  pipeIndex: number;
  pipeName: string;
  lengthMeters: number;
  holeCount: number;
  startPoint: Point2D;
  endPoint: Point2D;
  /**
   * The complete orthogonal route, detector to end cap, as a polyline. Both the
   * 2D plan and the 3D model draw from this single source so the picture can
   * never disagree with the length the calculator reported.
   */
  routePoints: Point2D[];
  /** Index into routePoints where the sampling run begins (holes start here). */
  runStartIndex: number;
  /** True when the operator drew this branch by hand. */
  isCustomRoute: boolean;
  /** False when ports are switched off for this branch. */
  portsEnabled: boolean;
  /** Spacing actually used for this branch's ports. */
  holeSpacingM: number;
  segments: { from: Point2D; to: Point2D }[];
  holes: HoleScheduleItem[];
}

/**
 * Compliance rows carry translation keys rather than rendered sentences so the
 * calculator stays language-agnostic and the UI (and PDF) can render either
 * language from the same result object.
 */
export interface ComplianceCheck {
  id: string;
  ruleKey: TranslationKey;
  standardRef: string;
  status: 'pass' | 'warning' | 'fail';
  actualValue: string;
  limitValue: string;
  noteKey: TranslationKey;
  noteVars?: Record<string, string | number>;
  /**
   * Concrete fix for a row that is not passing — the number to aim for, not
   * just a statement that the limit was exceeded.
   */
  adviceKey?: TranslationKey;
  adviceVars?: Record<string, string | number>;
}

export type BOMCategory = 'pipe' | 'fittings' | 'hardware' | 'accessories' | 'detector';

export interface BOMItem {
  itemCode: string;
  category: BOMCategory;
  descKey: TranslationKey;
  descVars?: Record<string, string | number>;
  quantity: number;
  unitKey: TranslationKey;
  remarkKey?: TranslationKey;
  remarkVars?: Record<string, string | number>;
}

/**
 * One traceable line of the derivation: the symbolic formula, the same formula
 * with this project's numbers substituted, and the resulting value. Emitted by
 * the calculator itself so the explanation can never drift from the result.
 */
export type CalculationGroup =
  | 'geometry'
  | 'spacing'
  | 'layout'
  | 'hydraulic'
  | 'transport';

export interface CalculationStep {
  id: string;
  group: CalculationGroup;
  titleKey: TranslationKey;
  /** Standard clause, printed verbatim in both languages. */
  reference?: string;
  /** Symbolic form, e.g. "A = P x L". */
  formula: string;
  /** Symbolic form with the actual inputs substituted. */
  substitution: string;
  /** Final value including unit. */
  result: string;
  noteKey?: TranslationKey;
  noteVars?: Record<string, string | number>;
}

export interface CalculationResults {
  roomAreaM2: number;
  roomVolumeM3: number;
  recommendedMaxAreaPerHoleM2: number;
  effectiveHoleSpacingM: number;
  effectivePipeSpacingM: number;
  totalHolesCalculated: number;
  totalPipeLengthM: number;
  maxBranchLengthM: number;
  estimatedTransportTimeSec: number;
  maxAllowedTransportTimeSec: number;
  suctionPressureEndHolePa: number;
  flowBalanceRatioPercent: number; // Target >= 70%
  isCompliant: boolean;
  branches: PipeBranchData[];
  holes: HoleScheduleItem[];
  complianceChecks: ComplianceCheck[];
  billOfMaterials: BOMItem[];
  transportTimeRating: 'Excellent' | 'Good' | 'Marginal' | 'Non-Compliant';
  /** Step-by-step derivation shown in the app and printed in the report. */
  derivation: CalculationStep[];
}

export interface ASDScenario {
  id: string;
  projectId: string;
  name: string;
  revision: string;
  createdAt: number;
  updatedAt: number;
  params: CalculationParams;
}

export type ProjectStatus = 'draft' | 'review' | 'approved' | 'as-built';

export interface ASDProject {
  id: string;
  code: string;
  title: string;
  clientName: string;
  clientContact: string;
  facilityName: string;
  location: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
  activeScenarioId: string;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  /** Human-readable fallback written by the server. */
  action: string;
  details: string;
  /** Optional translation keys, set for activities the app itself generates. */
  actionKey?: TranslationKey;
  detailsKey?: TranslationKey;
  detailsVars?: Record<string, string | number>;
  timestamp: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  status: 'online' | 'active' | 'idle';
  currentRoom?: string;
}

export interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  timestamp: number;
  read?: boolean;
}
