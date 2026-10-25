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
  /** Optional raster under /public/worker-icons; WorkerArt falls back to SVG on error. */
  imageSrc?: string;
  /** Optional corner pill; omit or leave unset to render nothing. */
  badge?: string;
  /** Soft stage tint (CSS color). */
  tint: string;
}

/** Matches `allTrades` / `tradeNames` order and ids used by EmployerHomeScreen → onNewJob(trade). */
export const workerCategories: WorkerCategory[] = (
  [
    { id: 'electrician', Illustration: ElectricianIllustration, tint: '#e3e9ff' },
    { id: 'plumber', Illustration: PlumberIllustration, tint: '#e1f3ff' },
    { id: 'mason', Illustration: MasonIllustration, tint: '#ffe8e3' },
    { id: 'carpenter', Illustration: CarpenterIllustration, tint: '#fff0e0' },
  ] as const
).map((row) => ({
  ...row,
  label: tradeNames[row.id].en,
  labelHi: tradeNames[row.id].hi,
  imageSrc: `/worker-icons/${row.id}.webp`,
}));
