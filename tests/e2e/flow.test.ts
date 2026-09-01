import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { signedIn, square } from "./helpers";
import { computeAndSave } from "@/lib/mrv/collect";
import { loadFactors } from "@/lib/mrv/factors";

/**
 * Chạy trọn vòng đời một dự án carbon trên cơ sở dữ liệu thật, qua khoá công khai
 * nên mọi truy vấn đều chịu RLS đúng như từ trình duyệt.
 */

const PASSWORD = "MatKhau12345";
let coop: SupabaseClient<Database>;
let buyer: SupabaseClient<Database>;
let coopId: string;
let coopUserId: string;
let farmerA: string;
let farmerB: string;
let fieldA: string;
let seasonId: string;
let fieldSeasonA: string;
let batchId: string;
let orderId: string;
let areaHaA: number;

/**
 * Mỗi lần chạy dùng mã và toạ độ riêng để không đụng dữ liệu của lần chạy trước —
 * cơ sở dữ liệu thật không được dọn sạch giữa các lần chạy.
 */
const RUN = Date.now().toString().slice(-7);
let originLng: number;
let originLat: number;

beforeAll(async () => {
  coop = await signedIn("htx@test.local", PASSWORD);
  buyer = await signedIn("dn@test.local", PASSWORD);
  coopUserId = (await coop.auth.getUser()).data.user!.id;

  // Rải các thửa của lần chạy này ra một góc riêng của bản đồ.
  originLng = 105 + (Number(RUN) % 900) / 1000;
  originLat = 9 + (Math.floor(Number(RUN) / 900) % 900) / 1000;
});

