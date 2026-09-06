"""Các ca SQL chạy bởi run.py, mỗi ca có role/GUC, SQLSTATE và log riêng.
Không import SDK/driver mạng, không đọc môi trường Supabase.
"""
def lit(s): return "'"+s.replace("'","''")+"'"
def uid(n): return f'30000000-0000-4000-8000-{n:012d}'
owner,owner_b,dev,dev_b,viewer,outsider,second,admin=[uid(i) for i in range(1,9)]
method='20000000-0000-4000-8000-000000000001'
standard='10000000-0000-4000-8000-000000000001'
task='40000000-0000-4000-8000-000000000001'
file_a='50000000-0000-4000-8000-000000000001'
file_b='50000000-0000-4000-8000-000000000002'
fixture='insert into auth.users(id,email) values '+','.join(f"('{u}','u{i}@local.invalid')" for i,u in enumerate([owner,owner_b,dev,dev_b,viewer,outsider,second,admin]))+';'
check('F01','Tạo 8 user giả, trigger signup sinh profile',fixture+' select count(*) from profiles;',role='postgres',expected='8',required=True)
pa=check('H01','Tạo project A bằng RPC',"select create_project('Project A');",uid=owner,required=True)
pb=check('H02','Tạo project B độc lập',"select create_project('Project B');",uid=owner_b,required=True)
assert re.fullmatch('[a-f0-9-]{36}',pa) and re.fullmatch('[a-f0-9-]{36}',pb)
state['fixture']={'owner':owner,'owner_b':owner_b,'developer':dev,'viewer':viewer,'outsider':outsider,'project_a':pa,'project_b':pb}
check('H03','Project có đúng owner và 7 stage đúng tên/thứ tự',f"""
select (select count(*)=1 from project_members where project_id='{pa}' and user_id='{owner}' and role='owner')
 and (select array_agg(title order by ordinal)=array['Project Idea','Feasibility Assessment','Chọn Standard','Chọn Methodology','Baseline','Additionality','Project Design/PDD'] from project_stages where project_id='{pa}');
""",uid=owner,expected='t',required=True)
sa=check('F02','Lấy stage A bằng phiên owner A',f"select id from project_stages where project_id='{pa}' and ordinal=1;",uid=owner,required=True)
sb=check('F03','Lấy stage B bằng phiên owner B',f"select id from project_stages where project_id='{pb}' and ordinal=1;",uid=owner_b,required=True)
check('H04','Owner thêm developer/viewer, đọc membership không đệ quy',f"""
select set_project_member('{pa}','{dev}','developer');
select set_project_member('{pa}','{viewer}','viewer');
select count(*) from project_members where project_id='{pa}';
""",uid=owner,expected='3',required=True)
check('F04','Thêm developer riêng B',f"select set_project_member('{pb}','{dev_b}','developer'); select count(*) from project_members where project_id='{pb}';",uid=owner_b,expected='2',required=True)
check('H05','Tạo task, gán developer cùng project, đổi status',f"""
insert into project_tasks(id,project_id,stage_id,title,assignee_id) values('{task}','{pa}','{sa}','Task 1','{dev}');
update project_tasks set status='in_progress' where id='{task}';
select status from project_tasks where id='{task}';
""",uid=owner,expected='in_progress',required=True)

def badtask(stage,assignee):
    return f"insert into project_tasks(project_id,stage_id,title,assignee_id) values('{pa}','{stage}','attack','{assignee}');"
