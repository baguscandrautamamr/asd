import React, {
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import {
  CalculationParams,
  CalculationResults,
  HoleScheduleItem,
  Point2D,
  WallLocation,
} from '../types';
import {
  Check,
  Eye,
  Info,
  Layers,
  Maximize2,
  Move,
  PenLine,
  RotateCcw,
  Server,
  Sliders,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { materialKey, wallKey } from '../i18n/labels';
import { detectorPosition } from '../utils/detectorPosition';

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
  draft: string;
  draftWash: string;
}

/**
 * A colour per branch. Two runs can legitimately sit on top of each other, and
 * a single red made them look like one pipe that had swallowed the other.
 */
const BRANCH_COLORS = ['#d5352f', '#1d6fa5', '#a15c07', '#7a3fa8'];

const branchColor = (index: number) => BRANCH_COLORS[index % BRANCH_COLORS.length];

/** Vertices land on a 250 mm grid, the practical tolerance for setting out
 *  pipe against a ceiling grid. */
const SNAP_M = 0.25;

const snap = (value: number) => Math.round(value / SNAP_M) * SNAP_M;

/**
 * Constrains a new vertex to be orthogonal to the previous one. Sampling pipe
 * runs along the ceiling grid, so only horizontal and vertical legs are
 * offered; the axis with the larger movement wins.
 */
function orthogonalTo(previous: Point2D | undefined, point: Point2D): Point2D {
  if (!previous) return point;
  return Math.abs(point.x - previous.x) >= Math.abs(point.y - previous.y)
    ? { x: point.x, y: previous.y }
    : { x: previous.x, y: point.y };
}

/** Single light palette; fire-alarm red stays for pipes and the ASD unit. */
const PLAN: PlanPalette = {
  page: '#f4f6f4',
  room: '#ffffff',
  roomStroke: '#8b9a8b',
  grid: 'rgba(139, 154, 139, 0.28)',
  rack: '#e6ebe6',
  rackStroke: '#9aa89a',
  rackDetail: '#c6cfc6',
  dim: '#6b7a6b',
  dimText: '#26332b',
  wallText: '#8b9a8b',
  pipe: '#d5352f',
  pipeGlow: '#e5534d',
  endCap: '#9b1f1a',
  endCapStroke: '#ffffff',
  branchText: '#9b1f1a',
  hole: '#ffffff',
  holeHover: '#4f8221',
  holeStroke: '#d5352f',
  labelBg: '#ffffff',
  labelStroke: '#ccd4cc',
  labelText: '#14201a',
  orificeText: '#a15c07',
  coverageFill: 'rgba(79, 130, 33, 0.09)',
  coverageStroke: 'rgba(79, 130, 33, 0.42)',
  asdBody: '#cfd7cf',
  asdBodyStroke: '#26332b',
  asdFace: '#f8faf8',
  asdFaceStroke: '#6b7a6b',
  asdText: '#14201a',
  draft: '#4f8221',
  draftWash: 'rgba(79, 130, 33, 0.05)',
};

export const FloorPlanCanvas = forwardRef<FloorPlanCanvasRef, FloorPlanCanvasProps>(
  ({ params, results, onUpdateParams }, ref) => {
    const { t, n } = useI18n();
    const palette = PLAN;

    const [zoom, setZoom] = useState(1);
    const [showCoverage, setShowCoverage] = useState(true);
    const [showHoleLabels, setShowHoleLabels] = useState(true);
    const [showDimensions, setShowDimensions] = useState(true);
    const [showRacks, setShowRacks] = useState(
      params.roomType === 'data_center' || params.roomType === 'telecom'
    );
    const [hoveredHole, setHoveredHole] = useState<HoleScheduleItem | null>(null);

    // Manual pipe routing: the operator draws the sampling run for one branch
    // at a time; the manifold back to the detector stays automatic.
    const [drawBranch, setDrawBranch] = useState<number | null>(null);
    const [draft, setDraft] = useState<Point2D[]>([]);
    const [cursor, setCursor] = useState<Point2D | null>(null);
    const [draggingDetector, setDraggingDetector] = useState(false);
    // The pointer emits moves faster than React re-renders, so the drag flag
    // has to be readable synchronously or most of the movement is dropped.
    const draggingRef = useRef(false);

    const svgRef = useRef<SVGSVGElement>(null);
    const isDrawing = drawBranch !== null;

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

    const commitDraft = useCallback(
      (points: Point2D[]) => {
        if (drawBranch === null || !onUpdateParams) return;
        const routes = { ...(params.customRoutes ?? {}) };
        if (points.length >= 2) {
          routes[String(drawBranch)] = points;
        } else {
          delete routes[String(drawBranch)];
        }
        onUpdateParams({ customRoutes: routes });
        setDrawBranch(null);
        setDraft([]);
        setCursor(null);
      },
      [drawBranch, onUpdateParams, params.customRoutes]
    );

    const cancelDraft = useCallback(() => {
      setDrawBranch(null);
      setDraft([]);
      setCursor(null);
    }, []);

    const updateBranch = useCallback(
      (index: number, patch: { portsEnabled?: boolean; holeSpacingM?: number }) => {
        if (!onUpdateParams) return;
        const settings = { ...(params.branchSettings ?? {}) };
        settings[String(index)] = { ...settings[String(index)], ...patch };
        onUpdateParams({ branchSettings: settings });
      },
      [onUpdateParams, params.branchSettings]
    );

    const clearRoute = useCallback(
      (index: number) => {
        if (!onUpdateParams) return;
        const routes = { ...(params.customRoutes ?? {}) };
        delete routes[String(index)];
        onUpdateParams({ customRoutes: routes });
      },
      [onUpdateParams, params.customRoutes]
    );

    // Keyboard is the fastest way out of a drawing: Enter commits, Escape
    // abandons, Backspace removes the last vertex.
    useEffect(() => {
      if (!isDrawing) return;
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelDraft();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (draft.length >= 2) commitDraft(draft);
        } else if (event.key === 'Backspace') {
          event.preventDefault();
          setDraft((prev) => prev.slice(0, -1));
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [isDrawing, draft, commitDraft, cancelDraft]);

    const padding = 5; // metres of drawing margin around the room
    const viewWidth = params.length + padding * 2;
    const viewHeight = params.width + padding * 2;
    const toSvgX = (x: number) => padding + x;
    const toSvgY = (y: number) => padding + y;

    const toRoom = useCallback(
      (event: React.MouseEvent): Point2D | null => {
        const svg = svgRef.current;
        const ctm = svg?.getScreenCTM();
        if (!svg || !ctm) return null;
        const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
        return {
          x: Math.min(params.length, Math.max(0, snap(local.x - padding))),
          y: Math.min(params.width, Math.max(0, snap(local.y - padding))),
        };
      },
      [params.length, params.width]
    );

    const handlePlanMove = (event: React.MouseEvent) => {
      if (draggingRef.current) {
        const point = toRoom(event);
        if (point) placeDetector(point);
        return;
      }
      if (!isDrawing) return;
      const point = toRoom(event);
      if (point) setCursor(orthogonalTo(draft[draft.length - 1], point));
    };

    const handlePlanClick = (event: React.MouseEvent) => {
      if (draggingRef.current) return;
      if (!isDrawing) return;
      const point = toRoom(event);
      if (!point) return;
      const next = orthogonalTo(draft[draft.length - 1], point);
      const last = draft[draft.length - 1];
      // Ignore a repeated click on the same spot.
      if (last && Math.abs(last.x - next.x) < 1e-6 && Math.abs(last.y - next.y) < 1e-6) return;
      setDraft((prev) => [...prev, next]);
    };

    const handlePlanDoubleClick = () => {
      if (isDrawing && draft.length >= 2) commitDraft(draft);
    };

    /**
     * Dropping the unit near a wall snaps it back onto that wall (how these
     * panels are actually mounted); dropped further in, it keeps the free spot.
     */
    const placeDetector = useCallback(
      (point: Point2D) => {
        if (!onUpdateParams) return;
        const SNAP_TO_WALL_M = 1.2;
        const distances: [WallLocation, number][] = [
          ['west', point.x],
          ['east', params.length - point.x],
          ['north', point.y],
          ['south', params.width - point.y],
        ];
        const [nearestWall, nearestDistance] = distances.reduce((a, b) => (a[1] <= b[1] ? a : b));

        if (nearestDistance <= SNAP_TO_WALL_M) {
          const ratio =
            nearestWall === 'west' || nearestWall === 'east'
              ? point.y / Math.max(0.1, params.width)
              : point.x / Math.max(0.1, params.length);
          onUpdateParams({
            detectorLocation: {
              ...params.detectorLocation,
              wall: nearestWall,
              positionOffsetRatio: Math.min(0.9, Math.max(0.1, Math.round(ratio * 100) / 100)),
              freePosition: null,
            },
          });
        } else {
          onUpdateParams({
            detectorLocation: { ...params.detectorLocation, freePosition: point },
          });
        }
      },
      [onUpdateParams, params.detectorLocation, params.length, params.width]
    );

    const handleDetectorDown = (event: React.MouseEvent) => {
      if (!onUpdateParams || isDrawing) return;
      event.stopPropagation();
      // Without this the drag paints a text selection across the whole page.
      event.preventDefault();
      draggingRef.current = true;
      setDraggingDetector(true);
    };

    const endDetectorDrag = useCallback(() => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDraggingDetector(false);
    }, []);

    // Releasing the button anywhere must end the drag, not just over the plan.
    useEffect(() => {
      window.addEventListener('mouseup', endDetectorDrag);
      return () => window.removeEventListener('mouseup', endDetectorDrag);
    }, [endDetectorDrag]);

    const detector = detectorPosition(params);
    const detX = detector.x;
    const detY = detector.y;
    const detAngle = detector.angleDeg;

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

            {onUpdateParams && (
              <>
                <span className="w-px h-5 bg-line-2 mx-1" />
                <button
                  type="button"
                  onClick={() => {
                    if (isDrawing) cancelDraft();
                    else {
                      setDrawBranch(0);
                      setDraft([]);
                    }
                  }}
                  className={toolButton(isDrawing)}
                  title={t('draw.hint')}
                >
                  <PenLine className="w-3.5 h-3.5" />
                  {t('draw.start')}
                </button>
              </>
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

        {isDrawing && (
          <div className="absolute top-16 left-3 right-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
            <div className="glass rounded-xl p-1 shadow-lg flex flex-wrap items-center gap-1 pointer-events-auto">
              <span className="text-2xs font-bold text-ink-3 uppercase px-1.5">
                {t('draw.branch')}
              </span>
              {results.branches.map((branch) => (
                <button
                  key={branch.pipeIndex}
                  type="button"
                  onClick={() => {
                    setDrawBranch(branch.pipeIndex);
                    setDraft([]);
                    setCursor(null);
                  }}
                  className={`px-2 py-1 text-2xs rounded-lg font-bold transition-colors ${
                    drawBranch === branch.pipeIndex
                      ? 'bg-brand text-white'
                      : 'text-ink-2 hover:bg-surface-3'
                  }`}
                >
                  {String.fromCharCode(65 + branch.pipeIndex)}
                  {branch.isCustomRoute && <span className="ml-1 opacity-70">*</span>}
                </button>
              ))}

              <span className="w-px h-4 bg-line-2 mx-0.5" />

              <span className="text-2xs font-mono text-ink-3 px-1">
                {t('draw.points', { n: draft.length })}
              </span>

              <button
                type="button"
                onClick={() => setDraft((prev) => prev.slice(0, -1))}
                disabled={draft.length === 0}
                title={t('draw.undo')}
                className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-3 disabled:opacity-40 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => drawBranch !== null && clearRoute(drawBranch)}
                title={t('draw.reset')}
                className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-3 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={cancelDraft}
                title={t('draw.cancel')}
                className="p-1.5 rounded-lg text-ink-3 hover:text-bad hover:bg-surface-3 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => commitDraft(draft)}
                disabled={draft.length < 2}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold bg-brand hover:bg-brand-ink text-white disabled:opacity-40 transition-colors"
              >
                <Check className="w-3 h-3" />
                {t('draw.finish')}
              </button>
            </div>

            <span className="glass rounded-lg px-2.5 py-1 text-2xs text-ink-2 shadow pointer-events-auto">
              {draft.length < 2 ? t('draw.needTwo') : t('draw.hint')}
            </span>
          </div>
        )}

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
              className={`w-[880px] h-[550px] drop-shadow-2xl ${
                isDrawing ? 'cursor-crosshair' : ''
              }`}
              style={{ background: palette.page }}
              onMouseMove={handlePlanMove}
              onMouseUp={endDetectorDrag}
              onClick={handlePlanClick}
              onDoubleClick={handlePlanDoubleClick}
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
                        stroke={branchColor(branch.pipeIndex)}
                        strokeWidth="0.26"
                        strokeLinecap="round"
                        opacity="0.25"
                      />
                    ))}

                    {branch.segments.map((seg, sIdx) => (
                      <line
                        key={`pipe-${branch.pipeIndex}-${sIdx}`}
                        x1={toSvgX(seg.from.x)}
                        y1={toSvgY(seg.from.y)}
                        x2={toSvgX(seg.to.x)}
                        y2={toSvgY(seg.to.y)}
                        stroke={branchColor(branch.pipeIndex)}
                        strokeWidth="0.14"
                        strokeLinecap="round"
                        strokeDasharray={branch.portsEnabled ? undefined : '0.45, 0.3'}
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
                      fill={branchColor(branch.pipeIndex)}
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
                      fill={branchColor(branch.pipeIndex)}
                    >
                      {t('plan.endCap')}
                    </text>

                    <text
                      x={toSvgX(
                        branch.startPoint.x + (branch.endPoint.x - branch.startPoint.x) * 0.15
                      )}
                      y={toSvgY(branch.startPoint.y) - 0.95 - branch.pipeIndex * 0.45}
                      fontSize="0.35"
                      fontWeight="bold"
                      fontFamily="JetBrains Mono, monospace"
                      fill={branchColor(branch.pipeIndex)}
                    >
                      {branch.pipeName} ({n(branch.lengthMeters, 1)}m)
                      {!branch.portsEnabled && ` · ${t('branch.noPorts')}`}
                    </text>
                  </g>
                ))}
              </g>

              <g id="sampling-holes" style={isDrawing ? { pointerEvents: 'none' } : undefined}>
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
                        stroke={branchColor(hole.pipeIndex)}
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
                onMouseDown={handleDetectorDown}
                style={{ cursor: onUpdateParams && !isDrawing ? 'grab' : undefined }}
              >
                <title>{t('detector.drag')}</title>
                {draggingDetector && (
                  <rect
                    x="-1"
                    y="-0.7"
                    width="2"
                    height="1.4"
                    fill="none"
                    stroke={palette.draft}
                    strokeWidth="0.08"
                    strokeDasharray="0.2, 0.15"
                    rx="0.2"
                  />
                )}
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

              {isDrawing && (
                <g id="draw-layer" style={{ pointerEvents: 'none' }}>
                  {/* Snap grid, so the operator can see where vertices land. */}
                  <rect
                    x={padding}
                    y={padding}
                    width={params.length}
                    height={params.width}
                    fill={palette.draftWash}
                  />

                  {draft.length > 0 && (
                    <polyline
                      points={draft.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ')}
                      fill="none"
                      stroke={palette.draft}
                      strokeWidth="0.16"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {draft.length > 0 && cursor && (
                    <line
                      x1={toSvgX(draft[draft.length - 1].x)}
                      y1={toSvgY(draft[draft.length - 1].y)}
                      x2={toSvgX(cursor.x)}
                      y2={toSvgY(cursor.y)}
                      stroke={palette.draft}
                      strokeWidth="0.12"
                      strokeDasharray="0.3, 0.2"
                      strokeLinecap="round"
                    />
                  )}

                  {draft.map((point, index) => (
                    <circle
                      key={`draft-${index}`}
                      cx={toSvgX(point.x)}
                      cy={toSvgY(point.y)}
                      r="0.18"
                      fill={index === 0 ? palette.draft : palette.room}
                      stroke={palette.draft}
                      strokeWidth="0.07"
                    />
                  ))}

                  {cursor && (
                    <g>
                      <circle
                        cx={toSvgX(cursor.x)}
                        cy={toSvgY(cursor.y)}
                        r="0.12"
                        fill={palette.draft}
                      />
                      <text
                        x={toSvgX(cursor.x) + 0.35}
                        y={toSvgY(cursor.y) - 0.3}
                        fontSize="0.34"
                        fontFamily="JetBrains Mono, monospace"
                        fill={palette.draft}
                        fontWeight="bold"
                      >
                        {cursor.x.toFixed(2)} , {cursor.y.toFixed(2)}
                      </text>
                    </g>
                  )}
                </g>
              )}

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

        {/* Per-branch port control: which pipe carries ports, and how far
            apart they sit on that pipe. */}
        {onUpdateParams && (
          <div id="branch-panel" className="border-t border-line bg-surface-2 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="text-2xs font-bold uppercase tracking-wide text-ink-2">
                {t('branch.title')}
              </span>
              <span className="text-2xs text-ink-3 truncate">{t('branch.subtitle')}</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {results.branches.map((branch) => {
                const setting = params.branchSettings?.[String(branch.pipeIndex)];
                const spacing = setting?.holeSpacingM ?? 0;
                return (
                  <div
                    key={branch.pipeIndex}
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: branchColor(branch.pipeIndex) }}
                    />
                    <span className="text-2xs font-bold text-ink font-mono">
                      {branch.pipeName.replace('Pipe ', '')}
                    </span>

                    <label
                      className="flex items-center gap-1 cursor-pointer"
                      title={branch.portsEnabled ? t('branch.portsOn') : t('branch.portsOff')}
                    >
                      <input
                        type="checkbox"
                        checked={branch.portsEnabled}
                        onChange={(e) =>
                          updateBranch(branch.pipeIndex, { portsEnabled: e.target.checked })
                        }
                        className="w-3.5 h-3.5 rounded accent-brand"
                      />
                      <span className="text-2xs text-ink-2">{t('branch.ports')}</span>
                    </label>

                    <label className="flex items-center gap-1" title={t('branch.spacingHint')}>
                      <span className="text-2xs text-ink-3">{t('branch.spacing')}</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        value={spacing}
                        disabled={!branch.portsEnabled}
                        onChange={(e) =>
                          updateBranch(branch.pipeIndex, {
                            holeSpacingM: Math.min(20, Math.max(0, parseFloat(e.target.value) || 0)),
                          })
                        }
                        className="field w-14 px-1 py-0.5 text-2xs text-center font-mono"
                      />
                    </label>

                    <span className="text-2xs text-ink-3 font-mono whitespace-nowrap">
                      {branch.portsEnabled
                        ? t('branch.summary', {
                            holes: branch.holeCount,
                            length: n(branch.lengthMeters, 1),
                          })
                        : t('branch.noPorts')}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setDrawBranch(branch.pipeIndex);
                        setDraft([]);
                        setCursor(null);
                      }}
                      title={t('branch.draw')}
                      className={`p-1 rounded transition-colors ${
                        drawBranch === branch.pipeIndex
                          ? 'bg-brand text-white'
                          : 'text-ink-3 hover:text-ink hover:bg-surface-3'
                      }`}
                    >
                      <PenLine className="w-3 h-3" />
                    </button>

                    {branch.isCustomRoute && (
                      <button
                        type="button"
                        onClick={() => clearRoute(branch.pipeIndex)}
                        title={t('branch.resetRoute')}
                        className="p-1 rounded text-brand-ink hover:bg-surface-3 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            {onUpdateParams && (
              <span className="flex items-center gap-1">
                <Move className="w-3 h-3" />
                {detector.isFree
                  ? t('detector.free')
                  : t('detector.snapped', { wall: t(wallKey[params.detectorLocation.wall]) })}
              </span>
            )}
            {results.branches.some((branch) => branch.isCustomRoute) && (
              <span className="flex items-center gap-1 text-brand-ink font-semibold">
                <PenLine className="w-3 h-3" />
                {t('draw.custom', {
                  list: results.branches
                    .filter((branch) => branch.isCustomRoute)
                    .map((branch) => String.fromCharCode(65 + branch.pipeIndex))
                    .join(', '),
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
);

FloorPlanCanvas.displayName = 'FloorPlanCanvas';
