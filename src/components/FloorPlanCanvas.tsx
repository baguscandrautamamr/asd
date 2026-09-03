import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { CalculationParams, CalculationResults, HoleScheduleItem } from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
  Sliders,
} from 'lucide-react';

export interface FloorPlanCanvasRef {
  getCanvasImageBase64: () => Promise<string | undefined>;
}

interface FloorPlanCanvasProps {
  params: CalculationParams;
  results: CalculationResults;
  onUpdateParams?: (partial: Partial<CalculationParams>) => void;
}

export const FloorPlanCanvas = forwardRef<FloorPlanCanvasRef, FloorPlanCanvasProps>(
  ({ params, results, onUpdateParams }, ref) => {
    const [zoom, setZoom] = useState(1);
    const [showCoverage, setShowCoverage] = useState(true);
    const [showHoleLabels, setShowHoleLabels] = useState(true);
    const [showDimensions, setShowDimensions] = useState(true);
    const [showRacks, setShowRacks] = useState(
      params.roomType === 'data_center' || params.roomType === 'telecom'
    );
    const [hoveredHole, setHoveredHole] = useState<HoleScheduleItem | null>(null);

    const svgRef = useRef<SVGSVGElement>(null);

    // Export SVG as Image for PDF
    useImperativeHandle(ref, () => ({
      getCanvasImageBase64: async () => {
        if (!svgRef.current) return undefined;
        try {
          const svgElement = svgRef.current;
          const svgString = new XMLSerializer().serializeToString(svgElement);
          const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
          const blobURL = window.URL.createObjectURL(svgBlob);

          return new Promise<string>((resolve) => {
            const image = new Image();
            image.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 1200;
              canvas.height = 700;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#ffffff';
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

    // Sizing & Scaling coordinates
    // We reserve space for dimensions and labels: viewBox padding
    const padding = 5; // meters
    const viewWidth = params.length + padding * 2;
    const viewHeight = params.width + padding * 2;

    // Transform room coordinates (x: 0..length, y: 0..width) to SVG coordinates
    const toSvgX = (x: number) => padding + x;
    const toSvgY = (y: number) => padding + y;

    // ASD Detector Position
    const detOffset = Math.max(0.1, Math.min(0.9, params.detectorLocation?.positionOffsetRatio ?? 0.5));
    let detX = 0;
    let detY = 0;
    let detAngle = 0;

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
      case 'west':
      default:
        detX = 0.2;
        detY = params.width * detOffset;
        detAngle = 90;
        break;
    }

    // Generate grid lines
    const gridLinesX = [];
    for (let x = 0; x <= params.length; x += 2) {
      gridLinesX.push(x);
    }
    const gridLinesY = [];
    for (let y = 0; y <= params.width; y += 2) {
      gridLinesY.push(y);
    }

    // Mock server racks for Data Center view
    const racks = [];
    if (showRacks && (params.roomType === 'data_center' || params.roomType === 'telecom')) {
      const rackRows = Math.max(2, Math.floor(params.width / 4));
      const racksPerRow = Math.max(3, Math.floor(params.length / 3.5));
      for (let r = 0; r < rackRows; r++) {
        const ry = (r + 0.6) * (params.width / rackRows);
        for (let c = 0; c < racksPerRow; c++) {
          const rx = 2.5 + c * 3.2;
          if (rx + 2.4 < params.length) {
            racks.push({ x: rx, y: ry, w: 2.4, h: 0.9 });
          }
        }
      }
    }

    return (
      <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col shadow-inner select-none">
        {/* Top Floating Toolbar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Left: Mode Indicators */}
          <div className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/60 shadow-lg pointer-events-auto">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse mr-1.5"></span>
              25mm CPVC Network
            </span>
            <span className="text-xs text-slate-400 px-1 font-mono">
              {params.length}m × {params.width}m ({results.roomAreaM2} m²)
            </span>
          </div>

          {/* Right: Layer Toggles & Zoom */}
          <div className="flex items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-lg border border-slate-700/60 shadow-lg pointer-events-auto">
            <button
              onClick={() => setShowCoverage(!showCoverage)}
              className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-colors ${
                showCoverage
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle NFPA 72 Sampling Coverage Radius"
            >
              <Layers className="w-3.5 h-3.5" />
              Coverage
            </button>

            <button
              onClick={() => setShowHoleLabels(!showHoleLabels)}
              className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-colors ${
                showHoleLabels
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle Hole Numbering & Orifice Sizes"
            >
              <Eye className="w-3.5 h-3.5" />
              Holes
            </button>

            <button
              onClick={() => setShowDimensions(!showDimensions)}
              className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-colors ${
                showDimensions
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle Dimensions & Distance Markers"
            >
              <Sliders className="w-3.5 h-3.5" />
              Dim
            </button>

            {(params.roomType === 'data_center' || params.roomType === 'telecom') && (
              <button
                onClick={() => setShowRacks(!showRacks)}
                className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-colors ${
                  showRacks
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Toggle Server Rack Footprints"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Racks
              </button>
            )}

            <div className="w-[1px] h-5 bg-slate-800 mx-1" />

            <button
              onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono text-slate-400 min-w-[2.5rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.2, Math.round((z + 0.15) * 100) / 100))}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* SVG Canvas Area */}
        <div className="flex-1 w-full h-full overflow-auto flex items-center justify-center p-4">
          <div
            className="transition-transform duration-200 origin-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewWidth} ${viewHeight}`}
              className="w-[880px] h-[550px] drop-shadow-2xl"
              style={{ background: '#0b1324' }}
            >
              <defs>
                {/* Subtle room grid pattern */}
                <pattern
                  id="meter-grid"
                  width="1"
                  height="1"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 1 0 L 0 0 0 1"
                    fill="none"
                    stroke="rgba(51, 65, 85, 0.4)"
                    strokeWidth="0.04"
                  />
                </pattern>

                {/* Pipe glow filter */}
                <filter id="pipe-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="0.2" floodColor="#f43f5e" floodOpacity="0.4" />
                </filter>

                {/* Arrow marker for pipe flow direction */}
                <marker
                  id="arrow-flow"
                  viewBox="0 0 10 10"
                  refX="5"
                  refY="5"
                  markerWidth="3"
                  markerHeight="3"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#f43f5e" opacity="0.9" />
                </marker>
              </defs>

              {/* Room Background & Grid */}
              <rect
                x={padding}
                y={padding}
                width={params.length}
                height={params.width}
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="0.15"
              />

              {/* Grid pattern over room */}
              <rect
                x={padding}
                y={padding}
                width={params.length}
                height={params.width}
                fill="url(#meter-grid)"
              />

              {/* Server Racks / Equipment Footprints (if enabled) */}
              {racks.map((rack, i) => (
                <g key={`rack-${i}`}>
                  <rect
                    x={toSvgX(rack.x)}
                    y={toSvgY(rack.y)}
                    width={rack.w}
                    height={rack.h}
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth="0.06"
                    rx="0.1"
                  />
                  <line
                    x1={toSvgX(rack.x + 0.2)}
                    y1={toSvgY(rack.y + rack.h / 2)}
                    x2={toSvgX(rack.x + rack.w - 0.2)}
                    y2={toSvgY(rack.y + rack.h / 2)}
                    stroke="#334155"
                    strokeWidth="0.04"
                    strokeDasharray="0.1, 0.1"
                  />
                </g>
              ))}

              {/* Room Dimensions & Scale Markers */}
              {showDimensions && (
                <g className="font-mono text-[0.45px] fill-slate-400">
                  {/* Top length dimension line */}
                  <line
                    x1={padding}
                    y1={padding - 1.2}
                    x2={padding + params.length}
                    y2={padding - 1.2}
                    stroke="#64748b"
                    strokeWidth="0.06"
                  />
                  <line
                    x1={padding}
                    y1={padding - 1.6}
                    x2={padding}
                    y2={padding - 0.8}
                    stroke="#64748b"
                    strokeWidth="0.06"
                  />
                  <line
                    x1={padding + params.length}
                    y1={padding - 1.6}
                    x2={padding + params.length}
                    y2={padding - 0.8}
                    stroke="#64748b"
                    strokeWidth="0.06"
                  />
                  <rect
                    x={padding + params.length / 2 - 1.2}
                    y={padding - 1.6}
                    width="2.4"
                    height="0.8"
                    fill="#0b1324"
                    rx="0.15"
                  />
                  <text
                    x={padding + params.length / 2}
                    y={padding - 1.05}
                    textAnchor="middle"
                    fontWeight="bold"
                    fill="#cbd5e1"
                  >
                    LENGTH: {params.length} m
                  </text>

                  {/* Left width dimension line */}
                  <line
                    x1={padding - 1.2}
                    y1={padding}
                    x2={padding - 1.2}
                    y2={padding + params.width}
                    stroke="#64748b"
                    strokeWidth="0.06"
                  />
                  <line
                    x1={padding - 1.6}
                    y1={padding}
                    x2={padding - 0.8}
                    y2={padding}
                    stroke="#64748b"
                    strokeWidth="0.06"
                  />
                  <line
                    x1={padding - 1.6}
                    y1={padding + params.width}
                    x2={padding - 0.8}
                    y2={padding + params.width}
                    stroke="#64748b"
                    strokeWidth="0.06"
                  />
                  <rect
                    x={padding - 1.8}
                    y={padding + params.width / 2 - 0.4}
                    width="2.4"
                    height="0.8"
                    fill="#0b1324"
                    rx="0.15"
                    transform={`rotate(-90 ${padding - 1.2} ${padding + params.width / 2})`}
                  />
                  <text
                    x={padding - 1.2}
                    y={padding + params.width / 2 + 0.15}
                    textAnchor="middle"
                    fontWeight="bold"
                    fill="#cbd5e1"
                    transform={`rotate(-90 ${padding - 1.2} ${padding + params.width / 2})`}
                  >
                    WIDTH: {params.width} m
                  </text>
                </g>
              )}

              {/* NFPA 72 Coverage Circles (semi-transparent overlay) */}
              {showCoverage && (
                <g id="coverage-layer">
                  {results.holes.map((hole) => (
                    <circle
                      key={`cov-${hole.id}`}
                      cx={toSvgX(hole.x)}
                      cy={toSvgY(hole.y)}
                      r={hole.coverageRadiusM}
                      fill="rgba(244, 63, 94, 0.08)"
                      stroke="rgba(244, 63, 94, 0.28)"
                      strokeWidth="0.05"
                      strokeDasharray="0.3, 0.2"
                    />
                  ))}
                </g>
              )}

              {/* Main Pipe Branches & Manifolds */}
              <g id="pipe-network">
                {results.branches.map((branch) => (
                  <g key={`branch-${branch.pipeIndex}`}>
                    {/* Glow outline */}
                    {branch.segments.map((seg, sIdx) => (
                      <line
                        key={`glow-${branch.pipeIndex}-${sIdx}`}
                        x1={toSvgX(seg.from.x)}
                        y1={toSvgY(seg.from.y)}
                        x2={toSvgX(seg.to.x)}
                        y2={toSvgY(seg.to.y)}
                        stroke="#f43f5e"
                        strokeWidth="0.28"
                        strokeLinecap="round"
                        filter="url(#pipe-glow)"
                      />
                    ))}

                    {/* Solid CPVC Fire Alarm Pipe */}
                    {branch.segments.map((seg, sIdx) => (
                      <line
                        key={`pipe-${branch.pipeIndex}-${sIdx}`}
                        x1={toSvgX(seg.from.x)}
                        y1={toSvgY(seg.from.y)}
                        x2={toSvgX(seg.to.x)}
                        y2={toSvgY(seg.to.y)}
                        stroke="#e11d48"
                        strokeWidth="0.14"
                        strokeLinecap="round"
                      />
                    ))}

                    {/* Pipe Flow Direction Markers */}
                    {branch.segments.map((seg, sIdx) => {
                      const mx = (seg.from.x + seg.to.x) / 2;
                      const my = (seg.from.y + seg.to.y) / 2;
                      // Flow is towards detector (reverse of pipe run)
                      return (
                        <line
                          key={`flow-${branch.pipeIndex}-${sIdx}`}
                          x1={toSvgX(seg.to.x)}
                          y1={toSvgY(seg.to.y)}
                          x2={toSvgX(mx)}
                          y2={toSvgY(my)}
                          stroke="transparent"
                          markerEnd="url(#arrow-flow)"
                        />
                      );
                    })}

                    {/* End Cap Marker */}
                    <circle
                      cx={toSvgX(branch.endPoint.x)}
                      cy={toSvgY(branch.endPoint.y)}
                      r="0.2"
                      fill="#be123c"
                      stroke="#ffe4e6"
                      strokeWidth="0.05"
                    />
                    <text
                      x={toSvgX(branch.endPoint.x)}
                      y={toSvgY(branch.endPoint.y) + 0.45}
                      textAnchor="middle"
                      className="font-mono text-[0.32px] fill-rose-300 font-bold"
                    >
                      END CAP
                    </text>

                    {/* Branch Name Label */}
                    <text
                      x={toSvgX(branch.startPoint.x + (branch.endPoint.x - branch.startPoint.x) * 0.15)}
                      y={toSvgY(branch.startPoint.y) - 0.3}
                      className="font-mono text-[0.35px] font-bold fill-rose-300"
                    >
                      {branch.pipeName} ({branch.lengthMeters}m)
                    </text>
                  </g>
                ))}
              </g>

              {/* Sampling Holes */}
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
                      {/* Interactive hit area */}
                      <circle cx={hx} cy={hy} r="0.6" fill="transparent" />

                      {/* Outer pulse if hovered */}
                      {isHovered && (
                        <circle
                          cx={hx}
                          cy={hy}
                          r="0.45"
                          fill="rgba(56, 189, 248, 0.25)"
                          stroke="#38bdf8"
                          strokeWidth="0.05"
                          className="animate-ping"
                        />
                      )}

                      {/* Sampling Hole Node */}
                      <circle
                        cx={hx}
                        cy={hy}
                        r={0.16 + (hole.diameterMm / 1000) * 15}
                        fill={isHovered ? '#38bdf8' : '#ffffff'}
                        stroke="#e11d48"
                        strokeWidth="0.06"
                      />

                      {/* Hole Label */}
                      {showHoleLabels && (
                        <g>
                          <rect
                            x={hx - 0.45}
                            y={hy - 0.7}
                            width="0.9"
                            height="0.4"
                            fill="#0f172a"
                            stroke="#334155"
                            strokeWidth="0.03"
                            rx="0.08"
                          />
                          <text
                            x={hx}
                            y={hy - 0.42}
                            textAnchor="middle"
                            className="font-mono text-[0.26px] font-bold fill-white"
                          >
                            #{hole.holeNumber}
                          </text>

                          {/* Orifice Diameter Tag */}
                          <text
                            x={hx}
                            y={hy + 0.55}
                            textAnchor="middle"
                            className="font-mono text-[0.24px] font-bold fill-amber-300"
                          >
                            ø{hole.diameterMm}mm
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* ASD Detector Unit Graphic on the designated wall */}
              <g
                id="asd-detector-unit"
                transform={`translate(${toSvgX(detX)}, ${toSvgY(detY)}) rotate(${detAngle})`}
                className="cursor-pointer"
                title={`ASD Unit (${params.detectorModel})`}
              >
                {/* Wall mounting base */}
                <rect
                  x="-0.8"
                  y="-0.5"
                  width="1.6"
                  height="1.0"
                  fill="#1e293b"
                  stroke="#e2e8f0"
                  strokeWidth="0.08"
                  rx="0.15"
                />
                {/* Front Faceplate */}
                <rect
                  x="-0.7"
                  y="-0.4"
                  width="1.4"
                  height="0.8"
                  fill="#0f172a"
                  stroke="#94a3b8"
                  strokeWidth="0.04"
                  rx="0.1"
                />
                {/* VESDA / ASD Status LEDs */}
                <circle cx="-0.4" cy="-0.1" r="0.08" fill="#10b981" />
                <circle cx="-0.15" cy="-0.1" r="0.08" fill="#3b82f6" />
                <circle cx="0.1" cy="-0.1" r="0.08" fill="#f59e0b" />
                <circle cx="0.35" cy="-0.1" r="0.08" fill="#ef4444" />
                {/* Bargraph display */}
                <rect x="-0.4" y="0.1" width="0.8" height="0.12" fill="#0284c7" rx="0.02" />
                {/* Detector Label */}
                <text
                  x="0"
                  y="0.32"
                  textAnchor="middle"
                  className="font-sans text-[0.16px] font-extrabold fill-slate-200"
                >
                  ASD DETECTOR
                </text>
              </g>

              {/* Wall label markers (N, S, E, W) */}
              <g className="font-mono text-[0.45px] font-bold fill-slate-500">
                <text x={padding + params.length / 2} y={padding - 0.4} textAnchor="middle">
                  NORTH WALL
                </text>
                <text x={padding + params.length / 2} y={padding + params.width + 0.8} textAnchor="middle">
                  SOUTH WALL
                </text>
                <text x={padding - 0.4} y={padding + params.width / 2} textAnchor="end">
                  WEST
                </text>
                <text x={padding + params.length + 0.4} y={padding + params.width / 2} textAnchor="start">
                  EAST
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* Bottom Status / Hole Inspection Banner */}
        <div className="bg-slate-950/90 backdrop-blur-md px-4 py-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {hoveredHole ? (
            <div className="flex items-center gap-4 text-slate-200 animate-fadeIn">
              <span className="flex items-center gap-1.5 font-semibold text-sky-400">
                <Info className="w-3.5 h-3.5" />
                Sampling Hole #{hoveredHole.holeNumber} ({hoveredHole.pipeName})
              </span>
              <span className="text-slate-400">
                Coord: <strong className="text-slate-200 font-mono">X:{hoveredHole.x}m, Y:{hoveredHole.y}m</strong>
              </span>
              <span className="text-slate-400">
                Pipe Distance: <strong className="text-slate-200 font-mono">{hoveredHole.distanceAlongPipe}m</strong>
              </span>
              <span className="text-slate-400">
                Orifice: <strong className="text-amber-300 font-mono">ø{hoveredHole.diameterMm} mm</strong>
              </span>
              <span className="text-slate-400">
                Suction Pressure: <strong className="text-emerald-400 font-mono">{hoveredHole.suctionPressurePa} Pa</strong>
              </span>
              <span className="text-slate-400">
                Flow Rate: <strong className="text-sky-300 font-mono">{hoveredHole.estimatedFlowRateLpm} L/min</strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Info className="w-3.5 h-3.5 text-rose-400" />
                Hover over any sampling hole node (circle) to inspect hydraulic pressure, flow rate, and orifice diameter.
              </span>
            </div>
          )}

          {/* Quick Legend */}
          <div className="flex items-center gap-3 text-[11px] text-slate-400 ml-auto">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-rose-500 rounded"></span>
              25mm Pipe
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-rose-500 bg-white"></span>
              Sampling Hole
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500/20 border border-rose-500/40"></span>
              NFPA 72 Coverage
            </span>
          </div>
        </div>
      </div>
    );
  }
);