check('A01','C18.1 Task A trỏ stage B',badtask(sb,dev),uid=owner,error='23503',message='project_tasks_stage_id_project_id_fkey')
check('A02','C18.2 Assignee không là thành viên',badtask(sa,outsider),uid=owner,error='23503',message='project_tasks_project_id_assignee_id_assignee_role_fkey')
check('A03','C18.3 Assignee là viewer',badtask(sa,viewer),uid=owner,error='23503',message='project_tasks_project_id_assignee_id_assignee_role_fkey')
check('A04','C18.4 Assignee developer của B',badtask(sa,dev_b),uid=owner,error='23503',message='project_tasks_project_id_assignee_id_assignee_role_fkey')
check('A08','C18.8 Đổi project_id của task A sang B',f"update project_tasks set project_id='{pb}' where id='{task}';",uid=owner,error='42501',message='permission denied')
check('A08P','Sau tấn công task vẫn thuộc A',f"select project_id='{pa}' from project_tasks where id='{task}';",uid=owner,expected='t')
check('A09','C18.9 Outsider tự INSERT membership owner',f"insert into project_members(project_id,user_id,role) values('{pa}','{outsider}','owner');",uid=outsider,error='42501',message='project_members')
check('R01','Outsider SELECT projects/members/tasks rỗng, không đệ quy',f"select (select count(*) from projects)+(select count(*) from project_members)+(select count(*) from project_tasks);",uid=outsider,expected='0')
check('R02','Outsider INSERT task bị RLS chặn',badtask(sa,dev),uid=outsider,error='42501',message='row-level security')
check('R03','Outsider gọi RPC member không được',f"select set_project_member('{pa}','{outsider}','owner');",uid=outsider,error='P0001',message='Chỉ owner')
check('R04','Viewer đọc membership được, không đệ quy',f"select count(*) from project_members where project_id='{pa}';",uid=viewer,expected='3')
check('R05','Viewer INSERT task bị chặn',badtask(sa,dev),uid=viewer,error='42501',message='row-level security')
check('R06','Viewer UPDATE task không sửa row nào',f"with changed as(update project_tasks set title='attack' where id='{task}' returning id) select count(*) from changed;",uid=viewer,expected='0')
check('R07','Developer DELETE project bị chặn quyền bảng',f"delete from projects where id='{pa}';",uid=dev,error='42501',message='permission denied')
check('R08','Developer xoá mềm project không sửa được row',f"with changed as(update projects set deleted_at=now() where id='{pa}' returning id) select count(*) from changed;",uid=dev,expected='0')
check('R09','Anon không có quyền đọc projects',"select * from projects;",role='anon',error='42501',message='permission denied')
check('O01','Không demote owner cuối cùng',f"select set_project_member('{pa}','{owner}','viewer');",uid=owner,error='P0001',message='owner cuối cùng')
check('O02','Không xóa owner cuối cùng',f"select set_project_member('{pa}','{owner}',null);",uid=owner,error='P0001',message='owner cuối cùng')
check('O03','Không đổi developer còn được giao task sang viewer',f"select set_project_member('{pa}','{dev}','viewer');",uid=owner,error='23503',message='project_tasks_project_id_assignee_id_assignee_role_fkey')
check('S01','Không thêm stage tuỳ ý',f"insert into project_stages(project_id,ordinal,title) values('{pa}',1,'fake');",uid=owner,error='42501',message='permission denied')
check('S02','Không xoá stage',f"delete from project_stages where project_id='{pa}';",uid=owner,error='42501',message='permission denied')

def file_insert(project,user,id):
    return f"insert into project_files(id,project_id,object_path,original_name,mime_type,size_bytes,checksum) values('{id}','{project}','{project}/{user}/local-1/sample.csv','sample.csv','text/csv',10,repeat('a',64));"
