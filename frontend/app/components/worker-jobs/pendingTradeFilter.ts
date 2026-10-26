/**
 * In-memory pending trade filter for Find work.
 * Routing has no query-param / screen-state field for trade — Home trade tiles
 * call setPendingTradeFilter(trade) then go.jobs(); Find work (Part 3) should
 * takePendingTradeFilter() on mount and seed its chip filter.
 */
import type { Trade } from '../../lib/api';

let pending: Trade | null = null;

export function setPendingTradeFilter(trade: Trade | null): void {
  pending = trade;
}

/** Read and clear. Safe to call when no pending filter (returns null). */
export function takePendingTradeFilter(): Trade | null {
  const value = pending;
  pending = null;
  return value;
}

export function peekPendingTradeFilter(): Trade | null {
  return pending;
}
