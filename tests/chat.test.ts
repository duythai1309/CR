import { describe, expect, it } from "vitest";
import {
  MAX_QUESTION_CHARS,
  checkQuestion,
  titleFromQuestion,
  trimHistory,
} from "@/lib/chat/guards";
import { TOOLS, findTool, toolsForRole } from "@/lib/chat/tools";
import { buildSystemPrompt, describePage } from "@/lib/chat/prompt";
import { runTurn } from "@/lib/chat/run";
import type { ChatProvider, ProviderEvent, ToolCall } from "@/lib/chat/provider";
import { readChatConfig } from "@/lib/chat/config";
import { missingMrvInputs } from "@/lib/mrv/collect";

describe("giới hạn quanh một lượt hỏi", () => {
  it("từ chối câu hỏi rỗng và câu hỏi không phải văn bản", () => {
    expect(checkQuestion("   ")).toEqual({ ok: false, error: "Bạn chưa nhập câu hỏi." });
    expect(checkQuestion(42).ok).toBe(false);
    expect(checkQuestion(null).ok).toBe(false);
  });

  it("từ chối câu hỏi dài quá trần và cắt khoảng trắng thừa", () => {
    expect(checkQuestion("x".repeat(MAX_QUESTION_CHARS + 1)).ok).toBe(false);
    expect(checkQuestion("  Vụ này ra sao?  ")).toEqual({ ok: true, question: "Vụ này ra sao?" });
  });

  it("giữ các lượt gần nhất, cắt từ đầu hội thoại", () => {
    const messages = Array.from({ length: 10 }, (_, i) => i);
    expect(trimHistory(messages, 2)).toEqual([6, 7, 8, 9]);
    expect(trimHistory(messages, 50)).toEqual(messages);
  });

  it("dựng tiêu đề hội thoại cắt ở ranh giới từ", () => {
    expect(titleFromQuestion("Vụ Xuân 2026 giảm bao nhiêu tấn?")).toBe(
      "Vụ Xuân 2026 giảm bao nhiêu tấn?",
    );
    const long = titleFromQuestion("Hợp tác xã của tôi còn thửa nào chưa ghi nhật ký nước", 30);
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(31);
    expect(long).not.toContain("  ");
  });
});

describe("phân phối công cụ theo vai trò", () => {
  it("doanh nghiệp mua không thấy công cụ nào chạm dữ liệu nông hộ", () => {
    const names = toolsForRole("buyer").map((t) => t.name);
    expect(names).toContain("lo_dang_chao_ban");
    expect(names).toContain("don_hang_cua_toi");
    expect(names).not.toContain("liet_ke_nong_ho");
    expect(names).not.toContain("chi_tiet_thua_vu");
    expect(names).not.toContain("thua_thieu_nhat_ky");
  });

  it("cán bộ hợp tác xã không tra được bảng chia doanh thu", () => {
    expect(findTool("chia_doanh_thu", "coop_staff")).toBeNull();
    expect(findTool("chia_doanh_thu", "coop_manager")).not.toBeNull();
  });

  it("không trả về công cụ ngoài phạm vi vai trò dù gọi đúng tên", () => {
    expect(findTool("don_hang_cua_toi", "coop_manager")).toBeNull();
    expect(findTool("khong_ton_tai", "platform_admin")).toBeNull();
  });

  it("mọi công cụ đều khai báo vai trò và mô tả", () => {
    for (const tool of TOOLS) {
      expect(tool.roles.length, tool.name).toBeGreaterThan(0);
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
      for (const required of tool.parameters.required ?? [])
        expect(Object.keys(tool.parameters.properties), tool.name).toContain(required);
    }
  });
});

describe("system prompt", () => {
  const base = { role: "coop_manager" as const, fullName: "Nguyễn Văn A", coopName: "HTX Đại Thắng" };

  it("nêu vai trò, hợp tác xã và màn hình đang xem", () => {
    const prompt = buildSystemPrompt({ ...base, path: "/htx/thua-ruong", today: "2026-09-01" });
    expect(prompt).toContain("Giám đốc hợp tác xã");
    expect(prompt).toContain("HTX Đại Thắng");
    expect(prompt).toContain("bản đồ và danh sách thửa ruộng");
    expect(prompt).toContain("2026-09-01");
  });

  it("chỉ liệt kê công cụ của đúng vai trò", () => {
    const buyerPrompt = buildSystemPrompt({ ...base, role: "buyer", coopName: null });
    expect(buyerPrompt).toContain("lo_dang_chao_ban");
    expect(buyerPrompt).not.toContain("liet_ke_nong_ho");
  });

  it("luôn mang theo quy tắc không được bịa số và không tự tính MRV", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("Không tự tính MRV");
    expect(prompt).toContain("không ước lượng");
  });

  it("nhận diện màn hình, bỏ qua đường dẫn lạ", () => {
    expect(describePage("/htx/thua-vu/abc-123")).toContain("nhật ký canh tác");
    expect(describePage("/cho/xyz")).toContain("chào bán");
    expect(describePage("/khong-co-that")).toBeNull();
    expect(describePage(null)).toBeNull();
  });
});

/** Provider giả phát lại một kịch bản dựng sẵn, mỗi phần tử là một vòng. */
function scriptedProvider(rounds: ProviderEvent[][]): ChatProvider {
  let round = 0;
  return {
    async *stream() {
      const events = rounds[Math.min(round++, rounds.length - 1)];
      for (const event of events) yield event;
    },
  };
}

const runOptions = (provider: ChatProvider, execute: (c: ToolCall) => Promise<Record<string, unknown>>) => ({
  provider,
  system: "hệ thống",
  contents: [{ role: "user" as const, parts: [{ text: "câu hỏi" }] }],
  tools: [],
  execute,
});

