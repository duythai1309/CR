"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { saveField, type SaveFieldResult } from "./actions";
import { polygonAreaHa, ringToGeoJson } from "@/lib/gis/area";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { fmtHa } from "@/lib/format";

// Leaflet đụng tới window nên chỉ nạp ở trình duyệt.
const FieldMap = dynamic(() => import("@/components/field-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[26rem] items-center justify-center rounded-lg border border-soil-200 bg-soil-100 text-sm text-soil-600">
      Đang tải bản đồ…
    </div>
  ),
});

type Farmer = { id: string; full_name: string; village: string | null };

export function FieldEditor({
  farmers,
  existing,
}: {
  farmers: Farmer[];
  existing: Array<{ name: string; farmer: string; geojson: unknown }>;
}) {
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const [result, setResult] = useState<SaveFieldResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const draftArea = points.length >= 3 ? polygonAreaHa(points) : 0;

  function submit(formData: FormData) {
    if (points.length < 3) {
      setResult({ ok: false, message: "Ranh thửa cần ít nhất 3 đỉnh." });
      return;
    }
    formData.set("geojson", JSON.stringify(ringToGeoJson(points)));
    startTransition(async () => {
      const r = await saveField(formData);
      setResult(r);
      if (r.ok) {
        setPoints([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card
        title="Vẽ ranh thửa"
        description="Bấm lần lượt quanh mép ruộng để đánh dấu các đỉnh. Vùng xám là những thửa đã số hoá."
      >
        <FieldMap points={points} onAddPoint={(p) => setPoints((prev) => [...prev, p])} existing={existing} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-soil-600">
            {points.length} đỉnh
            {draftArea > 0 && <> · tạm tính {fmtHa(draftArea)}</>}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPoints((p) => p.slice(0, -1))}
              disabled={points.length === 0}
            >
              Bỏ đỉnh cuối
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPoints([])}
              disabled={points.length === 0}
            >
              Vẽ lại
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Thông tin thửa">
        <form action={submit} className="space-y-4">
          <Field label="Nông hộ">
            <Select name="farmer_id" required defaultValue="">
              <option value="" disabled>
                — Chọn hộ —
              </option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.full_name}
                  {f.village ? ` (${f.village})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tên thửa">
            <Input name="name" required placeholder="Ruộng sau nhà" />
          </Field>
          <Field
            label="Diện tích hộ khai (ha)"
            hint="Không bắt buộc. Nhập để đối chiếu với diện tích đo từ bản đồ."
          >
            <Input name="declared_area_ha" type="number" step="0.0001" min="0" />
          </Field>
          <Field label="Loại đất">
            <Input name="soil_type" placeholder="Đất phù sa sông Hồng" />
          </Field>

          {result && !result.ok && <Alert tone="error">{result.message}</Alert>}

          {result?.ok && (
            <Alert tone="ok" title={`Đã lưu thửa — diện tích đo ${fmtHa(result.areaHa ?? 0)}`}>
              {result.overlaps && result.overlaps.length > 0 ? (
                <div className="mt-2">
                  <p className="font-medium text-carbon-700">Cảnh báo chồng lấn:</p>
                  <ul className="mt-1 list-inside list-disc text-carbon-700">
                    {result.overlaps.map((o, i) => (
                      <li key={i}>
                        {o.label} — chồng {fmtHa(o.overlap_ha)}
                        {!o.same_cooperative && " (khai trùng giữa hai hợp tác xã)"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-1">Không chồng lấn với thửa nào đã có.</p>
              )}
            </Alert>
          )}

          <Button type="submit" disabled={pending || points.length < 3} className="w-full">
            {pending ? "Đang lưu…" : "Lưu thửa ruộng"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
