# Agri-Carbon Pass — Thiết kế hệ thống

Ngày: 2026-08-30

## 1. Mục tiêu

Số hoá quy trình MRV (Đo lường – Báo cáo – Xác minh) tín chỉ carbon nông nghiệp cho
nông hộ nhỏ, gom thành dự án carbon tập thể đủ tiêu chuẩn và kết nối với bên mua.

Bốn năng lực cốt lõi:

1. Nhật ký canh tác số — cán bộ HTX nhập hộ cho nhiều nông hộ.
2. Engine MRV — tự động tính CH₄/N₂O cắt giảm theo IPCC 2019.
3. Xác minh thửa ruộng — polygon + PostGIS, chống khai trùng diện tích.
4. Marketplace B2B — gộp lô tín chỉ, đơn hàng, thanh toán sandbox, chia doanh thu.

## 2. Quyết định kiến trúc

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Ứng dụng | Một Next.js app (App Router) + TypeScript + Tailwind | Một codebase, chia vùng bằng route group theo vai trò |
| Dữ liệu | Supabase Postgres + PostGIS + Auth + Storage | RLS làm lớp bảo mật chính |
| Engine MRV | Module TypeScript thuần trong `src/lib/mrv` | Hàm thuần, không I/O, unit test đối chiếu số liệu IPCC |
| Người nhập liệu | Cán bộ HTX nhập hộ | Nông hộ là bản ghi, không cần tài khoản |
| Thanh toán | Provider giả lập (sandbox) sau một interface adapter | Cắm cổng thật sau chỉ cần thay adapter |

Đã cân nhắc và loại bỏ: monorepo Turborepo (chi phí hạ tầng thừa ở quy mô này);
đẩy engine MRV xuống Edge Function (khiến phần cần test kỹ nhất lại khó test nhất).

## 3. Mô hình dữ liệu

Trục chính: **HTX → Nông hộ → Thửa ruộng → Đăng ký mùa vụ → Nhật ký**.

Nhật ký gắn vào `field_seasons` (một thửa trong một mùa) chứ không gắn thẳng vào
thửa, vì cùng một thửa qua các vụ cho kết quả phát thải khác nhau.

| Nhóm | Bảng |
|---|---|
| Danh tính | `profiles`, `cooperatives` |
| Đối tượng | `farmers`, `fields` |
| Mùa vụ | `seasons`, `field_seasons` |
| Nhật ký | `water_events`, `fertilizer_applications`, `straw_management`, `evidence_photos` |
| MRV | `emission_factors`, `emission_calculations` |
| Thị trường | `credit_batches`, `batch_items`, `orders`, `payments`, `revenue_shares` |

Vai trò: `platform_admin`, `coop_manager`, `coop_staff`, `buyer`.

### RLS

Bảo mật đặt ở tầng cơ sở dữ liệu, không ở tầng ứng dụng:

- Cán bộ HTX đọc/ghi chỉ trong phạm vi `cooperative_id` của mình.
- Doanh nghiệp chỉ thấy `credit_batches` trạng thái `listed` và đơn hàng của chính họ.
- `platform_admin` thấy toàn bộ.

Mỗi bảng có policy tường minh; kiểm thử phải bao gồm cả trường hợp truy cập bị từ chối.

### PostGIS

Phục vụ đúng hai việc:

- Tự tính `area_ha` từ polygon, đối chiếu với diện tích nông dân khai.
- Phát hiện thửa chồng lấn giữa các hộ (`ST_Intersects`) — cơ chế chống khai trùng.

## 4. Engine MRV

Theo IPCC 2019 Refinement, Vol.4 Ch.5.5:

```
CH₄ = EFc × SFw × SFp × SFo × t × A
SFo = (1 + Σ ROAᵢ × CFOAᵢ)^0.59
```

- `SFw` (chế độ nước trong vụ) là nơi AWD tạo giá trị: ngập liên tục 1.0,
  rút nước một lần 0.71, rút nước nhiều lần (AWD) 0.55. Hệ thống **suy ra** bậc này
  từ số lần tháo nước trong `water_events`, không để người dùng tự khai.
- `SFo` lấy từ `straw_management`: rơm vùi <30 ngày trước vụ 1.0, vùi >30 ngày 0.29,
  compost 0.05, phân chuồng 0.14, phân xanh 0.50.
- Cộng N₂O trực tiếp từ phân đạm (EF1FR = 0.004 kg N₂O-N/kg N).
- Cộng phần phát thải tránh được do không đốt rơm rạ.

Giảm phát thải = kịch bản nền − kịch bản dự án, quy về tCO₂e.

Mọi hệ số nằm trong `emission_factors` có đánh version. `emission_calculations` lưu
`methodology_version` cùng toàn bộ tham số đầu vào dạng `jsonb`, để một con số tính
hôm nay vẫn tái lập được sau này — điều kiện bắt buộc để kiểm định viên chấp nhận.

## 5. Xử lý lỗi

Ba tình huống xử lý tường minh:

1. **Nhật ký thiếu dữ liệu** — engine từ chối tính và nêu rõ thiếu gì; không suy đoán.
2. **Polygon chồng lấn** — cảnh báo ngay lúc lưu, kèm tên hộ bị đụng.
3. **Sửa nhật ký sau khi đã gộp vào lô tín chỉ** — khoá lại, buộc tạo phiên bản tính mới.

## 6. Kiểm thử

- Unit test engine MRV, đối chiếu ví dụ tính tay trong tài liệu IPCC. Viết trước engine.
- Integration test cho RLS, gồm cả trường hợp bị từ chối.
- E2E cho luồng nhập trọn một vụ.

## 7. Lộ trình

| Đợt | Nội dung | Kết quả dùng được |
|---|---|---|
| 1 | Schema + RLS + auth + CRUD HTX/nông hộ/thửa ruộng (bản đồ vẽ polygon) | HTX số hoá được vùng canh tác |
| 2 | Mùa vụ + nhật ký + engine MRV | Nhập một vụ ra được tCO₂e từng thửa |
| 3 | Dashboard HTX + gộp lô tín chỉ + xuất báo cáo | Ra "Báo cáo phát thải giảm thiểu tập trung" |
| 4 | Cổng doanh nghiệp + đơn hàng + thanh toán sandbox + chia doanh thu | Doanh nghiệp chạy hết luồng mua thử |

Schema thiết kế trọn gói ngay từ đợt 1 để không phải migrate lại.
