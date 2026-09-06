#!/usr/bin/env python3
"""Kiểm chứng duy nhất qua docker exec/Unix socket, không đọc env/DSN Supabase.
Chạy: python3 -B tests/db/run.py --run-id ten-lan-chay
Mỗi lần tạo container mới, không reuse DB. Log chỉ ghi tests/db/runs/.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--run-id', required=True)
parser.add_argument('--image', default='postgis/postgis:17-3.4')
parser.add_argument('--diagnose-run', help='Chỉ đọc policy từ một container cr-pgtest- do runner tạo.')
args = parser.parse_args()
if not re.fullmatch('[a-z0-9-]+', args.run_id):
    parser.error('run-id chỉ chứa a-z, 0-9, dấu gạch nối')
NAME = 'cr-pgtest-' + args.run_id
OUT = ROOT / 'tests/db/runs' / args.run_id
OUT.mkdir(parents=True, exist_ok=False)
state = {'container': NAME, 'image': args.image, 'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
         'migration_transaction_mode': 'psql -X -1 -v ON_ERROR_STOP=1 -f -',
         'migrations': [], 'tests': [], 'not_run': ['C13-HTTP: Không có Supabase Storage HTTP/S3/TUS trong shim.']}

def persist():
    (OUT / 'results.json').write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')

def command(argv, **kw):
    return subprocess.run(argv, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, **kw)

def sql(text, *, file=None, transaction=False):
    cmd = ['docker','exec','-i',NAME,'psql','-X','-q','-A','-t','-U','postgres','-d','postgres',
           '-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
    if transaction: cmd.append('-1')
    cmd += ['-f','-']
    result = command(cmd, input=text, timeout=60)
    if file: (OUT/file).write_text(result.stdout)
    return result

def scoped(text, role='authenticated', uid=None):
    assert role in ('authenticated','anon','service_role','postgres')
    prefix = 'begin;\nset local statement_timeout=15000;\n'
    if role != 'postgres': prefix += 'set local role '+role+';\n'
    if uid: prefix += "set local request.jwt.claim.sub='"+uid+"';\n"
    return prefix+text+'\ncommit;\n'

def check(code, description, text, *, role='authenticated', uid=None, expected=None,
          error=None, message=None, required=False):
    body = scoped(text,role,uid)
    (OUT/(code+'.sql')).write_text(body)
    r = sql(body, file=code+'.log')
    actual = r.stdout.strip()
    ok = (r.returncode != 0 and re.search(r'ERROR:\s+'+error+r':',actual) is not None
          and (message is None or message in actual)) if error else (r.returncode == 0 and (expected is None or actual == expected))
    state['tests'].append({'id':code,'description':description,'role':role,'uid':uid,
                           'expected':('SQLSTATE '+error+(' / '+message if message else '')) if error else expected or 'SQL thành công',
                           'actual':actual,'exit_code':r.returncode,'status':'PASS' if ok else 'FAIL'})
    persist()
    print(('PASS ' if ok else 'FAIL ')+code+' '+description, flush=True)
    if not ok: print(actual, flush=True)
    if required and not ok: raise RuntimeError('Prerequisite failed: '+code)
    return actual

if args.diagnose_run:
    if not re.fullmatch('[a-z0-9-]+',args.diagnose_run): parser.error('diagnose-run không hợp lệ')
    NAME='cr-pgtest-'+args.diagnose_run
    state['container']=NAME
    r=sql("select polname,pg_get_expr(polwithcheck,polrelid) from pg_policy where polrelid='storage.objects'::regclass and polcmd='a' order by polname;",file='storage-bindings.log')
    print(r.stdout)
    env=sql("select extname,extversion,extnamespace::regnamespace from pg_extension order by extname;",file='extensions.log')
    print(env.stdout)
    details=command(['docker','inspect',NAME,'--format','{{json .HostConfig}} {{json .Mounts}}'])
    (OUT/'isolation.log').write_text(details.stdout)
    check('ASTNULL','AST op=null phải bị từ chối',"select project_validate_expression('{\"op\":null,\"args\":[{\"constant\":1},{\"constant\":2}]}','{}','{}','{}','{}');",role='postgres',error='P0001')
    sys.exit(1 if r.returncode or any(t['status']=='FAIL' for t in state['tests']) else 0)

try:
    # Không mount repo/credential, không publish port, không Docker volume ngoài tmpfs.
    r=command(['docker','run','-d','--name',NAME,'--platform','linux/amd64','--network','none',
               '--label','cr-pgtest=true','--tmpfs','/var/lib/postgresql/data:rw',
               '-e','POSTGRES_HOST_AUTH_METHOD=trust',args.image],timeout=60)
    (OUT/'container.log').write_text(r.stdout)
    if r.returncode: raise RuntimeError(r.stdout)
    for _ in range(60):
        logs=command(['docker','logs',NAME],timeout=10)
        # Image PostGIS khởi động một server tạm để cài extension rồi restart.
        # pg_isready đơn lẻ có thể bắt nhầm server tạm và đua CREATE EXTENSION.
        if 'PostgreSQL init process complete; ready for start up.' not in logs.stdout:
            time.sleep(1)
            continue
        r=command(['docker','exec',NAME,'pg_isready','-U','postgres'],timeout=10)
        if r.returncode==0: break
        time.sleep(1)
    else: raise RuntimeError('Postgres chưa sẵn sàng')
    (OUT/'startup.log').write_text(logs.stdout)
    state['environment']=sql('select version(); select postgis_full_version();').stdout.strip()
    (OUT/'extensions.log').write_text(sql('select extname,extversion,extnamespace::regnamespace from pg_extension order by extname;').stdout)
    (OUT/'isolation.log').write_text(command(['docker','inspect',NAME,'--format','{{json .HostConfig}} {{json .Mounts}}']).stdout)
    state['image_inspect']=command(['docker','image','inspect',args.image,'--format','{{json .RepoDigests}}']).stdout.strip()
    r=sql((ROOT/'tests/db/shim.sql').read_text(),file='shim.log',transaction=True)
    if r.returncode: raise RuntimeError('Shim failed: '+r.stdout)
    migrations=sorted((ROOT/'supabase/migrations').glob('*.sql'))
    migrations=[p for p in migrations if re.match(r'00(?:0[1-9]|1[0-5])_',p.name)]
    assert len(migrations)==15
    for p in migrations:
        # Lưu nguyên byte file đã áp để lỗi dòng không bị mất sau khi sửa SQL nguồn.
        original=p.read_text()
        (OUT/p.name).write_text(original)
        r=sql(original,file=p.name+'.log',transaction=True)
        state['migrations'].append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
                                    'status':'PASS' if r.returncode==0 else 'FAIL','output':r.stdout})
        persist()
        print(('PASS ' if r.returncode==0 else 'FAIL ')+p.name,flush=True)
        if r.returncode: raise RuntimeError('Migration failed: '+p.name+'\n'+r.stdout)
    exec(compile((ROOT/'tests/db/cases.py').read_text(),'tests/db/cases.py','exec'),globals())
    state['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    persist()
    print('RESULT:',sum(t['status']=='PASS' for t in state['tests']),'/',len(state['tests']),flush=True)
    sys.exit(1 if any(t['status']=='FAIL' for t in state['tests']) else 0)
except Exception as e:
    state['fatal_error']=str(e)
    state['not_run'].append('Các ca sau điểm dừng chưa chạy; xem tests và fatal_error.')
    persist()
    print(str(e),flush=True)
    sys.exit(1)
