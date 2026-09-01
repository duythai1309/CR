import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav, PageHeader } from "@/components/app-nav";
import { Alert, Card } from "@/components/ui";
import { PROVIDERS, providersWithEnvKey } from "@/lib/chat/providers/registry";
import { loadStoredSettings, resolveChatConfig } from "@/lib/chat/settings";
import { ChatSettingsForm, type ProviderOption } from "./form";

export const metadata: Metadata = { title: "Cấu hình trợ lý" };

const SOURCE_LABEL: Record<string, string> = {
  db: "lưu trong hệ thống",
  env: "biến môi trường",
  default: "mặc định",
};

export default async function AssistantSettingsPage() {
  const profile = await requireProfile();
  if (profile.role !== "platform_admin") redirect("/");

  const supabase = await createClient();
  const stored = await loadStoredSettings(supabase);
  const resolved = resolveChatConfig(stored, process.env);
  const envProviders = providersWithEnvKey();

  const providers: ProviderOption[] = PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    defaultModel: p.defaultModel,
    models: p.models,
    keyUrl: p.keyUrl,
    envKey: p.envKey,
    hasEnvKey: envProviders.includes(p.id),
  }));

  return (
    <div className="min-h-dvh bg-soil-50">
      <AppNav profile={profile} />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader
          title="Cấu hình trợ lý"
          description="Chọn nhà cung cấp model và khoá API cho trợ lý ảo của toàn nền tảng."
        />

        {!resolved && (
          <div className="mb-6">
            <Alert tone="warn" title="Trợ lý đang tắt">
              Chưa có khoá API ở đâu cả, nên trợ lý không trả lời được câu nào. Nhập khoá
              bên dưới để bật.
            </Alert>
          </div>
        )}

        <div className="mb-6">
          <Card title="Đang dùng gì">
            {resolved ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-soil-600">Nhà cung cấp</dt>
                  <dd className="font-medium text-soil-900">
                    {resolved.provider.label}
                    <span className="ml-1 text-xs font-normal text-soil-500">
                      ({SOURCE_LABEL[resolved.source.provider]})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-soil-600">Model</dt>
                  <dd className="font-medium text-soil-900">
                    {resolved.model}
                    <span className="ml-1 text-xs font-normal text-soil-500">
                      ({SOURCE_LABEL[resolved.source.model]})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-soil-600">Khoá API</dt>
                  <dd className="font-medium text-soil-900">
                    {stored.apiKeyLast4 ? `•••• ${stored.apiKeyLast4}` : "đã đặt"}
                    <span className="ml-1 text-xs font-normal text-soil-500">
                      ({SOURCE_LABEL[resolved.source.apiKey]})
                    </span>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-soil-600">Chưa cấu hình.</p>
            )}
            {/* Nói rõ giá trị đến từ đâu, để không ai phải đoán vì sao sửa biến môi
                trường mà không thấy tác dụng. */}
            <p className="mt-3 text-xs text-soil-500">
              Thứ tự ưu tiên: cấu hình lưu trong hệ thống → biến môi trường → mặc định.
              Từng giá trị xét riêng, nên để model ở đây mà khoá vẫn nằm ở biến môi
              trường là bình thường.
            </p>
          </Card>
        </div>

        <ChatSettingsForm
          providers={providers}
          current={{
            provider: resolved?.provider.id ?? PROVIDERS[0].id,
            model: resolved?.model ?? PROVIDERS[0].defaultModel,
            apiKeyLast4: stored.apiKeyLast4,
          }}
        />
      </main>
    </div>
  );
}
