export type {
  CompletionResult,
  ProfileExtras,
  ProfileStatus,
  ProfileUpdateResult,
  ProfileView,
} from './types';
export { PhotoTooLargeError } from './types';
export { maskPhone } from './mask';
export { getInitials } from './initials';
export { computeCompletion, type CompletionBase } from './completion';
export {
  validateName,
  validateEmail,
  validatePhone,
  validateDob,
  validateBusinessName,
} from './validation';
export {
  loadExtras,
  saveExtras,
  clearExtras,
  clearAllExtras,
  extrasKey,
  MAX_PHOTO_DATA_URL_CHARS,
} from './storage';
export { resizeImageToDataUrl } from './image';
export { buildProfileView, type BuildProfileInput } from './buildProfileView';
export {
  ProfileProvider,
  useProfileContext,
  type ProfileContextValue,
  type ProfilePatch,
  type ProfileProviderProps,
} from './ProfileContext';
export { useProfile } from './useProfile';
