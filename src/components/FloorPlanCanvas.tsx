import React, { useState, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { CalculationParams, CalculationResults, HoleScheduleItem } from '../types';
import {
  Eye,
  Info,
  Layers,
  Maximize2,
  Server,
  Sliders,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { materialKey } from '../i18n/labels';

export interface FloorPlanCanvasRef {
  getCanvasImageBase64: () => Promise<string | undefined>;
}

interface FloorPlanCanvasProps {
  params: CalculationParams;
  results: CalculationResults;
  onUpdateParams?: (partial: Partial<CalculationParams>) => void;
}

/** SVG cannot read CSS variables through the serialiser, so the plan carries
 *  its own palette and swaps it with the app theme. */
interface PlanPalette {
  page: string;
  room: string;
  roomStroke: string;
  grid: string;
  rack: string;
  rackStroke: string;
  rackDetail: string;
  dim: string;
  dimText: string;
  wallText: string;
  pipe: string;
  pipeGlow: string;
  endCap: string;
  endCapStroke: string;
  branchText: string;
  hole: string;
  holeHover: string;
  holeStroke: string;
  labelBg: string;
  labelStroke: string;
  labelText: string;
  orificeText: string;
  coverageFill: string;
  coverageStroke: string;
  asdBody: string;
  asdBodyStroke: string;
  asdFace: string;
  asdFaceStroke: string;
  asdText: string;
}

const DARK_PLAN: PlanPalette = {
  page: '#0b1324',
  room: '#0f172a',
  roomStroke: '#334155',
  grid: 'rgba(51, 65, 85, 0.45)',
  rack: '#1e293b',
  rackStroke: '#475569',
  rackDetail: '#334155',
  dim: '#64748b',
  dimText: '#cbd5e1',
  wallText: '#64748b',
  pipe: '#e11d48',
  pipeGlow: '#f43f5e',
  endCap: '#be123c',
  endCapStroke: '#ffe4e6',
  branchText: '#fda4af',
  hole: '#ffffff',
  holeHover: '#38bdf8',
  holeStroke: '#e11d48',
  labelBg: '#0f172a',
  labelStroke: '#334155',
  labelText: '#ffffff',
  orificeText: '#fcd34d',
  coverageFill: 'rgba(244, 63, 94, 0.08)',
  coverageStroke: 'rgba(244, 63, 94, 0.3)',
  asdBody: '#1e293b',
  asdBodyStroke: '#e2e8f0',
  asdFace: '#0f172a',
  asdFaceStroke: '#94a3b8',
  asdText: '#e2e8f0',
};

const LIGHT_PLAN: PlanPalette = {
  page: '#eef2f8',
  room: '#ffffff',
  roomStroke: '#94a3b8',
  grid: 'rgba(148, 163, 184, 0.35)',
  rack: '#e2e8f0',
  rackStroke: '#94a3b8',
  rackDetail: '#cbd5e1',
  dim: '#64748b',
  dimText: '#334155',
  wallText: '#94a3b8',
  pipe: '#e11d48',
  pipeGlow: '#f43f5e',
  endCap: '#9f1239',
  endCapStroke: '#ffffff',
  branchText: '#9f1239',
  hole: '#ffffff',
  holeHover: '#0284c7',
  holeStroke: '#e11d48',
  labelBg: '#ffffff',
  labelStroke: '#cbd5e1',
  labelText: '#0f172a',
  orificeText: '#b45309',
  coverageFill: 'rgba(225, 29, 72, 0.07)',
  coverageStroke: 'rgba(225, 29, 72, 0.32)',
  asdBody: '#cbd5e1',
  asdBodyStroke: '#334155',
  asdFace: '#f8fafc',
  asdFaceStroke: '#64748b',
  asdText: '#0f172a',
};

export const FloorPlanCanvas = forwardRef<FloorPlanCanvasRef, FloorPlanCanvasProps>(
  ({ params, results }, ref) => {
    const { t, n } = useI18n();
    const { isDark } = useTheme();
    const palette = isDark ? DARK_PLAN : LIGHT_PLAN;

    const [zoom, setZoom] = useState(1);
    const [showCoverage, setShowCoverage] = useState(true);
    const [showHoleLabels, setShowHoleLabels] = useState(true);
    const [showDimensions, setShowDimensions] = useState(true);
    const [showRacks, setShowRacks] = useState(
      params.roomType === 'data_center' || params.roomType === 'telecom'
    );
    const [hoveredHole, setHoveredHole] = useState<HoleScheduleItem | null>(null);

    const svgRef = useRef<SVGSVGElement>(null);

    useImperativeHandle(ref, () => ({
      getCanvasImageBase64: async () => {
        if (!svgRef.current) return undefined;
        try {
          const svgString = new XMLSerializer().serializeToString(svgRef.current);
          const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
          const blobURL = window.URL.createObjectURL(svgBlob);

          return await new Promise<string>((resolve) => {
            const image = new Image();
            image.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 1200;
              canvas.height = 700;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = palette.page;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/png'));
              } else {
                resolve('');
              }
              window.URL.revokeObjectURL(blobURL);
            };
            image.onerror = () => {
              window.URL.revokeObjectURL(blobURL);
              resolve('');
            };
            image.src = blobURL;
          });
        } catch (err) {
          console.error('Failed to export canvas image:', err);
          return undefined;
        }
      },
    }));

    const padding = 5; // metres of drawing margin around the room
    const viewWidth = params.length + padding * 2;
    const viewHeight = params.width + padding * 2;
    const toSvgX = (x: number) => padding + x;
    const toSvgY = (y: number) => padding + y;

    // ASD unit placement on its mounting wall.
    const detOffset = Math.max(
      0.1,
      Math.min(0.9, params.detectorLocation?.positionOffsetRatio ?? 0.5)
    );
    let detX = 0.2;
    let detY = params.width * detOffset;
    let detAngle = 90;

    switch (params.detectorLocation?.wall || 'west') {
      case 'north':
        detX = params.length * detOffset;
        detY = 0.2;
        detAngle = 180;
        break;
      case 'south':
        detX = params.length * detOffset;
        detY = params.width - 0.2;
        detAngle = 0;
        break;
      case 'east':
        detX = params.length - 0.2;
        detY = params.width * detOffset;
        detAngle = 270;
        break;
      default:
        break;
    }

    const racks = useMemo(() => {
      if (!showRacks || (params.roomType !== 'data_center' && params.roomType !== 'telecom')) {
        return [];
      }
      const out: { x: number; y: number; w: number; h: number }[] = [];
      const rackRows = Math.max(2, Math.floor(params.width / 4));
      const racksPerRow = Math.max(3, Math.floor(params.length / 3.5));
      for (let r = 0; r < rackRows; r++) {
        const ry = (r + 0.6) * (params.width / rackRows);
        for (let c = 0; c < racksPerRow; c++) {
          const rx = 2.5 + c * 3.2;
          if (rx + 2.4 < params.length) out.push({ x: rx, y: ry, w: 2.4, h: 0.9 });
        }
      }
      return out;
    }, [showRacks, params.roomType, params.width, params.length]);

    const materialLabel = materialKey(params.pipeMaterial);

    const toolButton = (active: boolean) =>
      `px-2.5 py-1 text-xs rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
        active ? 'bg-brand text-white shadow-sm' : 'text-ink-3 hover:text-ink hover:bg-surface-3'
      }`;

    return (
      <div className="relative w-full h-full rounded-2xl overflow-hidden border border-line bg-canvas flex flex-col select-none">
        {/* Floating toolbar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="glass rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2 pointer-events-auto">
            <span className="inline-flex items-center text-xs font-semibold text-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse mr-1.5" />
              {t('plan.network', {
                material: materialLabel ? t(materialLabel) : params.pipeMaterial,
              })}
            </span>
            <span className="text-xs text-ink-3 font-mono">
              {n(params.length, 1)}m × {n(params.width, 1)}m ({n(results.roomAreaM2, 1)} m²)
            </span>
          </div>

          <div className="glass rounded-xl p-1 shadow-lg flex items-center gap-1 pointer-events-auto">
            <button
              type="button"
              onClick={() => setShowCoverage((v) => !v)}
              className={toolButton(showCoverage)}
              title={t('plan.coverageHint')}
            >
              <Layers className="w-3.5 h-3.5" />
              {t('plan.coverage')}
            </button>

            <button
              type="button"
              onClick={() => setShowHoleLabels((v) => !v)}
              className={toolButton(showHoleLabels)}
              title={t('plan.holesHint')}
            >
              <Eye className="w-3.5 h-3.5" />
              {t('plan.holes')}
            </button>

            <button
              type="button"
              onClick={() => setShowDimensions((v) => !v)}
              className={toolButton(showDimensions)}
              title={t('plan.dimsHint')}
            >
              <Sliders className="w-3.5 h-3.5" />
              {t('plan.dims')}
            </button>

            {(params.roomType === 'data_center' || params.roomType === 'telecom') && (
              <button
                type="button"
                onClick={() => setShowRacks((v) => !v)}
                className={toolButton(showRacks)}
                title={t('plan.racksHint')}
              >
                <Server className="w-3.5 h-3.5" />
                {t('plan.racks')}
              </button>
            )}

            <span className="w-px h-5 bg-line-2 mx-1" />

            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}
              className="p-1.5 text-ink-3 hover:text-ink hover:bg-surface-3 rounded-lg transition-colors"
              title={t('plan.zoomOut')}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono text-ink-3 min-w-[2.5rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.2, Math.round((z + 0.15) * 100) / 100))}
              className="p-1.5 text-ink-3 hover:text-ink hover:bg-surface-3 rounded-lg transition-colors"
              title={t('plan.zoomIn')}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1.5 text-ink-3 hover:text-ink hover:bg-surface-3 rounded-lg transition-colors"
              title={t('plan.zoomReset')}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Drawing */}
        <div className="flex-1 w-full h-full overflow-auto flex items-center justify-center p-4">
          <div
            className="transition-transform duration-200 origin-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              viewBox={`0 0 ${viewWidth} ${viewHeight}`}
              className="w-[880px] h-[550px] drop-shadow-2xl"
              style={{ background: palette.page }}
            >
              <defs>
                <pattern id="meter-grid" width="1" height="1" patternUnits="userSpaceOnUse">
                  <path d="M 1 0 L 0 0 0 1" fill="none" stroke={palette.grid} strokeWidth="0.04" />
                </pattern>

                <filter id="pipe-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow
                    dx="0"
                    dy="0"
                    stdDeviation="0.2"
                    floodColor={palette.pipeGlow}
                    floodOpacity="0.45"
                  />
                </filter>

                <marker
                  id="arrow-flow"
                  viewBox="0 0 10 10"
                  refX="5"
                  refY="5"
                  markerWidth="3"
                  markerHeight="3"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill={palette.pipeGlow} opacity="0.9" />
                </marker>
              </defs>

              <rect
                x={padding}
                y={padding}
                width={params.length}
                height={params.width}
                fill={palette.room}
                stroke={palette.roomStroke}
                strokeWidth="0.15"
              />
              <rect
                x={padding}
                y={padding}
                width={params.length}
                height={params.width}
                fill="url(#meter-grid)"
              />

              {racks.map((rack, i) => (
                <g key={`rack-${i}`}>
                  <rect
                    x={toSvgX(rack.x)}
                    y={toSvgY(rack.y)}
                    width={rack.w}
                    height={rack.h}
                    fill={palette.rack}
                    stroke={palette.rackStroke}
                    strokeWidth="0.06"
                    rx="0.1"
                  />
                  <line
                    x1={toSvgX(rack.x + 0.2)}
                    y1={toSvgY(rack.y + rack.h / 2)}
                    x2={toSvgX(rack.x + rack.w - 0.2)}
                    y2={toSvgY(rack.y + rack.h / 2)}
                    stroke={palette.rackDetail}
                    strokeWidth="0.04"
                    strokeDasharray="0.1, 0.1"
                  />
                </g>
              ))}

              {showDimensions && (
                <g fontSize="0.45" fontFamily="JetBrains Mono, monospace">
                  <line
                    x1={padding}
                    y1={padding - 1.2}
                    x2={padding + params.length}
                    y2={padding - 1.2}
                    stroke={palette.dim}
                    strokeWidth="0.06"
                  />
                  <line
                    x1={padding}
                    y1={padding - 1.6}
                    x2={padding}
                    y2={padding - 0.8}
                    stroke={palette.dim}
                    strokeWidth="0.06"
                  />
                  <line
                    x1={padding + params.length}
                    y1={padding - 1.6}
                    x2={padding + params.length}
                    y2={padding - 0.8}
                    stroke={palette.dim}
                    strokeWidth="0.06"
                  />
                  <rect
                    x={padding + params.length / 2 - 1.5}
                    y={padding - 1.6}
                    width="3"
                    height="0.8"
                    fill={palette.page}
                    rx="0.15"
                  />
                  <text
                    x={padding + params.length / 2}
                    y={padding - 1.05}
                    textAnchor="middle"
                    fontWeight="bold"
                    fill={palette.dimText}
                  >
                    {t('plan.length')}: {n(params.length, 1)} m
                  </text>

                  <line
                    x1={padding - 1.2}
                    y1={padding}
                    x2={padding - 1.2}
                    y2={padding + params.width}
                    stroke={palette.dim}
                    strokeWidth="0.06"
                  />
                  <line
                    x1={padding - 1.6}
                    y1={padding}
                    x2={padding - 0.8}
                    y2={padding}
                    stroke={palette.dim}
                    strokeWidth="0.06"
                  />
                  <line
                    x1={padding - 1.6}
                    y1={padding + params.width}
                    x2={padding - 0.8}
                    y2={padding + params.width}
                    stroke={palette.dim}
                    strokeWidth="0.06"
                  />
                  <rect
                    x={padding - 2.7}
                    y={padding + params.width / 2 - 0.4}
                    width="3"
                    height="0.8"
                    fill={palette.page}
                    rx="0.15"
                    transform={`rotate(-90 ${padding - 1.2} ${padding + params.width / 2})`}
                  />
                  <text
                    x={padding - 1.2}
                    y={padding + params.width / 2 + 0.15}
                    textAnchor="middle"
                    fontWeight="bold"
                    fill={palette.dimText}
                    transform={`rotate(-90 ${padding - 1.2} ${padding + params.width / 2})`}
                  >
                    {t('plan.widthLabel')}: {n(params.width, 1)} m
                  </text>
                </g>
              )}

              {showCoverage && (
                <g id="coverage-layer">
                  {results.holes.map((hole) => (
                    <circle
                      key={`cov-${hole.id}`}
                      cx={toSvgX(hole.x)}
                      cy={toSvgY(hole.y)}
                      r={hole.coverageRadiusM}
                      fill={palette.coverageFill}
                      stroke={palette.coverageStroke}
                      strokeWidth="0.05"
                      strokeDasharray="0.3, 0.2"
                    />
                  ))}
                </g>
              )}

              <g id="pipe-network">
                {results.branches.map((branch) => (
                  <g key={`branch-${branch.pipeIndex}`}>
                    {branch.segments.map((seg, sIdx) => (
                      <line
                        key={`glow-${branch.pipeIndex}-${sIdx}`}
                        x1={toSvgX(seg.from.x)}
                        y1={toSvgY(seg.from.y)}
                        x2={toSvgX(seg.to.x)}
                        y2={toSvgY(seg.to.y)}
                        stroke={palette.pipeGlow}
                        strokeWidth="0.28"
                        strokeLinecap="round"
                        filter="url(#pipe-glow)"
                      />
                    ))}

                    {branch.segments.map((seg, sIdx) => (
                      <line
                        key={`pipe-${branch.pipeIndex}-${sIdx}`}
                        x1={toSvgX(seg.from.x)}
                        y1={toSvgY(seg.from.y)}
                        x2={toSvgX(seg.to.x)}
                        y2={toSvgY(seg.to.y)}
                        stroke={palette.pipe}
                        strokeWidth="0.14"
                        strokeLinecap="round"
                      />
                    ))}

                    {branch.segments.map((seg, sIdx) => {
                      const mx = (seg.from.x + seg.to.x) / 2;
                      const my = (seg.from.y + seg.to.y) / 2;
                      return (
                        <line
                          key={`flow-${branch.pipeIndex}-${sIdx}`}
                          x1={toSvgX(seg.to.x)}
                          y1={toSvgY(seg.to.y)}
                          x2={toSvgX(mx)}
                          y2={toSvgY(my)}
                          stroke="transparent"
                          strokeWidth="0.12"
                          markerEnd="url(#arrow-flow)"
                        />
                      );
                    })}

                    <circle
                      cx={toSvgX(branch.endPoint.x)}
                      cy={toSvgY(branch.endPoint.y)}
                      r="0.2"
                      fill={palette.endCap}
                      stroke={palette.endCapStroke}
                      strokeWidth="0.05"
                    />
                    <text
                      x={toSvgX(branch.endPoint.x)}
                      y={toSvgY(branch.endPoint.y) + 0.45}
                      textAnchor="middle"
                      fontSize="0.32"
                      fontWeight="bold"
                      fontFamily="JetBrains Mono, monospace"
                      fill={palette.branchText}
                    >
                      {t('plan.endCap')}
                    </text>

                    <text
                      x={toSvgX(
                        branch.startPoint.x + (branch.endPoint.x - branch.startPoint.x) * 0.15
                      )}
                      y={toSvgY(branch.startPoint.y) - 0.3}
                      fontSize="0.35"
                      fontWeight="bold"
                      fontFamily="JetBrains Mono, monospace"
                      fill={palette.branchText}
                    >
                      {branch.pipeName} ({n(branch.lengthMeters, 1)}m)
                    </text>
                  </g>
                ))}
              </g>

              <g id="sampling-holes">
                {results.holes.map((hole) => {
                  const isHovered = hoveredHole?.id === hole.id;
                  const hx = toSvgX(hole.x);
                  const hy = toSvgY(hole.y);

                  return (
                    <g
                      key={`hole-${hole.id}`}
                      onMouseEnter={() => setHoveredHole(hole)}
                      onMouseLeave={() => setHoveredHole(null)}
                      className="cursor-pointer"
                    >
                      <circle cx={hx} cy={hy} r="0.6" fill="transparent" />

                      {isHovered && (
                        <circle
                          cx={hx}
                          cy={hy}
                          r="0.45"
                          fill="none"
                          stroke={palette.holeHover}
                          strokeWidth="0.06"
                          className="animate-ping"
                        />
                      )}

                      <circle
                        cx={hx}
                        cy={hy}
                        r={0.16 + (hole.diameterMm / 1000) * 15}
                        fill={isHovered ? palette.holeHover : palette.hole}
                        stroke={palette.holeStroke}
                        strokeWidth="0.06"
                      />

                      {showHoleLabels && (
                        <g>
                          <rect
                            x={hx - 0.45}
                            y={hy - 0.7}
                            width="0.9"
                            height="0.4"
                            fill={palette.labelBg}
                            stroke={palette.labelStroke}
                            strokeWidth="0.03"
                            rx="0.08"
                          />
                          <text
                            x={hx}
                            y={hy - 0.42}
                            textAnchor="middle"
                            fontSize="0.26"
                            fontWeight="bold"
                            fontFamily="JetBrains Mono, monospace"
                            fill={palette.labelText}
                          >
                            #{hole.holeNumber}
                          </text>
                          <text
                            x={hx}
                            y={hy + 0.55}
                            textAnchor="middle"
                            fontSize="0.24"
                            fontWeight="bold"
                            fontFamily="JetBrains Mono, monospace"
                            fill={palette.orificeText}
                          >
                            ø{hole.diameterMm}mm
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              <g
                id="asd-detector-unit"
                transform={`translate(${toSvgX(detX)}, ${toSvgY(detY)}) rotate(${detAngle})`}
              >
                <rect
                  x="-0.8"
                  y="-0.5"
                  width="1.6"
                  height="1.0"
                  fill={palette.asdBody}
                  stroke={palette.asdBodyStroke}
                  strokeWidth="0.08"
                  rx="0.15"
                />
                <rect
                  x="-0.7"
                  y="-0.4"
                  width="1.4"
                  height="0.8"
                  fill={palette.asdFace}
                  stroke={palette.asdFaceStroke}
                  strokeWidth="0.04"
                  rx="0.1"
                />
                <circle cx="-0.4" cy="-0.1" r="0.08" fill="#10b981" />
                <circle cx="-0.15" cy="-0.1" r="0.08" fill="#3b82f6" />
                <circle cx="0.1" cy="-0.1" r="0.08" fill="#f59e0b" />
                <circle cx="0.35" cy="-0.1" r="0.08" fill="#ef4444" />
                <rect x="-0.4" y="0.1" width="0.8" height="0.12" fill="#0284c7" rx="0.02" />
                <text
                  x="0"
                  y="0.32"
                  textAnchor="middle"
                  fontSize="0.16"
                  fontWeight="800"
                  fill={palette.asdText}
                >
                  {t('plan.asdUnit')}
                </text>
              </g>

              <g
                fontSize="0.45"
                fontWeight="bold"
                fontFamily="JetBrains Mono, monospace"
                fill={palette.wallText}
              >
                <text x={padding + params.length / 2} y={padding - 0.4} textAnchor="middle">
                  {t('plan.northWall')}
                </text>
                <text
                  x={padding + params.length / 2}
                  y={padding + params.width + 0.8}
                  textAnchor="middle"
                >
                  {t('plan.southWall')}
                </text>
                <text x={padding - 0.4} y={padding + params.width / 2} textAnchor="end">
                  {t('plan.westWall')}
                </text>
                <text
                  x={padding + params.length + 0.4}
                  y={padding + params.width / 2}
                  textAnchor="start"
                >
                  {t('plan.eastWall')}
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* Inspection bar */}
        <div className="glass px-4 py-2.5 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs">
          {hoveredHole ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-2 animate-fadeIn">
              <span className="flex items-center gap-1.5 font-bold text-info">
                <Info className="w-3.5 h-3.5" />
                {t('plan.holeTitle', {
                  n: hoveredHole.holeNumber,
                  pipe: hoveredHole.pipeName,
                })}
              </span>
              <span>
                {t('plan.coord')}:{' '}
                <strong className="text-ink font-mono">
                  X {n(hoveredHole.x, 2)} m · Y {n(hoveredHole.y, 2)} m
                </strong>
              </span>
              <span>
                {t('plan.pipeDistance')}:{' '}
                <strong className="text-ink font-mono">
                  {n(hoveredHole.distanceAlongPipe, 1)} m
                </strong>
              </span>
              <span>
                {t('plan.orifice')}:{' '}
                <strong className="text-warn font-mono">
                  ø {n(hoveredHole.diameterMm, 1)} mm
                </strong>
              </span>
              <span>
                {t('plan.suction')}:{' '}
                <strong className="text-ok font-mono">{n(hoveredHole.suctionPressurePa)} Pa</strong>
              </span>
              <span>
                {t('plan.flow')}:{' '}
                <strong className="text-info font-mono">
                  {n(hoveredHole.estimatedFlowRateLpm, 1)} L/min
                </strong>
              </span>
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-ink-3">
              <Info className="w-3.5 h-3.5 text-brand" />
              {t('plan.hint')}
            </span>
          )}

          <div className="flex items-center gap-3 text-[11px] text-ink-3 ml-auto">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-brand rounded" />
              {t('plan.legendPipe')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-brand bg-surface" />
              {t('plan.legendHole')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand/20 border border-brand/40" />
              {t('plan.legendCoverage')}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

FloorPlanCanvas.displayName = 'FloorPlanCanvas';
