'use client';

import { t } from '../../lib/i18n';
import type { Trade } from '../../lib/api';
import { WorkerTile } from './WorkerTile';
import { workerCategories } from './workerCategories';

interface WorkerGridProps {
  onSelect: (trade: Trade) => void;
}

/** Ride-app-style 4-column worker booking grid. Title styling matches `.section-head` + `.h3`. */
export function WorkerGrid({ onSelect }: WorkerGridProps) {
  return (
    <>
      <div className="section-head">
        <h2 className="h3">{t('Book a worker')}</h2>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {workerCategories.map((category, index) => (
          <WorkerTile
            key={category.id}
            category={category}
            index={index}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  );
}
