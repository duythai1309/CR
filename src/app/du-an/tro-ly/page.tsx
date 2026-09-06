import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app-nav";
import { Alert, Badge } from "@/components/ui";
import { ChatPanel, type ChatMessage } from "@/components/chat/chat-panel";
import { loadChatConfig, missingKeyMessage } from "@/lib/chat/settings";
import { MAX_HISTORY_TURNS } from "@/lib/chat/guards";

export const metadata: Metadata = { title: "Trợ lý" };

/**
 * Trang trợ lý toàn màn hình, chuyển từ `/htx/tro-ly` sang khi module hợp tác xã bị gỡ.
 *
 * Nằm dưới `/du-an` nên dùng chung `du-an/layout.tsx`: cùng thanh điều hướng, cùng nền.
 * Segment tĩnh `tro-ly` thắng segment động `[id]` trong Next.js, nên đường dẫn này không
 * bao giờ bị hiểu nhầm là một dự án tên "tro-ly".
 *
 * Đổi `requireCoopProfile` thành `requireProfile`: điều kiện cũ là "phải thuộc một hợp
 * tác xã", mà khái niệm đó không còn tồn tại — giữ nguyên là mọi người dùng đều bị đá
 * sang một trang đã bị xoá.
 */
export default async function AssistantPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const configured = (await loadChatConfig(supabase)) !== null;

  // Mở lại hội thoại gần nhất thay vì bắt đầu trắng: người dùng thường quay lại để
  // hỏi tiếp chuyện đang dở.
  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: messages } = conversation
    ? await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(MAX_HISTORY_TURNS * 2)
    : { data: null };

  return (
    <>
      <PageHeader
        title="Trợ lý dự án Carbon"
        description={
          "Tra cứu tiến độ, điều kiện duyệt, catalog Methodology và yêu cầu dữ liệu MRV " +
          "bằng tiếng Việt. Câu trả lời dựa trên dữ liệu dự án mà bạn có quyền xem."
        }
      />

      {!configured && (
        <div className="mb-4">
          <Alert tone="warn" title="Trợ lý chưa hoạt động">
            {missingKeyMessage()}
          </Alert>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-soil-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-soil-900">Phạm vi công cụ</h2>
              <Badge tone="carbon">7 công cụ</Badge>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-soil-700">
              {[
                ["Danh mục & tiến độ", "Liệt kê dự án; đọc tiến độ 7 bước, công việc, kỳ giám sát và MRV estimate gần nhất."],
                ["Điều kiện duyệt", "Đối chiếu điều kiện thật của từng bước với trạng thái dự án."],
                ["Methodology catalog", "Gợi ý trong catalog SAMPLE hiện có; luôn trả lại Standard, code và version."],
                ["Metric schema", "Liệt kê baseline/observation fields, unit, bounds và tên cột CSV."],
                ["Baseline readiness", "Kiểm field thiếu, sai kiểu hoặc vượt giới hạn."],
                ["Work planning", "Gom công việc theo bước, trạng thái, hạn và người phụ trách."],
              ].map(([title, detail]) => (
                <li key={title}>
                  <p className="font-medium text-soil-900">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-soil-600">{detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-soil-200 bg-soil-50 p-5">
            <h2 className="text-sm font-semibold text-soil-900">Câu hỏi phù hợp</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-soil-700">
              <li>“Dự án Rừng A còn thiếu gì để duyệt bước 5?”</li>
              <li>“Catalog có Methodology nào cho dự án biogas?”</li>
              <li>“Methodology DEMO-VCS-FOREST cần các cột CSV nào?”</li>
              <li>“Baseline của Dự án A đã hợp lệ chưa?”</li>
              <li>“Việc chưa xong ở bước Additionality của Dự án A?”</li>
            </ul>
          </section>

          <Alert tone="warn" title="Giới hạn nghiệp vụ">
            Catalog hiện là SAMPLE tự soạn, chưa thẩm định. Trợ lý không thực hiện
            consultation, validation, VVB verification hoặc issuance.
          </Alert>
        </aside>

        <div className="flex h-[min(46rem,78dvh)] min-h-[34rem] flex-col overflow-hidden rounded-xl border border-soil-200 bg-white shadow-sm">
          <div className="border-b border-soil-100 px-5 py-3">
            <p className="text-xs font-medium text-soil-900">Workspace assistant</p>
            <p className="text-xs text-soil-500">Kết quả được giới hạn bởi quyền truy cập dự án và RLS.</p>
          </div>
          <ChatPanel
            initialConversationId={conversation?.id ?? null}
            initialMessages={(messages ?? []) as ChatMessage[]}
            className="min-h-0 flex-1"
          />
        </div>
      </div>
    </>
  );
}
