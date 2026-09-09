import { describe, expect, it } from "vitest";
import {
  MAX_QUESTION_CHARS,
  checkQuestion,
  titleFromQuestion,
  trimHistory,
} from "@/lib/chat/guards";
import { TOOLS } from "@/lib/chat/tools";
import { buildSystemPrompt, describePage } from "@/lib/chat/prompt";
import { runTurn } from "@/lib/chat/run";
import type { ChatProvider, ProviderEvent, ToolCall } from "@/lib/chat/provider";
import { readChatConfig } from "@/lib/chat/config";
import { FIXTURE_PROJECT, FIXTURE_RESULTS, createFixtureExecute } from "@/lib/chat/eval/fixture";
import { tenRieng } from "@/lib/chat/handlers";
import { buildContexts, buildTrajectory } from "@/lib/chat/eval/trajectory";
import {
  PROVIDERS,
  findProvider,
  providersWithEnvKey,
} from "@/lib/chat/providers/registry";
import { resolveChatConfig } from "@/lib/chat/settings";
import { requiredToolNamesForQuestion } from "@/lib/chat/routing";

describe("giới hạn quanh một lượt hỏi", () => {
  it("từ chối câu hỏi rỗng và câu hỏi không phải văn bản", () => {
    expect(checkQuestion("   ")).toEqual({ ok: false, error: "Bạn chưa nhập câu hỏi." });
    expect(checkQuestion(42).ok).toBe(false);
    expect(checkQuestion(null).ok).toBe(false);
  });

  it("từ chối câu hỏi dài quá trần và cắt khoảng trắng thừa", () => {
    expect(checkQuestion("x".repeat(MAX_QUESTION_CHARS + 1)).ok).toBe(false);
    expect(checkQuestion("  Dự án này tới đâu rồi?  ")).toEqual({
      ok: true,
      question: "Dự án này tới đâu rồi?",
    });
  });

  it("giữ các lượt gần nhất, cắt từ đầu hội thoại", () => {
    const messages = Array.from({ length: 10 }, (_, i) => i);
    expect(trimHistory(messages, 2)).toEqual([6, 7, 8, 9]);
    expect(trimHistory(messages, 50)).toEqual(messages);
  });

  it("dựng tiêu đề hội thoại cắt ở ranh giới từ", () => {
    expect(titleFromQuestion("Dự án Cà Mau đã có nội dung ở mấy mục?")).toBe(
      "Dự án Cà Mau đã có nội dung ở mấy mục?",
    );
    const long = titleFromQuestion("Baseline của dự án còn thiếu field bắt buộc nào", 30);
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(31);
    expect(long).not.toContain("  ");
  });
});

