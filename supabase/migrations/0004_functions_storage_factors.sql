-- Hàm nghiệp vụ, kho ảnh bằng chứng, và bộ hệ số phát thải IPCC 2019.

-- Phát hiện thửa chồng lấn. Chạy security definer để bắt được cả trường hợp hai HTX
-- khác nhau cùng khai một mảnh ruộng — đó mới là gian lận đáng lo. Thửa của HTX khác
-- chỉ trả về mã HTX, không lộ tên nông hộ.
create function check_field_overlap(p_geom geometry, p_exclude_id uuid default null)
returns table (field_id uuid, label text, overlap_ha numeric, same_cooperative boolean)
language sql stable security definer set search_path = public as $$
  select
    f.id,
    case
      when f.cooperative_id = app_coop_id() then fa.full_name || ' — ' || f.name
      else 'Thửa thuộc HTX khác (mã ' || c.code || ')'
    end,
    round((st_area(st_intersection(f.geom, p_geom)::geography) / 10000)::numeric, 4),
    f.cooperative_id = app_coop_id()
  from fields f
  join farmers fa on fa.id = f.farmer_id
  join cooperatives c on c.id = f.cooperative_id
  where f.geom is not null
    and (p_exclude_id is null or f.id <> p_exclude_id)
    and st_intersects(f.geom, p_geom)
    -- Bỏ qua chồng lấn dưới 1 m², thường chỉ là sai số khi vẽ tay.
    and st_area(st_intersection(f.geom, p_geom)::geography) > 1
$$;

-- Nhật ký đã gộp vào lô tín chỉ thì không sửa được nữa; muốn đổi phải mở khoá,
-- và khi mở khoá thì kết quả tính cũ bị đánh dấu hết hiệu lực.
create function guard_locked_field_season() returns trigger
language plpgsql as $$
declare
  target uuid;
  locked boolean;
begin
  target := coalesce(new.field_season_id, old.field_season_id);
  select is_locked into locked from field_seasons where id = target;
  if coalesce(locked, false) then
    raise exception 'Thửa-vụ đã khoá vì đã gộp vào lô tín chỉ. Mở khoá trước khi sửa nhật ký.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger water_events_guard_lock before insert or update or delete on water_events
  for each row execute function guard_locked_field_season();
create trigger fertilizer_guard_lock before insert or update or delete on fertilizer_applications
  for each row execute function guard_locked_field_season();
create trigger straw_guard_lock before insert or update or delete on straw_management
  for each row execute function guard_locked_field_season();
create trigger evidence_guard_lock before insert or update or delete on evidence_photos
  for each row execute function guard_locked_field_season();

-- ---------------------------------------------------------------- kho ảnh bằng chứng
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Đường dẫn theo quy ước {cooperative_id}/{field_season_id}/{tên tệp},
-- nên chỉ cần so thư mục cấp một với HTX của người đăng nhập.
create policy evidence_read on storage.objects for select to authenticated
  using (bucket_id = 'evidence'
         and ((storage.foldername(name))[1] = app_coop_id()::text or app_is_admin()));

create policy evidence_write on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence'
              and ((storage.foldername(name))[1] = app_coop_id()::text or app_is_admin()));

create policy evidence_delete on storage.objects for delete to authenticated
  using (bucket_id = 'evidence'
         and ((storage.foldername(name))[1] = app_coop_id()::text or app_is_admin()));