async function collect(gen: AsyncGenerator<{ type: string } & Record<string, unknown>>) {
  const events = [];
  for await (const event of gen) events.push(event);
  return events;
}

describe("vòng lặp một lượt hỏi", () => {
  it("trả lời thẳng khi model không gọi công cụ nào", async () => {
    const events = await collect(
      runTurn(
        runOptions(
          scriptedProvider([[{ type: "text", text: "Chào " }, { type: "text", text: "anh/chị." }]]),
          async () => ({}),
        ),
      ),
    );

    expect(events.filter((e) => e.type === "delta").map((e) => e.text)).toEqual([
      "Chào ",
      "anh/chị.",
    ]);
    const done = events.at(-1);
    expect(done).toMatchObject({ type: "done", text: "Chào anh/chị.", toolCalls: [] });
  });

  it("chạy công cụ rồi mới trả lời, và ghi lại đã gọi gì", async () => {
    const called: ToolCall[] = [];
    const events = await collect(
      runTurn(
        runOptions(
          scriptedProvider([
            [{ type: "calls", calls: [{ name: "tong_ket_mua_vu", args: { ten_mua_vu: "Xuân" } }] }],
            [{ type: "text", text: "Vụ Xuân giảm 12,5 tấn." }],
          ]),
          async (call) => {
            called.push(call);
            return { tong_giam_phat_thai_tco2e: 12.5 };
          },
        ),
      ),
    );

    expect(called).toEqual([{ name: "tong_ket_mua_vu", args: { ten_mua_vu: "Xuân" } }]);
    expect(events.find((e) => e.type === "status")).toMatchObject({ tool: "tong_ket_mua_vu" });
    expect(events.at(-1)).toMatchObject({
      type: "done",
      text: "Vụ Xuân giảm 12,5 tấn.",
      toolCalls: [{ name: "tong_ket_mua_vu", args: { ten_mua_vu: "Xuân" } }],
    });
  });

  it("dừng lại khi model gọi công cụ mãi không thôi", async () => {
    let calls = 0;
    const events = await collect(
      runTurn({
        ...runOptions(
          scriptedProvider([[{ type: "calls", calls: [{ name: "liet_ke_mua_vu", args: {} }] }]]),
          async () => {
            calls++;
            return {};
          },
        ),
        maxRounds: 3,
      }),
    );

    expect(calls).toBe(3);
    const done = events.at(-1) as { type: string; text: string };
    expect(done.type).toBe("done");
    expect(done.text).toContain("tách thành vài câu ngắn hơn");
  });

  it("lỗi của công cụ được đưa lại cho model chứ không làm hỏng lượt hỏi", async () => {
    const events = await collect(
      runTurn(
        runOptions(
          scriptedProvider([
            [{ type: "calls", calls: [{ name: "chia_doanh_thu", args: { ma_lo: "LTC-01" } }] }],
            [{ type: "text", text: "Mình không tra được lô này." }],
          ]),
          async () => ({ loi: "permission denied" }),
        ),
      ),
    );

    expect(events.at(-1)).toMatchObject({ type: "done", text: "Mình không tra được lô này." });
  });
});

describe("cấu hình trợ lý", () => {
  it("thiếu khoá thì trả về null để trợ lý tự tắt", () => {
    expect(readChatConfig({})).toBeNull();
    expect(readChatConfig({ GEMINI_API_KEY: "   " })).toBeNull();
  });

  it("model đặt được bằng biến môi trường", () => {
    expect(readChatConfig({ GEMINI_API_KEY: "k" })?.model).toBe("gemini-2.5-flash");
    expect(readChatConfig({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-2.5-pro" })?.model).toBe(
      "gemini-2.5-pro",
    );
  });
});

describe("danh sách việc còn thiếu dùng chung với màn hình nhập liệu", () => {
  const full = {
    areaHa: 1.2,
    transplantDate: "2026-02-01",
    harvestDate: "2026-06-01",
    strawMethod: "removed" as const,
    baselineStrawMethod: "incorporated_short" as const,
    strawTonnesPerHa: 0,
    region: "north" as const,
    seasonType: "early" as const,
  };

  it("đủ dữ liệu thì không còn gì thiếu", () => {
    expect(missingMrvInputs(full)).toEqual([]);
  });

  it("nêu đích danh từng mục còn thiếu", () => {
    const missing = missingMrvInputs({
      ...full,
      areaHa: null,
      harvestDate: null,
      strawMethod: null,
      seasonType: null,
    });
    expect(missing).toContain("Diện tích thửa (vẽ ranh thửa trên bản đồ)");
    expect(missing).toContain("Ngày thu hoạch");
    expect(missing).toContain("Cách xử lý rơm rạ");
    expect(missing).toContain("Loại vụ của mùa vụ này (đầu năm / giữa năm / cuối năm)");
  });

  it("bắt lỗi ngày thu hoạch trước ngày cấy", () => {
    expect(missingMrvInputs({ ...full, harvestDate: "2026-01-01" })).toContain(
      "Ngày thu hoạch phải sau ngày cấy",
    );
  });

  it("đòi sản lượng rơm khi có đốt rơm ở bất kỳ kịch bản nào", () => {
    expect(missingMrvInputs({ ...full, baselineStrawMethod: "burned" })).toContain(
      "Sản lượng rơm rạ (tấn/ha) — bắt buộc khi có đốt rơm",
    );
    expect(
      missingMrvInputs({ ...full, baselineStrawMethod: "burned", strawTonnesPerHa: 4 }),
    ).toEqual([]);
  });
});
