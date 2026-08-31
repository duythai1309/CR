-- Hiệu chỉnh cho triển khai tại Việt Nam.
--
-- Hai thay đổi về độ chính xác:
--
-- 1. Hệ số phát thải nền EFc phụ thuộc mạnh vào vùng miền và mùa vụ. Mặc định
--    toàn cầu của IPCC (1,19 kg CH4/ha/ngày) thấp hơn thực đo tại Việt Nam từ
--    45% đến 227% tuỳ vụ, nên dùng nó ở miền Bắc sẽ tính thiếu rất nhiều lượng
--    giảm phát thải mà nông dân đáng được ghi nhận.
--
-- 2. Từ 01/7/2025 Việt Nam bỏ cấp huyện, chuyển sang chính quyền địa phương hai
--    cấp: tỉnh/thành phố và xã/phường. Cột district giữ lại cho dữ liệu cũ nhưng
--    không dùng nữa.

create type vn_region as enum ('north', 'central', 'south');

-- Ba vụ theo cách phân của nghiên cứu hệ số Việt Nam: đầu năm, giữa năm, cuối năm.
-- Miền Bắc chỉ có vụ đầu năm (Vụ Xuân) và cuối năm (Vụ Mùa).
create type season_type as enum ('early', 'mid', 'late');

alter table cooperatives add column region vn_region;
alter table seasons add column season_type season_type;

comment on column cooperatives.district is
  'Cấp huyện đã bị bãi bỏ từ 01/7/2025. Chỉ giữ cho bản ghi cũ, không nhập mới.';
comment on column cooperatives.region is
  'Vùng miền, dùng để chọn hệ số phát thải nền phù hợp.';
comment on column seasons.season_type is
  'Vụ đầu năm / giữa năm / cuối năm — quyết định hệ số phát thải nền.';

-- Dữ liệu đã có thuộc đợt thử nghiệm miền Bắc.
update cooperatives set region = 'north' where region is null;
update seasons set season_type = 'early' where season_type is null;

-- ---------------------------------------------------------------- bộ hệ số Tier 2
-- Các hệ số scaling, GWP và đốt rơm giữ nguyên theo IPCC vì chúng là giá trị toàn
-- cầu; chỉ riêng EFc được thay bằng số đo tại Việt Nam.
insert into emission_factors (version, key, value, unit, description, source)
select 'IPCC2019-VN-TIER2-1.0', key, value, unit, description, source
from emission_factors
where version = 'IPCC2019-VN-1.0' and key <> 'ef_c_baseline';

insert into emission_factors (version, key, value, unit, description, source) values
  ('IPCC2019-VN-TIER2-1.0', 'ef_c_baseline', 1.22, 'kg CH4/ha/ngày',
   'Hệ số nền dự phòng cho Đông Nam Á, chỉ dùng khi chưa xác định được vùng và vụ',
   'IPCC 2019 Refinement, Vol.4 Ch.5, Bảng 5.11 (Đông Nam Á, khoảng 0,83–1,81)'),

  ('IPCC2019-VN-TIER2-1.0', 'ef_c_north_early', 2.21, 'kg CH4/ha/ngày',
   'Miền Bắc — vụ đầu năm (Vụ Xuân / Đông Xuân)',
   'Vo et al. 2020, Climate 8(6):74, đo tại 36 điểm ở Việt Nam theo điều kiện nền của IPCC'),
  ('IPCC2019-VN-TIER2-1.0', 'ef_c_north_late', 3.89, 'kg CH4/ha/ngày',
   'Miền Bắc — vụ cuối năm (Vụ Mùa)',
   'Vo et al. 2020, Climate 8(6):74'),

  ('IPCC2019-VN-TIER2-1.0', 'ef_c_central_early', 2.84, 'kg CH4/ha/ngày',
   'Miền Trung — vụ đầu năm', 'Vo et al. 2020, Climate 8(6):74'),
  ('IPCC2019-VN-TIER2-1.0', 'ef_c_central_mid', 3.13, 'kg CH4/ha/ngày',
   'Miền Trung — vụ giữa năm', 'Vo et al. 2020, Climate 8(6):74'),
  ('IPCC2019-VN-TIER2-1.0', 'ef_c_central_late', 3.13, 'kg CH4/ha/ngày',
   'Miền Trung — vụ cuối năm', 'Vo et al. 2020, Climate 8(6):74'),

  ('IPCC2019-VN-TIER2-1.0', 'ef_c_south_early', 1.72, 'kg CH4/ha/ngày',
   'Miền Nam — vụ đầu năm (Đông Xuân)', 'Vo et al. 2020, Climate 8(6):74'),
  ('IPCC2019-VN-TIER2-1.0', 'ef_c_south_mid', 2.80, 'kg CH4/ha/ngày',
   'Miền Nam — vụ giữa năm (Hè Thu)', 'Vo et al. 2020, Climate 8(6):74'),
  ('IPCC2019-VN-TIER2-1.0', 'ef_c_south_late', 3.58, 'kg CH4/ha/ngày',
   'Miền Nam — vụ cuối năm (Thu Đông / Mùa)', 'Vo et al. 2020, Climate 8(6):74');
