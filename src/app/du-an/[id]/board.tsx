"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Alert, Badge, Kbd, Toolbar } from "@/components/ui";
import {
  EMPTY_TASK_FILTER,
  TASK_SORTS,
  TASK_SORT_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  filterTasks,
  isFilterActive,
  nextPosition,
  sortTasks,
  taskFlags,
  type StageView,
  type TaskCard,
  type TaskFilter,
  type TaskSort,
} from "@/components/project/rules";
import { bulkUpdateTasks, moveTask, setTaskStatus } from "./actions";

export interface BoardMember {
  userId: string;
  fullName: string;
}

/**
 * Bảng công việc của một dự án.
 *
 * Mô hình giữ nguyên từ Module A: **cột là bước**, `status` là trục riêng của card. Thứ
 * được làm lại là cách dùng — người quen Jira cần lọc, sắp xếp, chọn nhiều, thao tác hàng
 * loạt và phím tắt, chứ không chỉ một bảng kéo-thả.
 *
 * **Kéo-thả vẫn không bao giờ là đường duy nhất.** Hai ô chọn trên mỗi card vẫn còn, và
 * chế độ danh sách cộng thao tác hàng loạt là một đường thứ ba hoàn toàn bằng bàn phím.
 * Phím tắt tự nhường khi con trỏ đang ở trong một ô nhập.
 */

const CONTROL =
  "rounded-lg border border-soil-200 bg-white px-2.5 py-1.5 text-sm text-soil-900 outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100";
const MICRO =
  "w-full rounded border border-soil-200 bg-white px-1.5 py-1 text-xs text-soil-900 outline-none focus:border-leaf-500";
const VIEW_KEY = "acp.board.view";

type View = "board" | "list";

const SHORTCUTS: Array<[string, string]> = [
  ["/", "Nhảy vào ô tìm"],
  ["b", "Chế độ bảng"],
  ["l", "Chế độ danh sách"],
  ["m", "Chỉ việc giao cho tôi"],
  ["x", "Chỉ việc đang chặn"],
  ["c", "Mở form thêm công việc"],
  ["Esc", "Xoá bộ lọc, đóng bảng phím tắt"],
  ["?", "Bật/tắt bảng phím tắt"],
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[parts.length - 2][0] + parts[parts.length - 1][0])
    .toLocaleUpperCase("vi");
}

