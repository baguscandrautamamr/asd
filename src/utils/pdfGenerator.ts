import { jsPDF } from 'jspdf';
import { ASDProject, ASDScenario, CalculationResults } from '../types';
import type { TranslateVars } from '../context/I18nContext';
import type { TranslationKey } from '../i18n/translations';
import {
  ceilingKey,
  detectorKey,
  materialKey,
  ratingKey,
  roomTypeKey,
  sensitivityKey,
  statusKey,
} from '../i18n/labels';

export interface ReportLocale {
  t: (key: TranslationKey, vars?: TranslateVars) => string;
  n: (value: number, digits?: number) => string;
  d: (value: number | Date) => string;
}

export interface ReportImages {
  planImage?: string;
  modelImage?: string;
}

/**
 * jsPDF's built-in fonts encode cp1252, which has no glyph for the math
 * comparison signs the calculator emits. Substituting keeps the report legible
 * instead of printing replacement boxes.
 */
function pdfSafe(text: string): string {
  return text
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[—–−]/g, '-')
    .replace(/→/g, '->')
    .replace(/·/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...');
}

export function generateTechnicalReportPDF(
  project: ASDProject,
  scenario: ASDScenario,
  results: CalculationResults,
  locale: ReportLocale,
  images: ReportImages = {}
) {
  const { t, n, d } = locale;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const write = (text: string, x: number, y: number, options?: Parameters<typeof doc.text>[3]) =>
    doc.text(pdfSafe(text), x, y, options);

  const renderHeader = (title: string) => {
    doc.setFillColor(225, 29, 72);
    doc.rect(margin, 10, contentWidth, 3, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    write(t('pdf.docTitle'), margin, 18);
    write(t('pdf.docRef', { code: project.code, rev: scenario.revision }), pageWidth - margin, 18, {
      align: 'right',
    });

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    write(title, margin, 26);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, 29, pageWidth - margin, 29);
  };

  const renderFooter = (pageNumber: number, totalPages: number) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    write(
      t('pdf.footer', { title: project.title, client: project.clientName }),
      margin,
      pageHeight - 9
    );
    write(
      t('pdf.pageOf', { n: pageNumber, total: totalPages, date: d(Date.now()) }),
      pageWidth - margin,
      pageHeight - 9,
      { align: 'right' }
    );
  };

  // ============================== PAGE 1 ==============================
  renderHeader(t('pdf.page1Title'));

  let y = 35;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  const infoRow = (
    label: string,
    value: string,
    x: number,
    rowY: number,
    valueOffset: number
  ) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    write(label, x, rowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    write(value, x + valueOffset, rowY);
  };

  infoRow(t('pdf.projectTitle'), project.title, margin + 4, y + 6, 30);
  infoRow(t('pdf.clientName'), project.clientName, margin + 4, y + 13, 30);
  infoRow(
    t('pdf.facility'),
    `${project.facilityName} (${project.location})`,
    margin + 4,
    y + 20,
    30
  );
  infoRow(t('pdf.scenarioName'), scenario.name, margin + 4, y + 27, 30);

  const rightColX = margin + 115;
  infoRow(t('pdf.projectCode'), project.code, rightColX, y + 6, 26);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  write(t('pdf.status'), rightColX, y + 13);
  const statusColor = project.status === 'approved' ? [16, 185, 129] : [245, 158, 11];
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  write(t(statusKey[project.status] ?? 'opt.status.draft').toUpperCase(), rightColX + 26, y + 13);

  infoRow(t('pdf.date'), d(scenario.updatedAt), rightColX, y + 20, 26);
  infoRow(t('pdf.engineer'), project.updatedBy || t('pdf.signEngineerRole'), rightColX, y + 27, 26);

  y += 38;

  // KPI cards
  const boxWidth = (contentWidth - 9) / 4;
  const boxHeight = 22;
  const areaPerPort = results.roomAreaM2 / Math.max(1, results.totalHolesCalculated);

  const kpis = [
    {
      label: t('pdf.kpiHoles'),
      value: t('pdf.kpiHolesValue', { n: results.totalHolesCalculated }),
      sub: t('pdf.kpiHolesSub', { v: n(areaPerPort, 1) }),
      color: [15, 23, 42],
    },
    {
      label: t('pdf.kpiPipe'),
      value: `${n(results.totalPipeLengthM, 1)} m`,
      sub: t('pdf.kpiPipeSub', { n: scenario.params.pipeCount }),
      color: [15, 23, 42],
    },
    {
      label: t('pdf.kpiTransport'),
      value: `${n(results.estimatedTransportTimeSec, 1)} s`,
      sub: t('pdf.kpiTransportSub', {
        v: results.maxAllowedTransportTimeSec,
        rating: t(ratingKey[results.transportTimeRating]),
      }),
      color:
        results.estimatedTransportTimeSec <= results.maxAllowedTransportTimeSec
          ? [16, 185, 129]
          : [239, 68, 68],
    },
    {
      label: t('pdf.kpiBalance'),
      value: `${n(results.flowBalanceRatioPercent, 1)}%`,
      sub: t('pdf.kpiBalanceSub'),
      color: results.flowBalanceRatioPercent >= 70 ? [16, 185, 129] : [245, 158, 11],
    },
  ];

  kpis.forEach((kpi, index) => {
    const bx = margin + index * (boxWidth + 3);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    write(kpi.label, bx + 3, y + 5);

    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    write(kpi.value, bx + 3, y + 13);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    write(doc.splitTextToSize(pdfSafe(kpi.sub), boxWidth - 6)[0] ?? '', bx + 3, y + 19);
  });

  y += 28;

  // Section 1 — room specification
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  write(t('pdf.section1'), margin, y);
  y += 4;

  const { params } = scenario;
  const material = materialKey(params.pipeMaterial);

  const roomSpecs: [string, string][] = [
    [
      t('pdf.specDims'),
      `${n(params.length, 1)} m x ${n(params.width, 1)} m x ${n(params.height, 1)} m`,
    ],
    [
      t('pdf.specArea'),
      `${n(results.roomAreaM2, 1)} m² | ${n(results.roomVolumeM3, 1)} m³`,
    ],
    [t('pdf.specHazard'), t(roomTypeKey[params.roomType])],
    [
      t('pdf.specAch'),
      t('pdf.specAchValue', {
        ach: params.airChangesPerHour,
        v: n(params.airflowVelocity, 1),
      }),
    ],
    [
      t('pdf.specCeiling'),
      t('pdf.specCeilingValue', {
        type: t(ceilingKey[params.ceilingType]),
        pitch: params.ceilingPitchDegrees,
      }),
    ],
    [t('pdf.specClass'), t(sensitivityKey[params.sensitivityClass])],
    [t('pdf.specModel'), t(detectorKey[params.detectorModel])],
    [t('pdf.specMaterial'), material ? t(material) : params.pipeMaterial],
    [
      t('pdf.specDrop'),
      params.capillaryDropEnabled
        ? t('pdf.specDropCapillary', { len: n(params.capillaryTubeLength, 1) })
        : t('pdf.specDropDirect'),
    ],
  ];

  doc.setFontSize(8.5);
  roomSpecs.forEach(([label, value], index) => {
    const rowY = y + index * 5.5;
    const shade = index % 2 === 0 ? 255 : 248;
    doc.setFillColor(shade, shade, shade === 255 ? 255 : 252);
    doc.rect(margin, rowY - 3.5, contentWidth, 5.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    write(label, margin + 4, rowY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    write(doc.splitTextToSize(pdfSafe(value), contentWidth - 78)[0] ?? '', margin + 74, rowY);
  });

  y += roomSpecs.length * 5.5 + 8;

  // Section 2 — compliance matrix
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  write(t('pdf.section2'), margin, y);
  y += 4;

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  write(t('pdf.colRule'), margin + 3, y + 4.2);
  write(t('pdf.colRef'), margin + 58, y + 4.2);
  write(t('pdf.colActual'), margin + 96, y + 4.2);
  write(t('pdf.colLimit'), margin + 121, y + 4.2);
  write(t('pdf.colStatus'), margin + 152, y + 4.2);
  y += 6;

  results.complianceChecks.forEach((check, index) => {
    const shade = index % 2 === 0 ? 255 : 248;
    doc.setFillColor(shade, shade, shade === 255 ? 255 : 252);
    doc.rect(margin, y, contentWidth, 6.5, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    write(doc.splitTextToSize(pdfSafe(t(check.ruleKey)), 52)[0] ?? '', margin + 3, y + 4.5);

    doc.setTextColor(100, 116, 139);
    write(doc.splitTextToSize(pdfSafe(check.standardRef), 36)[0] ?? '', margin + 58, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    write(check.actualValue, margin + 96, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    write(check.limitValue, margin + 121, y + 4.5);

    if (check.status === 'pass') {
      doc.setTextColor(16, 185, 129);
      write(t('comp.pass'), margin + 152, y + 4.5);
    } else if (check.status === 'warning') {
      doc.setTextColor(217, 119, 6);
      write(t('comp.warning'), margin + 152, y + 4.5);
    } else {
      doc.setTextColor(239, 68, 68);
      write(t('comp.fail'), margin + 152, y + 4.5);
    }

    y += 6.5;
  });

  renderFooter(1, 2);

  // ============================== PAGE 2 ==============================
  doc.addPage();
  renderHeader(t('pdf.page2Title'));
  y = 35;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  write(t('pdf.section3'), margin, y);
  y += 4;

  const shots = [
    { image: images.modelImage, caption: t('pdf.view3d') },
    { image: images.planImage, caption: t('pdf.view2d') },
  ].filter((shot) => !!shot.image);

  if (shots.length > 0) {
    const shotWidth = shots.length === 1 ? contentWidth : (contentWidth - 5) / 2;
    const shotHeight = shots.length === 1 ? 78 : 52;
    let drewAny = false;

    shots.forEach((shot, index) => {
      const x = margin + index * (shotWidth + 5);
      try {
        doc.addImage(shot.image as string, 'PNG', x, y, shotWidth, shotHeight);
        drewAny = true;
      } catch {
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(248, 250, 252);
        doc.rect(x, y, shotWidth, shotHeight, 'FD');
      }
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      write(shot.caption, x, y + shotHeight + 3.5);
    });

    y += shotHeight + 8;
    if (!drewAny) y -= 2;
  } else {
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 36, 'FD');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    write(
      t('pdf.layoutFallback', {
        n: params.pipeCount,
        holes: results.totalHolesCalculated,
      }),
      margin + 6,
      y + 14
    );
    write(
      t('pdf.layoutFallback2', {
        len: n(results.maxBranchLengthM, 1),
        t: n(results.estimatedTransportTimeSec, 1),
        p: n(results.suctionPressureEndHolePa),
      }),
      margin + 6,
      y + 24
    );
    y += 44;
  }

  // Section 4 — bill of materials
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  write(t('pdf.section4'), margin, y);
  y += 4;

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  write(t('pdf.colCode'), margin + 3, y + 4.2);
  write(t('pdf.colDesc'), margin + 28, y + 4.2);
  write(t('pdf.colQty'), margin + 128, y + 4.2);
  write(t('pdf.colUnit'), margin + 142, y + 4.2);
  write(t('pdf.colNotes'), margin + 160, y + 4.2);
  y += 6;

  results.billOfMaterials.forEach((item, index) => {
    const shade = index % 2 === 0 ? 255 : 248;
    doc.setFillColor(shade, shade, shade === 255 ? 255 : 252);
    doc.rect(margin, y, contentWidth, 6, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    write(item.itemCode, margin + 3, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const description = pdfSafe(t(item.descKey, item.descVars));
    write(doc.splitTextToSize(description, 96)[0] ?? description, margin + 28, y + 4.2);

    doc.setFont('helvetica', 'bold');
    write(n(item.quantity), margin + 128, y + 4.2);

    doc.setFont('helvetica', 'normal');
    write(t(item.unitKey), margin + 142, y + 4.2);

    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const remark = item.remarkKey ? pdfSafe(t(item.remarkKey, item.remarkVars)) : '';
    write(doc.splitTextToSize(remark, 22)[0] ?? '', margin + 160, y + 4.2);

    y += 6;
  });

  y += 8;

  // Sign-off block
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 30, 'D');

  const colW = contentWidth / 3;
  const signColumn = (title: string, role: string, x: number) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    write(title, x, y + 6);
    doc.line(x, y + 22, x + colW - 12, y + 22);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    write(doc.splitTextToSize(pdfSafe(role), colW - 12)[0] ?? role, x, y + 26);
  };

  signColumn(t('pdf.signEngineer'), project.updatedBy || t('pdf.signEngineerRole'), margin + 6);
  signColumn(t('pdf.signReviewer'), t('pdf.signReviewerRole'), margin + colW + 6);
  signColumn(t('pdf.signClient'), project.clientName, margin + colW * 2 + 6);

  renderFooter(2, 2);

  const fileName = `ASD_Report_${project.code}_${scenario.revision.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