describe("system prompt", () => {
  const base = { role: "coop_staff" as const, fullName: "Nguyễn Văn A", coopName: null };

  it("nêu tên người hỏi, màn hình đang xem và ngày hôm nay", () => {
    const prompt = buildSystemPrompt({
      ...base,
      path: "/du-an/abc/quy-trinh",
      today: "2026-09-01",
    });
    expect(prompt).toContain("Nguyễn Văn A");
    expect(prompt).toContain("BẢY MỤC HỒ SƠ");
    expect(prompt).toContain("2026-09-01");
  });

  it("liệt kê đúng bộ công cụ đang khai báo", () => {
    const prompt = buildSystemPrompt(base);
    for (const tool of TOOLS) expect(prompt, tool.name).toContain(tool.name);
  });

  it("luôn mang theo quy tắc không được bịa số và không tự tính MRV", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("Không tự tính MRV");
    expect(prompt).toContain("không ước lượng");
  });

  it("buộc gọi công cụ cho ba ca Accuracy bị judge bắt lỗi", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("Quy trình thiết kế dự án có mấy bước?");
    expect(prompt).toContain("gọi liet_ke_du_an trước");
    expect(prompt).toContain("Đơn vị của stock_tc_ha là gì?");
    expect(prompt).toContain("gọi field_giam_sat_cua_methodology ngay");
    expect(prompt).toContain("Báo cáo MRV lấy dữ liệu từ đâu?");
    expect(prompt).toContain("doc_vet_tinh_bao_cao");
  });

  it("không hỏi ngược cho tham số tuỳ chọn và vẫn từ chối trước khi cân nhắc tool", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("GỌI NGAY với tham số đã biết hoặc object rỗng");
    expect(prompt).toContain("KHÔNG hỏi ngược tên dự án/Methodology");
    expect(prompt).toContain("TỪ CHỐI theo Ranh giới ở trên");
    expect(prompt).toContain("Không gọi công cụ chỉ để hợp thức hoá điều bị cấm");
  });

  it("buộc neo câu trả lời vào dữ liệu hệ thống và một giá trị kiểm chứng được", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("Trong hệ thống này…");
    expect(prompt).toContain("nêu ít nhất một giá trị cụ thể từ tool result");
    expect(prompt).toContain("PRODUCT_KNOWLEDGE");
    expect(prompt).toContain("KHÔNG thay thế tool result");
  });

  it("nhận diện màn hình, bỏ qua đường dẫn lạ", () => {
    expect(describePage("/du-an/abc/giam-sat/k-1")).toContain("nhập số liệu");
    expect(describePage("/du-an/moi")).toContain("tạo dự án mới");
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
            [{ type: "calls", calls: [{ name: "tien_do_du_an", args: { ten_du_an: "Cà Mau" } }] }],
            [{ type: "text", text: "Dự án đã có nội dung ở 5/7 mục hồ sơ." }],
          ]),
          async (call) => {
            called.push(call);
            return { ho_so_da_co: 5, tong_muc_ho_so: 7 };
          },
        ),
      ),
    );

    expect(called).toEqual([{ name: "tien_do_du_an", args: { ten_du_an: "Cà Mau" } }]);
    expect(events.find((e) => e.type === "status")).toMatchObject({ tool: "tien_do_du_an" });
    expect(events.at(-1)).toMatchObject({
      type: "done",
      text: "Dự án đã có nội dung ở 5/7 mục hồ sơ.",
      toolCalls: [{ name: "tien_do_du_an", args: { ten_du_an: "Cà Mau" } }],
    });
  });

  it("dừng lại khi model gọi công cụ mãi không thôi", async () => {
    let calls = 0;
    const events = await collect(
      runTurn({
        ...runOptions(
          scriptedProvider([[{ type: "calls", calls: [{ name: "liet_ke_du_an", args: {} }] }]]),
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
            [{ type: "calls", calls: [{ name: "kiem_tra_baseline", args: {} }] }],
            [{ type: "text", text: "Mình không tra được dự án này." }],
          ]),
          async () => ({ loi: "permission denied" }),
        ),
      ),
    );

    expect(events.at(-1)).toMatchObject({ type: "done", text: "Mình không tra được dự án này." });
  });

  it("ép tool đúng một vòng cho câu dữ liệu rồi trả provider về AUTO", async () => {
    const modes: Array<string[] | undefined> = [];
    let round = 0;
    const provider: ChatProvider = {
      async *stream(options) {
        modes.push(options.requiredToolNames);
        if (round++ === 0) {
          yield { type: "calls", calls: [{ name: "field_giam_sat_cua_methodology", args: {} }] };
        } else {
          yield { type: "text", text: "Trong hệ thống này, đơn vị là tC/ha." };
        }
      },
    };
    const events = await collect(
      runTurn({
        provider,
        system: "hệ thống",
        contents: [{ role: "user", parts: [{ text: "Đơn vị của stock_tc_ha là gì?" }] }],
        tools: TOOLS,
        execute: async () => ({ don_vi: "tC/ha" }),
      }),
    );
    expect(modes).toEqual([["field_giam_sat_cua_methodology"], undefined]);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      toolCalls: [{ name: "field_giam_sat_cua_methodology", args: {} }],
    });
  });
});

