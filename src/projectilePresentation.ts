export interface ProjectilePoint {
  x: number;
  y: number;
}

type IsoProjector = (x: number, y: number, z?: number) => ProjectilePoint;

const ARROW_SOURCE_HEADING = -Math.PI / 4;

export const getScreenTravelHeading = (
  iso: ProjectilePoint,
  velocity: ProjectilePoint,
  project: IsoProjector,
) => {
  const start = project(iso.x, iso.y, 24);
  const ahead = project(iso.x + velocity.x, iso.y + velocity.y, 24);
  return Math.atan2(ahead.y - start.y, ahead.x - start.x);
};

export const getDirectionalProjectileRotation = (
  type: string,
  iso: ProjectilePoint,
  velocity: ProjectilePoint,
  project: IsoProjector,
) => {
  if (type !== 'arrow') {
    return null;
  }
  return getScreenTravelHeading(iso, velocity, project) - ARROW_SOURCE_HEADING;
};
