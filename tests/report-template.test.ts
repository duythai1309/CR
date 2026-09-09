import { describe, expect, it } from "vitest";
import {
  parseReportTemplateSnapshot,
  preferReadyTemplates,
  templateDownloadName,
} from "@/lib/mrv/template";

const ready = {
  version: "v5.0A",
  format: "docx",
  status: "ready",
  bucket_id: "methodology-templates",
  object_path: "methodology/id/VCS-\n  Monitoring-Report.docx",
  checksum: "a".repeat(64),
  disclaimer: "Tệp chính thức; phải kiểm tra phạm vi áp dụng.",
};

describe("template báo cáo", () => {
  it("đọc được snapshot ready có đủ provenance tệp", () => {
    expect(parseReportTemplateSnapshot(ready)).toMatchObject({
      version: "v5.0A",
      format: "docx",
      status: "ready",
      bucketId: "methodology-templates",
      objectPath: ready.object_path,
    });
  });

  it("không coi snapshot ready thiếu path hoặc checksum là tệp dùng được", () => {
    expect(parseReportTemplateSnapshot({ ...ready, object_path: null })).toBeNull();
    expect(parseReportTemplateSnapshot({ ...ready, checksum: "sai" })).toBeNull();
  });

  it("chỉ trả template ready khi catalog đã có tệp thật", () => {
    const templates = [
      { id: "placeholder", status: "placeholder" as const },
      { id: "ready", status: "ready" as const },
    ];
    expect(preferReadyTemplates(templates).map((template) => template.id)).toEqual(["ready"]);
  });

  it("giữ placeholder khi chưa có tệp thật", () => {
    const templates = [{ id: "placeholder", status: "placeholder" as const }];
    expect(preferReadyTemplates(templates)).toEqual(templates);
  });

  it("làm sạch xuống dòng trong tên tải về nhưng không đổi object path", () => {
    const parsed = parseReportTemplateSnapshot(ready)!;
    expect(templateDownloadName(parsed)).toBe("VCS-Monitoring-Report.docx");
    expect(parsed.objectPath).toBe(ready.object_path);
  });
});