check('F05','Đăng ký metadata file A bằng owner A',file_insert(pa,owner,file_a),uid=owner,required=True)
check('F06','Đăng ký metadata file B bằng owner B',file_insert(pb,owner_b,file_b),uid=owner_b,required=True)
check('A07','C18.7 Đính file B vào task A',f"insert into task_attachments(project_id,task_id,file_id) values('{pa}','{task}','{file_b}');",uid=owner,error='23503',message='task_attachments_file_id_project_id_fkey')
check('C13I','C13 SQL shim: authenticated INSERT storage.objects',f"insert into storage.objects(bucket_id,name,metadata) values('project-documents','{pa}/{owner}/local-1/sample.csv','{{}}'); select count(*) from storage.objects;",uid=owner,expected='1',required=True)
check('C13U','C13 SQL shim: metadata UPDATE trả 0 row',f"with changed as(update storage.objects set metadata='{{\"size\":10}}' where bucket_id='project-documents' and name='{pa}/{owner}/local-1/sample.csv' returning id) select count(*) from changed;",uid=owner,expected='0')
check('C13UPS','C13 SQL shim: upsert trên path có sẵn bị chặn',f"insert into storage.objects(bucket_id,name,metadata) values('project-documents','{pa}/{owner}/local-1/sample.csv','{{}}') on conflict(bucket_id,name) do update set metadata=excluded.metadata;",uid=owner,error='42501',message='row-level security')
check('C13V','Viewer đọc object được nhưng không upload',f"select count(*) from storage.objects where bucket_id='project-documents';",uid=viewer,expected='1')
check('C13VW','Viewer upload SQL shim bị chặn',f"insert into storage.objects(bucket_id,name) values('project-documents','{pa}/{viewer}/x/a.csv');",uid=viewer,error='42501',message='row-level security')
check('C13O','Outsider không đọc object project A',"select count(*) from storage.objects;",uid=outsider,expected='0')
check('FADMIN','Thiết lập global admin giả chỉ trên DB local',f"set local app.bypass_profile_guard='on'; update profiles set role='platform_admin' where id='{admin}';",role='postgres',required=True)
check('C13TI','C13 SQL shim: admin INSERT template object đúng path',f"insert into storage.objects(bucket_id,name) values('methodology-templates','{method}/local-1/template.pdf'); select count(*) from storage.objects where bucket_id='methodology-templates';",uid=admin,expected='1',required=True)
check('C13RF','Kiểm restrictive UPDATE ngay cả khi có permissive UPDATE shim',f"""
create policy cr_pgtest_update_probe on storage.objects for update to authenticated using(true) with check(true);
set local role authenticated;
set local request.jwt.claim.sub='{owner}';
with changed as(update storage.objects set metadata='{{"size":11}}' where bucket_id='project-documents' and name='{pa}/{owner}/local-1/sample.csv' returning id) select count(*) from changed;
""",role='postgres',expected='0')
coop=check('FCOOP','Tạo HTX local để kiểm evidence không bị ảnh hưởng',"select create_cooperative_and_join('Local cooperative','PGTEST','Local province','north');",uid=owner,required=True)
check('C13E','Evidence vẫn INSERT và DELETE được qua policy legacy',f"insert into storage.objects(bucket_id,name) values('evidence','{coop}/test/photo.jpg'); with removed as(delete from storage.objects where bucket_id='evidence' returning id) select count(*) from removed;",uid=owner,expected='1')

