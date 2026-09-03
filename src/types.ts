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

export interface PipeBranchData {
  pipeIndex: number;
  pipeName: string;
  lengthMeters: number;
  holeCount: number;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  segments: { from: { x: number; y: number }; to: { x: number; y: number } }[];
  holes: HoleScheduleItem[];
}

export interface ComplianceCheck {
  id: string;
  rule: string;
  standardRef: string;
  status: 'pass' | 'warning' | 'fail';
  actualValue: string;
  limitValue: string;
  notes: string;
}

export interface BOMItem {
  itemCode: string;
  category: 'pipe' | 'fittings' | 'hardware' | 'accessories' | 'detector';
  description: string;
  quantity: number;
  unit: string;
  remarks?: string;
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
  action: string;
  details: string;
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
