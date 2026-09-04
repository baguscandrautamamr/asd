import { detectorPosition } from './detectorPosition';
import {
  CalculationParams,
  CalculationResults,
  CalculationStep,
  HoleScheduleItem,
  PipeBranchData,
  ComplianceCheck,
  BOMItem,
} from '../types';

type Pt = { x: number; y: number };

const EPS = 1e-6;

/** Total length of a polyline in metres. */
function polylineLength(points: Pt[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return total;
}

/** Point sitting `distance` metres along a polyline. */
function pointAlong(points: Pt[], distance: number): Pt {
  if (points.length === 0) return { x: 0, y: 0 };
  let remaining = Math.max(0, distance);
  for (let i = 0; i < points.length - 1; i++) {
    const segment = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (remaining <= segment || i === points.length - 2) {
      const ratio = segment < EPS ? 0 : Math.min(1, remaining / segment);
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      };
    }
    remaining -= segment;
  }
  return points[points.length - 1];
}

/**
 * Orthogonal manifold from the detector to where a branch begins.
 *
 * Sampling pipe is installed along the ceiling grid with 90 degree sweep
 * elbows, never diagonally across a room, so the header first runs along the
 * wall the detector is mounted on and then turns into the room. This also makes
 * the drawn route agree with the Manhattan length the schedule reports.
 */
function manifoldRoute(detector: Pt, wall: string, start: Pt): Pt[] {
  const onVerticalWall = wall === 'west' || wall === 'east';
  const corner: Pt = onVerticalWall
    ? { x: detector.x, y: start.y }
    : { x: start.x, y: detector.y };

  const points: Pt[] = [detector];
  const push = (p: Pt) => {
    const last = points[points.length - 1];
    if (Math.abs(p.x - last.x) > EPS || Math.abs(p.y - last.y) > EPS) points.push(p);
  };
  push(corner);
  push(start);
  return points;
}

/**
 * Calculates NFPA 72 compliant ASD pipe network parameters, sampling hole schedule,
 * hydraulic flow estimation, and BoQ materials.
 */
