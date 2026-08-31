"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createSeason } from "./actions";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { SEASON_CALENDAR, SEASON_TYPE_LABEL } from "@/lib/labels";
import { ACTIVE_SEASON_TYPES } from "@/lib/region";
import type { Database } from "@/types/database";

type Region = Database["public"]["Enums"]["vn_region"];
type SeasonType = Database["public"]["Enums"]["season_type"];

export function NewSeasonForm({ region }: { region: Region }) {
  const [error, action, pending] = useActionState(createSeason, null);
  const ref = useRef<HTMLFormElement>(null);

  // Chỉ hiện các vụ có thật ở vùng triển khai; hiện thêm vụ khác sẽ dẫn tới lỗi
  // lúc tính vì không có hệ số phát thải nền cho tổ hợp đó.
  const available = ACTIVE_SEASON_TYPES;
  const [seasonType, setSeasonType] = useState<SeasonType>(available[0]);

  useEffect(() => {
    if (!pending && !error) ref.current?.reset();
  }, [pending, error]);

  return (
    <Card title="Tạo mùa vụ">
      <form ref={ref} action={action} className="space-y-4">
        <Field label="Tên vụ">
          <Input name="name" required placeholder="Vụ Xuân 2026" />
        </Field>
        <Field
          label="Loại vụ"
          hint={
            SEASON_CALENDAR[region][seasonType]
              ? `${SEASON_CALENDAR[region][seasonType]}. Loại vụ quyết định hệ số phát thải nền.`
              : "Loại vụ quyết định hệ số phát thải nền."
          }
        >
          <Select
            name="season_type"
            required
            value={seasonType}
            onChange={(e) => setSeasonType(e.target.value as SeasonType)}
          >
            {available.map((t) => (
              <option key={t} value={t}>
                {SEASON_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ngày bắt đầu vụ">
          <Input name="start_date" type="date" required />
        </Field>
        <Field label="Ngày kết thúc vụ" hint="Có thể bổ sung sau khi thu hoạch xong.">
          <Input name="end_date" type="date" />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Đang tạo…" : "Tạo mùa vụ"}
        </Button>
      </form>
    </Card>
  );
}