-- ---------------------------------------------------------------- hệ số IPCC 2019
insert into emission_factors (version, key, value, unit, description, source) values
  ('IPCC2019-VN-1.0', 'ef_c_baseline', 1.19, 'kg CH4/ha/ngày',
   'Hệ số phát thải nền cho ruộng ngập liên tục, không bón chất hữu cơ',
   'IPCC 2019 Refinement, Vol.4 Ch.5, Bảng 5.11'),
  ('IPCC2019-VN-1.0', 'sfw_continuously_flooded', 1.0, 'hệ số',
   'SFw — ngập liên tục suốt vụ', 'IPCC 2019 Refinement, Bảng 5.12'),
  ('IPCC2019-VN-1.0', 'sfw_single_aeration', 0.71, 'hệ số',
   'SFw — rút nước một lần trong vụ', 'IPCC 2019 Refinement, Bảng 5.12'),
  ('IPCC2019-VN-1.0', 'sfw_multiple_aeration', 0.55, 'hệ số',
   'SFw — rút nước nhiều lần trong vụ (kỹ thuật AWD)', 'IPCC 2019 Refinement, Bảng 5.12'),
  ('IPCC2019-VN-1.0', 'sfp_non_flooded_short', 1.0, 'hệ số',
   'SFp — không ngập dưới 180 ngày trước vụ', 'IPCC 2019 Refinement, Bảng 5.13'),
  ('IPCC2019-VN-1.0', 'sfp_non_flooded_long', 0.68, 'hệ số',
   'SFp — không ngập trên 180 ngày trước vụ', 'IPCC 2019 Refinement, Bảng 5.13'),
  ('IPCC2019-VN-1.0', 'sfp_flooded_pre', 2.41, 'hệ số',
   'SFp — ngập trên 30 ngày trước vụ', 'IPCC 2019 Refinement, Bảng 5.13'),
  ('IPCC2019-VN-1.0', 'cfoa_straw_incorporated_short', 1.0, 'hệ số',
   'CFOA — rơm rạ vùi dưới 30 ngày trước khi cấy', 'IPCC 2019 Refinement, Bảng 5.14'),
  ('IPCC2019-VN-1.0', 'cfoa_straw_incorporated_long', 0.29, 'hệ số',
   'CFOA — rơm rạ vùi trên 30 ngày trước khi cấy', 'IPCC 2019 Refinement, Bảng 5.14'),
  ('IPCC2019-VN-1.0', 'cfoa_compost', 0.05, 'hệ số',
   'CFOA — phân ủ compost', 'IPCC 2019 Refinement, Bảng 5.14'),
  ('IPCC2019-VN-1.0', 'cfoa_farmyard_manure', 0.14, 'hệ số',
   'CFOA — phân chuồng', 'IPCC 2019 Refinement, Bảng 5.14'),
  ('IPCC2019-VN-1.0', 'cfoa_green_manure', 0.50, 'hệ số',
   'CFOA — phân xanh', 'IPCC 2019 Refinement, Bảng 5.14'),
  ('IPCC2019-VN-1.0', 'sfo_exponent', 0.59, 'số mũ',
   'Số mũ trong công thức SFo = (1 + Σ ROA×CFOA)^0.59', 'IPCC 2019 Refinement, PT 5.3'),
  ('IPCC2019-VN-1.0', 'ef1_flooded_rice_n2o', 0.004, 'kg N2O-N/kg N',
   'Hệ số phát thải N2O trực tiếp từ phân đạm trên ruộng lúa ngập',
   'IPCC 2019 Refinement, Vol.4 Ch.11, Bảng 11.1'),
  ('IPCC2019-VN-1.0', 'n2o_n_to_n2o', 1.571428571, 'tỷ lệ',
   'Quy đổi N2O-N sang N2O (44/28)', 'IPCC 2019 Refinement, Vol.4 Ch.11'),
  ('IPCC2019-VN-1.0', 'gwp_ch4', 28, 'tCO2e/tCH4',
   'Tiềm năng nóng lên toàn cầu 100 năm của CH4 (AR5, chuẩn Verra đang dùng)',
   'IPCC AR5'),
  ('IPCC2019-VN-1.0', 'gwp_n2o', 265, 'tCO2e/tN2O',
   'Tiềm năng nóng lên toàn cầu 100 năm của N2O (AR5)', 'IPCC AR5'),
  ('IPCC2019-VN-1.0', 'burn_ef_ch4', 2.7, 'g CH4/kg chất khô',
   'Phát thải CH4 khi đốt phụ phẩm nông nghiệp ngoài đồng',
   'IPCC 2006 Vol.4 Ch.2, Bảng 2.5'),
  ('IPCC2019-VN-1.0', 'burn_ef_n2o', 0.07, 'g N2O/kg chất khô',
   'Phát thải N2O khi đốt phụ phẩm nông nghiệp ngoài đồng',
   'IPCC 2006 Vol.4 Ch.2, Bảng 2.5'),
  ('IPCC2019-VN-1.0', 'burn_combustion_factor', 0.80, 'hệ số',
   'Tỷ lệ rơm rạ thực sự cháy hết khi đốt ngoài đồng',
   'IPCC 2006 Vol.4 Ch.2, Bảng 2.6'),
  ('IPCC2019-VN-1.0', 'burn_dry_matter_fraction', 0.85, 'hệ số',
   'Tỷ lệ chất khô trong rơm rạ', 'IPCC 2006 Vol.4 Ch.2');
