#!/usr/bin/env python3
"""Đẩy 5 bộ dataset của CR lên Eval Platform, tạo Evaluation Set và chấm.

Chạy sau `run_cr_eval.py` — script này KHÔNG sinh câu trả lời, nó chỉ mang những câu
trả lời đã có lên platform để chấm. Nếu cột `output` còn rỗng thì dừng, vì output rỗng
sẽ bị chấm là "trả lời sai" chứ không phải "hạ tầng lỗi", và con số thu được sẽ đổ oan
cho trợ lý.

Ghép evaluator theo đúng khuyến cáo của platform trong `datasets/eval-travel-README.md`:
tối đa 4–5 evaluator một set. Verdict theo luật all-pass (mọi evaluator >= 0.75) nên
càng nhiều trục thì nhiễu của judge càng dồn lại — 4 trục còn 81% cơ hội gắn đúng "Đạt"
cho một câu trả lời đúng, 13 trục chỉ còn 51%.
"""

from __future__ import annotations

import argparse
import csv
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request

SETS = pathlib.Path(__file__).parent / "datasets"
OUT = pathlib.Path(__file__).parent / "results"

# Mỗi bộ đo một trục, và chỉ những evaluator thật sự nói lên điều đó.
PLAN = [
    {
        "file": "cr-1-accuracy.csv",
        "set": "CR · Accuracy",
        "evaluators": ["accuracy", "completeness", "relevance"],
        "mapping": {"input": "question", "output": "output", "extra": {"key_points": "key_points"}},
    },
    {
        "file": "cr-2-faithfulness.csv",
        "set": "CR · Faithfulness",
        "evaluators": ["faithfulness", "context-relevance", "relevance", "coherence"],
        "mapping": {"input": "question", "output": "output", "extra": {"context": "contexts"}},
    },
    {
        "file": "cr-3-scope-safety.csv",
        "set": "CR · Scope & Safety",
        "evaluators": ["off-topic", "safety", "helpfulness", "accuracy"],
        "mapping": {"input": "question", "output": "output", "extra": {"scope_spec": "scope_spec"}},
    },
    {
        # Chỉ mưu toan ghi đè chỉ dẫn. Vi phạm chính sách sản phẩm nằm ở bộ 6 —
        # gộp chung vào đây là dùng sai evaluator, xem chú thích trong build script.
        "file": "cr-4-jailbreak.csv",
        "set": "CR · Jailbreak resistance",
        "evaluators": ["instruction-following", "safety", "off-topic", "helpfulness"],
        "mapping": {"input": "question", "output": "output", "extra": {"key_points": "key_points", "scope_spec": "scope_spec"}},
    },
    {
        "file": "cr-5-experience.csv",
        "set": "CR · Experience",
        "evaluators": ["instruction-following", "tone", "conciseness", "helpfulness"],
        "mapping": {"input": "question", "output": "output", "extra": {"tone_spec": "tone_spec"}},
    },
    {
        # Ranh giới nghề nghiệp và phân quyền: lời từ chối phải ĐÚNG và vẫn HỮU ÍCH,
        # nên `helpfulness` ở đây không phải cho có — chặn cửa mà bỏ mặc người dùng
        # cũng là hỏng.
        "file": "cr-6-policy.csv",
        "set": "CR · Policy",
        "evaluators": ["off-topic", "safety", "instruction-following", "helpfulness"],
        "mapping": {"input": "question", "output": "output", "extra": {"key_points": "key_points", "scope_spec": "scope_spec"}},
    },
]


class Api:
    """Client có tự làm mới token.

    Token của platform sống 900 giây, còn chấm 6 bộ bằng LLM judge thì lâu hơn thế —
    lần chạy đầu chết giữa chừng ở bộ thứ sáu với `token_expired`, mất luôn kết quả
    polling của bộ thứ năm. Nên phải tự đăng nhập lại khi gặp 401 thay vì để cả lượt
    chấm đổ vì một chi tiết hạ tầng.
    """

    def __init__(self, base: str, email: str, password: str) -> None:
        self.base = base.rstrip("/")
        self.email, self.password = email, password
        self.token = login(self.base, email, password)

    def call(self, method: str, path: str, body: dict | None = None, timeout: int = 900, _retry: bool = True):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            f"{self.base}{path}",
            data=data,
            method=method,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.token}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read().decode()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            if e.code == 401 and _retry:
                self.token = login(self.base, self.email, self.password)
                return self.call(method, path, body, timeout, _retry=False)
            sys.exit(f"{method} {path} → HTTP {e.code}: {e.read().decode('utf-8','replace')[:400]}")


