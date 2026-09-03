import { jsPDF } from 'jspdf';
import { ASDProject, ASDScenario, CalculationResults } from '../types';

export function generateTechnicalReportPDF(
  project: ASDProject,
  scenario: ASDScenario,
  results: CalculationResults,
  planImageBase64?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Header function
  const renderHeader = (pageNumber: number, title: string) => {
    // Top primary accent bar
    doc.setFillColor(225, 29, 72); // Red #E11D48
    doc.rect(margin, 10, contentWidth, 3, 'F');

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('ASPIRATING SMOKE DETECTION (ASD) SYSTEM DESIGN - NFPA 72 COMPLIANT', margin, 18);
    doc.text(`DOC REF: ${project.code} | REV: ${scenario.revision}`, pageWidth - margin, 18, {
      align: 'right',
    });

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, 26);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, 29, pageWidth - margin, 29);
  };

  // Footer function
  const renderFooter = (pageNumber: number, totalPages: number) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Project: ${project.title} | Client: ${project.clientName}`,
      margin,
      pageHeight - 9
    );
    doc.text(
      `Page ${pageNumber} of ${totalPages} | Generated ${new Date().toLocaleDateString('id-ID')}`,
      pageWidth - margin,
      pageHeight - 9,
      { align: 'right' }
    );
  };

  // ================= PAGE 1 =================
  renderHeader(1, 'PROJECT TECHNICAL REPORT & COMPLIANCE SUMMARY');

  let y = 35;

  // Project Info Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');

  // Left col
  doc.text('Project Title:', margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(project.title, margin + 28, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Client Name:', margin + 4, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(project.clientName, margin + 28, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Facility / Site:', margin + 4, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${project.facilityName} (${project.location})`, margin + 28, y + 20);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Scenario Name:', margin + 4, y + 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(scenario.name, margin + 28, y + 27);

  // Right col
  const rightColX = margin + 115;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Project Code:', rightColX, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(project.code, rightColX + 24, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Status:', rightColX, y + 13);
  doc.setFont('helvetica', 'bold');
  const statusColor =
    project.status === 'approved' ? [16, 185, 129] : [245, 158, 11];
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(project.status.toUpperCase(), rightColX + 24, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Date:', rightColX, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(new Date(scenario.updatedAt).toLocaleDateString('id-ID'), rightColX + 24, y + 20);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Engineer:', rightColX, y + 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(project.updatedBy || 'Fire Design Engineer', rightColX + 24, y + 27);

  y += 38;

  // Key KPI Cards Grid (4 boxes)
  const boxWidth = (contentWidth - 9) / 4;
  const boxHeight = 22;

  const kpis = [
    {
      label: 'TOTAL HOLES',
      value: `${results.totalHolesCalculated} Ports`,
      sub: `${(results.roomAreaM2 / results.totalHolesCalculated).toFixed(1)} m²/port`,
      color: [15, 23, 42],
    },
    {
      label: 'TOTAL PIPE RUN',
      value: `${results.totalPipeLengthM} m`,
      sub: `${scenario.params.pipeCount} Pipe Branches`,
      color: [15, 23, 42],
    },
    {
      label: 'TRANSPORT TIME',
      value: `${results.estimatedTransportTimeSec} s`,
      sub: `Limit: ≤ ${results.maxAllowedTransportTimeSec} s (${results.transportTimeRating})`,
      color: results.estimatedTransportTimeSec <= results.maxAllowedTransportTimeSec ? [16, 185, 129] : [239, 68, 68],
    },
    {
      label: 'FLOW BALANCE',
      value: `${results.flowBalanceRatioPercent}%`,
      sub: `Target: ≥ 70% (NFPA 72)`,
      color: results.flowBalanceRatioPercent >= 70 ? [16, 185, 129] : [245, 158, 11],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const bx = margin + idx * (boxWidth + 3);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, bx + 3, y + 5);

    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, bx + 3, y + 13);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, bx + 3, y + 19);
  });

  y += 28;

  // Section: Room Geometry & Environmental Parameters
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. Room Geometry & Hazard Classification', margin, y);
  y += 4;

  const roomSpecs = [
    ['Room Dimensions (L x W x H)', `${scenario.params.length} m × ${scenario.params.width} m × ${scenario.params.height} m`],
    ['Total Floor Area & Volume', `${results.roomAreaM2} m² | ${results.roomVolumeM3} m³`],
    ['Hazard / Application Type', `${scenario.params.roomType.replace('_', ' ').toUpperCase()}`],
    ['Air Changes per Hour (ACH)', `${scenario.params.airChangesPerHour} ACH (Airflow Velocity: ${scenario.params.airflowVelocity} m/s)`],
    ['Ceiling Structure', `${scenario.params.ceilingType.replace('_', ' ')} (${scenario.params.ceilingPitchDegrees}° pitch)`],
    ['Detection Sensitivity Class', `${scenario.params.sensitivityClass}`],
    ['ASD Detector Unit Model', `${scenario.params.detectorModel}`],
    ['Pipe Material & Diameter', `${scenario.params.pipeMaterial}`],
    ['Sampling Drop Configuration', scenario.params.capillaryDropEnabled ? `Capillary Tube Drop (${scenario.params.capillaryTubeLength}m)` : 'Direct Pipe Port Sampling'],
  ];

  doc.setFontSize(8.5);
  roomSpecs.forEach(([label, val], idx) => {
    const rowY = y + idx * 5.5;
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(margin, rowY - 3.5, contentWidth, 5.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(label, margin + 4, rowY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(val, margin + 70, rowY);
  });

  y += roomSpecs.length * 5.5 + 8;

  // Section: NFPA 72 Compliance Matrix
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. NFPA 72 Verification & Compliance Matrix', margin, y);
  y += 4;

  // Table header
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('STANDARD RULE / CRITERIA', margin + 3, y + 4.2);
  doc.text('REFERENCE', margin + 55, y + 4.2);
  doc.text('ACTUAL', margin + 92, y + 4.2);
  doc.text('ALLOWABLE LIMIT', margin + 120, y + 4.2);
  doc.text('STATUS', margin + 155, y + 4.2);
  y += 6;

  results.complianceChecks.forEach((chk, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(margin, y, contentWidth, 6.5, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(chk.rule, margin + 3, y + 4.5);

    doc.setTextColor(100, 116, 139);
    doc.text(chk.standardRef, margin + 55, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(chk.actualValue, margin + 92, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(chk.limitValue, margin + 120, y + 4.5);

    // Status Pill
    if (chk.status === 'pass') {
      doc.setTextColor(16, 185, 129);
      doc.text('PASS [OK]', margin + 155, y + 4.5);
    } else if (chk.status === 'warning') {
      doc.setTextColor(217, 119, 6);
      doc.text('WARNING', margin + 155, y + 4.5);
    } else {
      doc.setTextColor(239, 68, 68);
      doc.text('FAIL [X]', margin + 155, y + 4.5);
    }

    y += 6.5;
  });

  renderFooter(1, 2);

  // ================= PAGE 2 =================
  doc.addPage();
  renderHeader(2, 'PIPE INSTALLATION LAYOUT & BILL OF MATERIALS');
  y = 35;

  // Visual layout floor plan diagram
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('3. Real-Time Pipe Network Layout Schematic', margin, y);
  y += 4;

  if (planImageBase64) {
    try {
      doc.addImage(planImageBase64, 'PNG', margin, y, contentWidth, 80);
      y += 84;
    } catch (e) {
      // Fallback graphic box if image fails
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 40, 'FD');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Pipe Layout Schematic (Vector schematic documented in design file)', margin + 10, y + 20);
      y += 44;
    }
  } else {
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 36, 'FD');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Pipe Layout Summary: ${scenario.params.pipeCount} Branches with ${results.totalHolesCalculated} calibrated sampling ports`, margin + 6, y + 12);
    doc.text(`Longest Run: ${results.maxBranchLengthM}m | Transport Time: ${results.estimatedTransportTimeSec}s | End Pressure: ${results.suctionPressureEndHolePa} Pa`, margin + 6, y + 22);
    y += 40;
  }

  // Section 4: Bill of Materials
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('4. Bill of Materials (BoQ) / Material Take-Off', margin, y);
  y += 4;

  // BoQ Table Header
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ITEM CODE', margin + 3, y + 4.2);
  doc.text('ITEM DESCRIPTION', margin + 28, y + 4.2);
  doc.text('QTY', margin + 130, y + 4.2);
  doc.text('UNIT', margin + 145, y + 4.2);
  doc.text('NOTES', margin + 160, y + 4.2);
  y += 6;

  results.billOfMaterials.forEach((item, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(margin, y, contentWidth, 6, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(item.itemCode, margin + 3, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const desc = doc.splitTextToSize(item.description, 98);
    doc.text(desc[0] || item.description, margin + 28, y + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.text(item.quantity.toString(), margin + 130, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.text(item.unit, margin + 145, y + 4.2);

    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text((item.remarks || '').substring(0, 18), margin + 160, y + 4.2);

    y += 6;
  });

  y += 8;

  // Engineering Sign-off Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, 30, 'D');

  const colW = contentWidth / 3;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);

  doc.text('DESIGN ENGINEER', margin + 6, y + 6);
  doc.line(margin + 6, y + 22, margin + colW - 6, y + 22);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(project.updatedBy || 'Lead Engineer', margin + 6, y + 26);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PEER REVIEWED BY', margin + colW + 6, y + 6);
  doc.line(margin + colW + 6, y + 22, margin + colW * 2 - 6, y + 22);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('NFPA 72 Certified Inspector', margin + colW + 6, y + 26);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT APPROVAL', margin + colW * 2 + 6, y + 6);
  doc.line(margin + colW * 2 + 6, y + 22, margin + contentWidth - 6, y + 22);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(project.clientName, margin + colW * 2 + 6, y + 26);

  renderFooter(2, 2);

  // Save the document
  const fileName = `ASD_Report_${project.code}_${scenario.revision.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
