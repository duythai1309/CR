import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actionsPath = new URL(
  "../src/app/du-an/[id]/quy-trinh/actions.ts",
  import.meta.url,
);
const formsPath = new URL(
  "../src/app/du-an/[id]/quy-trinh/forms.tsx",
  import.meta.url,
);
const actions = readFileSync(actionsPath, "utf8");
const forms = readFileSync(formsPath, "utf8");

describe("đường tải tài liệu bằng signed URL", () => {
  it("không đưa nội dung File qua server action", () => {
    expect(actions).not.toContain('formData.get("file")');
    expect(forms).toContain("uploadToSignedUrl(signed.path, signed.token, file");
    expect(forms).toContain('crypto.subtle.digest("SHA-256"');
  });

  it("server kiểm quyền trước khi cấp URL và tự dựng objectPath", () => {
    const start = actions.indexOf("export async function createDocumentSignedUpload");
    const end = actions.indexOf("export async function completeDocumentSignedUpload");
    const issueAction = actions.slice(start, end);

    expect(issueAction.indexOf("requireProjectMember(input.projectId)")).toBeGreaterThan(-1);
    expect(issueAction.indexOf("requireProjectMember(input.projectId)")).toBeLessThan(
      issueAction.indexOf("createSignedUploadUrl(objectPath"),
    );
    expect(issueAction).toContain(
      "`${input.projectId}/${profile.id}/${randomUUID()}/${safeName}`",
    );
    expect(issueAction).not.toMatch(/input\.objectPath/);
  });

  it("action hoàn tất chỉ nhận ticket đã ký và checksum đúng dạng SHA-256", () => {
    const start = actions.indexOf("export async function completeDocumentSignedUpload");
    const end = actions.indexOf("export async function abandonDocumentSignedUpload");
    const completeAction = actions.slice(start, end);

    expect(completeAction).toMatch(/input:\s*\{\s*ticket: string;\s*checksum: string;\s*\}/);
    expect(completeAction).toContain("/^[0-9a-f]{64}$/.test(input.checksum)");
    expect(completeAction).not.toMatch(/input\.objectPath/);
  });

  it("xoá đúng object do ticket chỉ định khi ghi metadata thất bại", () => {
    expect(actions).toContain('.from("project-documents").remove([objectPath])');
    expect(actions).toContain('failAfterDocumentUpload(\n        "project_files"');
    expect(actions).toContain('failAfterDocumentUpload(\n        "project_documents"');
    expect(actions).toContain("còn file thừa trong kho tại ${objectPath}");
  });

  it("không xoá object nếu metadata đã commit nhưng làm mới giao diện lỗi", () => {
    expect(actions).toContain("let metadataCommitted = false");
    expect(actions).toContain("if (payload && metadataCommitted)");
    expect(actions).toContain("Metadata tài liệu đã được ghi");
  });

  it("giao diện công bố đúng trần 50 MB và chuẩn hoá MIME theo loại tệp", () => {
    expect(forms).toContain("tối đa 50 MB");
    expect(forms).toContain("if (file.size > 52_428_800)");
    expect(forms).toContain("const mimeType = documentMimeType(file)");
    expect(forms).toContain('csv: "text/csv"');
  });
});
