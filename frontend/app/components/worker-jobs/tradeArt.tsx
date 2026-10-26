'use client';

import type { ComponentType } from 'react';
import type { Trade } from '../../lib/api';
import {
  CarpenterIllustration,
  ElectricianIllustration,
  MasonIllustration,
  PlumberIllustration,
} from '../worker-grid/illustrations';

export const tradeIllustrations: Record<Trade, ComponentType> = {
  electrician: ElectricianIllustration,
  plumber: PlumberIllustration,
  mason: MasonIllustration,
  carpenter: CarpenterIllustration,
};