describe("1. Thiết lập hợp tác xã", () => {
  it("cán bộ tạo được đơn vị và tự động gắn vào đó", async () => {
    const { data: before } = await coop
      .from("profiles")
      .select("cooperative_id")
      .eq("id", coopUserId)
      .single();

    if (before?.cooperative_id) {
      // Lần chạy trước đã tạo; nhánh tạo mới chỉ chạy trên cơ sở dữ liệu sạch.
      coopId = before.cooperative_id;
    } else {
      const { data, error } = await coop.rpc("create_cooperative_and_join", {
        p_name: "HTX Nông nghiệp Tân Phú",
        p_code: `TANPHU${RUN}`,
        p_province: "Hưng Yên",
        p_region: "north",
        p_commune: "Phường Thái Bình",
        p_contact_name: "Trần Văn Bảy",
        p_contact_phone: "0901234567",
      });
      expect(error).toBeNull();
      coopId = data as string;
    }

    const { data: profile } = await coop.from("profiles").select("cooperative_id, role").eq("id", coopUserId).single();
    expect(profile?.cooperative_id).toBe(coopId);
    expect(profile?.role).toBe("coop_manager");
  });

  it("đã thuộc một hợp tác xã thì không tạo thêm đơn vị nữa", async () => {
    const { error } = await coop.rpc("create_cooperative_and_join", {
      p_name: "HTX thứ hai",
      p_code: `KHAC${RUN}`,
      p_province: "Hưng Yên",
      p_region: "north",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("đã thuộc một hợp tác xã");
  });

  it("không tự nâng quyền lên quản trị nền tảng được", async () => {
    const { error } = await coop.from("profiles").update({ role: "platform_admin" }).eq("id", coopUserId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("Không thể tự thay đổi vai trò");
  });
});

describe("2. Nông hộ và thửa ruộng", () => {
  it("thêm được nông hộ", async () => {
    const { data, error } = await coop
      .from("farmers")
      .insert([
        { cooperative_id: coopId, full_name: "Nguyễn Văn A", member_code: `XV-${RUN}-1`, village: "Ấp Bình Hoà" },
        { cooperative_id: coopId, full_name: "Phạm Thị B", member_code: `XV-${RUN}-2`, village: "Ấp Bình Hoà" },
      ])
      .select("id, full_name");
    expect(error).toBeNull();
    farmerA = data!.find((f) => f.full_name === "Nguyễn Văn A")!.id;
    farmerB = data!.find((f) => f.full_name === "Phạm Thị B")!.id;
  });

  it("không chèn được nông hộ vào hợp tác xã khác", async () => {
    const { error } = await coop.from("farmers").insert({
      cooperative_id: "00000000-0000-0000-0000-000000000001",
      full_name: "Hộ giả mạo",
    });
    expect(error).not.toBeNull();
  });

  it("diện tích thửa tính từ hình học, không lấy số hộ khai", async () => {
    const { data, error } = await coop.rpc("save_field", {
      p_farmer_id: farmerA,
      p_name: "Ruộng sau nhà",
      p_geojson: square(originLng, originLat, 0.002),
      p_declared_area_ha: 9.9, // hộ khai sai lệch hẳn
    });
    expect(error).toBeNull();

    const r = data as unknown as { field_id: string; area_ha: number; overlaps: unknown[] };
    fieldA = r.field_id;
    areaHaA = Number(r.area_ha);

    // Ô vuông 0,002° ở vĩ độ 10 ≈ 222 m × 219 m ≈ 4,87 ha — không phải 9,9 ha hộ khai.
    expect(areaHaA).toBeGreaterThan(4.7);
    expect(areaHaA).toBeLessThan(5.0);
    expect(r.overlaps).toHaveLength(0);
  });

  it("thửa thứ hai không chồng lấn thì không cảnh báo", async () => {
    const { data, error } = await coop.rpc("save_field", {
      p_farmer_id: farmerB,
      p_name: "Ruộng bờ kênh",
      p_geojson: square(originLng + 0.01, originLat, 0.002),
    });
    expect(error).toBeNull();
    expect((data as unknown as { overlaps: unknown[] }).overlaps).toHaveLength(0);
  });

  it("khai trùng lên thửa đã có thì báo chồng lấn kèm tên hộ", async () => {
    const { data, error } = await coop.rpc("save_field", {
      p_farmer_id: farmerB,
      p_name: "Thửa khai trùng",
      p_geojson: square(originLng + 0.001, originLat + 0.001, 0.002), // đè lên phần lớn thửa của hộ A
    });
    expect(error).toBeNull();

    const overlaps = (data as unknown as {
      overlaps: Array<{ label: string; overlap_ha: number; same_cooperative: boolean }>;
    }).overlaps;

    expect(overlaps.length).toBeGreaterThan(0);
    expect(overlaps[0].label).toContain("Nguyễn Văn A");
    expect(overlaps[0].overlap_ha).toBeGreaterThan(1);
    expect(overlaps[0].same_cooperative).toBe(true);
  });

  it("từ chối ranh thửa nhỏ bất thường", async () => {
    const { error } = await coop.rpc("save_field", {
      p_farmer_id: farmerA,
      p_name: "Thửa vẽ nhầm",
      p_geojson: square(originLng + 0.05, originLat + 0.05, 0.00005), // ~30 m²
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("nhỏ hơn 100 m2");
  });
});

describe("3. Mùa vụ và nhật ký canh tác", () => {
  it("tạo vụ và đăng ký thửa", async () => {
    const { data: season, error } = await coop
      .from("seasons")
      .insert({
        cooperative_id: coopId,
        name: `Vụ Xuân 2026 (${RUN})`,
        season_type: "early",
        start_date: "2025-11-15",
        end_date: "2026-03-20",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    seasonId = season!.id;

    const { data: fs, error: fsError } = await coop
      .from("field_seasons")
      .insert({
        cooperative_id: coopId,
        season_id: seasonId,
        field_id: fieldA,
        transplant_date: "2025-12-01",
        harvest_date: "2026-03-11", // đúng 100 ngày
        preseason_water: "non_flooded_short",
        baseline_water_regime: "continuously_flooded",
      })
      .select("id")
      .single();
    expect(fsError).toBeNull();
    fieldSeasonA = fs!.id;
  });

  it("chưa đủ nhật ký thì engine từ chối tính và nói rõ thiếu gì", async () => {
    const result = await computeAndSave(coop, fieldSeasonA, coopId, coopUserId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing.join(" ")).toContain("rơm rạ");
  });

  it("ghi lịch nước, phân bón và cách xử lý rơm rạ", async () => {
    const { error: waterError } = await coop.from("water_events").insert([
      { cooperative_id: coopId, field_season_id: fieldSeasonA, event_date: "2025-12-20", event_type: "drainage" },
      { cooperative_id: coopId, field_season_id: fieldSeasonA, event_date: "2025-12-27", event_type: "reflood" },
      { cooperative_id: coopId, field_season_id: fieldSeasonA, event_date: "2026-01-15", event_type: "drainage" },
      { cooperative_id: coopId, field_season_id: fieldSeasonA, event_date: "2026-01-22", event_type: "reflood" },
      { cooperative_id: coopId, field_season_id: fieldSeasonA, event_date: "2026-02-10", event_type: "drainage" },
    ]);
    expect(waterError).toBeNull();

    const { error: fertError } = await coop.from("fertilizer_applications").insert({
      cooperative_id: coopId,
      field_season_id: fieldSeasonA,
      applied_date: "2025-12-10",
      product_name: "Ure",
      amount_kg: 100,
      n_content_pct: 46,
    });
    expect(fertError).toBeNull();

    const { error: strawError } = await coop.from("straw_management").insert({
      cooperative_id: coopId,
      field_season_id: fieldSeasonA,
      method: "incorporated_long",
      baseline_method: "burned",
      amount_t_per_ha: 5,
      days_before_cultivation: 45,
    });
    expect(strawError).toBeNull();
  });
});

describe("4. Tính giảm phát thải", () => {
  it("tính và lưu được kết quả", async () => {
    const result = await computeAndSave(coop, fieldSeasonA, coopId, coopUserId);
    expect(result.ok).toBe(true);
  });

  it("dùng hệ số phát thải nền của miền Bắc vụ đầu năm, không dùng mặc định toàn cầu", async () => {
    const { data: calc } = await coop
      .from("emission_calculations")
      .select("methodology_version, factors")
      .eq("field_season_id", fieldSeasonA)
      .eq("is_current", true)
      .single();

    const factors = calc!.factors as Record<string, unknown>;
    expect(calc!.methodology_version).toBe("IPCC2019-VN-TIER2-1.0");
    expect(factors.ef_c_source_key).toBe("ef_c_north_early");
    // Vo et al. 2020 đo 2,21 cho miền Bắc vụ Xuân — cao hơn hẳn mặc định IPCC 1,19.
    expect(Number(factors.ef_c_baseline)).toBe(2.21);
  });

  it("con số khớp với phép tính tay theo công thức IPCC", async () => {
    const { data: calc } = await coop
      .from("emission_calculations")
      .select("*")
      .eq("field_season_id", fieldSeasonA)
      .eq("is_current", true)
      .single();

    const A = areaHaA;
    const t = 100;

    // Hệ số nền miền Bắc vụ đầu năm: 2,21 kg CH4/ha/ngày (Vo et al. 2020).
    const efc = 2.21;
    // Nền: ngập liên tục (SFw 1.0), không vùi rơm vì tập quán cũ là đốt (SFo 1.0).
    const baselineCh4 = efc * 1.0 * 1.0 * 1.0 * t * A;
    // Dự án: tháo nước 3 lần → SFw 0.55; rơm vùi trên 30 ngày → SFo = (1+5×0.29)^0.59.
    const sfo = Math.pow(1 + 5 * 0.29, 0.59);
    const projectCh4 = efc * 0.55 * 1.0 * sfo * t * A;
    // 100 kg ure × 46% = 46 kg N, giống nhau ở cả hai kịch bản.
    const n2o = 46 * 0.004 * (44 / 28);
    // Đốt 5 tấn rơm/ha: 5000 × 0.85 × 0.80 = 3400 kg chất khô.
    const dm = 5 * 1000 * 0.85 * 0.8;
    const burnPerHa = ((dm * 2.7) / 1000 * 28 + (dm * 0.07) / 1000 * 265) / 1000;

    expect(Number(calc!.baseline_ch4_kg)).toBeCloseTo(baselineCh4, 3);
    expect(Number(calc!.project_ch4_kg)).toBeCloseTo(projectCh4, 3);
    expect(Number(calc!.baseline_n2o_kg)).toBeCloseTo(n2o, 3);
    expect(Number(calc!.baseline_burning_co2e_t)).toBeCloseTo(burnPerHa * A, 3);
    expect(Number(calc!.project_burning_co2e_t)).toBe(0);

    const baselineCo2e = (baselineCh4 * 28 + n2o * 265) / 1000 + burnPerHa * A;
    const projectCo2e = (projectCh4 * 28 + n2o * 265) / 1000;
    expect(Number(calc!.baseline_co2e_t)).toBeCloseTo(baselineCo2e, 3);
    expect(Number(calc!.project_co2e_t)).toBeCloseTo(projectCo2e, 3);
    expect(Number(calc!.reduction_co2e_t)).toBeCloseTo(baselineCo2e - projectCo2e, 3);
    expect(Number(calc!.reduction_co2e_t)).toBeGreaterThan(0);
  });

  it("lưu lại phiên bản phương pháp luận và tham số đầu vào để tái lập", async () => {
    const { data: calc } = await coop
      .from("emission_calculations")
      .select("methodology_version, inputs, factors")
      .eq("field_season_id", fieldSeasonA)
      .eq("is_current", true)
      .single();

    expect(calc!.methodology_version).toBe("IPCC2019-VN-TIER2-1.0");
    const inputs = calc!.inputs as Record<string, unknown>;
    expect(inputs.drainageCount).toBe(3);
    expect((inputs.derived as Record<string, unknown>).projectWaterRegime).toBe("multiple_aeration");
    expect((calc!.factors as Record<string, number>).sfw_multiple_aeration).toBe(0.55);
  });

  it("tính lại thì bản cũ mất hiệu lực, chỉ còn đúng một bản hiện hành", async () => {
    await computeAndSave(coop, fieldSeasonA, coopId, coopUserId);
    const { data: all } = await coop
      .from("emission_calculations")
      .select("id, is_current")
      .eq("field_season_id", fieldSeasonA);

    expect(all!.length).toBeGreaterThanOrEqual(2);
    expect(all!.filter((c) => c.is_current)).toHaveLength(1);
  });
});

describe("4b. Chọn hệ số theo vùng và vụ", () => {
  it("miền Bắc không có vụ giữa năm nên phải báo lỗi thay vì lấy đại một hệ số", async () => {
    await expect(
      loadFactors(coop, "IPCC2019-VN-TIER2-1.0", { region: "north", seasonType: "mid" }),
    ).rejects.toThrow(/miền Bắc vụ giữa năm/);
  });

  it("mỗi vùng và vụ cho một hệ số nền khác nhau", async () => {
    const bacXuan = await loadFactors(coop, "IPCC2019-VN-TIER2-1.0", { region: "north", seasonType: "early" });
    const bacMua = await loadFactors(coop, "IPCC2019-VN-TIER2-1.0", { region: "north", seasonType: "late" });
    const namXuan = await loadFactors(coop, "IPCC2019-VN-TIER2-1.0", { region: "south", seasonType: "early" });

    expect(bacXuan.ef_c_baseline).toBe(2.21);
    expect(bacMua.ef_c_baseline).toBe(3.89);
    expect(namXuan.ef_c_baseline).toBe(1.72);
    // Vụ Mùa miền Bắc phát thải nền cao hơn hẳn Vụ Xuân.
    expect(bacMua.ef_c_baseline).toBeGreaterThan(bacXuan.ef_c_baseline);
  });
});

describe("5. Gộp lô tín chỉ", () => {
  it("tạo và gộp lô, khoá các thửa-vụ đã gộp", async () => {
    const { data: batch, error } = await coop
      .from("credit_batches")
      .insert({
        cooperative_id: coopId,
        season_id: seasonId,
        code: `LO-${RUN}`,
        name: "Lúa AWD Đông Xuân 2025–2026",
        description: "Áp dụng tưới ngập khô xen kẽ và ngừng đốt rơm.",
        buffer_pct: 15,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    batchId = batch!.id;

    const { data: built, error: buildError } = await coop.rpc("build_credit_batch", { p_batch_id: batchId });
    expect(buildError).toBeNull();
    expect((built as unknown as { items: number }).items).toBe(1);

    const { data: fs } = await coop.from("field_seasons").select("is_locked").eq("id", fieldSeasonA).single();
    expect(fs!.is_locked).toBe(true);
  });

  it("thửa-vụ đã khoá thì không sửa nhật ký được nữa", async () => {
    const { error } = await coop.from("water_events").insert({
      cooperative_id: coopId,
      field_season_id: fieldSeasonA,
      event_date: "2026-02-25",
      event_type: "drainage",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("đã khoá");
  });

  it("đệm rủi ro 15% được trừ khỏi lượng phát hành", async () => {
    const { data: batch } = await coop
      .from("credit_batches")
      .select("gross_co2e_t, issuable_co2e_t")
      .eq("id", batchId)
      .single();

    expect(Number(batch!.issuable_co2e_t)).toBeCloseTo(Number(batch!.gross_co2e_t) * 0.85, 3);
  });

  it("đưa lô lên sàn kèm giá", async () => {
    const { error } = await coop
      .from("credit_batches")
      .update({ status: "listed", price_per_t_vnd: 450000, listed_at: new Date().toISOString() })
      .eq("id", batchId);
    expect(error).toBeNull();
  });
});

describe("6. Ranh giới dữ liệu giữa các vai trò", () => {
  it("doanh nghiệp không đọc được danh sách nông hộ", async () => {
    const { data } = await buyer.from("farmers").select("id");
    expect(data).toEqual([]);
  });

  it("doanh nghiệp không đọc được nhật ký canh tác", async () => {
    const { data } = await buyer.from("water_events").select("id");
    expect(data).toEqual([]);
  });

  it("doanh nghiệp không xem được chi tiết từng thửa trong lô", async () => {
    const { data } = await buyer.from("batch_items").select("id");
    expect(data).toEqual([]);
  });

  it("doanh nghiệp thấy được lô đang chào bán", async () => {
    const { data } = await buyer.from("credit_batches").select("id, name").eq("id", batchId);
    expect(data).toHaveLength(1);
  });

  it("hợp tác xã không đặt mua tín chỉ được", async () => {
    const { error } = await coop.rpc("place_order", { p_batch_id: batchId, p_quantity: 1 });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("doanh nghiệp");
  });
});

describe("7. Đặt mua và thanh toán thử", () => {
  it("không đặt quá lượng còn khả dụng", async () => {
    const { error } = await buyer.rpc("place_order", { p_batch_id: batchId, p_quantity: 99999 });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("khả dụng");
  });

  it("đặt được đơn hợp lệ và sinh sẵn bản ghi thanh toán", async () => {
    const { data, error } = await buyer.rpc("place_order", {
      p_batch_id: batchId,
      p_quantity: 2,
      p_note: "Bù đắp phát thải quý I.",
    });
    expect(error).toBeNull();
    orderId = data as string;

    const { data: order } = await buyer
      .from("orders")
      .select("status, total_vnd, quantity_co2e_t, payments ( status, provider )")
      .eq("id", orderId)
      .single();

    expect(order!.status).toBe("awaiting_payment");
    expect(Number(order!.total_vnd)).toBe(2 * 450000);
    expect(order!.payments[0].status).toBe("pending");
    expect(order!.payments[0].provider).toBe("sandbox");
  });

  it("giả lập thất bại thì đơn vẫn chờ thanh toán", async () => {
    const { data, error } = await buyer.rpc("settle_sandbox_payment", {
      p_order_id: orderId,
      p_succeed: false,
    });
    expect(error).toBeNull();
    expect((data as unknown as { status: string }).status).toBe("failed");

    const { data: order } = await buyer.from("orders").select("status").eq("id", orderId).single();
    expect(order!.status).toBe("awaiting_payment");
  });

  it("đơn đang chờ thanh toán vẫn giữ chỗ, không cho bán trùng lượng đó", async () => {
    // Đơn 2 tCO2e ở trên chưa thanh toán nhưng đã chiếm chỗ, nên lô gần như hết hàng.
    const { data: batch } = await coop
      .from("credit_batches")
      .select("issuable_co2e_t")
      .eq("id", batchId)
      .single();

    const { error } = await buyer.rpc("place_order", {
      p_batch_id: batchId,
      p_quantity: Number(batch!.issuable_co2e_t),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("khả dụng");
  });

  it("thanh toán thành công thì chia doanh thu theo tỷ trọng đóng góp", async () => {
    // Bản ghi thanh toán trước đã chuyển sang thất bại nên cần đơn mới; lấy lượng nhỏ
    // vì đơn 2 tCO2e chưa thanh toán vẫn đang giữ chỗ phần lớn lô.
    const quantity = 0.2;
    const { data: newOrder, error: orderError } = await buyer.rpc("place_order", {
      p_batch_id: batchId,
      p_quantity: quantity,
    });
    expect(orderError).toBeNull();
    const id = newOrder as string;

    const { data, error } = await buyer.rpc("settle_sandbox_payment", { p_order_id: id, p_succeed: true });
    expect(error).toBeNull();

    const settled = data as unknown as { status: string; platform: number; cooperative: number; farmer: number };
    expect(settled.status).toBe("succeeded");

    const total = quantity * 450000;
    expect(settled.platform).toBeCloseTo(total * 0.12, 2);
    expect(settled.cooperative).toBeCloseTo(total * 0.08, 2);
    expect(settled.farmer).toBeCloseTo(total * 0.8, 2);
    // Phần lớn doanh thu phải về tay nông dân — đúng cam kết của mô hình.
    expect(settled.farmer).toBeGreaterThan(settled.platform + settled.cooperative);

    const { data: order } = await buyer.from("orders").select("status").eq("id", id).single();
    expect(order!.status).toBe("paid");
  });

  it("hợp tác xã xem được bảng chia doanh thu, doanh nghiệp thì không", async () => {
    const { data: coopView } = await coop
      .from("revenue_shares")
      .select("farmer_amount_vnd, breakdown, orders!inner ( batch_id )")
      .eq("orders.batch_id", batchId);
    expect(coopView!.length).toBeGreaterThan(0);

    const farmers = (coopView![0].breakdown as { farmers: Array<{ farmer_name: string; amount_vnd: number }> }).farmers;
    expect(farmers[0].farmer_name).toBe("Nguyễn Văn A");
    expect(farmers[0].amount_vnd).toBeGreaterThan(0);

    const { data: buyerView } = await buyer.from("revenue_shares").select("farmer_amount_vnd");
    expect(buyerView).toEqual([]);
  });

  it("lượng đã bán được cộng dồn vào lô", async () => {
    const { data: batch } = await coop.from("credit_batches").select("sold_co2e_t").eq("id", batchId).single();
    expect(Number(batch!.sold_co2e_t)).toBe(0.2);
  });
});

describe("8. Hội thoại với trợ lý là riêng tư", () => {
  let conversationId: string;

  it("mỗi người mở được hội thoại của chính mình", async () => {
    const { data, error } = await coop
      .from("chat_conversations")
      .insert({ user_id: coopUserId, cooperative_id: coopId, title: "Hỏi về vụ Xuân" })
      .select("id")
      .single();
    expect(error).toBeNull();
    conversationId = data!.id;

    const { error: msgError } = await coop.from("chat_messages").insert({
      conversation_id: conversationId,
      user_id: coopUserId,
      role: "user",
      content: "Vụ này còn thửa nào chưa tính MRV?",
    });
    expect(msgError).toBeNull();
  });

  it("người khác không đọc được hội thoại và tin nhắn của mình", async () => {
    const { data: convos } = await buyer
      .from("chat_conversations")
      .select("id")
      .eq("id", conversationId);
    expect(convos).toEqual([]);

    const { data: messages } = await buyer
      .from("chat_messages")
      .select("content")
      .eq("conversation_id", conversationId);
    expect(messages).toEqual([]);
  });

  it("không chèn được tin nhắn vào hội thoại của người khác", async () => {
    const buyerId = (await buyer.auth.getUser()).data.user!.id;
    const { error } = await buyer.from("chat_messages").insert({
      conversation_id: conversationId,
      user_id: buyerId,
      role: "user",
      content: "Chen ngang vào hội thoại người khác",
    });
    expect(error).not.toBeNull();
  });

  it("không mạo danh người khác để ghi tin nhắn", async () => {
    const buyerId = (await buyer.auth.getUser()).data.user!.id;
    const { data: own } = await buyer
      .from("chat_conversations")
      .insert({ user_id: buyerId, title: "Hội thoại của doanh nghiệp" })
      .select("id")
      .single();

    const { error } = await buyer.from("chat_messages").insert({
      conversation_id: own!.id,
      user_id: coopUserId,
      role: "user",
      content: "Mạo danh cán bộ hợp tác xã",
    });
    expect(error).not.toBeNull();
  });

  it("hội thoại vừa có tin nhắn được đẩy lên đầu danh sách", async () => {
    const { data: before } = await coop
      .from("chat_conversations")
      .select("updated_at")
      .eq("id", conversationId)
      .single();

    await coop.from("chat_messages").insert({
      conversation_id: conversationId,
      user_id: coopUserId,
      role: "assistant",
      content: "Mình đã tra giúp anh/chị.",
      tool_calls: [{ name: "thua_thieu_nhat_ky", args: {} }],
    });

    const { data: after } = await coop
      .from("chat_conversations")
      .select("updated_at")
      .eq("id", conversationId)
      .single();

    expect(new Date(after!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before!.updated_at).getTime(),
    );
  });
});
