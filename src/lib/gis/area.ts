/** Bán kính Trái Đất theo WGS84, mét. */
const EARTH_RADIUS = 6378137;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Diện tích hình cầu của một vùng, tính từ danh sách đỉnh [vĩ độ, kinh độ].
 * Dùng để hiện diện tích tạm tính ngay lúc vẽ; con số chính thức do PostGIS tính
 * lại phía máy chủ nên người dùng không tự khai được diện tích.
 */
export function polygonAreaM2(ring: Array<[number, number]>): number {
  if (ring.length < 3) return 0;

  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lat1, lng1] = ring[i];
    const [lat2, lng2] = ring[(i + 1) % ring.length];
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }

  return Math.abs((total * EARTH_RADIUS * EARTH_RADIUS) / 2);
}

export const polygonAreaHa = (ring: Array<[number, number]>) => polygonAreaM2(ring) / 10000;

/** Chuyển danh sách đỉnh [vĩ độ, kinh độ] thành Polygon GeoJSON (kinh độ trước). */
export function ringToGeoJson(ring: Array<[number, number]>) {
  const coords = ring.map(([lat, lng]) => [lng, lat]);
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
  return { type: "Polygon" as const, coordinates: [coords] };
}
