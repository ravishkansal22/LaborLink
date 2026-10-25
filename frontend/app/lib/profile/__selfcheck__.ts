/**
 * Type-visible mirror of the runtime self-check.
 * Execute the runner (no test-runner install):
 *   node --experimental-strip-types app/lib/profile/__selfcheck__.mjs
 *
 * This file exists so `tsc` typechecks the same import graph Agent B will use.
 */
export { maskPhone } from './mask';
export { getInitials } from './initials';
export { computeCompletion } from './completion';
export {
  validateName,
  validateEmail,
  validatePhone,
  validateDob,
  validateBusinessName,
} from './validation';
