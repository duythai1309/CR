"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runCalculation, unlockFieldSeason, type ComputeResult } from "./actions";
import { Alert, Button, Card } from "@/components/ui";
import { fmtDate, fmtNum, fmtTonnes } from "@/lib/format";

type Calculation = {
  methodology_version: string;
  area_ha: number;
  cultivation_days: number;
  baseline_ch4_kg: number;
  project_ch4_kg: number;
  baseline_n2o_kg: number;
  project_n2o_kg: number;
  baseline_burning_co2e_t: number;
  project_burning_co2e_t: number;
  baseline_co2e_t: number;
  project_co2e_t: number;
  reduction_co2e_t: number;
  computed_at: string;
  factors: unknown;
} | null;

export function CalculationPanel({
  fieldSeasonId,
  missing,
  calculation,
  locked,
}: {
  fieldSeasonId: string;
  missing: string[];
  calculation: Calculation;
  locked: boolean;
}) {
  const [result, setResult] = useState<ComputeResult | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ready = missing.length === 0;

  return (
    <div className="space-y-6">
      <Card title="Tính giảm phát thải">
        {ready ? (
          <Alert tone="ok">Nhật ký đã đủ dữ liệu để tính.</Alert>
        ) : (
          <Alert tone="warn" title="Còn thiếu trước khi tính được">
            <ul className="mt-1 list-inside list-disc">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Alert>
        )}

        {result && !result.ok && (
          <div className="mt-3">
            <Alert tone="error">
              {result.message ?? `Còn thiếu: ${result.missing?.join(", ")}`}
            </Alert>
          </div>
        )}

        <div className="mt-4">
          <Button
            disabled={!ready || pending || locked}
            className="w-full"
            onClick={() =>
              start(async () => {
                const r = await runCalculation(fieldSeasonId);
                setResult(r);
                if (r.ok) router.refresh();
              })
            }
          >
            {pending ? "Đang tính…" : calculation ? "Tính lại" : "Tính giảm phát thải"}
          </Button>
          {locked && (
            <p className="mt-2 text-xs text-soil-600">
              Thửa-vụ đang khoá. Mở khoá bên dưới nếu cần sửa nhật ký rồi tính lại.
            </p>
          )}
        </div>
      </Card>

      {calculation && (
        <Card
          title="Kết quả hiện hành"
          description={`Phương pháp luận ${calculation.methodology_version} · tính lúc ${fmtDate(calculation.computed_at)}`}
        >
          <div className="rounded-lg bg-leaf-50 px-4 py-3 text-center">
            <div className="text-xs uppercase tracking-wide text-leaf-700">Giảm phát thải</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums text-leaf-900">
              {fmtTonnes(calculation.reduction_co2e_t)}
            </div>
            <div className="mt-1 text-xs text-leaf-700">
              trên {fmtNum(calculation.area_ha)} ha, {calculation.cultivation_days} ngày canh tác
            </div>
          </div>

          {(() => {
            const f = calculation.factors as Record<string, unknown> | null;
            const key = f?.ef_c_source_key;
            if (typeof key !== "string") return null;
            return (
              <p className="mt-3 rounded-lg bg-soil-100 px-3 py-2 text-xs text-soil-600">
                Hệ số phát thải nền đã dùng: <span className="font-mono">{key}</span> ={" "}
                <span className="font-medium">{String(f?.ef_c_baseline)}</span> kg CH₄/ha/ngày
              </p>
            );
          })()}

          <dl className="mt-4 space-y-2 text-sm">
            <Row label="CH₄ kịch bản nền" value={`${fmtNum(calculation.baseline_ch4_kg)} kg`} />
            <Row label="CH₄ kịch bản dự án" value={`${fmtNum(calculation.project_ch4_kg)} kg`} />
            <Row label="N₂O kịch bản nền" value={`${fmtNum(calculation.baseline_n2o_kg)} kg`} />
            <Row label="N₂O kịch bản dự án" value={`${fmtNum(calculation.project_n2o_kg)} kg`} />
            <Row
              label="Đốt rơm — nền"
              value={fmtTonnes(calculation.baseline_burning_co2e_t)}
            />
            <Row
              label="Đốt rơm — dự án"
              value={fmtTonnes(calculation.project_burning_co2e_t)}
            />
            <div className="border-t border-soil-200 pt-2">
              <Row label="Tổng phát thải nền" value={fmtTonnes(calculation.baseline_co2e_t)} strong />
              <Row label="Tổng phát thải dự án" value={fmtTonnes(calculation.project_co2e_t)} strong />
            </div>
          </dl>
        </Card>
      )}

      {locked && (
        <Card title="Mở khoá để sửa">
          <p className="text-sm text-soil-600">
            Mở khoá sẽ làm kết quả tính hiện tại mất hiệu lực, và bạn phải tính lại trước
            khi gộp vào lô mới.
          </p>
          {unlockError && (
            <div className="mt-3">
              <Alert tone="error">{unlockError}</Alert>
            </div>
          )}
          <Button
            variant="danger"
            className="mt-3 w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const err = await unlockFieldSeason(fieldSeasonId);
                setUnlockError(err);
                if (!err) router.refresh();
              })
            }
          >
            Mở khoá thửa-vụ
          </Button>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-soil-600">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold text-soil-900" : "text-soil-800"}`}>
        {value}
      </dd>
    </div>
  );
}
