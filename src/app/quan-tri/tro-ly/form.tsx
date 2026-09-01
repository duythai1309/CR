"use client";

import { useActionState, useState, useTransition } from "react";
import { saveChatSettings, testChatConnection, type ActionResult } from "./actions";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

export interface ProviderOption {
  id: string;
  label: string;
  defaultModel: string;
  models: Array<{ id: string; label: string; hint?: string }>;
  keyUrl: string;
  envKey: string;
  hasEnvKey: boolean;
}

export function ChatSettingsForm({
  providers,
  current,
}: {
  providers: ProviderOption[];
  current: { provider: string; model: string; apiKeyLast4: string | null };
}) {
  const [result, formAction, saving] = useActionState<ActionResult | null, FormData>(
    saveChatSettings,
    null,
  );
  const [providerId, setProviderId] = useState(current.provider);
  const [model, setModel] = useState(current.model);
  const [testResult, setTestResult] = useState<ActionResult | null>(null);
  const [testing, startTest] = useTransition();

  const provider = providers.find((p) => p.id === providerId) ?? providers[0];
  const modelIsListed = provider.models.some((m) => m.id === model);

  return (
    <div className="space-y-6">
      <Card
        title="Nhà cung cấp và model"
        description="Áp dụng cho toàn nền tảng. Đổi xong có hiệu lực ngay, không cần deploy lại."
      >
        <form action={formAction} className="space-y-4">
          <Field label="Nhà cung cấp">
            <Select
              name="provider"
              value={providerId}
              onChange={(e) => {
                const next = providers.find((p) => p.id === e.target.value);
                setProviderId(e.target.value);
                // Đổi nhà cung cấp mà giữ tên model cũ thì gần như chắc chắn sai,
                // vì mỗi bên đặt tên một kiểu.
                if (next) setModel(next.defaultModel);
              }}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Model"
            hint={
              provider.models.find((m) => m.id === model)?.hint ??
              "Tên model tự gõ — dùng khi nhà cung cấp ra bản mới chưa có trong danh sách."
            }
          >
            <div className="space-y-2">
              <Select
                value={modelIsListed ? model : "__khac__"}
                onChange={(e) =>
                  setModel(e.target.value === "__khac__" ? "" : e.target.value)
                }
              >
                {provider.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                <option value="__khac__">Model khác (tự gõ)</option>
              </Select>
              {!modelIsListed && (
                <Input
                  name="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={provider.defaultModel}
                  aria-label="Tên model tự gõ"
                />
              )}
              {modelIsListed && <input type="hidden" name="model" value={model} />}
            </div>
          </Field>

          <Field
            label="Khoá API"
            hint={
              <>
                Để trống thì giữ nguyên khoá đang dùng. Khoá lưu xong{" "}
                <strong>không đọc lại được</strong>, kể cả bởi chính anh/chị — cơ sở dữ
                liệu không cấp quyền đọc cột đó cho bất kỳ tài khoản nào.{" "}
                <a
                  href={provider.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-leaf-700 underline"
                >
                  Lấy khoá {provider.label}
                </a>
              </>
            }
          >
            <Input
              name="api_key"
              type="password"
              autoComplete="off"
              placeholder={
                current.apiKeyLast4
                  ? `Đang dùng khoá •••• ${current.apiKeyLast4}`
                  : provider.hasEnvKey
                    ? `Đang dùng khoá từ biến môi trường ${provider.envKey}`
                    : "Chưa có khoá nào"
              }
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu cấu hình"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={testing}
              onClick={() =>
                startTest(async () => setTestResult(await testChatConnection()))
              }
            >
              {testing ? "Đang gọi thử…" : "Kiểm tra kết nối"}
            </Button>
          </div>

          {result && (
            <Alert tone={result.ok ? "ok" : "error"}>{result.message}</Alert>
          )}
          {testResult && (
            <Alert tone={testResult.ok ? "ok" : "error"} title="Kết quả kiểm tra">
              {testResult.message}
            </Alert>
          )}
        </form>
      </Card>
    </div>
  );
}
