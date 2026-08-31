"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Đồng bằng sông Hồng — vùng lúa trọng điểm miền Bắc. */
export const DEFAULT_CENTER: [number, number] = [20.4463, 106.3366];

/**
 * Bản đồ vẽ ranh thửa. Bấm để thêm đỉnh; danh sách đỉnh do component cha giữ nên
 * nút hoàn tác và vẽ lại nằm cùng chỗ với phần còn lại của biểu mẫu.
 */
export default function FieldMap({
  points,
  onAddPoint,
  existing = [],
  center = DEFAULT_CENTER,
}: {
  points: Array<[number, number]>;
  onAddPoint: (p: [number, number]) => void;
  existing?: Array<{ name: string; farmer: string; geojson: unknown }>;
  center?: [number, number];
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const drawn = useRef<L.LayerGroup | null>(null);
  const others = useRef<L.LayerGroup | null>(null);
  const addPoint = useRef(onAddPoint);
  addPoint.current = onAddPoint;

  useEffect(() => {
    if (!holder.current || map.current) return;

    const m = L.map(holder.current, { center, zoom: 16 });

    // Ảnh vệ tinh là nền mặc định: bờ ruộng nhìn rõ trên ảnh chụp, còn bản đồ
    // đường phố gần như trống trơn ở vùng canh tác nên không vẽ ranh theo được.
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Ảnh vệ tinh: Esri", maxZoom: 19, maxNativeZoom: 18 },
    ).addTo(m);

    const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    });

    L.control
      .layers(
        { "Ảnh vệ tinh": satellite, "Bản đồ đường": street },
        undefined,
        { position: "topright" },
      )
      .addTo(m);

    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(m);

    drawn.current = L.layerGroup().addTo(m);
    others.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => addPoint.current([e.latlng.lat, e.latlng.lng]));
    map.current = m;

    // Khung bản đồ nằm trong lưới co giãn nên kích thước thật có thể chỉ xác định
    // sau lần vẽ đầu; thiếu bước này Leaflet tính sai số ô cần tải.
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(holder.current);

    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
    // Chỉ dựng bản đồ một lần; thay đổi sau đó do các effect bên dưới xử lý.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vẽ các thửa đã có để người nhập liệu thấy ngay mình đang vẽ chồng lên đâu.
  useEffect(() => {
    const layer = others.current;
    if (!layer) return;
    layer.clearLayers();

    const bounds = L.latLngBounds([]);
    for (const f of existing) {
      if (!f.geojson) continue;
      const gj = L.geoJSON(f.geojson as never, {
        style: { color: "#fbbf24", weight: 2, fillOpacity: 0.15 },
      });
      gj.bindTooltip(`${f.farmer} — ${f.name}`);
      gj.addTo(layer);
      bounds.extend(gj.getBounds());
    }

    if (!bounds.isValid() || !map.current) return;

    // Nếu các thửa nằm rải quá xa nhau thì việc thu về vừa khung sẽ kéo bản đồ ra
    // mức tỉnh, không còn nhìn thấy bờ ruộng. Khi đó giữ nguyên vùng mặc định.
    const spread = Math.max(
      bounds.getNorth() - bounds.getSouth(),
      bounds.getEast() - bounds.getWest(),
    );
    if (spread < 0.25) {
      map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
    }
  }, [existing]);

  useEffect(() => {
    const layer = drawn.current;
    if (!layer) return;
    layer.clearLayers();

    points.forEach((p, i) =>
      L.circleMarker(p, {
        radius: 5,
        color: "#15803d",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(`Đỉnh ${i + 1}`)
        .addTo(layer),
    );

    if (points.length >= 3) {
      L.polygon(points, { color: "#22c55e", weight: 2, fillOpacity: 0.25 }).addTo(layer);
    } else if (points.length === 2) {
      L.polyline(points, { color: "#22c55e", weight: 2, dashArray: "4 4" }).addTo(layer);
    }
  }, [points]);

  return <div ref={holder} className="h-[30rem] w-full rounded-lg border border-soil-200" />;
}