configure=f"update projects set standard_id='{standard}',methodology_id='{method}',standard_locked_at=now(),methodology_locked_at=now(),baseline='{{\"baseline_stock_tc_ha\":\"10\"}}' where id='{pa}';"
check('H06','Owner chọn/khóa Standard+Methodology, nhập baseline',configure+f" select baseline_revision from projects where id='{pa}';",uid=owner,expected='1',required=True)
period=check('H07','Tạo kỳ với snapshot schema/baseline/hệ số',f"select create_monitoring_period('{pa}','Period 1','2026-01-01','2026-12-31');",uid=owner,required=True)
assert re.fullmatch('[a-f0-9-]{36}',period)
records=json.dumps([{'record_key':'P1','observed_on':'2026-06-01','values':{'plot_code':'P1','area_ha':'2','stock_tc_ha':'12'}}])
check('H08','Developer ghi observation qua RPC',f"select save_monitoring_records('{period}',{lit(records)},0)->>'data_revision';",uid=dev,expected='1',required=True)
check('A05','C18.5 FK monitoring_data sai project, kiểm dưới DB owner để đi qua lớp grant',f"insert into monitoring_data(project_id,period_id,record_key,observed_on,metric_values,entered_by,revision) values('{pb}','{period}','forged','2026-06-01','{{\"plot_code\":\"x\",\"area_ha\":\"2\",\"stock_tc_ha\":\"12\"}}','{owner}',1);",role='postgres',error='23503',message='monitoring_data_period_id_project_id_fkey')
check('A05AUTH','C18.5 authenticated không được INSERT monitoring_data trực tiếp',f"insert into monitoring_data(project_id,period_id,record_key,observed_on,metric_values,entered_by,revision) values('{pb}','{period}','forged','2026-06-01','{{}}','{owner}',1);",uid=owner,error='42501',message='permission denied')
check('M01','Sai expected_revision không ghi được',f"select save_monitoring_records('{period}',{lit(records)},0);",uid=dev,error='P0001',message='revision')
bad=json.loads(records); bad[0]['record_key']='bad';bad[0]['values']['area_ha']='-1'
batch=json.loads(records);batch[0]['record_key']='would-insert';batch+=bad
check('M02','Batch có row sai bounds rollback toàn bộ',f"select save_monitoring_records('{period}',{lit(json.dumps(batch))},1);",uid=dev,error='P0001',message='ngoài phạm vi')
check('M03','Sau lỗi batch còn đúng 1 observation và revision=1',f"select (select count(*)=1 from monitoring_data where period_id='{period}') and (select data_revision=1 from monitoring_periods where id='{period}');",uid=owner,expected='t')
check('M04','Viewer không gọi được RPC ghi monitoring',f"select save_monitoring_records('{period}',{lit(records)},1);",uid=viewer,error='P0001',message='Không có quyền')
import_records=json.loads(records);import_records[0]['record_key']='P2';import_records[0]['source_row']=2
check('M05','Import file cùng project thành công nguyên tử',f"select save_monitoring_records('{period}',{lit(json.dumps(import_records))},1,'{file_a}','{{}}')->>'data_revision';",uid=owner,expected='2',required=True)
check('M06','Retry import không tăng revision',f"select save_monitoring_records('{period}',{lit(json.dumps(import_records))},1,'{file_a}','{{}}')->>'already_imported';",uid=owner,expected='true')
check('H09','Owner khóa kỳ và snapshot dữ liệu',f"select lock_monitoring_period('{period}',2); select status||':'||jsonb_array_length(data_snapshot) from monitoring_periods where id='{period}';",uid=owner,expected='locked:2',required=True)
check('L01','Kỳ đã khóa không ghi qua RPC',f"select save_monitoring_records('{period}',{lit(records)},2);",uid=dev,error='P0001',message='Kỳ khóa')
check('L02','Kỳ khóa chặn UPDATE dữ liệu kể cả DB owner',f"update monitoring_data set metric_values='{{}}' where period_id='{period}';",role='postgres',error='P0001',message='Kỳ không mở')
check('L03','Kỳ khóa chặn xóa observation qua RPC',f"select delete_monitoring_record('{period}','P1',2);",uid=dev,error='P0001',message='Kỳ khóa')
template=check('F07','Lấy template placeholder đúng methodology',f"select id from report_templates where methodology_id='{method}' and format='pdf';",uid=owner,required=True)
wrong_template=check('F08','Lấy template khác Standard/methodology',"select id from report_templates where methodology_id='20000000-0000-4000-8000-000000000004' and format='pdf';",uid=owner,required=True)
def report_sql(t=template,status='preview'):
    return f"select create_mrv_report('{period}','{t}','{{\"test_supplied_result\":true}}','{{\"source\":\"local SQL test, not evaluator\"}}','test-engine-v0','{owner}','{status}');"