export function ProjectBoard({
  projectId,
  columns,
  members,
  canWrite,
  viewerId,
  initialFilter,
  newTaskForm,
}: {
  projectId: string;
  columns: Array<{ stage: StageView; tasks: TaskCard[] }>;
  members: BoardMember[];
  canWrite: boolean;
  /** Để lọc "việc của tôi" — `assignee_id` được so với chính người đang xem. */
  viewerId: string | null;
  /** Bộ lọc mở sẵn từ query string, để trang Thành viên trỏ thẳng vào đúng người. */
  initialFilter?: Partial<TaskFilter>;
  /** Form thêm việc, do trang truyền vào để phím `c` mở được nó. */
  newTaskForm?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const [view, setView] = useState<View>("board");
  const [filter, setFilter] = useState<TaskFilter>({ ...EMPTY_TASK_FILTER, ...initialFilter });
  const [sort, setSort] = useState<TaskSort>("stage");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showHelp, setShowHelp] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const newTaskRef = useRef<HTMLDivElement>(null);

  // Chế độ xem là sở thích cá nhân của người dùng trên máy này, nên nó thuộc về trình
  // duyệt chứ không thuộc về dữ liệu dự án. Bọc try/catch vì cửa sổ ẩn danh và các trình
  // duyệt chặn site data đều ném ngay ở lúc đọc.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === "board" || saved === "list") setView(saved);
    } catch {
      /* không có localStorage thì giữ mặc định */
    }
  }, []);

  const changeView = useCallback((next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* bỏ qua: chế độ xem không đáng để làm hỏng màn hình */
    }
  }, []);

  const memberName = useMemo(
    () => new Map(members.map((m) => [m.userId, m.fullName])),
    [members],
  );
  const nameOf = useCallback(
    (id: string | null) =>
      id === null ? "" : (memberName.get(id) ?? "Thành viên đã rời dự án"),
    [memberName],
  );

  const allTasks = useMemo(() => columns.flatMap((c) => c.tasks), [columns]);
  const stageOf = useMemo(() => {
    const map = new Map<string, StageView>();
    for (const c of columns) map.set(c.stage.id, c.stage);
    return map;
  }, [columns]);

  // Một mốc thời gian duy nhất cho cả lần render: nếu mỗi card tự gọi `new Date()` thì
  // hai card cạnh nhau có thể rơi hai bên nửa đêm và hiện mâu thuẫn nhau.
  const [now, setNow] = useState<Date>(() => new Date(0));
  useEffect(() => setNow(new Date()), [columns]);

  const visible = useMemo(
    () => filterTasks(allTasks, filter, { viewerId, now }),
    [allTasks, filter, viewerId, now],
  );
  const visibleIds = useMemo(() => new Set(visible.map((t) => t.id)), [visible]);
  const hidden = allTasks.length - visible.length;

  const listRows = useMemo(
    () =>
      sortTasks(visible, sort, {
        stageOrdinal: (stageId) => stageOf.get(stageId)?.ordinal ?? 99,
        memberName: (id) => nameOf(id) || "￿",
      }),
    [visible, sort, stageOf, nameOf],
  );

  // `startTransition` bọc cả lượt ghi lẫn `router.refresh()`, nên `pending` còn bật cho
  // tới khi dữ liệu mới về — không phải chỉ tới khi server action trả lời.
  const run = useCallback(
    (action: () => Promise<string | null>, success?: string) => {
      setError(null);
      setNotice(null);
      startTransition(async () => {
        const message = await action();
        if (message) setError(message);
        else {
          if (success) setNotice(success);
          router.refresh();
        }
      });
    },
    [router],
  );

  function moveTo(taskId: string, stageId: string, currentStageId: string) {
    if (!canWrite || stageId === currentStageId) return;
    const target = columns.find((c) => c.stage.id === stageId);
    run(() => moveTask(projectId, taskId, stageId, nextPosition(target?.tasks ?? [])));
  }

  const set = <K extends keyof TaskFilter>(key: K, value: TaskFilter[K]) =>
    setFilter((f) => ({ ...f, [key]: value }));

  // ------------------------------------------------------------------ phím tắt
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;

      if (event.key === "Escape") {
        if (typing) (target as HTMLElement).blur();
        setShowHelp(false);
        setFilter(EMPTY_TASK_FILTER);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case "/":
          event.preventDefault();
          searchRef.current?.focus();
          break;
        case "b":
          changeView("board");
          break;
        case "l":
          changeView("list");
          break;
        case "m":
          setFilter((f) => ({ ...f, onlyMine: !f.onlyMine }));
          break;
        case "x":
          setFilter((f) => ({ ...f, onlyBlocking: !f.onlyBlocking }));
          break;
        case "c":
          if (newTaskForm) {
            event.preventDefault();
            setShowNewTask(true);
            requestAnimationFrame(() => {
              const first = newTaskRef.current?.querySelector<HTMLElement>("input, textarea, select");
              first?.focus();
            });
          }
          break;
        case "?":
          setShowHelp((v) => !v);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changeView, newTaskForm]);

  // Bỏ chọn những việc vừa bị bộ lọc ẩn đi: thao tác hàng loạt không được chạm vào thứ
  // người dùng không còn nhìn thấy.
  useEffect(() => {
    setSelected((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleIds]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulk(patch: { status?: string; stageId?: string }, label: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    run(() => bulkUpdateTasks(projectId, ids, patch), `Đã ${label} cho ${ids.length} công việc.`);
    setSelected(new Set());
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="ok">{notice}</Alert>}

      {!canWrite && (
        <Alert tone="warn" title="Chỉ xem">
          Vai trò của bạn trong dự án này không cho phép sửa công việc. Lọc, sắp xếp và đổi
          chế độ xem vẫn dùng được.
        </Alert>
      )}

      {newTaskForm && (
        <div className="rounded-xl border border-soil-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setShowNewTask((v) => !v)}
            aria-expanded={showNewTask}
            className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
          >
            <span className="font-semibold text-soil-900">Thêm công việc</span>
            <span className="flex items-center gap-2 text-xs text-soil-600">
              <Kbd>c</Kbd>
              <span aria-hidden>{showNewTask ? "▲" : "▼"}</span>
            </span>
          </button>
          {showNewTask && (
            <div ref={newTaskRef} className="border-t border-soil-200 px-5 py-4">
              {newTaskForm}
            </div>
          )}
        </div>
      )}

      <Toolbar
        note={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Hiện <strong className="font-medium text-soil-800">{visible.length}</strong>/
              {allTasks.length} công việc
              {hidden > 0 && <> · {hidden} bị bộ lọc ẩn</>}
            </span>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="font-medium text-leaf-800 hover:underline"
            >
              Phím tắt <Kbd>?</Kbd>
            </button>
            {isFilterActive(filter) && (
              <button
                type="button"
                onClick={() => setFilter(EMPTY_TASK_FILTER)}
                className="font-medium text-leaf-800 hover:underline"
              >
                Xoá bộ lọc
              </button>
            )}
          </div>
        }
      >
        <div className="flex rounded-lg border border-soil-200 p-0.5" role="group" aria-label="Chế độ xem">
          {(["board", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => changeView(mode)}
              aria-pressed={view === mode}
              className={`rounded px-2.5 py-1 text-sm font-medium transition ${
                view === mode ? "bg-leaf-700 text-white" : "text-soil-600 hover:bg-soil-100"
              }`}
            >
              {mode === "board" ? "Bảng" : "Danh sách"}
            </button>
          ))}
        </div>

        <input
          ref={searchRef}
          type="search"
          value={filter.text}
          onChange={(e) => set("text", e.target.value)}
          placeholder="Tìm công việc…"
          aria-label="Tìm công việc"
          className={`${CONTROL} min-w-[12rem] flex-1`}
        />

        <select
          value={filter.stageId}
          onChange={(e) => set("stageId", e.target.value)}
          aria-label="Lọc theo bước"
          className={CONTROL}
        >
          <option value="">Mọi bước</option>
          {columns.map((c) => (
            <option key={c.stage.id} value={c.stage.id}>
              {c.stage.ordinal}. {c.stage.title}
            </option>
          ))}
        </select>

        <select
          value={filter.assigneeId}
          onChange={(e) => set("assigneeId", e.target.value)}
          aria-label="Lọc theo người nhận"
          className={CONTROL}
        >
          <option value="">Mọi người nhận</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName}
            </option>
          ))}
        </select>

        <select
          value={filter.status}
          onChange={(e) => set("status", e.target.value)}
          aria-label="Lọc theo trạng thái"
          className={CONTROL}
        >
          <option value="">Mọi trạng thái</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        {viewerId && (
          <label className="flex items-center gap-1.5 text-sm text-soil-700">
            <input
              type="checkbox"
              checked={filter.onlyMine}
              onChange={(e) => set("onlyMine", e.target.checked)}
              className="h-4 w-4 rounded border-soil-300"
            />
            Việc của tôi
          </label>
        )}

        <label className="flex items-center gap-1.5 text-sm text-soil-700">
          <input
            type="checkbox"
            checked={filter.onlyBlocking}
            onChange={(e) => set("onlyBlocking", e.target.checked)}
            className="h-4 w-4 rounded border-soil-300"
          />
          Đang chặn
        </label>

        {view === "list" && (
          <label className="ml-auto flex items-center gap-2 text-sm text-soil-600">
            Sắp xếp
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as TaskSort)}
              aria-label="Sắp xếp danh sách"
              className={CONTROL}
            >
              {TASK_SORTS.map((key) => (
                <option key={key} value={key}>
                  {TASK_SORT_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
        )}
      </Toolbar>

      {showHelp && (
        <div className="rounded-xl border border-soil-200 bg-white px-5 py-4 shadow-sm">
          <h3 className="text-sm font-semibold text-soil-900">Phím tắt</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {SHORTCUTS.map(([key, meaning]) => (
              <div key={key} className="flex items-center gap-3">
                <dt className="w-12 shrink-0">
                  <Kbd>{key}</Kbd>
                </dt>
                <dd className="text-soil-700">{meaning}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-soil-600">
            Phím tắt tự nhường khi con trỏ đang ở trong một ô nhập. Mọi việc mà kéo-thả làm
            được đều làm được bằng bàn phím: ô chọn <em>Bước</em> và <em>Trạng thái</em> trên
            từng card, hoặc chọn nhiều rồi đổi hàng loạt ở chế độ danh sách.
          </p>
        </div>
      )}

      {view === "board" ? (
        <div
          className={`grid gap-4 overflow-x-auto pb-2 lg:grid-flow-col lg:auto-cols-[minmax(17.5rem,1fr)] ${
            pending ? "opacity-70" : ""
          }`}
        >
          {columns.map(({ stage }) => {
            const tasks = visible.filter((t) => t.stageId === stage.id);
            return (
              <section
                key={stage.id}
                aria-label={`Bước ${stage.ordinal}: ${stage.title}`}
                onDragOver={(e) => {
                  if (!canWrite || !dragging) return;
                  e.preventDefault();
                  setDragOver(stage.id);
                }}
                onDragLeave={() => setDragOver((v) => (v === stage.id ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const taskId = e.dataTransfer.getData("text/plain") || dragging;
                  const from = columns.find((c) => c.tasks.some((t) => t.id === taskId));
                  if (taskId && from) moveTo(taskId, stage.id, from.stage.id);
                  setDragging(null);
                }}
                className={`flex min-w-[17.5rem] flex-col rounded-xl border bg-soil-100/60 p-3 transition ${
                  dragOver === stage.id ? "border-leaf-500 bg-leaf-50" : "border-soil-200"
                }`}
              >
                <header className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-soil-900">
                    <span className="mr-1.5 text-leaf-700">{stage.ordinal}</span>
                    {stage.title}
                  </h3>
                  <span className="flex items-center gap-1.5">
                    {stage.approvedAt && <Badge tone="leaf">Đã duyệt</Badge>}
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-soil-600">
                      {tasks.length}
                    </span>
                  </span>
                </header>

                <ul className="flex flex-1 flex-col gap-2">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <TaskCardView
                        task={task}
                        stage={stage}
                        columns={columns}
                        now={now}
                        canWrite={canWrite}
                        pending={pending}
                        projectId={projectId}
                        assigneeName={nameOf(task.assigneeId)}
                        dragging={dragging === task.id}
                        onDragStart={() => setDragging(task.id)}
                        onDragEnd={() => {
                          setDragging(null);
                          setDragOver(null);
                        }}
                        onMove={(stageId) => moveTo(task.id, stageId, stage.id)}
                        onStatus={(status) => run(() => setTaskStatus(projectId, task.id, status))}
                      />
                    </li>
                  ))}

                  {tasks.length === 0 && (
                    <li className="rounded-lg border border-dashed border-soil-300 px-3 py-6 text-center text-xs text-soil-500">
                      {isFilterActive(filter) ? "Không có việc khớp bộ lọc" : "Chưa có công việc"}
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <TaskList
          projectId={projectId}
          rows={listRows}
          columns={columns}
          stageOf={stageOf}
          nameOf={nameOf}
          now={now}
          canWrite={canWrite}
          pending={pending}
          selected={selected}
          onToggle={toggle}
          onToggleAll={(checked) => setSelected(checked ? new Set(listRows.map((t) => t.id)) : new Set())}
          onStatus={(taskId, status) => run(() => setTaskStatus(projectId, taskId, status))}
          onMove={(taskId, stageId, from) => moveTo(taskId, stageId, from)}
          onBulk={bulk}
        />
      )}

      {canWrite && view === "board" && (
        <p className="text-xs text-soil-600">
          Kéo card sang cột khác để đổi bước, hoặc dùng ô chọn <em>Bước</em> ngay trên card —
          hai cách cho cùng một kết quả. Cần đổi nhiều việc một lúc thì sang chế độ{" "}
          <button
            type="button"
            onClick={() => changeView("list")}
            className="font-medium text-leaf-800 hover:underline"
          >
            Danh sách
          </button>
          .
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ card trên bảng */

function DueLabel({ task, now }: { task: TaskCard; now: Date }) {
  if (!task.dueAt) return null;
  const flags = taskFlags(task, now);
  const text = new Date(task.dueAt).toLocaleDateString("vi-VN");
  if (flags.overdue)
    return (
      <span className="text-xs font-medium text-red-700">
        Quá hạn {flags.overdueDays} ngày · {text}
      </span>
    );
  return (
    <span className={`text-xs ${flags.dueSoon ? "font-medium text-carbon-700" : "text-soil-600"}`}>
      Hạn {text}
    </span>
  );
}

function TaskCardView({
  task,
  stage,
  columns,
  now,
  canWrite,
  pending,
  projectId,
  assigneeName,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onStatus,
}: {
  task: TaskCard;
  stage: StageView;
  columns: Array<{ stage: StageView; tasks: TaskCard[] }>;
  now: Date;
  canWrite: boolean;
  pending: boolean;
  projectId: string;
  assigneeName: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (stageId: string) => void;
  onStatus: (status: string) => void;
}) {
  const flags = taskFlags(task, now);
  const edge = flags.blocked
    ? "border-l-red-400"
    : flags.overdue
      ? "border-l-carbon-500"
      : task.status === "done"
        ? "border-l-leaf-400"
        : "border-l-soil-200";

  return (
    <article
      draggable={canWrite}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`rounded-lg border border-l-4 border-soil-200 bg-white p-3 shadow-sm ${edge} ${
        canWrite ? "cursor-grab active:cursor-grabbing" : ""
      } ${dragging ? "opacity-50" : ""}`}
    >
      <Link
        href={`/du-an/${projectId}/cong-viec/${task.id}`}
        className="block text-sm font-medium text-soil-900 hover:text-leaf-800"
      >
        {task.title}
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
        <DueLabel task={task} now={now} />
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-soil-600">
        {task.assigneeId ? (
          <>
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-soil-200 text-[10px] font-semibold text-soil-700"
              aria-hidden
            >
              {initials(assigneeName)}
            </span>
            {assigneeName}
          </>
        ) : (
          <span className="italic">Chưa giao cho ai</span>
        )}
      </p>

      {canWrite && (
        <div className="mt-3 grid gap-1.5 border-t border-soil-100 pt-2.5">
          <label className="flex items-center gap-2 text-xs text-soil-600">
            <span className="w-16 shrink-0">Bước</span>
            <select
              value={stage.id}
              disabled={pending}
              onChange={(e) => onMove(e.target.value)}
              className={MICRO}
            >
              {columns.map((c) => (
                <option key={c.stage.id} value={c.stage.id}>
                  {c.stage.ordinal}. {c.stage.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-soil-600">
            <span className="w-16 shrink-0">Trạng thái</span>
            <select
              value={task.status}
              disabled={pending}
              onChange={(e) => onStatus(e.target.value)}
              className={MICRO}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ chế độ danh sách */

function TaskList({
  projectId,
  rows,
  columns,
  stageOf,
  nameOf,
  now,
  canWrite,
  pending,
  selected,
  onToggle,
  onToggleAll,
  onStatus,
  onMove,
  onBulk,
}: {
  projectId: string;
  rows: TaskCard[];
  columns: Array<{ stage: StageView; tasks: TaskCard[] }>;
  stageOf: Map<string, StageView>;
  nameOf: (id: string | null) => string;
  now: Date;
  canWrite: boolean;
  pending: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onStatus: (taskId: string, status: string) => void;
  onMove: (taskId: string, stageId: string, from: string) => void;
  onBulk: (patch: { status?: string; stageId?: string }, label: string) => void;
}) {
  const allChecked = rows.length > 0 && rows.every((t) => selected.has(t.id));

  return (
    <div className="space-y-3">
      {canWrite && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-2.5">
          <span className="text-sm font-medium text-leaf-900">
            Đã chọn {selected.size} công việc
          </span>

          <label className="flex items-center gap-2 text-sm text-leaf-900">
            Đổi trạng thái
            <select
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                if (e.target.value) onBulk({ status: e.target.value }, "đổi trạng thái");
                e.target.value = "";
              }}
              className={CONTROL}
            >
              <option value="">— chọn —</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-leaf-900">
            Chuyển bước
            <select
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                if (e.target.value) onBulk({ stageId: e.target.value }, "chuyển bước");
                e.target.value = "";
              }}
              className={CONTROL}
            >
              <option value="">— chọn —</option>
              {columns.map((c) => (
                <option key={c.stage.id} value={c.stage.id}>
                  {c.stage.ordinal}. {c.stage.title}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => onToggleAll(false)}
            className="ml-auto text-sm font-medium text-leaf-800 hover:underline"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      <div className={`overflow-x-auto rounded-xl border border-soil-200 bg-white shadow-sm ${pending ? "opacity-70" : ""}`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-soil-200 bg-soil-50 text-[11px] uppercase tracking-wide text-soil-600">
              {canWrite && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => onToggleAll(e.target.checked)}
                    aria-label="Chọn tất cả công việc đang hiện"
                    className="h-4 w-4 rounded border-soil-300"
                  />
                </th>
              )}
              <th className="px-3 py-2 font-medium">Công việc</th>
              <th className="px-3 py-2 font-medium">Bước</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Người nhận</th>
              <th className="px-3 py-2 font-medium">Hạn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-soil-100">
            {rows.map((task) => {
              const stage = stageOf.get(task.stageId);
              const flags = taskFlags(task, now);
              return (
                <tr key={task.id} className={selected.has(task.id) ? "bg-leaf-50/60" : undefined}>
                  {canWrite && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(task.id)}
                        onChange={() => onToggle(task.id)}
                        aria-label={`Chọn ${task.title}`}
                        className="h-4 w-4 rounded border-soil-300"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <Link
                      href={`/du-an/${projectId}/cong-viec/${task.id}`}
                      className="font-medium text-soil-900 hover:text-leaf-800"
                    >
                      {task.title}
                    </Link>
                    {flags.blocking && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        đang chặn
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <select
                        value={task.stageId}
                        disabled={pending}
                        onChange={(e) => onMove(task.id, e.target.value, task.stageId)}
                        aria-label={`Bước của ${task.title}`}
                        className={MICRO}
                      >
                        {columns.map((c) => (
                          <option key={c.stage.id} value={c.stage.id}>
                            {c.stage.ordinal}. {c.stage.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-soil-700">
                        {stage ? `${stage.ordinal}. ${stage.title}` : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <select
                        value={task.status}
                        disabled={pending}
                        onChange={(e) => onStatus(task.id, e.target.value)}
                        aria-label={`Trạng thái của ${task.title}`}
                        className={MICRO}
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {TASK_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone={TASK_STATUS_TONE[task.status]}>
                        {TASK_STATUS_LABEL[task.status]}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-soil-700">
                    {task.assigneeId ? nameOf(task.assigneeId) : <span className="italic text-soil-500">Chưa giao</span>}
                  </td>
                  <td className="px-3 py-2">
                    <DueLabel task={task} now={now} /> {!task.dueAt && <span className="text-soil-500">—</span>}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-3 py-10 text-center text-sm text-soil-600">
                  Không có công việc nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
