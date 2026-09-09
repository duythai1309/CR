"use client";

import { useId, useState } from "react";
import { Alert, Button, Field, Select, Table } from "@/components/ui";
import { parseCSV, previewTable, type ImportOptions, type ImportPreview } from "@/lib/monitoring/import";

/**
 * Nhập CSV: chọn tệp → xem trước lỗi theo dòng/cột → xác nhận.
 *
 * Xem trước chạy NGAY TRÊN TRÌNH DUYỆT bằng đúng bộ hàm mà máy chủ dùng, nên người dùng
 * thấy hết lỗi trước khi gửi đi. Nhưng đó **không phải ranh giới tin cậy**: server action
 * parse và validate lại từ đầu trên chính văn bản gửi lên, và chỉ ghi khi không còn lỗi
 * nào — hoặc cả tệp vào, hoặc không dòng nào vào.
 *
 * Chỉ nhận **CSV**. Định dạng .xlsx đã được quyết để lại sau; lõi có sẵn chỗ cắm
 * `SpreadsheetParser` nhưng chưa có bộ đọc, nên giao diện không hứa điều đó.
 */
export function CsvImport({
  projectId,
  periodId,
  schema,
  disabled,
  action,
}: {
  projectId: string;
  periodId: string;
  schema: unknown;
  disabled?: boolean;
  action: (formData: FormData) => void;
}) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState(",");
  const [decimalSeparator, setDecimalSeparator] = useState(".");
  const [thousandsSeparator, setThousandsSeparator] = useState("");
  const fileInputId = useId();
  const fileHintId = `${fileInputId}-hint`;

  function options(): ImportOptions {
    const o: ImportOptions = {
      delimiter: delimiter === ";" ? ";" : delimiter === "tab" ? "\t" : ",",
      decimalSeparator: decimalSeparator === "," ? "," : ".",
      scope: "observation",
    };
    if (thousandsSeparator === "." || thousandsSeparator === "," || thousandsSeparator === " ")
      o.thousandsSeparator = thousandsSeparator;
    return o;
  }

  function rebuild(source: string) {
    setReadError(null);
    if (!source.trim()) {
      setPreview(null);
      return;
    }
    try {
      const o = options();
      setPreview(previewTable(schema, parseCSV(source, o.delimiter), o));
    } catch (e) {
      setPreview(null);
      setReadError(e instanceof Error ? e.message : "Không đọc được tệp.");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    // Caller chịu trách nhiệm giải mã UTF-8 — đọc thẳng bằng text() của File.
    const source = await file.text();
    setText(source);
    rebuild(source);
  }

  const errors = preview?.errors ?? [];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="period_id" value={periodId} />
      <input type="hidden" name="csv_text" value={text} />
      <input type="hidden" name="delimiter" value={delimiter} />
      <input type="hidden" name="decimal_separator" value={decimalSeparator} />
      <input type="hidden" name="thousands_separator" value={thousandsSeparator} />

      <ol className="grid gap-2 text-xs sm:grid-cols-3" aria-label="Quy trình nhập CSV">
        {[
          ["1", "Ánh xạ cột", "Theo mã field hoặc alias trong schema"],
          ["2", "Xem trước và kiểm tra", "Kiểm từng dòng, cột, đơn vị và giới hạn"],
          ["3", "Ghi nguyên tử", "Hoặc toàn bộ tệp, hoặc không dòng nào"],
        ].map(([step, title, detail]) => (
          <li key={step} className="rounded-lg border border-soil-200 bg-soil-50 p-3">
            <span className="font-mono text-soil-500">{step}</span>{" "}
            <strong className="text-soil-900">{title}</strong>
            <span className="mt-1 block text-soil-600">{detail}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Dấu ngăn cột">
          <Select
            value={delimiter}
            onChange={(e) => {
              setDelimiter(e.target.value);
              rebuild(text);
            }}
          >
            <option value=",">Dấu phẩy ,</option>
            <option value=";">Dấu chấm phẩy ;</option>
            <option value="tab">Tab</option>
          </Select>
        </Field>
        <Field label="Dấu thập phân">
          <Select
            value={decimalSeparator}
            onChange={(e) => {
              setDecimalSeparator(e.target.value);
              rebuild(text);
            }}
          >
            <option value=".">Dấu chấm 1.5</option>
            <option value=",">Dấu phẩy 1,5</option>
          </Select>
        </Field>
        <Field label="Dấu nhóm nghìn">
          <Select
            value={thousandsSeparator}
            onChange={(e) => {
              setThousandsSeparator(e.target.value);
              rebuild(text);
            }}
          >
            <option value="">Không dùng</option>
            <option value=".">Dấu chấm 20.000</option>
            <option value=",">Dấu phẩy 20,000</option>
            <option value=" ">Khoảng trắng 20 000</option>
          </Select>
        </Field>
      </div>

      <div>
        <label htmlFor={fileInputId} className="mb-1 block text-sm font-medium text-soil-800">
          Tệp CSV chứa dữ liệu quan sát
        </label>
        <input
          id={fileInputId}
          type="file"
          accept=".csv,text/csv"
          aria-describedby={fileHintId}
          disabled={disabled}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm text-soil-700 file:mr-3 file:rounded-lg file:border file:border-soil-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-soil-800"
        />
        <p id={fileHintId} className="mt-1 text-xs text-soil-600">
          Chỉ nhận tệp CSV. Tệp Excel (.xlsx) chưa hỗ trợ — hãy lưu sang CSV trước.
          Bảng cần hai cột <code>record_key</code> và <code>observed_on</code> cùng các cột chỉ số.
        </p>
      </div>

      {readError && <Alert tone="error">{readError}</Alert>}

      {preview && (
        <>
          {preview.mapping.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-soil-900">
                1. Ánh xạ cột CSV → metric schema
              </h3>
              <p className="mt-1 text-xs text-soil-600">
                Hệ thống khớp chính xác theo mã field hoặc alias đã khai trong Methodology;
                không suy đoán theo tên gần giống.
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {preview.mapping.map((m) => (
                  <li
                    key={`${m.column}-${m.field}`}
                    className="rounded-full bg-soil-100 px-2.5 py-0.5 text-xs text-soil-700"
                  >
                    {m.header || "(cột thiếu)"} → {m.field}
                    {m.unit ? ` (${m.unit})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.records.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-soil-900">
                2. Xem trước dữ liệu · {preview.records.length} dòng
              </h3>
              <div className="max-h-64 overflow-auto">
                <Table head={["Dòng", "record_key", "observed_on", "Giá trị đã chuẩn hoá"]}>
                  {preview.records.slice(0, 5).map((record) => (
                    <tr key={`${record.source_row}-${record.record_key}`} className="border-b border-soil-100 last:border-0">
                      <td className="px-3 py-1.5 text-soil-600">{record.source_row}</td>
                      <td className="px-3 py-1.5 font-mono text-xs text-soil-900">{record.record_key || "—"}</td>
                      <td className="px-3 py-1.5 text-soil-700">{record.observed_on || "—"}</td>
                      <td className="px-3 py-1.5 font-mono text-xs text-soil-600">
                        {Object.entries(record.metric_values).map(([key, value]) => `${key}=${String(value)}`).join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </Table>
              </div>
              {preview.records.length > 5 && (
                <p className="mt-1 text-xs text-soil-500">
                  Hiện 5 dòng đầu; toàn bộ tệp vẫn được kiểm tra.
                </p>
              )}
            </div>
          )}

          {errors.length > 0 ? (
            <div>
              <Alert tone="error" title={`2. Còn ${errors.length} lỗi — chưa nhập được dòng nào`}>
                Sửa hết lỗi trong tệp rồi chọn lại. Hệ thống không nhập một phần.
              </Alert>
              <div className="mt-3 max-h-72 overflow-y-auto">
                <Table head={["Dòng", "Cột", "Chỉ số", "Lỗi"]}>
                  {errors.slice(0, 200).map((e, i) => (
                    <tr key={i} className="border-b border-soil-100 last:border-0">
                      <td className="px-3 py-1.5 text-soil-700">{e.row || "—"}</td>
                      <td className="px-3 py-1.5 text-soil-700">{e.column || "—"}</td>
                      <td className="px-3 py-1.5 text-soil-700">{e.field ?? "—"}</td>
                      <td className="px-3 py-1.5 text-red-700">{e.message}</td>
                    </tr>
                  ))}
                </Table>
                {errors.length > 200 && (
                  <p className="mt-2 text-xs text-soil-600">
                    Còn {errors.length - 200} lỗi nữa không liệt kê hết ở đây.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Alert tone="ok" title={`3. Sẵn sàng ghi ${preview.records.length} dòng`}>
              {fileName} — ánh xạ và kiểm tra đều đạt. Bấm xác nhận để ghi nguyên tử vào kỳ.
            </Alert>
          )}
        </>
      )}

      <Button
        type="submit"
        disabled={disabled || !preview || errors.length > 0 || preview.records.length === 0}
      >
        Xác nhận nhập {preview && errors.length === 0 ? `${preview.records.length} dòng` : ""}
      </Button>
    </form>
  );
}
