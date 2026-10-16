/* Reference list of Delhi NCR areas with map coordinates, used when the browser can't share the
   device location (e.g. location turned off on a laptop). Matching needs coordinates. */
export const areas: Array<{ name: string; latitude: number; longitude: number }> = [
  { name: 'Connaught Place', latitude: 28.6315, longitude: 77.2167 },
  { name: 'Karol Bagh', latitude: 28.6519, longitude: 77.1909 },
  { name: 'Lajpat Nagar', latitude: 28.5677, longitude: 77.2433 },
  { name: 'Saket', latitude: 28.5245, longitude: 77.2066 },
  { name: 'Dwarka', latitude: 28.5921, longitude: 77.046 },
  { name: 'Rohini', latitude: 28.7495, longitude: 77.0565 },
  { name: 'Noida Sector 18', latitude: 28.5708, longitude: 77.3261 },
  { name: 'Gurugram Cyber City', latitude: 28.495, longitude: 77.0895 },
];
