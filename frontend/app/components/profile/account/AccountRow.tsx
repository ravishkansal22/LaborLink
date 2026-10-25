'use client';

import { ChevronRight } from 'lucide-react';
import type { AccountRowConfig } from './types';

interface AccountRowProps {
  row: AccountRowConfig;
}

export function AccountRow({ row }: AccountRowProps) {
  const { id, title, subtitle, value, icon: Icon, onPress, badge, showChevron } = row;

  return (
    <button
      id={id}
      type="button"
      className="acct-row"
      onClick={onPress}
    >
      <span className="acct-row-icon" aria-hidden="true">
        <Icon size={24} strokeWidth={1.75} />
      </span>
      <span className="acct-row-body">
        <span className="acct-row-title">
          {title}
          {badge ? <span className="acct-row-badge" style={{ marginLeft: 8 }}>{badge}</span> : null}
        </span>
        {subtitle ? <span className="acct-row-sub">{subtitle}</span> : null}
      </span>
      {(value !== undefined || showChevron) && (
        <span className="acct-row-right">
          {value !== undefined ? <span className="acct-row-value">{value}</span> : null}
          {showChevron ? (
            <ChevronRight size={18} strokeWidth={1.75} className="acct-row-chevron" aria-hidden="true" />
          ) : null}
        </span>
      )}
    </button>
  );
}
