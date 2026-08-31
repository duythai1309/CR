-- Lưu thửa ruộng kèm hình học, và view xuất GeoJSON cho bản đồ.

-- View kế thừa RLS của bảng gốc nhờ security_invoker, nên không mở thêm cửa nào.
create view fields_view with (security_invoker = true) as
select
  f.id, f.cooperative_id, f.farmer_id, f.name, f.area_ha, f.declared_area_ha,
  f.soil_type, f.created_at,
  fa.full_name as farmer_name,
  st_asgeojson(f.geom)::jsonb as geojson
from fields f
join farmers fa on fa.id = f.farmer_id;

-- Lưu thửa và trả về ngay danh sách thửa chồng lấn. Chồng lấn là cảnh báo chứ không
-- chặn: ranh ruộng vẽ tay có sai số, người nhập liệu cần tự quyết định.
create function save_field(
  p_farmer_id uuid,
  p_name text,
  p_geojson jsonb,
  p_declared_area_ha numeric default null,
  p_soil_type text default null,
  p_field_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  coop uuid;
  g geometry;
  target uuid;
  v_overlaps jsonb;  -- 'overlaps' là từ khoá SQL, không dùng làm tên biến được
  v_area numeric;
begin
  select cooperative_id into coop from farmers where id = p_farmer_id;
  if coop is null then raise exception 'Không tìm thấy nông hộ'; end if;
  if not (app_is_admin() or coop = app_coop_id()) then
    raise exception 'Nông hộ này không thuộc hợp tác xã của bạn';
  end if;

  g := st_setsrid(st_geomfromgeojson(p_geojson::text), 4326);
  if st_geometrytype(g) <> 'ST_Polygon' then
    raise exception 'Ranh thửa phải là một vùng khép kín';
  end if;
  if not st_isvalid(g) then
    g := st_makevalid(g);
    if st_geometrytype(g) <> 'ST_Polygon' then
      raise exception 'Ranh thửa bị tự cắt, hãy vẽ lại';
    end if;
  end if;
  if st_area(g::geography) < 100 then
    raise exception 'Ranh thửa nhỏ hơn 100 m², nhiều khả năng vẽ nhầm';
  end if;

  if p_field_id is null then
    insert into fields (cooperative_id, farmer_id, name, geom, declared_area_ha, soil_type)
    values (coop, p_farmer_id, p_name, g, p_declared_area_ha, nullif(p_soil_type, ''))
    returning id, area_ha into target, v_area;
  else
    update fields
    set farmer_id = p_farmer_id, name = p_name, geom = g,
        declared_area_ha = p_declared_area_ha, soil_type = nullif(p_soil_type, '')
    where id = p_field_id and (cooperative_id = app_coop_id() or app_is_admin())
    returning id, area_ha into target, v_area;
    if target is null then raise exception 'Không tìm thấy thửa cần sửa'; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'label', o.label, 'overlap_ha', o.overlap_ha, 'same_cooperative', o.same_cooperative)), '[]'::jsonb)
  into v_overlaps
  from check_field_overlap(g, target) o;

  return jsonb_build_object('field_id', target, 'area_ha', v_area, 'overlaps', v_overlaps);
end;
$$;
