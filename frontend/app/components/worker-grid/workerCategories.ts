import type { ComponentType } from 'react';
import type { Trade } from '../../lib/api';
import { tradeNames } from '../../lib/api';
import {
  CarpenterIllustration,
  ElectricianIllustration,
  MasonIllustration,
  PlumberIllustration,
} from './illustrations';

export interface WorkerCategory {
  id: Trade;
  label: string;
  labelHi: string;
  Illustration: ComponentType;
  /** Raster under /public/worker-icons; WorkerArt falls back to clean SVG on error. */
  imageSrc?: string;
  /** Optional corner pill; omit or leave unset to render nothing. */
  badge?: string;
  /** Dark stage tint. */
  tint: string;
}

/** Matches `allTrades` / `tradeNames` order and ids used by EmployerHomeScreen → onNewJob(trade). */
export const workerCategories: WorkerCategory[] = (
  [
    { id: 'electrician', Illustration: ElectricianIllustration, tint: '#1E1E1E' },
    { id: 'plumber', Illustration: PlumberIllustration, tint: '#1E1E1E' },
    { id: 'mason', Illustration: MasonIllustration, tint: '#1E1E1E' },
    { id: 'carpenter', Illustration: CarpenterIllustration, tint: '#1E1E1E' },
  ] as const
).map((row) => ({
  ...row,
  label: tradeNames[row.id].en,
  labelHi: tradeNames[row.id].hi,
  imageSrc: `/worker-icons/${row.id}.webp`,
}));
