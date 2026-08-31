import { describe, expect, it } from "vitest";
import { polygonAreaM2, ringToGeoJson } from "@/lib/gis/area";

describe("diện tích vùng trên mặt cầu", () => {
  it("ô vuông 0,001° ở vĩ độ 10 xấp xỉ 12.200 m²", () => {
    // Một độ kinh tuyến ≈ 111.320 m; ở vĩ độ 10 chiều ngang co lại theo cos(10°).
    const expected = 111_320 * 0.001 * 111_320 * 0.001 * Math.cos((10 * Math.PI) / 180);
    const ring: Array<[number, number]> = [
      [10, 105],
      [10, 105.001],
      [10.001, 105.001],
      [10.001, 105],
    ];
    expect(polygonAreaM2(ring)).toBeGreaterThan(expected * 0.99);
    expect(polygonAreaM2(ring)).toBeLessThan(expected * 1.01);
  });

  it("chiều vẽ ngược kim đồng hồ hay xuôi đều cho cùng diện tích", () => {
    const ring: Array<[number, number]> = [
      [10, 105],
      [10, 105.001],
      [10.001, 105.001],
      [10.001, 105],
    ];
    expect(polygonAreaM2([...ring].reverse())).toBeCloseTo(polygonAreaM2(ring), 6);
  });

  it("dưới ba đỉnh thì không thành vùng", () => {
    expect(polygonAreaM2([[10, 105], [10, 105.001]])).toBe(0);
  });
});

describe("xuất GeoJSON", () => {
  it("đảo thứ tự sang kinh độ trước và khép kín vòng", () => {
    const gj = ringToGeoJson([
      [10, 105],
      [10, 105.001],
      [10.001, 105.001],
    ]);
    expect(gj.type).toBe("Polygon");
    expect(gj.coordinates[0][0]).toEqual([105, 10]);
    expect(gj.coordinates[0].at(-1)).toEqual(gj.coordinates[0][0]);
    expect(gj.coordinates[0]).toHaveLength(4);
  });
});
