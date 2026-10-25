export type AddressLabel = 'Home' | 'Work' | 'Other';

export interface SavedAddress {
  id: string;
  label: AddressLabel;
  line1: string;
  area: string;
  city: string;
  pincode?: string;
  landmark?: string;
  receiverName?: string;
  phone?: string;
  lat: number;
  lng: number;
  createdAt: number;
}

export interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

export interface Coords {
  lat: number;
  lng: number;
}

export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';