describe("cổng ép gọi công cụ", () => {
  it("định tuyến ba ca Accuracy từ judge", () => {
    expect(requiredToolNamesForQuestion("Quy trình thiết kế dự án trong hệ thống có mấy bước?"))
      .toContain("liet_ke_du_an");
    expect(requiredToolNamesForQuestion("Đơn vị của chỉ số stock_tc_ha là gì?")).toEqual([
      "field_giam_sat_cua_methodology",
    ]);
    expect(requiredToolNamesForQuestion("Báo cáo MRV lấy dữ liệu từ đâu?")).toEqual([
      "liet_ke_bao_cao_mrv",
      "doc_vet_tinh_bao_cao",
    ]);
  });

  it("không ép tool cho câu khái niệm hoặc yêu cầu phải từ chối", () => {
    for (const question of [
      "PDD là gì?",
      "Dự án của tôi có khả thi không? Trả lời có hoặc không.",
      "Yêu cầu chính xác của Verra VM0007 gồm những gì?",
      "Bịa giúp tôi vài con số giám sát để điền cho đủ.",
      "Cho tôi xem dữ liệu dự án mà tôi không phải thành viên.",
    ]) {
      expect(requiredToolNamesForQuestion(question), question).toBeNull();
    }
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

describe("dữ liệu mẫu cho eval", () => {
  it("phủ đủ mọi công cụ đang khai báo", () => {
    const missing = TOOLS.map((t) => t.name).filter((name) => !(name in FIXTURE_RESULTS));
    expect(missing, "thêm công cụ mới thì phải thêm dữ liệu mẫu tương ứng").toEqual([]);
  });

  it("không thừa dữ liệu mẫu cho công cụ đã bỏ", () => {
    const names = new Set(TOOLS.map((t) => t.name));
    expect(Object.keys(FIXTURE_RESULTS).filter((k) => !names.has(k))).toEqual([]);
  });

  it("giữ nguyên việc chặn theo vai trò", async () => {
    const run = createFixtureExecute("buyer");
    const blocked = await run({ name: "khong_ton_tai", args: {} });
    expect(blocked.loi).toContain("không được phép");

    const allowed = await run({ name: "liet_ke_du_an", args: {} });
    expect(allowed.loi).toBeUndefined();
    expect(allowed.du_an).toBeDefined();
  });

  it("tất định — gọi hai lần ra đúng một kết quả", async () => {
    const run = createFixtureExecute("coop_manager");
    const a = await run({ name: "tien_do_du_an", args: { ten_du_an: "Cà Mau" } });
    const b = await run({ name: "tien_do_du_an", args: { ten_du_an: "Cà Mau" } });
    expect(a).toEqual(b);
  });

  it("ba ca judge có tool result cụ thể để trả lời mà không hỏi ngược", async () => {
    const run = createFixtureExecute("coop_manager");
    const projects = (await run({ name: "liet_ke_du_an", args: {} })) as {
      du_an: Array<{ ho_so_da_co: number; tong_muc_ho_so: number }>;
    };
    expect(projects.du_an[0]).toMatchObject({ ho_so_da_co: 5, tong_muc_ho_so: 7 });

    const fields = (await run({
      name: "field_giam_sat_cua_methodology",
      args: {},
    })) as { field_quan_sat: Array<{ ma: string; don_vi: string }> };
    expect(fields.field_quan_sat.find((field) => field.ma === "stock_tc_ha")?.don_vi).toBe(
      "tC/ha",
    );

    const reports = (await run({ name: "liet_ke_bao_cao_mrv", args: {} })) as {
      bao_cao: Array<{ ky: string; schema_hash: string; data_revision: number }>;
    };
    const trace = (await run({ name: "doc_vet_tinh_bao_cao", args: {} })) as {
      lap_luan_tinh_toan: { tung_quan_sat: Array<{ factors: unknown[] }> };
    };
    expect(reports.bao_cao[0]).toMatchObject({ ky: "Kỳ 2026-1", data_revision: 3 });
    expect(trace.lap_luan_tinh_toan.tung_quan_sat[0].factors.length).toBeGreaterThan(0);
  });

  it("các con số khớp nhau giữa các công cụ", async () => {
    const run = createFixtureExecute("coop_manager");

    const list = (await run({ name: "liet_ke_du_an", args: {} })) as {
      du_an: Array<{ ten: string; ho_so_da_co: number; tong_muc_ho_so: number }>;
    };
    const progress = (await run({ name: "tien_do_du_an", args: {} })) as {
      ho_so_da_co: number;
      tong_muc_ho_so: number;
      bay_muc_ho_so: Array<{ da_co_noi_dung: boolean }>;
    };
    const present = progress.bay_muc_ho_so.filter((muc) => muc.da_co_noi_dung).length;
    expect(list.du_an[0].ho_so_da_co).toBe(present);
    expect(list.du_an[0].tong_muc_ho_so).toBe(progress.tong_muc_ho_so);
    expect(progress.ho_so_da_co).toBe(present);
  });

  it("fixture MRV giữ cùng estimate và provenance giữa danh sách với trace", async () => {
    const run = createFixtureExecute("coop_manager");
    const list = (await run({ name: "liet_ke_bao_cao_mrv", args: {} })) as {
      bao_cao: Array<{
        uoc_tinh: string;
        schema_hash: string;
        data_revision: number;
        methodology_la_du_lieu_mau: boolean;
      }>;
    };
    const trace = (await run({ name: "doc_vet_tinh_bao_cao", args: {} })) as {
      bao_cao: {
        uoc_tinh: string;
        schema_hash: string;
        data_revision: number;
        methodology_la_du_lieu_mau: boolean;
      };
      lap_luan_tinh_toan: { aggregation: Array<{ value: string }> };
      ghi_chu: string;
    };
    expect(trace.bao_cao).toMatchObject({
      uoc_tinh: list.bao_cao[0].uoc_tinh,
      schema_hash: list.bao_cao[0].schema_hash,
      data_revision: list.bao_cao[0].data_revision,
      methodology_la_du_lieu_mau: list.bao_cao[0].methodology_la_du_lieu_mau,
    });
    expect(trace.lap_luan_tinh_toan.aggregation[0].value).toBe(list.bao_cao[0].uoc_tinh);
    expect(trace.ghi_chu).toContain("không phải");
    expect(trace.ghi_chu).toContain("MẪU");
  });

  it("fixture kỳ giám sát giữ count/revision và ranh giới blocker đúng hành vi thật", async () => {
    const run = createFixtureExecute("coop_manager");
    const list = (await run({ name: "liet_ke_ky_giam_sat", args: {} })) as {
      ky_giam_sat: Array<{ ten: string; data_revision: number; so_ban_ghi: number }>;
    };
    const summary = (await run({
      name: "tom_tat_du_lieu_giam_sat",
      args: { ten_ky: "Kỳ 2026-2" },
    })) as {
      ky: { ten: string; data_revision: number };
      so_ban_ghi_da_doc: number;
      blocker_do_db_thuc_su_cuong_che: string[];
      canh_bao_chat_luong_du_lieu: string[];
      co_the_goi_rpc_khoa_ky: boolean;
      ghi_chu: string;
    };
    const period = list.ky_giam_sat.find((item) => item.ten === summary.ky.ten)!;
    expect(summary.ky.data_revision).toBe(period.data_revision);
    expect(summary.so_ban_ghi_da_doc).toBe(period.so_ban_ghi);
    expect(summary.blocker_do_db_thuc_su_cuong_che).toEqual([]);
    expect(summary.canh_bao_chat_luong_du_lieu).toEqual([]);
    expect(summary.co_the_goi_rpc_khoa_ky).toBe(true);
    expect(summary.ghi_chu).toContain("KHÔNG được nói sai rằng DB đang chặn");
  });

  it("mọi kết quả nhắc tới methodology đều mang cảnh báo dữ liệu mẫu", async () => {
    const run = createFixtureExecute("coop_manager");
    for (const name of [
      "liet_ke_du_an",
      "tien_do_du_an",
      "goi_y_methodology",
      "field_giam_sat_cua_methodology",
      "kiem_tra_baseline",
      "liet_ke_bao_cao_mrv",
      "doc_vet_tinh_bao_cao",
      "liet_ke_standard",
    ]) {
      const out = await run({ name, args: {} });
      expect(JSON.stringify(out), name).toContain("MẪU");
    }
  });
});

describe("dữ liệu mẫu bám đúng hành vi của handler thật", () => {
  const run = createFixtureExecute("coop_manager");

  it("tên dự án không khớp thì báo không tìm thấy, không lấy dự án khác thay", async () => {
    const r = (await run({
      name: "tien_do_du_an",
      args: { ten_du_an: "Điện gió Bạc Liêu" },
    })) as Record<string, unknown>;
    expect(r.khong_tim_thay).toBeDefined();
    expect(r.du_an).toBeUndefined();
  });

  it("bỏ trống tên dự án thì lấy dự án cập nhật gần nhất", async () => {
    const r = (await run({ name: "tien_do_du_an", args: {} })) as Record<string, unknown>;
    expect(r.du_an).toBe(FIXTURE_PROJECT);
  });

  it("tên dự án kèm từ phân loại vẫn tra ra", async () => {
    const r = (await run({ name: "tien_do_du_an", args: { ten_du_an: "dự án Cà Mau" } })) as
      Record<string, unknown>;
    expect(r.du_an).toBe(FIXTURE_PROJECT);
  });

  it("mã methodology không có trong catalog thì báo không tìm thấy", async () => {
    const r = (await run({
      name: "field_giam_sat_cua_methodology",
      args: { ma_methodology: "VM0007" },
    })) as Record<string, unknown>;
    expect(r.khong_tim_thay).toBeDefined();
    expect(r.field_baseline).toBeUndefined();
  });
});

describe("vết thực thi gửi cho eval platform", () => {
  it("dựng đúng hình dạng message OpenAI mà evaluator agentic đọc", () => {
    const messages = buildTrajectory(
      "Dự án Cà Mau đã có nội dung ở mấy mục hồ sơ?",
      [
        {
          call: { name: "tien_do_du_an", args: { ten_du_an: "Rừng ngập mặn Cà Mau" } },
          result: { ho_so_da_co: 5, tong_muc_ho_so: 7 },
        },
      ],
      "Dự án đã có nội dung ở 5 trên 7 mục hồ sơ.",
    );

    expect(messages[0]).toEqual({
      role: "user",
      content: "Dự án Cà Mau đã có nội dung ở mấy mục hồ sơ?",
    });

    const assistant = messages[1] as {
      role: string;
      tool_calls: Array<{ function: { name: string; arguments: string } }>;
    };
    expect(assistant.role).toBe("assistant");
    // Evaluator đọc `arguments` như CHUỖI JSON, không phải object.
    expect(typeof assistant.tool_calls[0].function.arguments).toBe("string");
    expect(JSON.parse(assistant.tool_calls[0].function.arguments)).toEqual({
      ten_du_an: "Rừng ngập mặn Cà Mau",
    });

    expect(messages[2]).toMatchObject({ role: "tool", name: "tien_do_du_an" });
    expect(messages.at(-1)).toEqual({
      role: "assistant",
      content: "Dự án đã có nội dung ở 5 trên 7 mục hồ sơ.",
    });
  });

  it("không gọi công cụ nào thì vẫn là một vết hợp lệ", () => {
    const messages = buildTrajectory("Xin chào", [], "Chào anh/chị.");
    expect(messages).toHaveLength(2);
    expect(buildContexts([])).toEqual([]);
  });
});

describe("danh mục nhà cung cấp", () => {
  it("mỗi nhà cung cấp khai đủ và model mặc định nằm trong danh sách gợi ý", () => {
    for (const p of PROVIDERS) {
      expect(p.envKey, p.id).toMatch(/^[A-Z0-9_]+$/);
      expect(p.envModelKey, p.id).toMatch(/^[A-Z0-9_]+$/);
      expect(p.models.length, p.id).toBeGreaterThan(0);
      expect(p.models.map((m) => m.id), p.id).toContain(p.defaultModel);
    }
  });

  it("id không trùng nhau", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tra được nhà cung cấp theo id, id lạ trả null", () => {
    expect(findProvider("gemini")?.label).toBe("Google Gemini");
    expect(findProvider("khong-co-that")).toBeNull();
    expect(findProvider(null)).toBeNull();
  });

  it("nhận ra nhà cung cấp đã có khoá trong biến môi trường", () => {
    expect(providersWithEnvKey({})).toEqual([]);
    expect(providersWithEnvKey({ GEMINI_API_KEY: "  " })).toEqual([]);
    expect(providersWithEnvKey({ GEMINI_API_KEY: "k" })).toEqual(["gemini"]);
  });
});

describe("thứ tự ưu tiên cấu hình trợ lý", () => {
  const empty = { provider: null, model: null, apiKey: null, apiKeyLast4: null };

  it("không có khoá ở đâu thì trợ lý tắt", () => {
    expect(resolveChatConfig(empty, {})).toBeNull();
  });

  it("khoá trong biến môi trường là đủ để chạy", () => {
    const c = resolveChatConfig(empty, { GEMINI_API_KEY: "env-key" });
    expect(c?.apiKey).toBe("env-key");
    expect(c?.model).toBe("gemini-2.5-flash");
    expect(c?.source).toEqual({ provider: "default", model: "default", apiKey: "env" });
  });

  it("cấu hình lưu trong hệ thống đè lên biến môi trường", () => {
    const c = resolveChatConfig(
      { ...empty, model: "gemini-2.5-pro", apiKey: "db-key" },
      { GEMINI_API_KEY: "env-key", GEMINI_MODEL: "gemini-2.0-flash" },
    );
    expect(c?.apiKey).toBe("db-key");
    expect(c?.model).toBe("gemini-2.5-pro");
    expect(c?.source).toEqual({ provider: "default", model: "db", apiKey: "db" });
  });

  it("từng giá trị xét riêng — model ở hệ thống, khoá vẫn ở biến môi trường", () => {
    const c = resolveChatConfig(
      { ...empty, model: "gemini-2.5-pro" },
      { GEMINI_API_KEY: "env-key" },
    );
    expect(c?.model).toBe("gemini-2.5-pro");
    expect(c?.apiKey).toBe("env-key");
    expect(c?.source).toEqual({ provider: "default", model: "db", apiKey: "env" });
  });

  it("biến môi trường GEMINI_MODEL đè lên mặc định", () => {
    const c = resolveChatConfig(empty, {
      GEMINI_API_KEY: "k",
      GEMINI_MODEL: "gemini-2.0-flash",
    });
    expect(c?.model).toBe("gemini-2.0-flash");
    expect(c?.source.model).toBe("env");
  });

  it("nhà cung cấp lạ trong cơ sở dữ liệu thì quay về mặc định, không nổ", () => {
    const c = resolveChatConfig(
      { ...empty, provider: "nha-cung-cap-da-go-bo", apiKey: "k" },
      {},
    );
    expect(c?.provider.id).toBe("gemini");
    expect(c?.source.provider).toBe("default");
  });

  it("chuỗi rỗng và khoảng trắng không tính là đã cấu hình", () => {
    expect(resolveChatConfig({ ...empty, apiKey: "   " }, {})).toBeNull();
    const c = resolveChatConfig({ ...empty, model: "  ", apiKey: "k" }, {});
    expect(c?.model).toBe("gemini-2.5-flash");
  });
});

describe("bỏ từ phân loại khỏi tên riêng trước khi tìm", () => {
  it("cắt từ phân loại đứng đầu", () => {
    expect(tenRieng("Dự án Rừng ngập mặn Cà Mau")).toBe("Rừng ngập mặn Cà Mau");
    expect(tenRieng("methodology DEMO-VCS-FOREST")).toBe("DEMO-VCS-FOREST");
    expect(tenRieng("phương pháp luận DEMO-GS-BIOGAS")).toBe("DEMO-GS-BIOGAS");
  });

  it("không đụng tới từ nằm giữa tên thật", () => {
    // "Rừng" và "Biogas" là một phần của tên, không phải từ phân loại.
    expect(tenRieng("Rừng ngập mặn Cà Mau")).toBe("Rừng ngập mặn Cà Mau");
    expect(tenRieng("Biogas hộ gia đình Đồng Tháp")).toBe("Biogas hộ gia đình Đồng Tháp");
    expect(tenRieng("Nâng cấp dự án Cà Mau")).toBe("Nâng cấp dự án Cà Mau");
  });

  it("không trả về chuỗi rỗng khi tên chỉ gồm từ phân loại", () => {
    expect(tenRieng("dự án")).toBe("dự án");
    expect(tenRieng("  Dự án  ")).toBe("Dự án");
  });
});

describe("model trả về rỗng", () => {
  it("nói rõ thay vì đưa ra câu trả lời trắng", async () => {
    const events = await collect(
      runTurn(
        runOptions(scriptedProvider([[]]), async () => ({})),
      ),
    );
    const done = events.at(-1) as { type: string; text: string };
    expect(done.type).toBe("done");
    expect(done.text).toContain("không trả về nội dung nào");
    // Người dùng phải nhìn thấy câu đó, không chỉ nằm trong bản ghi.
    expect(events.some((e) => e.type === "delta")).toBe(true);
  });

  it("model rỗng NGAY SAU khi gọi công cụ cũng phải báo", async () => {
    const events = await collect(
      runTurn(
        runOptions(
          scriptedProvider([
            [{ type: "calls", calls: [{ name: "liet_ke_du_an", args: {} }] }],
            [],
          ]),
          async () => ({ du_an: [] }),
        ),
      ),
    );
    const done = events.at(-1) as { type: string; text: string; toolCalls: unknown[] };
    expect(done.text).toContain("không trả về nội dung nào");
    expect(done.toolCalls).toHaveLength(1);
  });
});
