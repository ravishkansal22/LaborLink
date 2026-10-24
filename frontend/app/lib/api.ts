/* Typed client for the LaborLink FastAPI backend (see docs/API.md). Every screen gets its data
   from here; nothing shown in the app is hard-coded sample data. */

export type Trade = 'plumber' | 'electrician' | 'mason' | 'carpenter';
export type Urgency = 'flexible' | 'normal' | 'urgent';
export type JobStatus =
  | 'needs_information' | 'estimated' | 'booked' | 'in_progress'
  | 'awaiting_confirmation' | 'completed' | 'disputed';

export interface JobLocation { address: string | null; latitude: number | null; longitude: number | null }

export interface WorkOrder {
  normalized_description: string;
  suggested_trade: Trade | null;
  trade_source: 'employer_selected' | 'inferred' | 'unknown';
  problem_category: string;
  problem_summary: string;
  classification_confidence: 'low' | 'medium' | 'high';
  complexity: 'low' | 'medium' | 'high';
  likely_tools: string[];
  likely_materials: string[];
  estimated_duration: { min_hours: number; max_hours: number };
  missing_information: string[];
  follow_up_questions: string[];
  image_assessment: { status: 'not_provided' | 'not_analysed' | 'analysed'; observations: string[]; disclaimer: string };
}

export interface PriceEstimate {
  id: string;
  min_amount: number;
  max_amount: number;
  currency: string;
  labour: { min: number; max: number };
  travel_allowance: number;
  hourly_rate_used: number;
  duration_hours: { min: number; max: number };
  assumptions: string[];
  warnings: string[];
}