report=check('H10','Backend service_role sinh MRV preview từ kỳ khóa',report_sql(),role='service_role',required=True)
check('H11','Report giữ nguyên snapshot/hash/revision của kỳ',f"select r.schema_hash=p.schema_hash and r.baseline_snapshot=p.baseline_snapshot and r.factors_snapshot=p.factors_snapshot and r.data_revision=p.data_revision and r.input_snapshot=p.data_snapshot from mrv_reports r join monitoring_periods p on p.id=r.period_id where r.id='{report}';",uid=owner,expected='t')
check('A06','C18.6 RPC từ chối template khác methodology/Standard',report_sql(wrong_template),role='service_role',error='P0001',message='Template khác')
check('M07','Authenticated không được gọi RPC kết quả report',report_sql(),uid=owner,error='42501',message='permission denied')
check('M08','Sample + placeholder không được tạo final',report_sql(status='final'),role='service_role',error='P0001',message='Final cần')
check('M09','Report bất biến cả với DB owner',f"update mrv_reports set results='{{}}' where id='{report}';",role='postgres',error='P0001',message='bất biến')
check('M10','Methodology published bất biến',f"update methodologies set name='changed' where id='{method}';",role='postgres',error='P0001',message='published bất biến')
check('M11','Factors published bất biến',f"update methodology_factors set value=1 where methodology_id='{method}';",role='postgres',error='P0001',message='draft')
check('ASTNULL','AST op=null phải bị từ chối',"select project_validate_expression('{\"op\":null,\"args\":[{\"constant\":1},{\"constant\":2}]}','{}','{}','{}','{}');",role='postgres',error='P0001',message='Toán tử AST')
check('ASTCODE','AST chứa mã lạ phải bị từ chối',"select project_validate_expression('{\"op\":\"eval\",\"args\":[{\"constant\":1},{\"constant\":2}]}','{}','{}','{}','{}');",role='postgres',error='P0001',message='Toán tử AST')
check('ASTCYCLE','AST tham chiếu calculation chưa có phải bị từ chối',"select project_validate_expression('{\"calculation\":\"self\"}','{}','{}','{}','{}');",role='postgres',error='P0001',message='đứng trước')
check('M12','Đổi baseline project không làm đổi baseline report cũ',f"update projects set baseline='{{\"baseline_stock_tc_ha\":\"20\"}}' where id='{pa}'; select baseline_snapshot->>'baseline_stock_tc_ha' from mrv_reports where id='{report}';",uid=owner,expected='10')
check('C21','Xóa auth.users bị RESTRICT và rollback toàn bộ',f"delete from auth.users where id='{owner}';",role='postgres',error='23503',message='profiles')
check('C21P','User và profile vẫn còn sau lệnh DELETE lỗi',f"select exists(select 1 from auth.users where id='{owner}') and exists(select 1 from profiles where id='{owner}');",role='postgres',expected='t')

# Hai kết nối thật: transaction thứ nhất giữ khóa để transaction thứ hai đợi.
check('O04','Thêm owner thứ hai để thử race',f"select set_project_member('{pa}','{second}','owner'); select count(*) from project_members where project_id='{pa}' and role='owner';",uid=owner,expected='2',required=True)
def race_attempt(user,target,delay):
    body=scoped(f"select set_project_member('{pa}','{target}','viewer'); select pg_sleep({delay});",uid=user)
    return sql(body)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    first=pool.submit(race_attempt,owner,owner,2)
    time.sleep(0.5)
    other=pool.submit(race_attempt,second,second,0)
    a,b=first.result(),other.result()
(OUT/'O05-first.log').write_text(a.stdout)
(OUT/'O05-second.log').write_text(b.stdout)
ok=a.returncode==0 and b.returncode!=0 and 'owner cuối cùng' in b.stdout
state['tests'].append({'id':'O05','description':'Hai owner đồng thời tự demote: đúng một thành công, một bị chặn',
 'expected':'first success; second SQLSTATE P0001 owner cuối cùng','actual':a.stdout+'\nSECOND:\n'+b.stdout,
 'status':'PASS' if ok else 'FAIL'})
