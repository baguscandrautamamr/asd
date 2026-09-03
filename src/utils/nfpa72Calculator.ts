import {
  CalculationParams,
  CalculationResults,
  HoleScheduleItem,
  PipeBranchData,
  ComplianceCheck,
  BOMItem,
} from '../types';

/**
 * Calculates NFPA 72 compliant ASD pipe network parameters, sampling hole schedule,
 * hydraulic flow estimation, and BoQ materials.
 */
export function calculateASD(params: CalculationParams): CalculationResults {
  const roomAreaM2 = params.length * params.width;
  const roomVolumeM3 = roomAreaM2 * params.height;

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

  // 4. Calculate detector coordinates
  // Wall positions in room coordinates (x: 0..length, y: 0..width)
  let detX = 0;
  let detY = 0;
  const offset = Math.max(0.1, Math.min(0.9, params.detectorLocation?.positionOffsetRatio ?? 0.5));

  switch (params.detectorLocation?.wall || 'west') {
    case 'north':
      detX = params.length * offset;
      detY = 0.4;
      break;
    case 'south':
      detX = params.length * offset;
      detY = params.width - 0.4;
      break;
    case 'east':
      detX = params.length - 0.4;
      detY = params.width * offset;
      break;
    case 'west':
    default:
      detX = 0.4;
      detY = params.width * offset;
      break;
  }

  // 5. Generate Pipe Branches and Sampling Hole Positions
  const branches: PipeBranchData[] = [];
  const allHoles: HoleScheduleItem[] = [];
  let globalHoleNum = 1;
  let totalPipeLengthM = 0;
  let maxBranchLengthM = 0;

  // Coverage radius per NFPA 72: R = Spacing / sqrt(2)
  const coverageRadiusM = Math.round((effectiveHoleSpacingM / Math.SQRT2) * 100) / 100;

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

    // Branch start and end in room coordinates
    let startX: number;
    let startY: number;
    let endX: number;
    let endY: number;

    const wallOffset = Math.min(1.5, Math.max(0.6, effectiveHoleSpacingM / 2));

    if (isLengthwise) {
      startX = wallOffset;
      endX = params.length - wallOffset;
      startY = branchLateralPos;
      endY = branchLateralPos;
    } else {
      startX = branchLateralPos;
      endX = branchLateralPos;
      startY = wallOffset;
      endY = params.width - wallOffset;
    }

    const branchLinearRunM = Math.abs(isLengthwise ? endX - startX : endY - startY);

    // Manifold header length from detector to branch entry
    const headerManifoldM = Math.round((Math.abs(detX - startX) + Math.abs(detY - startY)) * 10) / 10;
    const branchTotalM = Math.round((headerManifoldM + branchLinearRunM) * 10) / 10;

    totalPipeLengthM += branchTotalM;
    if (branchTotalM > maxBranchLengthM) {
      maxBranchLengthM = branchTotalM;
    }

    // Calculate holes for this pipe branch
    const holesOnBranch: HoleScheduleItem[] = [];
    const availableLength = branchLinearRunM;
    const holeStep = effectiveHoleSpacingM;
    const holeCount = Math.max(2, Math.floor(availableLength / holeStep) + 1);

    for (let hIdx = 0; hIdx < holeCount; hIdx++) {
      const frac = holeCount > 1 ? hIdx / (holeCount - 1) : 0.5;
      const hx = isLengthwise ? startX + frac * (endX - startX) : startX;
      const hy = isLengthwise ? startY : startY + frac * (endY - startY);

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
        coverageRadiusM,
      };

      holesOnBranch.push(holeItem);
      allHoles.push(holeItem);
    }

    // Segments: Manifold header line from detector to branch start, then branch run
    const segments = [
      { from: { x: detX, y: detY }, to: { x: startX, y: startY } },
      { from: { x: startX, y: startY }, to: { x: endX, y: endY } },
    ];

    branches.push({
      pipeIndex: pIdx,
      pipeName,
      lengthMeters: branchTotalM,
      holeCount: holesOnBranch.length,
      startPoint: { x: startX, y: startY },
      endPoint: { x: endX, y: endY },
      segments,
      holes: holesOnBranch,
    });
  }

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
  const flows = allHoles.map((h) => h.estimatedFlowRateLpm);
  const minFlow = Math.min(...flows);
  const maxFlow = Math.max(...flows);
  const flowBalanceRatioPercent =
    maxFlow > 0 ? Math.round((minFlow / maxFlow) * 1000) / 10 : 100;

  // Pressure at furthest end hole
  const furthestHole = allHoles.reduce((prev, curr) =>
    curr.distanceAlongPipe > prev.distanceAlongPipe ? curr : prev
  );
  const suctionPressureEndHolePa = furthestHole ? furthestHole.suctionPressurePa : 35;

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
    },
    {
      id: 'chk-coverage',
      ruleKey: 'chk.coverage.rule',
      standardRef: 'NFPA 72 Sec. 17.7.3.6.3 & 17.7.6.3',
      status:
        roomAreaM2 / allHoles.length <= recommendedMaxAreaPerHoleM2 * 1.15 ? 'pass' : 'warning',
      actualValue: `${(roomAreaM2 / allHoles.length).toFixed(1)} m\u00b2`,
      limitValue: `\u2264 ${recommendedMaxAreaPerHoleM2} m\u00b2`,
      noteKey: 'chk.coverage.note',
      noteVars: { ach: params.airChangesPerHour, h: params.height },
    },
    {
      id: 'chk-pipe-length',
      ruleKey: 'chk.pipeLength.rule',
      standardRef: 'NFPA 72 & Manufacturer Limit',
      status: maxBranchLengthM <= 100 ? 'pass' : 'warning',
      actualValue: `${maxBranchLengthM.toFixed(1)} m`,
      limitValue: '\u2264 100.0 m',
      noteKey: maxBranchLengthM <= 100 ? 'chk.pipeLength.pass' : 'chk.pipeLength.warn',
    },
    {
      id: 'chk-flow-balance',
      ruleKey: 'chk.balance.rule',
      standardRef: 'NFPA 72 Hydraulic Balance (VESDA/Securiton)',
      status: flowBalanceRatioPercent >= 70 ? 'pass' : 'warning',
      actualValue: `${flowBalanceRatioPercent}%`,
      limitValue: '\u2265 70%',
      noteKey: flowBalanceRatioPercent >= 70 ? 'chk.balance.pass' : 'chk.balance.warn',
    },
    {
      id: 'chk-end-pressure',
      ruleKey: 'chk.pressure.rule',
      standardRef: 'NFPA 72 Sec. 17.7.3.6.5',
      status: suctionPressureEndHolePa >= 25 ? 'pass' : 'warning',
      actualValue: `${suctionPressureEndHolePa} Pa`,
      limitValue: '\u2265 25 Pa',
      noteKey: suctionPressureEndHolePa >= 25 ? 'chk.pressure.pass' : 'chk.pressure.warn',
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
  };
}
