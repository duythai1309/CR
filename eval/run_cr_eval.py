#!/usr/bin/env python3
"""Điền cột `output` của các bộ dataset bằng câu trả lời THẬT của trợ lý CR.

Gọi `POST /api/eval/chat` — endpoint dùng đúng system prompt, đúng bộ công cụ và đúng
vòng lặp của production, chỉ khác là chạy trên fixture cố định thay vì DB thật. Nhờ vậy
bài đo tất định và dữ liệu thật không rời hệ thống.

Không bao giờ tự viết `output`. Cả bài đo là đo trợ lý thật; điền câu trả lời do người
hay mô hình khác viết thì con số thu được vô nghĩa.

Chạy:
    python3 eval/run_cr_eval.py                     # cần CR chạy ở localhost:3000
    python3 eval/run_cr_eval.py --base http://... --only cr-4-guardrail.csv
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

ROOT = pathlib.Path(__file__).parent.parent
SETS = pathlib.Path(__file__).parent / "datasets"


def read_token() -> str:
    """Đọc EVAL_API_TOKEN từ .env.local. Không in ra, không ghi vào dataset."""
    env = ROOT / ".env.local"
    if not env.exists():
        sys.exit("Không thấy .env.local")
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("EVAL_API_TOKEN="):
            token = line.split("=", 1)[1].strip()
            if token:
                return token
    sys.exit("EVAL_API_TOKEN chưa đặt trong .env.local — endpoint eval sẽ trả 503.")


def ask(base: str, token: str, question: str, role: str) -> tuple[str, str, dict]:
    """Trả (answer, contexts_json, trajectory). Lỗi thì answer rỗng để lộ ra ở báo cáo."""
    body = json.dumps({"input": question, "role": role}).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/api/eval/chat",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:200]
        return "", "", {"error": f"HTTP {e.code}: {detail}"}
    except Exception as e:  # timeout, connection refused...
        return "", "", {"error": str(e)}

    contexts = data.get("contexts") or []
    return (
        data.get("answer", ""),
        json.dumps(contexts, ensure_ascii=False) if contexts else "",
        data.get("trajectory") or {},
    )


def run_file(path: pathlib.Path, base: str, token: str, role: str, delay: float) -> dict:
    rows = list(csv.DictReader(path.open(encoding="utf-8-sig")))
    if not rows:
        return {"file": path.name, "total": 0, "filled": 0, "failed": 0}

    fields = list(rows[0].keys())
    trajectories: list[dict] = []
    filled = failed = 0

    for i, row in enumerate(rows, 1):
        answer, contexts, traj = ask(base, token, row["question"], role)
        row["output"] = answer
        if "contexts" in fields:
            row["contexts"] = contexts
        if answer:
            filled += 1
        else:
            failed += 1
            print(f"  ✗ {row['id']}: {traj.get('error', 'câu trả lời rỗng')}")
        trajectories.append({"id": row["id"], "trajectory": traj})
        print(f"  [{i}/{len(rows)}] {row['id']}", end="\r", flush=True)
        time.sleep(delay)

    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    # Trajectory để riêng: platform chấm bằng CSV, còn bốn evaluator agentic
    # (tool-call-correctness, trajectory-efficiency, goal-completion, routing) cần
    # chuỗi gọi công cụ chứ không chỉ câu chữ.
    traj_path = path.with_suffix(".trajectory.json")
    traj_path.write_text(json.dumps(trajectories, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"  {path.name}: {filled} điền được, {failed} lỗi → {traj_path.name}")
    return {"file": path.name, "total": len(rows), "filled": filled, "failed": failed}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3000")
    ap.add_argument("--role", default="coop_staff", help="Vai trò toàn cục của người hỏi.")
    ap.add_argument("--only", help="Chỉ chạy một file dataset.")
    ap.add_argument("--delay", type=float, default=1.0, help="Giãn cách giữa các câu, giây.")
    args = ap.parse_args()

    token = read_token()
    files = sorted(SETS.glob("cr-*.csv"))
    if args.only:
        files = [f for f in files if f.name == args.only]
    if not files:
        sys.exit("Không thấy dataset nào. Chạy eval/build_cr_eval_sets.py trước.")

    summary = [run_file(f, args.base, token, args.role, args.delay) for f in files]

    print("\n--- tổng kết ---")
    total = sum(s["total"] for s in summary)
    filled = sum(s["filled"] for s in summary)
    failed = sum(s["failed"] for s in summary)
    for s in summary:
        print(f"{s['file']:26} {s['filled']:3}/{s['total']:3} điền được")
    print(f"{'TỔNG':26} {filled:3}/{total:3} điền được, {failed} lỗi")
    if failed:
        print("\nCòn dòng lỗi — đừng upload lên platform cho tới khi điền đủ, "
              "vì output rỗng sẽ bị chấm là trả lời sai chứ không phải là lỗi hạ tầng.")


if __name__ == "__main__":
    main()
