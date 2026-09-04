import { CalculationParams, Point2D } from '../types';

export interface DetectorPlacement extends Point2D {
  /** Rotation of the unit graphic, degrees clockwise from north. */
  angleDeg: number;
  /** True when the unit was dragged off the wall and given a free position. */
  isFree: boolean;
}

/**
 * Where the ASD unit sits, in room coordinates.
 *
 * The calculator, the 2D plan and the 3D model all read this. When each of them
 * derived the position separately, dragging the unit moved the pipework but
 * left the drawn unit stuck on its wall.
 */
export function detectorPosition(params: CalculationParams): DetectorPlacement {
  const location = params.detectorLocation;
  const free = location?.freePosition;

  if (free) {
    return {
      x: Math.min(params.length, Math.max(0, free.x)),
      y: Math.min(params.width, Math.max(0, free.y)),
      angleDeg: 0,
      isFree: true,
    };
  }

  const offset = Math.max(0.1, Math.min(0.9, location?.positionOffsetRatio ?? 0.5));

  switch (location?.wall || 'west') {
    case 'north':
      return { x: params.length * offset, y: 0.4, angleDeg: 180, isFree: false };
    case 'south':
      return { x: params.length * offset, y: params.width - 0.4, angleDeg: 0, isFree: false };
    case 'east':
      return { x: params.length - 0.4, y: params.width * offset, angleDeg: 270, isFree: false };
    case 'west':
    default:
      return { x: 0.4, y: params.width * offset, angleDeg: 90, isFree: false };
  }
}
