import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { Coords } from './types';

/** Thrown when the user denies location permission (native or browser). */
export class LocationPermissionDeniedError extends Error {
  constructor(message = 'Location permission denied') {
    super(message);
    this.name = 'LocationPermissionDeniedError';
  }
}

/** Thrown when location is unsupported, timed out, or otherwise unavailable. */
export class LocationUnavailableError extends Error {
  constructor(message = 'Location unavailable or timeout') {
    super(message);
    this.name = 'LocationUnavailableError';
  }
}

/**
 * Returns the device's current coordinates.
 * Uses Capacitor Geolocation on native; otherwise `navigator.geolocation`.
 * Requests permission when needed and rejects with {@link LocationPermissionDeniedError} on denial.
 */
export async function getCurrentCoords(): Promise<Coords> {
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          throw new LocationPermissionDeniedError();
        }
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (err: unknown) {
      if (err instanceof LocationPermissionDeniedError) throw err;
      throw new LocationUnavailableError(
        err instanceof Error ? err.message : 'Capacitor geolocation failed',
      );
    }
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new LocationUnavailableError('Geolocation is not supported by this browser');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new LocationPermissionDeniedError());
        } else {
          reject(new LocationUnavailableError(error.message));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  });
}