export function calculateASD(params: CalculationParams): CalculationResults {
  // Every intermediate value is recorded as it is produced, so the explanation
  // shown to the client is generated from the same numbers as the result.
  const derivation: CalculationStep[] = [];
  const step = (item: CalculationStep) => derivation.push(item);
  const num = (value: number, digits = 2) =>
    Number.isFinite(value) ? String(Math.round(value * 10 ** digits) / 10 ** digits) : '-';

  const roomAreaM2 = params.length * params.width;
  const roomVolumeM3 = roomAreaM2 * params.height;

  step({
    id: 'calc-area',
    group: 'geometry',
    titleKey: 'calc.area.title',
    formula: 'A = L \u00d7 W',
    substitution: `A = ${num(params.length, 1)} \u00d7 ${num(params.width, 1)}`,
    result: `${num(roomAreaM2, 1)} m\u00b2`,
    noteKey: 'calc.area.note',
  });

  step({
    id: 'calc-volume',
    group: 'geometry',
    titleKey: 'calc.volume.title',
    formula: 'V = A \u00d7 H',
    substitution: `V = ${num(roomAreaM2, 1)} \u00d7 ${num(params.height, 1)}`,
    result: `${num(roomVolumeM3, 1)} m\u00b3`,
    noteKey: 'calc.volume.note',
  });

  // 1. Determine NFPA 72 baseline spacing based on Air Changes Per Hour (ACH) & Room Type
  let baseMaxAreaPerHole = 81.0; // standard NFPA 72 30ft x 30ft (~9m x 9m)
  if (params.airChangesPerHour > 60 || params.roomType === 'clean_room') {
    baseMaxAreaPerHole = 15.0;
  } else if (params.airChangesPerHour > 30 || params.roomType === 'data_center') {
    baseMaxAreaPerHole = 20.0;
  } else if (params.airChangesPerHour > 15 || params.roomType === 'telecom') {
    baseMaxAreaPerHole = 32.0;
  } else if (params.airChangesPerHour > 6) {
    baseMaxAreaPerHole = 50.0;
  }

  step({
    id: 'calc-base-area',
    group: 'spacing',
    titleKey: 'calc.baseArea.title',
    reference: 'NFPA 72 Sec. 17.7.3.2.3 & 17.7.6',
    formula: 'A_base = f(ACH, room type)',
    substitution: `f(${params.airChangesPerHour} ACH, ${params.roomType})`,
    result: `${num(baseMaxAreaPerHole, 1)} m\u00b2/port`,
    noteKey: 'calc.baseArea.note',
    noteVars: { ach: params.airChangesPerHour, base: num(baseMaxAreaPerHole, 1) },
  });

  // 2. Ceiling height reduction factor (NFPA 72 Table 17.7.3.2.3.1)
  let heightDerating = 1.0;
  if (params.height > 8.5) heightDerating = 0.38;
  else if (params.height > 8.0) heightDerating = 0.40;
  else if (params.height > 7.3) heightDerating = 0.46;
  else if (params.height > 6.7) heightDerating = 0.52;
  else if (params.height > 6.1) heightDerating = 0.58;
  else if (params.height > 5.5) heightDerating = 0.64;
  else if (params.height > 4.9) heightDerating = 0.71;
  else if (params.height > 4.3) heightDerating = 0.77;
  else if (params.height > 3.7) heightDerating = 0.84;
  else if (params.height > 3.0) heightDerating = 0.91;

  const recommendedMaxAreaPerHoleM2 = Math.round(baseMaxAreaPerHole * heightDerating * 10) / 10;
  const maxLinearSpacingM = Math.round(Math.sqrt(recommendedMaxAreaPerHoleM2) * 10) / 10;

  step({
    id: 'calc-derating',
    group: 'spacing',
    titleKey: 'calc.derating.title',
    reference: 'NFPA 72 Table 17.7.3.2.3.1',
    formula: 'k_h = f(H)',
    substitution: `k_h = f(${num(params.height, 1)} m)`,
    result: num(heightDerating, 2),
    noteKey: 'calc.derating.note',
    noteVars: { h: num(params.height, 1), k: num(heightDerating, 2) },
  });

  step({
    id: 'calc-max-area',
    group: 'spacing',
    titleKey: 'calc.maxArea.title',
    reference: 'NFPA 72 Sec. 17.7.3.6.3',
    formula: 'A_max = A_base \u00d7 k_h',
    substitution: `A_max = ${num(baseMaxAreaPerHole, 1)} \u00d7 ${num(heightDerating, 2)}`,
    result: `${num(recommendedMaxAreaPerHoleM2, 1)} m\u00b2/port`,
    noteKey: 'calc.maxArea.note',
  });

  step({
    id: 'calc-max-spacing',
    group: 'spacing',
    titleKey: 'calc.maxSpacing.title',
    formula: 'S_max = \u221aA_max',
    substitution: `S_max = \u221a${num(recommendedMaxAreaPerHoleM2, 1)}`,
    result: `${num(maxLinearSpacingM, 1)} m`,
    noteKey: 'calc.maxSpacing.note',
  });

  // 3. Pipe layout configuration
  const pipeCount = Math.max(1, Math.min(4, params.pipeCount || 2));
  const isLengthwise = params.pipeRunOrientation === 'lengthwise';

  const runLength = isLengthwise ? params.length : params.width;
  const crossWidth = isLengthwise ? params.width : params.length;

  // Pipe branch spacing across crossWidth
  const effectivePipeSpacingM =
    params.pipeSpacingMeters > 0
      ? params.pipeSpacingMeters
      : Math.round((crossWidth / pipeCount) * 10) / 10;

  // Hole spacing along runLength
  const effectiveHoleSpacingM =
    params.holeSpacingMeters > 0
      ? params.holeSpacingMeters
      : Math.min(maxLinearSpacingM, Math.max(2.5, Math.round((runLength / Math.ceil(runLength / maxLinearSpacingM)) * 10) / 10));

  step({
    id: 'calc-pipe-spacing',
    group: 'layout',
    titleKey: 'calc.pipeSpacing.title',
    formula:
      params.pipeSpacingMeters > 0 ? 'S_pipe = input' : 'S_pipe = W_cross / n_pipe',
    substitution:
      params.pipeSpacingMeters > 0
        ? `S_pipe = ${num(params.pipeSpacingMeters, 1)}`
        : `S_pipe = ${num(crossWidth, 1)} / ${pipeCount}`,
    result: `${num(effectivePipeSpacingM, 1)} m`,
    noteKey:
      params.pipeSpacingMeters > 0 ? 'calc.pipeSpacing.manual' : 'calc.pipeSpacing.auto',
  });

  step({
    id: 'calc-hole-spacing',
    group: 'layout',
    titleKey: 'calc.holeSpacing.title',
    formula: params.holeSpacingMeters > 0 ? 'S_hole = input' : 'S_hole = min(S_max, L_run / n)',
    substitution:
      params.holeSpacingMeters > 0
        ? `S_hole = ${num(params.holeSpacingMeters, 1)}`
        : `S_hole = min(${num(maxLinearSpacingM, 1)}, ${num(runLength, 1)} / n)`,
    result: `${num(effectiveHoleSpacingM, 1)} m`,
    noteKey:
      params.holeSpacingMeters > 0 ? 'calc.holeSpacing.manual' : 'calc.holeSpacing.auto',
    noteVars: { max: num(maxLinearSpacingM, 1) },
  });

  // 4. Detector coordinates come from the shared placement helper, so the
  // plan, the model and this schedule can never disagree about where the unit
  // is — including when it has been dragged off its wall.
  const detector = detectorPosition(params);
  const detX = detector.x;
  const detY = detector.y;

  // 5. Generate Pipe Branches and Sampling Hole Positions
  const branches: PipeBranchData[] = [];
  const allHoles: HoleScheduleItem[] = [];
  let globalHoleNum = 1;
  let totalPipeLengthM = 0;
  let maxBranchLengthM = 0;

  // Coverage radius per NFPA 72: R = Spacing / sqrt(2)
  const coverageRadiusM = Math.round((effectiveHoleSpacingM / Math.SQRT2) * 100) / 100;

  step({
    id: 'calc-coverage',
    group: 'layout',
    titleKey: 'calc.coverage.title',
    reference: 'NFPA 72 Sec. 17.7.3.6.3',
    formula: 'R = S_hole / \u221a2',
    substitution: `R = ${num(effectiveHoleSpacingM, 1)} / 1.414`,
    result: `${num(coverageRadiusM, 2)} m`,
    noteKey: 'calc.coverage.note',
  });

  for (let pIdx = 0; pIdx < pipeCount; pIdx++) {
    const pipeName = `Pipe ${String.fromCharCode(65 + pIdx)}`; // Pipe A, Pipe B, Pipe C, Pipe D

    // Determine branch lateral position
    let branchLateralPos: number;
    if (pipeCount === 1) {
      branchLateralPos = crossWidth / 2;
    } else {
      // Offset from wall is half of inter-pipe spacing per NFPA 72 wall proximity rule
      const margin = crossWidth / (pipeCount * 2);
      branchLateralPos = margin + pIdx * (crossWidth / pipeCount);
    }

    const wallOffset = Math.min(1.5, Math.max(0.6, effectiveHoleSpacingM / 2));

    // A hand-drawn run replaces the automatic one; the manifold back to the
    // detector is still routed for the operator.
    const setting = params.branchSettings?.[String(pIdx)];
    const portsEnabled = setting?.portsEnabled !== false;
    const branchHoleSpacingM =
      setting?.holeSpacingM && setting.holeSpacingM > 0
        ? setting.holeSpacingM
        : effectiveHoleSpacingM;

    const drawn = params.customRoutes?.[String(pIdx)];
    const isCustomRoute = Array.isArray(drawn) && drawn.length >= 2;

    let runPoints: Pt[];
    if (isCustomRoute) {
      runPoints = drawn.map((point) => ({
        x: Math.min(params.length, Math.max(0, point.x)),
        y: Math.min(params.width, Math.max(0, point.y)),
      }));
    } else if (isLengthwise) {
      runPoints = [
        { x: wallOffset, y: branchLateralPos },
        { x: params.length - wallOffset, y: branchLateralPos },
      ];
    } else {
      runPoints = [
        { x: branchLateralPos, y: wallOffset },
        { x: branchLateralPos, y: params.width - wallOffset },
      ];
    }

    const startPoint = runPoints[0];
    const endPoint = runPoints[runPoints.length - 1];

    const manifoldPoints = manifoldRoute(
      { x: detX, y: detY },
      params.detectorLocation?.wall || 'west',
      startPoint
    );

    // The full route is the manifold followed by the sampling run; the shared
    // vertex is not repeated.
    const routePoints: Pt[] = [...manifoldPoints, ...runPoints.slice(1)];
    const runStartIndex = manifoldPoints.length - 1;

    const branchLinearRunM = polylineLength(runPoints);
    const headerManifoldM = Math.round(polylineLength(manifoldPoints) * 10) / 10;
    const branchTotalM = Math.round((headerManifoldM + branchLinearRunM) * 10) / 10;

    totalPipeLengthM += branchTotalM;
    if (branchTotalM > maxBranchLengthM) {
      maxBranchLengthM = branchTotalM;
    }

    // Calculate holes for this pipe branch
    const holesOnBranch: HoleScheduleItem[] = [];
    const holeStep = branchHoleSpacingM;
    // A branch with ports switched off still carries pipe, just no holes.
    const holeCount = portsEnabled ? Math.max(2, Math.floor(branchLinearRunM / holeStep) + 1) : 0;
    const branchCoverageRadiusM = Math.round((branchHoleSpacingM / Math.SQRT2) * 100) / 100;

    for (let hIdx = 0; hIdx < holeCount; hIdx++) {
      const frac = holeCount > 1 ? hIdx / (holeCount - 1) : 0.5;
      // Holes ride the drawn run, so they follow every corner the operator made.
      const position = pointAlong(runPoints, frac * branchLinearRunM);
      const hx = position.x;
      const hy = position.y;

      const distanceAlongPipe = Math.round((headerManifoldM + frac * branchLinearRunM) * 10) / 10;

      // NFPA / VESDA Stepped Orifice Design for balanced flow:
      // Holes closer to detector have smaller diameter (e.g. 2.0mm - 2.5mm)
      // Holes at the far end have larger diameter (e.g. 3.2mm - 4.2mm)
      let diameterMm = 2.5;
      if (hIdx === holeCount - 1) {
        diameterMm = 3.8; // End hole / cap orifice
      } else if (hIdx >= holeCount - 3) {
        diameterMm = 3.2;
      } else if (hIdx >= Math.floor(holeCount / 2)) {
        diameterMm = 2.8;
      } else {
        diameterMm = 2.4;
      }

      // Suction pressure calculation based on aspirator speed and distance
      const baseAspiratorPressure =
        params.aspiratorSpeed === 'high' ? 420 : params.aspiratorSpeed === 'medium' ? 300 : 200; // Pa
      const frictionLossPerM = 3.8; // Pa per meter of 25mm pipe
      const pressureAtHole = Math.max(
        22,
        Math.round(baseAspiratorPressure - distanceAlongPipe * frictionLossPerM)
      );

      // Hole flow rate: Q = C_d * A * sqrt(2 * Delta_P / rho)
      const holeAreaM2 = Math.PI * Math.pow((diameterMm / 1000) / 2, 2);
      const airDensity = 1.2; // kg/m³
      const cd = 0.62; // discharge coefficient for drilled orifice
      const velocity = Math.sqrt((2 * pressureAtHole) / airDensity);
      const flowRateM3s = cd * holeAreaM2 * velocity;
      const flowRateLpm = Math.round(flowRateM3s * 60 * 1000 * 10) / 10;

      const holeItem: HoleScheduleItem = {
        id: `h-${pIdx + 1}-${hIdx + 1}`,
        holeNumber: globalHoleNum++,
        pipeIndex: pIdx,
        pipeName,
        x: Math.round(hx * 100) / 100,
        y: Math.round(hy * 100) / 100,
        distanceAlongPipe,
        diameterMm,
        estimatedFlowRateLpm: flowRateLpm,
        suctionPressurePa: pressureAtHole,
        coverageRadiusM: branchCoverageRadiusM,
      };

      holesOnBranch.push(holeItem);
      allHoles.push(holeItem);
    }

    const segments = routePoints.slice(0, -1).map((from, index) => ({
      from,
      to: routePoints[index + 1],
    }));

    branches.push({
      pipeIndex: pIdx,
      pipeName,
      lengthMeters: branchTotalM,
      holeCount: holesOnBranch.length,
      startPoint,
      endPoint,
      routePoints,
      runStartIndex,
      isCustomRoute,
      portsEnabled,
      holeSpacingM: branchHoleSpacingM,
      segments,
      holes: holesOnBranch,
    });
  }

  const holesPerBranch = branches[0]?.holeCount ?? 0;
  const branchRunM = branches[0]
    ? Math.round(polylineLength(branches[0].routePoints.slice(branches[0].runStartIndex)) * 10) / 10
    : 0;

  step({
    id: 'calc-holes-branch',
    group: 'layout',
    titleKey: 'calc.holesPerBranch.title',
    formula: 'n_hole = floor(L_run / S_hole) + 1',
    substitution: `n_hole = floor(${num(branchRunM, 1)} / ${num(effectiveHoleSpacingM, 1)}) + 1`,
    result: `${holesPerBranch} port/branch`,
    noteKey: 'calc.holesPerBranch.note',
  });

  step({
    id: 'calc-total-holes',
    group: 'layout',
    titleKey: 'calc.totalHoles.title',
    formula: 'N = n_hole \u00d7 n_pipe',
    substitution: `N = ${holesPerBranch} \u00d7 ${pipeCount}`,
    result: `${allHoles.length} port`,
    noteKey: 'calc.totalHoles.note',
    noteVars: {
      actual: num(roomAreaM2 / Math.max(1, allHoles.length), 1),
      max: num(recommendedMaxAreaPerHoleM2, 1),
    },
  });

  step({
    id: 'calc-total-pipe',
    group: 'layout',
    titleKey: 'calc.totalPipe.title',
    formula: 'L_total = \u03a3 (L_manifold + L_run)',
    substitution: `L_total = ${pipeCount} \u00d7 (manifold + ${num(branchRunM, 1)})`,
    result: `${num(totalPipeLengthM, 1)} m`,
    noteKey: 'calc.totalPipe.note',
    noteVars: { longest: num(maxBranchLengthM, 1) },
  });

  step({
    id: 'calc-orifice',
    group: 'hydraulic',
    titleKey: 'calc.orifice.title',
    reference: 'VESDA / Securiton hydraulic balancing practice',
    formula: '\u00f8 = f(position along branch)',
    substitution: '2.4 mm \u2192 2.8 mm \u2192 3.2 mm \u2192 3.8 mm',
    result: '2.4 - 3.8 mm',
    noteKey: 'calc.orifice.note',
  });

  // 6. Transport Time Estimation
  // Air speed inside 25mm pipe is ~3.2 m/s (high speed), ~2.6 m/s (medium), ~2.0 m/s (low)
  const airSpeed =
    params.aspiratorSpeed === 'high' ? 3.4 : params.aspiratorSpeed === 'medium' ? 2.8 : 2.2;
  const transportTimeBase = maxBranchLengthM / airSpeed;
  const entryDelaySec = params.capillaryDropEnabled ? 4.5 : 2.5; // Capillary tube adds ~2-4s
  const estimatedTransportTimeSec = Math.round((transportTimeBase + entryDelaySec) * 10) / 10;

  // NFPA 72 Maximum Allowed Transport Time
  // Class A / High Sensitivity / High ACH = 60 seconds
  // Class B = 90 seconds
  // Standard NFPA 72 = 120 seconds
  let maxAllowedTransportTimeSec = 120;
  if (params.sensitivityClass === 'Class A (High Sensitivity)' || params.airChangesPerHour > 20) {
    maxAllowedTransportTimeSec = 60;
  } else if (params.sensitivityClass === 'Class B (Enhanced)') {
    maxAllowedTransportTimeSec = 90;
  }

  // 7. Hydraulic Flow Balance Ratio
  // Ports can be switched off branch by branch, so the design may legitimately
  // contain no holes at all; every statistic below has to survive that.
  const flows = allHoles.map((h) => h.estimatedFlowRateLpm);
  const minFlow = flows.length > 0 ? Math.min(...flows) : 0;
  const maxFlow = flows.length > 0 ? Math.max(...flows) : 0;
  const flowBalanceRatioPercent =
    maxFlow > 0 ? Math.round((minFlow / maxFlow) * 1000) / 10 : 100;

  // Pressure at furthest end hole
  const basePressurePa =
    params.aspiratorSpeed === 'high' ? 420 : params.aspiratorSpeed === 'medium' ? 300 : 200;
  const furthestHole =
    allHoles.length > 0
      ? allHoles.reduce((prev, curr) =>
          curr.distanceAlongPipe > prev.distanceAlongPipe ? curr : prev
        )
      : null;
  const suctionPressureEndHolePa = furthestHole ? furthestHole.suctionPressurePa : basePressurePa;
  step({
    id: 'calc-pressure',
    group: 'hydraulic',
    titleKey: 'calc.pressure.title',
    formula: 'P_d = P_0 - (d \u00d7 f)',
    substitution: `P_d = ${
      params.aspiratorSpeed === 'high' ? 420 : params.aspiratorSpeed === 'medium' ? 300 : 200
    } - (${num(maxBranchLengthM, 1)} \u00d7 3.8)`,
    result: `${suctionPressureEndHolePa} Pa`,
    noteKey: 'calc.pressure.note',
    noteVars: { speed: params.aspiratorSpeed },
  });

  step({
    id: 'calc-flow',
    group: 'hydraulic',
    titleKey: 'calc.flow.title',
    formula: 'Q = Cd \u00d7 A \u00d7 \u221a(2\u0394P / \u03c1)',
    substitution: `Q = 0.62 \u00d7 A \u00d7 \u221a(2 \u00d7 \u0394P / 1.2)`,
    result: `${num(minFlow, 1)} - ${num(maxFlow, 1)} L/min`,
    noteKey: 'calc.flow.note',
  });

  step({
    id: 'calc-balance',
    group: 'hydraulic',
    titleKey: 'calc.balance.title',
    formula: 'B = Q_min / Q_max \u00d7 100%',
    substitution: `B = ${num(minFlow, 1)} / ${num(maxFlow, 1)} \u00d7 100%`,
    result: `${num(flowBalanceRatioPercent, 1)}%`,
    noteKey: 'calc.balance.note',
  });

  step({
    id: 'calc-transport',
    group: 'transport',
    titleKey: 'calc.transport.title',
    reference: 'NFPA 72 Sec. 17.7.3.6.2',
    formula: 't = L_max / v + t_entry',
    substitution: `t = ${num(maxBranchLengthM, 1)} / ${num(airSpeed, 1)} + ${num(entryDelaySec, 1)}`,
    result: `${num(estimatedTransportTimeSec, 1)} s`,
    noteKey: 'calc.transport.note',
    noteVars: { v: num(airSpeed, 1), delay: num(entryDelaySec, 1) },
  });

  step({
    id: 'calc-max-transport',
    group: 'transport',
    titleKey: 'calc.maxTransport.title',
    reference: 'NFPA 72 Sec. 17.7.3.6.2',
    formula: 't_max = f(sensitivity class, ACH)',
    substitution: `f(${params.sensitivityClass}, ${params.airChangesPerHour} ACH)`,
    result: `${maxAllowedTransportTimeSec} s`,
    noteKey: 'calc.maxTransport.note',
    noteVars: { limit: maxAllowedTransportTimeSec },
  });

  // Transport Time Rating
  let transportTimeRating: 'Excellent' | 'Good' | 'Marginal' | 'Non-Compliant' = 'Good';
  if (estimatedTransportTimeSec <= maxAllowedTransportTimeSec * 0.7) {
    transportTimeRating = 'Excellent';
  } else if (estimatedTransportTimeSec <= maxAllowedTransportTimeSec * 0.9) {
    transportTimeRating = 'Good';
  } else if (estimatedTransportTimeSec <= maxAllowedTransportTimeSec) {
    transportTimeRating = 'Marginal';
  } else {
    transportTimeRating = 'Non-Compliant';
  }

  const areaPerPortM2 = allHoles.length > 0 ? roomAreaM2 / allHoles.length : 0;

  // ---- Concrete targets quoted by the advice on a failing row ----------------
  // Coverage: the spacing and port count that would bring the design inside the
  // allowable area per port.
  const advisedHoleSpacingM = Math.max(
    1,
    Math.floor(Math.sqrt(recommendedMaxAreaPerHoleM2) * 10) / 10
  );
  const advisedPortCount = Math.ceil(roomAreaM2 / Math.max(0.1, recommendedMaxAreaPerHoleM2));

  // Balance: flow scales with orifice area, so the weakest port needs its
  // diameter opened by sqrt(target / actual) to reach the 70% rule.
  const balanceTarget = 0.7;
  const weakestHole =
    allHoles.length > 0
      ? allHoles.reduce((prev, curr) =>
          curr.estimatedFlowRateLpm < prev.estimatedFlowRateLpm ? curr : prev
        )
      : null;
  const advisedMinOrificeMm =
    weakestHole && maxFlow > 0
      ? Math.round(
          weakestHole.diameterMm * Math.sqrt((balanceTarget * maxFlow) / weakestHole.estimatedFlowRateLpm) * 10
        ) / 10
      : 0;

  // Transport: the longest run the current air speed can still clear in time.
  const advisedMaxRunM =
    Math.round(Math.max(0, (maxAllowedTransportTimeSec - entryDelaySec) * airSpeed) * 10) / 10;

  // End pressure: how far the aspirator can push before dropping below 25 Pa.
  const advisedPressureRunM = Math.round(((basePressurePa - 25) / 3.8) * 10) / 10;

  // 8. NFPA 72 Compliance Checks.
  // Rows carry translation keys instead of prose so the same result object can
  // be rendered in Bahasa Indonesia or English without recalculating.
  const complianceChecks: ComplianceCheck[] = [
    {
      id: 'chk-transport',
      ruleKey: 'chk.transport.rule',
      standardRef: 'NFPA 72 Sec. 17.7.3.6.2',
      status: estimatedTransportTimeSec <= maxAllowedTransportTimeSec ? 'pass' : 'fail',
      actualValue: `${estimatedTransportTimeSec} s`,
      limitValue: `\u2264 ${maxAllowedTransportTimeSec} s`,
      noteKey:
        estimatedTransportTimeSec <= maxAllowedTransportTimeSec
          ? 'chk.transport.pass'
          : 'chk.transport.fail',
      adviceKey:
        estimatedTransportTimeSec <= maxAllowedTransportTimeSec ? undefined : 'chk.transport.advice',
      adviceVars: {
        run: advisedMaxRunM,
        current: maxBranchLengthM.toFixed(1),
        pipes: Math.min(4, pipeCount + 1),
      },
    },
    {
      id: 'chk-coverage',
      ruleKey: 'chk.coverage.rule',
      standardRef: 'NFPA 72 Sec. 17.7.3.6.3 & 17.7.6.3',
      status: areaPerPortM2 <= recommendedMaxAreaPerHoleM2 * 1.15 ? 'pass' : 'warning',
      actualValue: `${areaPerPortM2.toFixed(1)} m\u00b2`,
      limitValue: `\u2264 ${recommendedMaxAreaPerHoleM2} m\u00b2`,
      noteKey: 'chk.coverage.note',
      noteVars: { ach: params.airChangesPerHour, h: params.height },
      adviceKey:
        areaPerPortM2 <= recommendedMaxAreaPerHoleM2 * 1.15 ? undefined : 'chk.coverage.advice',
      adviceVars: {
        spacing: advisedHoleSpacingM,
        ports: advisedPortCount,
        current: allHoles.length,
      },
    },
    {
      id: 'chk-pipe-length',
      ruleKey: 'chk.pipeLength.rule',
      standardRef: 'NFPA 72 & Manufacturer Limit',
      status: maxBranchLengthM <= 100 ? 'pass' : 'warning',
      actualValue: `${maxBranchLengthM.toFixed(1)} m`,
      limitValue: '\u2264 100.0 m',
      noteKey: maxBranchLengthM <= 100 ? 'chk.pipeLength.pass' : 'chk.pipeLength.warn',
      adviceKey: maxBranchLengthM <= 100 ? undefined : 'chk.pipeLength.advice',
      adviceVars: {
        pipes: Math.min(4, pipeCount + 1),
        run: Math.round((maxBranchLengthM / Math.min(4, pipeCount + 1)) * 10) / 10,
      },
    },
    {
      id: 'chk-flow-balance',
      ruleKey: 'chk.balance.rule',
      standardRef: 'NFPA 72 Hydraulic Balance (VESDA/Securiton)',
      status: flowBalanceRatioPercent >= 70 ? 'pass' : 'warning',
      actualValue: `${flowBalanceRatioPercent}%`,
      limitValue: '\u2265 70%',
      noteKey: flowBalanceRatioPercent >= 70 ? 'chk.balance.pass' : 'chk.balance.warn',
      adviceKey: flowBalanceRatioPercent >= 70 ? undefined : 'chk.balance.advice',
      adviceVars: {
        from: weakestHole ? weakestHole.diameterMm.toFixed(1) : '-',
        to: advisedMinOrificeMm.toFixed(1),
        hole: weakestHole ? weakestHole.holeNumber : '-',
      },
    },
    {
      id: 'chk-end-pressure',
      ruleKey: 'chk.pressure.rule',
      standardRef: 'NFPA 72 Sec. 17.7.3.6.5',
      status: suctionPressureEndHolePa >= 25 ? 'pass' : 'warning',
      actualValue: `${suctionPressureEndHolePa} Pa`,
      limitValue: '\u2265 25 Pa',
      noteKey: suctionPressureEndHolePa >= 25 ? 'chk.pressure.pass' : 'chk.pressure.warn',
      adviceKey: suctionPressureEndHolePa >= 25 ? undefined : 'chk.pressure.advice',
      adviceVars: {
        run: advisedPressureRunM,
        current: maxBranchLengthM.toFixed(1),
      },
    },
  ];

  const isCompliant = complianceChecks.every(
    (c) => c.status === 'pass' || c.status === 'warning'
  );

  // 9. Bill of Materials (BoQ) Calculation
  const pipeSticks = Math.ceil((totalPipeLengthM * 1.1) / 3); // 3m CPVC stick with 10% wastage
  const elbows90 = pipeCount * 2 + 2;
  const tees = pipeCount > 1 ? pipeCount - 1 : 0;
  const endCaps = pipeCount;
  const pipeClips = Math.ceil(totalPipeLengthM / 1.5); // 1 clip every 1.5m
  const couplings = Math.max(0, pipeSticks - pipeCount);

  const billOfMaterials: BOMItem[] = [
    {
      itemCode: 'ASD-UNIT-01',
      category: 'detector',
      descKey: 'bom.asdUnit.desc',
      descVars: { model: params.detectorModel },
      quantity: 1,
      unitKey: 'unit.unit',
      remarkKey: 'bom.asdUnit.remark',
      remarkVars: { n: pipeCount, class: params.sensitivityClass },
    },
    {
      itemCode: 'PIP-CPVC-25',
      category: 'pipe',
      descKey: 'bom.pipe.desc',
      descVars: { material: params.pipeMaterial },
      quantity: pipeSticks,
      unitKey: 'unit.stick',
      remarkKey: 'bom.pipe.remark',
      remarkVars: { len: totalPipeLengthM.toFixed(1) },
    },
    {
      itemCode: 'FIT-ELB-90',
      category: 'fittings',
      descKey: 'bom.elbow.desc',
      quantity: elbows90,
      unitKey: 'unit.pcs',
      remarkKey: 'bom.elbow.remark',
    },
    {
      itemCode: 'FIT-TEE-25',
      category: 'fittings',
      descKey: 'bom.tee.desc',
      quantity: tees,
      unitKey: 'unit.pcs',
      remarkKey: 'bom.tee.remark',
    },
    {
      itemCode: 'FIT-CAP-25',
      category: 'fittings',
      descKey: 'bom.cap.desc',
      quantity: endCaps,
      unitKey: 'unit.pcs',
      remarkKey: 'bom.cap.remark',
    },
    {
      itemCode: 'FIT-CPL-25',
      category: 'fittings',
      descKey: 'bom.coupling.desc',
      quantity: couplings,
      unitKey: 'unit.pcs',
      remarkKey: 'bom.coupling.remark',
    },
    {
      itemCode: 'HRD-CLP-25',
      category: 'hardware',
      descKey: 'bom.clip.desc',
      quantity: pipeClips,
      unitKey: 'unit.pcs',
      remarkKey: 'bom.clip.remark',
    },
    {
      itemCode: 'LBL-SAM-01',
      category: 'accessories',
      descKey: 'bom.label.desc',
      quantity: allHoles.length,
      unitKey: 'unit.pcs',
      remarkKey: 'bom.label.remark',
    },
  ];

  if (params.capillaryDropEnabled) {
    billOfMaterials.push({
      itemCode: 'CAP-KIT-01',
      category: 'accessories',
      descKey: 'bom.capillary.desc',
      descVars: { len: params.capillaryTubeLength },
      quantity: allHoles.length,
      unitKey: 'unit.set',
      remarkKey: 'bom.capillary.remark',
    });
  }

  billOfMaterials.push({
    itemCode: 'VAL-TST-01',
    category: 'accessories',
    descKey: 'bom.testValve.desc',
    quantity: pipeCount,
    unitKey: 'unit.set',
    remarkKey: 'bom.testValve.remark',
  });

  return {
    roomAreaM2: Math.round(roomAreaM2 * 10) / 10,
    roomVolumeM3: Math.round(roomVolumeM3 * 10) / 10,
    recommendedMaxAreaPerHoleM2,
    effectiveHoleSpacingM,
    effectivePipeSpacingM,
    totalHolesCalculated: allHoles.length,
    totalPipeLengthM: Math.round(totalPipeLengthM * 10) / 10,
    maxBranchLengthM: Math.round(maxBranchLengthM * 10) / 10,
    estimatedTransportTimeSec,
    maxAllowedTransportTimeSec,
    suctionPressureEndHolePa,
    flowBalanceRatioPercent,
    isCompliant,
    branches,
    holes: allHoles,
    complianceChecks,
    billOfMaterials,
    transportTimeRating,
    derivation,
  };
}
