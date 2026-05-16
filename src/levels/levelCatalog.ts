import { DEFAULT_VILLAGE_LEVEL } from './defaultVillageLevel';
import type { LevelConfig } from './levelTypes';
import { isTimeOfDay } from './timeOfDay';

export interface LevelCatalogEntry {
  id: string;
  label: string;
  config: LevelConfig;
}

export interface LevelSelection {
  id: string;
  label: string;
  config: LevelConfig;
  warnings: string[];
}

export const DEFAULT_LEVEL_ID = 'village-crossroads';

const FESTIVAL_VILLAGE_LEVEL: LevelConfig = {
  ...DEFAULT_VILLAGE_LEVEL,
  seed: 'festival-village-001',
  timeOfDay: 'afternoon',
  decorationDensity: 0.52,
  difficulty: 2,
};

export const LEVEL_CATALOG: Record<string, LevelCatalogEntry> = {
  [DEFAULT_LEVEL_ID]: {
    id: DEFAULT_LEVEL_ID,
    label: 'Village Crossroads',
    config: DEFAULT_VILLAGE_LEVEL,
  },
  'festival-village': {
    id: 'festival-village',
    label: 'Festival Village',
    config: FESTIVAL_VILLAGE_LEVEL,
  },
};

const cloneLevelConfig = (config: LevelConfig): LevelConfig => ({
  ...config,
  matrix: config.matrix.map((row) => [...row]),
});

const clampNumberParam = (value: string | null, fallback: number, min: number, max: number) => {
  if (value === null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

export const getGeneratedLevelIdFromParams = (params: URLSearchParams) => {
  const raw = params.get('generatedLevel');
  if (!raw || raw === '1' || raw === 'true') {
    return DEFAULT_LEVEL_ID;
  }
  return raw;
};

export const shouldRenderGeneratedLevelFromParams = (params: URLSearchParams) => {
  const explicitStaticMap = params.has('staticMap')
    || params.has('paintedMap')
    || params.has('legacyMap');
  if (explicitStaticMap) {
    return false;
  }
  const raw = params.get('generatedLevel');
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'static';
};

export const resolveLevelConfigFromParams = (params: URLSearchParams): LevelSelection => {
  const requestedId = getGeneratedLevelIdFromParams(params);
  const requestedEntry = LEVEL_CATALOG[requestedId];
  const warnings: string[] = [];
  const entry = requestedEntry ?? LEVEL_CATALOG[DEFAULT_LEVEL_ID];
  if (!requestedEntry) {
    warnings.push(`Unknown generated level "${requestedId}"; using ${DEFAULT_LEVEL_ID}.`);
  }

  const config = cloneLevelConfig(entry.config);
  const seed = params.get('seed') ?? params.get('levelSeed');
  if (seed?.trim()) {
    config.seed = seed.trim();
  }
  const timeOfDay = params.get('timeOfDay');
  if (isTimeOfDay(timeOfDay)) {
    config.timeOfDay = timeOfDay;
  }
  config.decorationDensity = clampNumberParam(
    params.get('decorationDensity') ?? params.get('density'),
    config.decorationDensity,
    0,
    1,
  );
  config.difficulty = clampNumberParam(params.get('difficulty'), config.difficulty, 0.25, 5);
  config.tileSize = clampNumberParam(params.get('tileSize'), config.tileSize, 32, 128);

  return {
    id: entry.id,
    label: entry.label,
    config,
    warnings,
  };
};