def login(base: str, email: str, password: str) -> str:
    req = urllib.request.Request(
        f"{base}/api/auth/login",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["access_token"]


def load_rows(path: pathlib.Path) -> tuple[list[str], list[dict]]:
    rows = list(csv.DictReader(path.open(encoding="utf-8-sig")))
    if not rows:
        sys.exit(f"{path.name} rỗng")
    cols = list(rows[0].keys())
    # Bộ guardrail chấm thẳng trên câu hỏi nên không cần output.
    if "output" in cols:
        missing = [r["id"] for r in rows if not (r.get("output") or "").strip()]
        if missing:
            sys.exit(
                f"{path.name}: còn {len(missing)} dòng chưa có output ({', '.join(missing[:5])}…). "
                "Chạy eval/run_cr_eval.py trước — upload lúc này sẽ đổ oan cho trợ lý."
            )
    return cols, rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--email", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--slug", default="cr-carbon")
    ap.add_argument("--project-name", default="CR — Nền tảng dự án Carbon")
    ap.add_argument("--only", help="Chỉ chạy các bộ có tên chứa chuỗi này.")
    # Không có model judge thì mọi dòng bị đánh trượt vì không ai chấm, chứ không
    # phải vì trợ lý trả lời sai — lần chạy đầu đã dính đúng bẫy đó.
    ap.add_argument("--model", default="judge", help="Mã model dùng làm judge.")
    args = ap.parse_args()

    api = Api(args.base, args.email, args.password)
    OUT.mkdir(exist_ok=True)

    slugs = {p["slug"] for p in api.call("GET", "/api/projects")}
    if args.slug not in slugs:
        api.call("POST", "/api/projects", {"slug": args.slug, "name": args.project_name})
        print(f"đã tạo project {args.slug}")
    else:
        print(f"dùng project sẵn có {args.slug}")

    plans = [p for p in PLAN if not args.only or args.only.lower() in p["set"].lower()]
    summary = []
    for plan in plans:
        path = SETS / plan["file"]
        cols, rows = load_rows(path)
        print(f"\n=== {plan['set']} ({len(rows)} dòng) ===")

        ds = api.call(
            "POST",
            f"/api/projects/{args.slug}/datasets/import",
            {
                "name": plan["set"],
                "columns": cols,
                "rows": rows,
                "source_file": plan["file"],
            },
        )
        code = ds.get("code") or ds.get("dataset", {}).get("code")
        print(f"  dataset: {code}")

        # Chạy lại một bộ thì suite đã tồn tại — dùng lại thay vì tạo trùng, để so
        # sánh giữa các lần chấm vẫn trên cùng một cấu hình evaluator.
        existing = api.call("GET", f"/api/projects/{args.slug}/evaluation-sets")
        found = next((e for e in existing if e.get("name") == plan["set"]), None)
        if found:
            set_id = found.get("id") or found.get("set_id")
            print("  evaluation set: dùng lại", set_id)
        else:
            es = api.call(
                "POST",
                f"/api/projects/{args.slug}/evaluation-sets",
                {"name": plan["set"], "evaluators": plan["evaluators"]},
            )
            set_id = es.get("id") or es.get("set_id")
        print(f"  evaluators: {', '.join(plan['evaluators'])}")

        run = api.call(
            "POST",
            f"/api/projects/{args.slug}/offline-evals/run",
            {
                "name": plan["set"],
                "dataset_code": code,
                "evaluation_set_id": set_id,
                "mapping": plan["mapping"],
                "model_code": args.model,
            },
        )
        run_id = run.get("run_id") or run.get("id")
        print(f"  run: {run_id}")

        # Chấm bằng LLM nên chậm; hỏi lại tới khi có kết quả.
        for _ in range(120):
            state = api.call("GET", f"/api/projects/{args.slug}/offline-evals")
            row = next((r for r in state if (r.get("run_id") or r.get("id")) == run_id), None)
            status = (row or {}).get("status", "")
            if status and status.lower() not in ("running", "queued", "pending"):
                break
            time.sleep(10)

        (OUT / f"{plan['file'].replace('.csv','')}.run.json").write_text(
            json.dumps(row or run, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        summary.append({"set": plan["set"], "run_id": run_id, "status": status, "row": row})
        print(f"  → {status}")

    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\n--- tổng kết ---")
    for s in summary:
        print(f"{s['set']:24} {s['status']:12} run={s['run_id']}")
    print(f"\nBáo cáo HTML: {args.base}/api/projects/{args.slug}/offline-evals/<run_id>/report")


if __name__ == "__main__":
    main()
