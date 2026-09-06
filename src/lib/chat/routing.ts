/**
 * Cổng hẹp để Gemini không bỏ qua tool cho câu hỏi dữ liệu hệ thống.
 *
 * Đây không phải bộ phân loại nghiệp vụ toàn năng. Danh sách từ chối được xét trước để
 * giữ nguyên safety; chỉ các intent đọc dữ liệu rõ ràng mới bị buộc gọi một trong các
 * tool phù hợp. Những câu khái niệm hoặc điều hướng vẫn để model trả lời trực tiếp.
 */
const NORMALIZE = (text: string): string => text.normalize("NFC").toLowerCase();

function mustStayTextOnly(question: string): boolean {
  const q = NORMALIZE(question);
  if (/khả thi|feasibility/.test(q)) return true;
  if (/bịa|không phải thành viên|số điện thoại|thời tiết|bài thơ|giá tín chỉ|ipcc/.test(q))
    return true;
  if (/tín chỉ/.test(q) && /được cấp|cấp bao nhiêu|phát hành|issuance/.test(q)) return true;
  if (/xuất|tạo/.test(q) && /\bfinal\b/.test(q) && /mẫu|sample/.test(q)) return true;

  const namesExternalStandard = /verra|gold standard|\bvcs\b|\bvm\d+/i.test(q);
  const asksExternalDecision =
    /yêu cầu|chấp nhận|công nhận|đăng ký|nộp|validation|verification|vvb|review|issuance/.test(q);
  return namesExternalStandard && asksExternalDecision;
}

/**
 * `null` nghĩa là để provider ở AUTO. Mảng có phần tử nghĩa là vòng model đầu phải gọi
 * một tool trong tập đó; các vòng sau luôn AUTO để model có thể kết luận bằng chữ.
 */
export function requiredToolNamesForQuestion(question: string): string[] | null {
  if (!question.trim() || mustStayTextOnly(question)) return null;
  const q = NORMALIZE(question);

  if (/field|chỉ số|đơn vị|metric_schema|cột.*csv|csv.*cột/.test(q))
    return ["field_giam_sat_cua_methodology"];
  if (/báo cáo|\bmrv\b|calculation_trace|\btrace\b|nguồn factor|vết tính/.test(q))
    return ["liet_ke_bao_cao_mrv", "doc_vet_tinh_bao_cao"];
  if (/methodology|phương pháp luận/.test(q)) return ["goi_y_methodology"];
  if (/standard/.test(q)) return ["liet_ke_standard"];
  if (/baseline/.test(q)) return ["kiem_tra_baseline"];
  if (/kỳ giám sát|monitoring period|khóa kỳ|khoá kỳ|dữ liệu giám sát/.test(q))
    return ["liet_ke_ky_giam_sat", "tom_tat_du_lieu_giam_sat"];
  if (/tài liệu|document/.test(q)) return ["tai_lieu_theo_buoc"];
  if (/thành viên|phân công|giao việc cho ai|ai đang giữ việc|vai trò trong.*dự án/.test(q))
    return ["thanh_vien_va_phan_cong"];
  if (/công việc|nhiệm vụ|quá hạn|blocked/.test(q)) return ["cong_viec_theo_buoc"];
  if (/bước|quy trình/.test(q))
    return /điều kiện|duyệt|kẹt|chặn|cần gì|thiếu gì/.test(q)
      ? ["yeu_cau_cua_buoc", "tien_do_du_an"]
      : ["liet_ke_du_an", "tien_do_du_an"];
  if (/tiến độ|trạng thái dự án|làm gì tiếp theo|tới đâu rồi/.test(q))
    return ["tien_do_du_an"];
  if (/dự án (?:nào|gì)|danh sách dự án|các dự án|dự án tôi đang/.test(q))
    return ["liet_ke_du_an"];

  return null;
}
