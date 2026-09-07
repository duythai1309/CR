import { describe, expect, it } from "vitest";
import {
  countPresentDossiers,
  dossierPresence,
  journeyPhases,
} from "@/components/project/journey-rail";

/**
 * Trục hành trình đếm nội dung hồ sơ, không đếm lượt duyệt. Mốc khoá Methodology vẫn là
 * phụ thuộc dữ liệu thật để mở Giám sát và Báo cáo.
 */
describe("trục hành trình của dự án", () => {
  it("dự án mới: danh mục Thiết kế chưa có hồ sơ, Giám sát và Báo cáo còn khoá", () => {
    const [design, monitoring, report] = journeyPhases({
      dossierCount: 0,
      methodologyLocked: false,
    });

    expect(design.state).toBe("active");
    expect(design.detail).toBe("0/7 hồ sơ đã có");
    expect(monitoring.state).toBe("locked");
    expect(report.state).toBe("locked");
  });

  it("khoá Methodology mở Module B, không phụ thuộc số hồ sơ đã có", () => {
    const [design, monitoring, report] = journeyPhases({
      dossierCount: 4,
      methodologyLocked: true,
    });

    expect(design.state).toBe("active");
    expect(monitoring.state).toBe("available");
    expect(report.state).toBe("available");
  });

  it("có đủ bảy hồ sơ thì danh mục Thiết kế hoàn thành và Giám sát thành việc đang làm", () => {
    const [design, monitoring, report] = journeyPhases({
      dossierCount: 7,
      methodologyLocked: true,
    });

    expect(design.state).toBe("done");
    expect(design.detail).toBe("Đã có đủ 7/7 hồ sơ");
    expect(monitoring.state).toBe("active");
    // Báo cáo không bao giờ là `active`: trục không biết đã có kỳ nào khoá chưa.
    expect(report.state).toBe("available");
  });

  it("giai đoạn bị khoá luôn nêu phụ thuộc dữ liệu, không dùng nhãn thứ tự", () => {
    for (const phase of journeyPhases({ dossierCount: 2, methodologyLocked: false })) {
      if (phase.state === "locked") {
        expect(phase.detail).toContain("Methodology");
        expect(phase.detail).not.toContain("bước 4");
        expect(phase.detail.length).toBeGreaterThan(10);
      }
    }
  });

  it("liên kết trỏ đúng route thật; Thiết kế giữ tên quy-trinh vì trợ lý tham chiếu cứng", () => {
    const slugs = journeyPhases({ dossierCount: 7, methodologyLocked: true }).map((p) => p.slug);
    expect(slugs).toEqual(["quy-trinh", "giam-sat", "bao-cao"]);
  });

  it("không bao giờ mở Module B khi Methodology chưa khoá, kể cả khi đủ bảy hồ sơ", () => {
    const [, monitoring, report] = journeyPhases({
      dossierCount: 7,
      methodologyLocked: false,
    });
    expect(monitoring.state).toBe("locked");
    expect(report.state).toBe("locked");
  });

  it("suy ra hồ sơ đã có từ nội dung setup, lựa chọn và tài liệu", () => {
    const presence = dossierPresence({
      setup: {
        idea: { activity: "Phục hồi rừng" },
        feasibility: { notes: "Cần khảo sát thêm" },
      },
      standardId: "standard-1",
      methodologyId: "methodology-1",
      baseline: { carbon_stock: "0" },
      documentKinds: ["additionality", "pdd"],
    });

    expect(presence).toEqual({
      idea: true,
      feasibility: true,
      standard: true,
      methodology: true,
      baseline: true,
      additionality: true,
      pdd: true,
    });
    expect(countPresentDossiers(presence)).toBe(7);
  });

  it("object, mảng và chuỗi rỗng không bị tính nhầm là hồ sơ đã có", () => {
    const presence = dossierPresence({
      setup: { idea: {}, description: "  ", feasibility: { known: [], gaps: [] } },
      standardId: null,
      methodologyId: null,
      baseline: {},
      documentKinds: [],
    });

    expect(countPresentDossiers(presence)).toBe(0);
  });

  it("tài liệu có thể tạo nội dung cho hồ sơ Feasibility và Baseline", () => {
    const presence = dossierPresence({
      setup: {},
      standardId: null,
      methodologyId: null,
      baseline: null,
      documentKinds: ["feasibility", "baseline"],
    });

    expect(presence.feasibility).toBe(true);
    expect(presence.baseline).toBe(true);
    expect(countPresentDossiers(presence)).toBe(2);
  });
});