persist();print(('PASS' if ok else 'FAIL')+' O05 owner concurrency',flush=True)
check('O06','Sau race còn đúng 1 owner',f"select count(*) from project_members where project_id='{pa}' and role='owner';",uid=second,expected='1')

# ---------------------------------------------------------------- C5: danh tính thành viên
# Migration 0015. Dùng project B (owner_b + dev_b) vì nó không bị race O05 chạm vào,
# nên trạng thái membership ở đây tất định bất kể thứ tự các ca phía trên.
email_devb, email_outsider = 'u3@local.invalid', 'u5@local.invalid'
directory = "select count(*)||'/'||count(email) from project_member_directory('%s');" % pb

check('D01','C5 Owner đọc danh bạ dự án: đủ thành viên, có email',directory,uid=owner_b,expected='2/2')
check('D02','C5 Developer đọc danh bạ: thấy tên, KHÔNG thấy email',directory,uid=dev_b,expected='2/0')
check('D03','C5 Outsider gọi danh bạ trả rỗng, không lỗi, không lộ tồn tại dự án',directory,uid=outsider,expected='0/0')
check('D04','C5 Anon không execute được danh bạ',directory,role='anon',error='42501',message='permission denied')
check('D05','C5 Danh bạ trả đúng full_name từ profiles',
      f"select full_name from project_member_directory('{pb}') where user_id='{dev_b}';",uid=owner_b,expected='u3')
check('D06','C5 profiles_select KHÔNG bị nới: vẫn không đọc được hồ sơ ngoài phạm vi',
      f"select count(*) from profiles where id='{outsider}';",uid=dev_b,expected='0')

check('I01','C5 Owner tra người đã là thành viên bằng email chính xác',
      f"select user_id::text||'/'||already_member from project_lookup_invitee('{pb}',{lit(email_devb)});",
      uid=owner_b,expected=dev_b+'/true')
check('I02','C5 Owner tra người chưa là thành viên: already_member=false',
      f"select user_id::text||'/'||already_member from project_lookup_invitee('{pb}',{lit(email_outsider)});",
      uid=owner_b,expected=outsider+'/false')
check('I03','C5 Developer KHÔNG được tra cứu người để mời',
      f"select count(*) from project_lookup_invitee('{pb}',{lit(email_devb)});",
      uid=dev_b,error='P0001',message='Chỉ owner')
check('I04','C5 Outsider KHÔNG được tra cứu người để mời',
      f"select count(*) from project_lookup_invitee('{pb}',{lit(email_devb)});",
      uid=outsider,error='P0001',message='Chỉ owner')
check('I05','C5 Ký tự đại diện không liệt kê được người dùng (khớp tuyệt đối)',
      f"select count(*) from project_lookup_invitee('{pb}',{lit('%')});",uid=owner_b,expected='0')
check('I06','C5 Tiền tố email không khớp (không LIKE)',
      f"select count(*) from project_lookup_invitee('{pb}',{lit('u3')});",uid=owner_b,expected='0')
check('I07','C5 Email rỗng bị từ chối',
      f"select count(*) from project_lookup_invitee('{pb}',{lit('   ')});",uid=owner_b,error='P0001',message='Email không hợp lệ')
check('I08','C5 Email khác hoa/thường vẫn khớp',
      f"select count(*) from project_lookup_invitee('{pb}',{lit('U3@LOCAL.INVALID')});",uid=owner_b,expected='1')
check('I09','C5 Owner dự án A không tra cứu được qua dự án B',
      f"select count(*) from project_lookup_invitee('{pb}',{lit(email_devb)});",uid=owner,error='P0001',message='Chỉ owner')
