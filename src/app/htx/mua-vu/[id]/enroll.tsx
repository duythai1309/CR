"use client";

import { useActionState } from "react";
import { enrollFields } from "../actions";
import { Alert, Button, Card, Empty, Field, Select } from "@/components/ui";
import { PRESEASON_LABEL, WATER_REGIME_LABEL } from "@/lib/labels";
import { fmtHa } from "@/lib/format";

type FieldRow = {
  id: string;
  name: string;
  area_ha: number | null;
  farmers: { full_name: string } | null;
};

export function EnrollForm({ seasonId, fields }: { seasonId: string; fields: FieldRow[] }) {
  const [error, action, pending] = useActionState(enrollFields, null);

  if (fields.length === 0) {
    return (
      <Card title="Đăng ký thêm thửa">
        <Empty title="Mọi thửa của hợp tác xã đã đăng ký vào vụ này" />
      </Card>
    );
  }

  return (
    <Card
      title="Đăng ký thửa tham gia vụ"
      description="Kịch bản nền là tập quán canh tác cũ của vùng — dùng làm mốc so sánh để tính lượng cắt giảm."
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="season_id" value={seasonId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Chế độ nước trước vụ"
            hint="Quyết định hệ số SFp trong công thức IPCC."
          >
            <Select name="preseason_water" defaultValue="non_flooded_short">
              {Object.entries(PRESEASON_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chế độ nước của kịch bản nền" hint="Tập quán trước khi áp dụng AWD.">
            <Select name="baseline_water_regime" defaultValue="continuously_flooded">
              {Object.entries(WATER_REGIME_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-soil-800">
            Chọn thửa ({fields.length} thửa chưa đăng ký)
          </legend>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-soil-200 p-3">
            {fields.map((f) => (
              <label key={f.id} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-soil-50">
                <input type="checkbox" name="field_ids" value={f.id} className="accent-leaf-700" />
                <span className="text-sm text-soil-900">{f.name}</span>
                <span className="text-sm text-soil-600">— {f.farmers?.full_name}</span>
                <span className="ml-auto text-sm tabular-nums text-soil-600">{fmtHa(f.area_ha)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? "Đang đăng ký…" : "Đăng ký các thửa đã chọn"}
        </Button>
      </form>
    </Card>
  );
}
