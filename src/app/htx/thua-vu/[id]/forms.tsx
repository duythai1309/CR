"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addFertilizer,
  addWaterEvent,
  deleteLogRow,
  saveDates,
  saveStraw,
} from "./actions";
import { Alert, Badge, Button, Card, Field, Input, Select, Table } from "@/components/ui";
import {
  ORGANIC_LABEL,
  PRESEASON_LABEL,
  STRAW_LABEL,
  WATER_EVENT_LABEL,
  WATER_REGIME_LABEL,
} from "@/lib/labels";
import { fmtDate, fmtNum } from "@/lib/format";

const LOCKED_NOTE = "Thửa-vụ đã khoá vì nằm trong lô tín chỉ. Mở khoá ở khung bên phải để sửa.";

export function DatesForm({
  fieldSeason,
  disabled,
}: {
  fieldSeason: {
    id: string;
    transplant_date: string | null;
    harvest_date: string | null;
    preseason_water: string;
    baseline_water_regime: string;
  };
  disabled: boolean;
}) {
  const [error, action, pending] = useActionState(saveDates, null);

  return (
    <Card title="Mốc thời gian và kịch bản nền">
      <form action={action} className="space-y-4">
        <input type="hidden" name="field_season_id" value={fieldSeason.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ngày cấy">
            <Input
              name="transplant_date"
              type="date"
              defaultValue={fieldSeason.transplant_date ?? ""}
              disabled={disabled}
            />
          </Field>
          <Field label="Ngày thu hoạch">
            <Input
              name="harvest_date"
              type="date"
              defaultValue={fieldSeason.harvest_date ?? ""}
              disabled={disabled}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chế độ nước trước vụ">
            <Select name="preseason_water" defaultValue={fieldSeason.preseason_water} disabled={disabled}>
              {Object.entries(PRESEASON_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Chế độ nước kịch bản nền">
            <Select
              name="baseline_water_regime"
              defaultValue={fieldSeason.baseline_water_regime}
              disabled={disabled}
            >
              {Object.entries(WATER_REGIME_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {disabled ? (
          <Alert>{LOCKED_NOTE}</Alert>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu"}
          </Button>
        )}
      </form>
    </Card>
  );
}

function DeleteButton({
  table,
  rowId,
  fieldSeasonId,
  disabled,
}: {
  table: "water_events" | "fertilizer_applications";
  rowId: string;
  fieldSeasonId: string;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          await deleteLogRow(table, rowId, fieldSeasonId);
          router.refresh();
        })
      }
      className="text-sm text-red-700 hover:underline disabled:opacity-40"
    >
      Xoá
    </button>
  );
}

export function WaterPanel({
  fieldSeasonId,
  events,
  disabled,
}: {
  fieldSeasonId: string;
  events: Array<{
    id: string;
    event_date: string;
    event_type: "drainage" | "reflood";
    water_depth_cm: number | null;
    note: string | null;
  }>;
  disabled: boolean;
}) {
  const [error, action, pending] = useActionState(addWaterEvent, null);
  const drainage = events.filter((e) => e.event_type === "drainage").length;

  return (
    <Card
      title="Lịch nước"
      description="Số lần tháo nước quyết định hệ số SFw — đây là chỗ tạo ra phần lớn lượng tín chỉ, nên ghi đúng từng lần."
      action={
        <Badge tone={drainage >= 2 ? "leaf" : "soil"}>
          {drainage} lần tháo nước
          {drainage >= 2 ? " · đạt AWD" : ""}
        </Badge>
      }
    >
      {events.length > 0 && (
        <div className="mb-4">
          <Table head={["Ngày", "Loại", "Mực nước", "Ghi chú", ""]}>
            {[...events]
              .sort((a, b) => a.event_date.localeCompare(b.event_date))
              .map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2">{fmtDate(e.event_date)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={e.event_type === "drainage" ? "carbon" : "soil"}>
                      {WATER_EVENT_LABEL[e.event_type]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {e.water_depth_cm !== null ? `${fmtNum(e.water_depth_cm)} cm` : "—"}
                  </td>
                  <td className="px-3 py-2 text-soil-600">{e.note ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <DeleteButton
                      table="water_events"
                      rowId={e.id}
                      fieldSeasonId={fieldSeasonId}
                      disabled={disabled}
                    />
                  </td>
                </tr>
              ))}
          </Table>
        </div>
      )}

      {disabled ? (
        <Alert>{LOCKED_NOTE}</Alert>
      ) : (
        <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input type="hidden" name="field_season_id" value={fieldSeasonId} />
          <Field label="Ngày">
            <Input name="event_date" type="date" required />
          </Field>
          <Field label="Loại">
            <Select name="event_type" defaultValue="drainage">
              {Object.entries(WATER_EVENT_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Mực nước (cm)">
            <Input name="water_depth_cm" type="number" step="0.1" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              {pending ? "…" : "Thêm"}
            </Button>
          </div>
          {error && (
            <div className="sm:col-span-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}

export function FertilizerPanel({
  fieldSeasonId,
  rows,
  disabled,
}: {
  fieldSeasonId: string;
  rows: Array<{
    id: string;
    applied_date: string;
    product_name: string | null;
    is_organic: boolean;
    organic_type: string | null;
    amount_kg: number;
    n_content_pct: number;
  }>;
  disabled: boolean;
}) {
  const [error, action, pending] = useActionState(addFertilizer, null);
  const [organic, setOrganic] = useState(false);
  const totalN = rows.reduce((s, r) => s + (Number(r.amount_kg) * Number(r.n_content_pct)) / 100, 0);

  // Rơm rạ khai riêng ở khung bên dưới; để ở cả hai chỗ sẽ bị tính hai lần vào SFo.
  const organicOptions = Object.entries(ORGANIC_LABEL).filter(([v]) => !v.startsWith("straw_"));

  return (
    <Card
      title="Phân bón"
      description="Lượng đạm quyết định phát thải N₂O; chất hữu cơ làm tăng hệ số SFo."
      action={<Badge tone="soil">Tổng {fmtNum(totalN)} kg N</Badge>}
    >
      {rows.length > 0 && (
        <div className="mb-4">
          <Table head={["Ngày bón", "Sản phẩm", "Loại", "Khối lượng", "%N", ""]}>
            {[...rows]
              .sort((a, b) => a.applied_date.localeCompare(b.applied_date))
              .map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{fmtDate(r.applied_date)}</td>
                  <td className="px-3 py-2">{r.product_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.is_organic
                      ? ORGANIC_LABEL[r.organic_type as keyof typeof ORGANIC_LABEL]
                      : "Phân vô cơ"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(r.amount_kg)} kg</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(r.n_content_pct)}%</td>
                  <td className="px-3 py-2 text-right">
                    <DeleteButton
                      table="fertilizer_applications"
                      rowId={r.id}
                      fieldSeasonId={fieldSeasonId}
                      disabled={disabled}
                    />
                  </td>
                </tr>
              ))}
          </Table>
        </div>
      )}

      {disabled ? (
        <Alert>{LOCKED_NOTE}</Alert>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="field_season_id" value={fieldSeasonId} />
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Ngày bón">
              <Input name="applied_date" type="date" required />
            </Field>
            <Field label="Sản phẩm">
              <Input name="product_name" placeholder="Ure" />
            </Field>
            <Field label="Khối lượng (kg)">
              <Input name="amount_kg" type="number" step="0.01" min="0" required />
            </Field>
            <Field label="Hàm lượng N (%)" hint="Ure ≈ 46%.">
              <Input name="n_content_pct" type="number" step="0.01" min="0" max="100" defaultValue="0" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-soil-800">
            <input
              type="checkbox"
              name="is_organic"
              checked={organic}
              onChange={(e) => setOrganic(e.target.checked)}
              className="accent-leaf-700"
            />
            Đây là phân hữu cơ
          </label>
          {organic && (
            <Field label="Loại chất hữu cơ">
              <Select name="organic_type" defaultValue="compost">
                {organicOptions.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </Field>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" disabled={pending}>
            {pending ? "Đang thêm…" : "Thêm lần bón"}
          </Button>
        </form>
      )}
    </Card>
  );
}

export function StrawForm({
  fieldSeasonId,
  straw,
  disabled,
}: {
  fieldSeasonId: string;
  straw: {
    method: string;
    baseline_method: string;
    amount_t_per_ha: number | null;
    days_before_cultivation: number | null;
  } | null;
  disabled: boolean;
}) {
  const [error, action, pending] = useActionState(saveStraw, null);
  const [method, setMethod] = useState(straw?.method ?? "incorporated_long");
  const [baseline, setBaseline] = useState(straw?.baseline_method ?? "burned");
  const needsAmount = method === "burned" || baseline === "burned";

  return (
    <Card
      title="Xử lý rơm rạ"
      description="So sánh cách làm hiện nay với tập quán cũ. Không đốt rơm là một nguồn giảm phát thải riêng, ngoài phần từ AWD."
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="field_season_id" value={fieldSeasonId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cách làm vụ này">
            <Select name="method" value={method} onChange={(e) => setMethod(e.target.value)} disabled={disabled}>
              {Object.entries(STRAW_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tập quán cũ (kịch bản nền)">
            <Select
              name="baseline_method"
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              disabled={disabled}
            >
              {Object.entries(STRAW_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Sản lượng rơm rạ (tấn/ha)"
            hint={needsAmount ? "Bắt buộc vì có kịch bản đốt rơm." : "Lúa nước thường 4–6 tấn/ha."}
          >
            <Input
              name="amount_t_per_ha"
              type="number"
              step="0.001"
              min="0"
              required={needsAmount}
              defaultValue={straw?.amount_t_per_ha ?? ""}
              disabled={disabled}
            />
          </Field>
          <Field label="Số ngày vùi trước khi cấy">
            <Input
              name="days_before_cultivation"
              type="number"
              min="0"
              defaultValue={straw?.days_before_cultivation ?? ""}
              disabled={disabled}
            />
          </Field>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {disabled ? (
          <Alert>{LOCKED_NOTE}</Alert>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu cách xử lý rơm rạ"}
          </Button>
        )}
      </form>
    </Card>
  );
}
