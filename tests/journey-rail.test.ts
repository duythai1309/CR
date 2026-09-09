import { describe, expect, it } from "vitest";
import {
  countPresentDossiers,
  dossierCountFor,
  dossierPresence,
  journeyPhases,
} from "@/components/project/journey-rail";
import { DOCUMENT_KIND_STAGE } from "@/components/project/rules";

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

/**
 * LỖI-1: tải tài liệu cho bước 6 (Additionality) và bước 7 (PDD) không làm thanh tiến độ
 * nhúc nhích. Nguyên nhân là đường dây từ tài liệu tới con số bị đứt ở layout, nên các ca
 * dưới đây đi trọn mạch `dossierCountFor` — đúng hàm mà layout gọi — chứ không chỉ kiểm
 * `dossierPresence` rời rạc.
 */
describe("LỖI-1: tải tài liệu bước 6 và bước 7 phải làm số hồ sơ tăng", () => {
  /** Dự án đã có 5 hồ sơ đầu, còn thiếu đúng Additionality và PDD. */
  const project = (documentKinds: string[]) => ({
    setup: {
      idea: { activity: "Phục hồi rừng ngập mặn" },
      feasibility: { notes: "Đã khảo sát sơ bộ" },
    },
    standardId: "std-1",
    methodologyId: "meth-1",
    baseline: { carbon_stock: "12.4" },
    documentKinds,
  });

  it("hai loại tài liệu này đúng là của bước 6 và bước 7", () => {
    expect(DOCUMENT_KIND_STAGE.additionality).toBe(6);
    expect(DOCUMENT_KIND_STAGE.pdd).toBe(7);
  });

  it("chưa tải gì thì dừng ở 5/7", () => {
    expect(dossierCountFor(project([]))).toBe(5);
    expect(journeyPhases({ dossierCount: 5, methodologyLocked: true })[0].detail).toBe(
      "5/7 hồ sơ đã có",
    );
  });

  it("tải tài liệu Additionality (bước 6) thì số hồ sơ tăng 5 → 6", () => {
    const before = dossierCountFor(project([]));
    const after = dossierCountFor(project(["additionality"]));

    expect(after).toBe(before + 1);
    expect(after).toBe(6);
    expect(journeyPhases({ dossierCount: after, methodologyLocked: true })[0].detail).toBe(
      "6/7 hồ sơ đã có",
    );
  });

  it("tải tài liệu PDD (bước 7) thì số hồ sơ tăng 5 → 6", () => {
    const before = dossierCountFor(project([]));
    const after = dossierCountFor(project(["pdd"]));

    expect(after).toBe(before + 1);
    expect(dossierPresence(project(["pdd"])).pdd).toBe(true);
  });

  it("tải cả hai thì đủ 7/7 và Thiết kế chuyển sang xong", () => {
    const count = dossierCountFor(project(["additionality", "pdd"]));
    expect(count).toBe(7);

    const [design] = journeyPhases({ dossierCount: count, methodologyLocked: true });
    expect(design.detail).toBe("Đã có đủ 7/7 hồ sơ");
    expect(design.state).toBe("done");
  });

  it("mỗi loại tài liệu chỉ mở đúng hồ sơ của nó, không cộng lây sang hồ sơ khác", () => {
    const only6 = dossierPresence(project(["additionality"]));
    expect(only6.additionality).toBe(true);
    expect(only6.pdd).toBe(false);

    const only7 = dossierPresence(project(["pdd"]));
    expect(only7.pdd).toBe(true);
    expect(only7.additionality).toBe(false);
  });

  it("tải nhiều phiên bản cùng một loại vẫn chỉ tính một hồ sơ", () => {
    expect(dossierCountFor(project(["pdd", "pdd", "pdd"]))).toBe(6);
  });

  it("số hồ sơ không phụ thuộc lượt duyệt stage — đó là prop `approved` đã gỡ", () => {
    // Dự án chưa duyệt bước nào nhưng đã có đủ tài liệu: tiến độ vẫn phải là 7/7.
    expect(dossierCountFor(project(["additionality", "pdd"]))).toBe(7);
  });
});
