import { describe, expect, it } from "vitest";
import { journeyPhases } from "@/components/project/journey-rail";

/**
 * `journeyPhases` quyết định điều hướng nhìn thấy được của mọi trang trong một dự án, nên
 * nó phải được kiểm bằng test chứ không bằng mắt: sai một nhánh là cả một giai đoạn biến
 * mất hoặc mở ra sớm.
 *
 * Ba giai đoạn suy ra từ hai giá trị có thật trong DB — số stage đã duyệt và mốc
 * `methodology_locked_at`. Không có cột trạng thái riêng nào được thêm.
 */
describe("trục hành trình của dự án", () => {
  it("dự án mới: Thiết kế đang làm, Giám sát và Báo cáo còn khoá", () => {
    const [design, monitoring, report] = journeyPhases({
      approved: 0,
      methodologyLocked: false,
    });

    expect(design.state).toBe("active");
    expect(design.detail).toBe("0/7 bước đã duyệt");
    expect(monitoring.state).toBe("locked");
    expect(report.state).toBe("locked");
  });

  it("khoá Methodology ở bước 4 là mốc mở Module B, không phải duyệt đủ bảy bước", () => {
    const [design, monitoring, report] = journeyPhases({
      approved: 4,
      methodologyLocked: true,
    });

    expect(design.state).toBe("active");
    // `available`, KHÔNG phải `done`: đã mở nhưng chưa phải việc đang làm.
    expect(monitoring.state).toBe("available");
    expect(report.state).toBe("available");
  });

  it("duyệt đủ bảy bước thì Thiết kế xong và Giám sát thành việc đang làm", () => {
    const [design, monitoring, report] = journeyPhases({
      approved: 7,
      methodologyLocked: true,
    });

    expect(design.state).toBe("done");
    expect(design.detail).toBe("Đủ 7/7 bước");
    expect(monitoring.state).toBe("active");
    // Báo cáo không bao giờ là `active`: trục không biết đã có kỳ nào khoá chưa.
    expect(report.state).toBe("available");
  });

  it("giai đoạn bị khoá luôn nêu lý do mở, không bao giờ để trống", () => {
    for (const phase of journeyPhases({ approved: 2, methodologyLocked: false })) {
      if (phase.state === "locked") {
        expect(phase.detail).toContain("bước 4");
        expect(phase.detail.length).toBeGreaterThan(10);
      }
    }
  });

  it("liên kết trỏ đúng route thật; Thiết kế giữ tên quy-trinh vì trợ lý tham chiếu cứng", () => {
    const slugs = journeyPhases({ approved: 7, methodologyLocked: true }).map((p) => p.slug);
    expect(slugs).toEqual(["quy-trinh", "giam-sat", "bao-cao"]);
  });

  it("không bao giờ mở Module B khi Methodology chưa khoá, kể cả khi đã duyệt hết", () => {
    // Trạng thái này không xảy ra qua đường nghiệp vụ vì bước 4 chặn, nhưng hàm phải
    // vẫn an toàn: cổng là methodologyLocked, không phải số bước đã duyệt.
    const [, monitoring, report] = journeyPhases({ approved: 7, methodologyLocked: false });
    expect(monitoring.state).toBe("locked");
    expect(report.state).toBe("locked");
  });
});
