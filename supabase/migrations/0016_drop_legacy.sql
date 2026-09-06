-- Gỡ module HTX, MRV lúa nước và mua bán tín chỉ cũ.
--
-- CẢNH BÁO: migration này phá huỷ dữ liệu và không có đường hoàn tác tự động.
-- Chỉ áp sau khi đã sao lưu theo docs/design/legacy-removal-plan.md và được người
-- dùng xác nhận. File này cố ý dùng RESTRICT ở mọi DROP để phụ thuộc chưa được
-- kiểm kê làm migration dừng lại thay vì bị xoá ngầm bởi CASCADE.
--
-- BẮT BUỘC GIỮ: auth.users, public.profiles, public.user_role, các đối tượng chat,
-- app_is_admin(), handle_new_user() và toàn bộ schema nền tảng dự án 0013–0015.

-- 1. Storage evidence dùng app_coop_id(); tháo policy trước khi bỏ helper HTX.
drop policy if exists evidence_read on storage.objects restrict;
drop policy if exists evidence_write on storage.objects restrict;
drop policy if exists evidence_delete on storage.objects restrict;

-- Xoá object trước bucket vì storage.objects.bucket_id tham chiếu storage.buckets.id.
-- Đây là DELETE có chủ đích: DROP không áp dụng cho từng bucket của Supabase Storage.
delete from storage.objects where bucket_id = 'evidence';
delete from storage.buckets where id = 'evidence';

-- 2. Policy profiles_select và cooperatives_select giữ phụ thuộc xuyên bảng.
-- cooperatives_select tham chiếu credit_batches, nên phải bỏ trước bảng thị trường.
drop policy if exists cooperatives_select on public.cooperatives restrict;
drop policy if exists cooperatives_insert on public.cooperatives restrict;
drop policy if exists cooperatives_update on public.cooperatives restrict;
drop policy if exists profiles_select on public.profiles restrict;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.app_is_admin());

-- Chat vẫn sống; chỉ bỏ snapshot HTX để có thể drop cooperatives.
alter table public.chat_conversations
  drop column cooperative_id restrict;

-- Profile vẫn là bảng định danh/auth. Chuẩn bị trigger guard để thân hàm không còn
-- đọc cooperative_id; cột chỉ được bỏ sau khi mọi policy/helper HTX đã được tháo.
create or replace function public.guard_profile_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.app_is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Không thể tự thay đổi vai trò';
  end if;
  return new;
end;
$$;

-- 3. Gỡ view/RPC nghiệp vụ trước các bảng mà chúng đọc hoặc dùng làm rowtype.
drop view if exists public.fields_view restrict;

drop function if exists public.create_cooperative_and_join(text, text, text, public.vn_region, text, text, text) restrict;
drop function if exists public.join_cooperative_by_code(text) restrict;
drop function if exists public.build_credit_batch(uuid) restrict;
drop function if exists public.unlock_field_season(uuid) restrict;
drop function if exists public.place_order(uuid, numeric, text) restrict;
drop function if exists public.settle_sandbox_payment(uuid, boolean) restrict;
drop function if exists public.save_field(uuid, text, jsonb, numeric, text, uuid) restrict;
drop function if exists public.check_field_overlap(geometry, uuid) restrict;

-- 4. Trigger nhật ký và hình học được tháo tường minh, rồi mới bỏ trigger function.
drop trigger if exists water_events_guard_lock on public.water_events restrict;
drop trigger if exists fertilizer_guard_lock on public.fertilizer_applications restrict;
drop trigger if exists straw_guard_lock on public.straw_management restrict;
drop trigger if exists evidence_guard_lock on public.evidence_photos restrict;
drop trigger if exists fields_sync_area on public.fields restrict;

drop function if exists public.guard_locked_field_season() restrict;
drop function if exists public.sync_field_area() restrict;

-- 5. Bảng lá trước bảng cha. RESTRICT là chốt kiểm kê phụ thuộc ở từng bước.
drop table if exists public.revenue_shares restrict;
drop table if exists public.payments restrict;
drop table if exists public.orders restrict;
drop table if exists public.batch_items restrict;
drop table if exists public.credit_batches restrict;

drop table if exists public.evidence_photos restrict;
drop table if exists public.straw_management restrict;
drop table if exists public.fertilizer_applications restrict;
drop table if exists public.water_events restrict;
drop table if exists public.emission_calculations restrict;
drop table if exists public.emission_factors restrict;
drop table if exists public.field_seasons restrict;
drop table if exists public.seasons restrict;
drop table if exists public.fields restrict;
drop table if exists public.farmers restrict;

-- Đến đây mọi policy/RPC legacy dùng helper HTX đã mất. Bỏ helper, rồi mới cắt FK
-- cuối cùng từ profiles sang cooperatives. profiles và trigger auth vẫn được giữ.
drop function if exists public.app_coop_id() restrict;
drop function if exists public.app_user_role() restrict;

alter table public.profiles
  drop column cooperative_id restrict;

drop table if exists public.cooperatives restrict;

-- 6. Enum chỉ bỏ khi không còn cột/hàm nào sử dụng. user_role cố ý được giữ cho profiles.
drop type if exists public.payment_status restrict;
drop type if exists public.order_status restrict;
drop type if exists public.batch_status restrict;
drop type if exists public.season_type restrict;
drop type if exists public.vn_region restrict;
drop type if exists public.water_event_type restrict;
drop type if exists public.straw_method restrict;
drop type if exists public.organic_amendment restrict;
drop type if exists public.preseason_water restrict;
drop type if exists public.water_regime restrict;
drop type if exists public.crop_type restrict;

-- PostGIS được giữ: đây là extension nền tảng có thể tiếp tục phục vụ ranh giới dự án,
-- không phải dữ liệu của module HTX. Không sửa auth/chat/project objects tại đây.
