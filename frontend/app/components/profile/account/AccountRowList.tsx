'use client';

import { AccountRow } from './AccountRow';
import type { AccountRowConfig } from './types';

interface AccountRowListProps {
  rows: AccountRowConfig[];
}

export function AccountRowList({ rows }: AccountRowListProps) {
  return (
    <div className="acct-list" role="list">
      {rows.map((row) => (
        <div key={row.id} role="listitem">
          <AccountRow row={row} />
        </div>
      ))}
    </div>
  );
}