export interface Job {
  id: string;
  status: JobStatus;
  trade: Trade | null;
  employer_id: string | null;
  request: {
    description: string;
    description_source: 'text' | 'voice_transcript';
    language: string | null;
    requested_trade: Trade | null;
    urgency: Urgency;
    location: JobLocation;
    image_id: string | null;
  };
  work_order: WorkOrder;
  price_estimate: PriceEstimate | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerSummary {
  id: string;
  display_name: string;
  trades: Trade[];
  years_experience: number | null;
  verification_status: 'unverified';
}

export interface Worker extends WorkerSummary {
  location: { latitude: number; longitude: number; locality: string | null };
  service_radius_km: number;
  availability: 'available' | 'unavailable';
  created_at: string;
}

export interface OfferTerms {
  price_estimate_id: string;
  currency: string;
  suggested_labour_amount: number;
  permitted_min: number;
  permitted_max: number;
  travel_allowance: number;
  basis: string;
}

export interface MatchCandidate {
  worker: WorkerSummary;
  distance_km: number | null;
  service_radius_km: number;
  score: number;
  reasons: string[];
  limitations: string[];
}
export interface MatchResponse {
  distance_matching: 'complete' | 'unavailable';
  limitations: string[];
  candidates: MatchCandidate[];
  excluded: Record<string, number>;
}

export interface Opportunity {
  job_id: string;
  trade: Trade;
  problem_category: string;
  problem_summary: string;
  description: string; // the employer's own words
  image_id: string | null; // the employer's photo of the problem
  complexity: 'low' | 'medium' | 'high';
  urgency: Urgency;
  estimated_duration: { min_hours: number; max_hours: number };
  distance_km: number | null;
  limitations: string[];
  offer_terms: OfferTerms;
  has_active_offer: boolean;
  created_at: string;
}
export interface Opportunities {
  worker_availability: 'available' | 'unavailable';
  limitations: string[];
  items: Opportunity[];
}

export type OfferStatus = 'pending' | 'accepted' | 'rejected';
export interface Offer {
  id: string;
  job_id: string;
  worker: WorkerSummary;
  kind: 'accept_suggested' | 'counter';
  labour_amount: number;
  travel_allowance: number;
  total_amount: number;
  currency: string;
  message: string | null;
  status: OfferStatus;
  closed_reason: string | null;
  created_at: string;
}
export interface OfferComparison extends Offer {
  distance_km: number | null;
  match_score: number | null;
  difference_from_suggested: number | null;
  currently_eligible: boolean;
  eligibility_issues: string[];
}
export interface JobOffers { job_status: JobStatus; offer_terms: OfferTerms | null; offers: OfferComparison[] }
export interface WorkerOffer extends Offer { job_status: JobStatus; job_trade: Trade | null; problem_summary: string }

export interface Booking {
  id: string;
  job_id: string;
  worker: WorkerSummary;
  agreed_labour_amount: number;
  travel_allowance: number;
  agreed_total_amount: number;
  currency: string;
  created_at: string;
}

export interface EvidenceImage { image_id: string; content_type: string }
export interface Evidence {
  id: string;
  before_images: EvidenceImage[];
  after_images: EvidenceImage[];
  note: string | null;
  submitted_at: string;
  disclaimer: string;
}

export interface Settlement {
  id: string;
  amount: number;
  labour_amount: number;
  travel_allowance: number;
  currency: string;
  status: 'simulated_pending' | 'simulated_settled';
  created_at: string;
  settled_at: string | null;
  disclaimer: string;
}
export interface Review {
  decision: 'confirmed' | 'disputed';
  dispute_reason: string | null;
  job_status: JobStatus;
  settlement: Settlement | null;
  note: string;
}

export type EarningStatus = 'in_progress' | 'confirmed_unsettled' | 'settled' | 'disputed';
export interface PassbookEntry {
  job_id: string;
  trade: Trade | null;
  problem_summary: string;
  job_status: JobStatus;
  earning_status: EarningStatus;
  agreed_labour_amount: number;
  travel_allowance: number;
  agreed_total_amount: number;
  currency: string;
  booked_at: string;
  completed_at: string | null;
  disputed_at: string | null;
  dispute_reason: string | null;
  settlement_status: 'simulated_pending' | 'simulated_settled' | 'none' | 'withheld_disputed';
  settled_at: string | null;
}
export interface Passbook {
  worker_display_name: string;
  currency: string;
  summary: {
    completed_jobs: number;
    confirmed_earnings: number;
    simulated_settled_earnings: number;
    pending_settlements: { count: number; amount: number };
    disputed: { count: number; amount: number };
    active_jobs: number;
  };
  entries: PassbookEntry[];
  total_entries: number;
  disclaimer: string;
}

export interface UploadedImage { id: string; content_type: string; size_bytes: number }

export interface Tracking {
  job_id: string;
  job_status: JobStatus;
  worker_id: string;
  worker_name: string;
  worker_location: { latitude: number; longitude: number; accuracy_m: number | null; recorded_at: string; age_seconds: number; stale: boolean } | null;
  destination: { latitude: number; longitude: number; address: string | null } | null;
  distance_km: number | null;
  eta_minutes: number | null;
  arrived: boolean;
  eta_basis: string;
}

/* ------------------------------------------------------------------ transport */

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const API_HOST = process.env.NEXT_PUBLIC_API_URL || '';
const BASE = `${API_HOST.replace(/\/$/, '')}/api/v1`;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isJson = typeof init.body === 'string';
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(isJson ? { 'content-type': 'application/json' } : {}),
        'ngrok-skip-browser-warning': 'true',
        ...(init.headers || {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'network', 'Can’t reach the LaborLink server. Check that the backend is running.');
  }
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: Array<{ msg?: string; loc?: unknown[] }> } } | null)?.error;
    if (response.status >= 500 && !error) {
      throw new ApiError(response.status, 'server', 'The LaborLink server isn’t responding. Check that the backend is running.');
    }
    let message = error?.message ?? `Request failed (${response.status}).`;
    const first = error?.details?.[0];
    if (error?.code === 'validation_error' && first?.msg) {
      const field = first.loc?.filter((p) => p !== 'body').join(' → ');
      message = field ? `${field}: ${first.msg.replace(/^Value error, /, '')}` : first.msg;
    }
    throw new ApiError(response.status, error?.code ?? 'http_error', message);
  }
  return data as T;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  health: () => request<{ status: string }>('/health'),

  uploadImage(file: File) {
    const form = new FormData();
    form.append('file', file);
    return request<UploadedImage>('/images', { method: 'POST', body: form });
  },
  imageUrl: (imageId: string) => `${BASE}/images/${encodeURIComponent(imageId)}`,

  translate: (texts: string[], targetLanguage: string, sourceLanguage: 'en' | 'auto' = 'en') =>
    post<{ target_language: string; translations: Array<string | null>; available: boolean }>('/translate', {
      texts, target_language: targetLanguage, source_language: sourceLanguage,
    }),
  speechStatus: () => request<{ available: boolean; provider: 'sarvam' | null; max_bytes: number }>('/speech/status'),
  transcribe(audio: Blob, language: string) {
    const form = new FormData();
    form.append('file', audio, `voice.${audio.type.includes('ogg') ? 'ogg' : audio.type.includes('mp4') ? 'm4a' : 'webm'}`);
    form.append('language', language);
    return request<{ transcript: string; language_code: string | null; provider: 'sarvam' }>('/speech/transcribe', { method: 'POST', body: form });
  },

  createJob: (body: {
    description: string; description_source: 'text' | 'voice_transcript'; language: string;
    trade: Trade | null; urgency: Urgency; location: JobLocation; image_id: string | null; employer_id: string;
  }) => post<Job>('/jobs', body),
  getJob: (jobId: string) => request<Job>(`/jobs/${jobId}`),
  matches: (jobId: string) => request<MatchResponse>(`/jobs/${jobId}/matches`),
  jobOffers: (jobId: string) => request<JobOffers>(`/jobs/${jobId}/offers`),
  book: (jobId: string, offerId: string, employerId: string) =>
    post<Booking>(`/jobs/${jobId}/bookings`, { offer_id: offerId, employer_id: employerId }),
  booking: (jobId: string) => request<Booking>(`/jobs/${jobId}/booking`),
  evidence: (jobId: string) => request<Evidence>(`/jobs/${jobId}/completion-evidence`),
  review: (jobId: string, employerId: string, decision: 'confirm' | 'dispute', disputeReason?: string) =>
    post<Review>(`/jobs/${jobId}/completion-confirmation`, {
      employer_id: employerId, decision, ...(decision === 'dispute' ? { dispute_reason: disputeReason } : {}),
    }),
  settle: (jobId: string, employerId: string) => post<Settlement>(`/jobs/${jobId}/settlement`, { employer_id: employerId }),
  settlement: (jobId: string) => request<Settlement>(`/jobs/${jobId}/settlement`),

  createWorker: (body: {
    display_name: string; trades: Trade[]; years_experience: number | null;
    location: { latitude: number; longitude: number; locality: string | null }; service_radius_km: number;
  }) => post<Worker>('/workers', body),
  getWorker: (workerId: string) => request<Worker>(`/workers/${workerId}`),
  updateWorker: (workerId: string, patch: Partial<Pick<Worker, 'availability' | 'service_radius_km' | 'trades' | 'years_experience'>>) =>
    request<Worker>(`/workers/${workerId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  opportunities: (workerId: string) => request<Opportunities>(`/workers/${workerId}/jobs`),
  workerOffers: (workerId: string) => request<{ offers: WorkerOffer[] }>(`/workers/${workerId}/offers`),
  createOffer: (jobId: string, body: { worker_id: string; kind: 'accept_suggested' | 'counter'; labour_amount?: number; message?: string }) =>
    post<Offer>(`/jobs/${jobId}/offers`, body),
  startJob: (jobId: string, workerId: string) => post<{ job_status: JobStatus; started_at: string }>(`/jobs/${jobId}/start`, { worker_id: workerId }),
  submitEvidence: (jobId: string, body: { worker_id: string; before_image_ids: string[]; after_image_ids: string[]; note: string | null }) =>
    post<Evidence>(`/jobs/${jobId}/completion-evidence`, body),
  passbook: (workerId: string) => request<Passbook>(`/workers/${workerId}/passbook`),

  shareLocation: (jobId: string, body: { worker_id: string; latitude: number; longitude: number; accuracy_m?: number | null }) =>
    post<Tracking>(`/jobs/${jobId}/worker-location`, body),
  tracking: (jobId: string, employerId: string) =>
    request<Tracking>(`/jobs/${jobId}/worker-location?employer_id=${encodeURIComponent(employerId)}`),
};

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/* ------------------------------------------------------------------ display helpers */

export const tradeNames: Record<Trade, { en: string; hi: string }> = {
  electrician: { en: 'Electrician', hi: 'इलेक्ट्रीशियन' },
  plumber: { en: 'Plumber', hi: 'प्लंबर' },
  mason: { en: 'Mason', hi: 'मिस्त्री' },
  carpenter: { en: 'Carpenter', hi: 'बढ़ई' },
};
export const allTrades = Object.keys(tradeNames) as Trade[];

export function money(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function hours(range: { min_hours: number; max_hours: number } | { min: number; max: number }): string {
  const [min, max] = 'min_hours' in range ? [range.min_hours, range.max_hours] : [range.min, range.max];
  const fmt = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1));
  return min === max ? `${fmt(min)} h` : `${fmt(min)}–${fmt(max)} h`;
}

export function when(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  // The page's lang (set from the chosen app language) localises dates for free via Intl.
  const locale = (typeof document !== 'undefined' && document.documentElement.lang) || 'en-IN';
  const time = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  if (!sameDay) return `${date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${time}`;
  const todayWord = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'day');
  return `${todayWord[0].toUpperCase()}${todayWord.slice(1)}, ${time}`;
}

export function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
