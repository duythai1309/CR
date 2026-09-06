"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Empty, Kbd, ProgressBar, Toolbar } from "@/components/ui";
import { PROJECT_ROLE_LABEL } from "@/lib/labels";
import {
  EMPTY_PORTFOLIO_FILTER,
  PORTFOLIO_SORTS,
  PORTFOLIO_SORT_LABEL,
  filterProjects,
  projectAttention,
  sortProjects,
  type PortfolioFilter,
  type PortfolioRow,
  type PortfolioSort,
} from "./rules";

/**
 * Danh mục nhiều dự án.
 *
 * Người dùng của màn hình này giữ nhiều dự án chạy song song trong nhiều tháng, nên thứ
 * họ cần không phải một lưới thẻ đẹp mà là một bảng quét được: mỗi dòng nói ngay dự án
 * đang ở bước mấy, dùng Standard/Methodology nào, kỳ giám sát gần nhất tới đâu, và cái gì
 * đang chặn.
 *
 * Lọc và sắp xếp chạy ở client trên dữ liệu đã tải — `listPortfolio()` đã lấy đủ trong
 * sáu truy vấn, nên thêm một truy vấn cho mỗi lần gõ phím là lãng phí.
 */

const CONTROL =
  "rounded-lg border border-soil-200 bg-white px-2.5 py-1.5 text-sm text-soil-900 outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
}

export function ProjectPortfolio({
  rows,
  standards,
}: {
  rows: PortfolioRow[];
  /** Mã Standard có mặt trong danh mục, để ô lọc chỉ liệt kê thứ dùng được. */
  standards: string[];
}) {
  const [filter, setFilter] = useState<PortfolioFilter>(EMPTY_PORTFOLIO_FILTER);
  const [sort, setSort] = useState<PortfolioSort>("updated");
  const searchRef = useRef<HTMLInputElement>(null);

  // `/` nhảy vào ô tìm, `Esc` xoá bộ lọc — hai phím mà người quen Jira thử trước tiên.
  // Không cướp phím khi con trỏ đang ở trong một ô nhập nào đó.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && typing) {
        setFilter(EMPTY_PORTFOLIO_FILTER);
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(
    () => sortProjects(filterProjects(rows, filter), sort),
    [rows, filter, sort],
  );

  const hiddenCount = rows.length - visible.length;
  const set = <K extends keyof PortfolioFilter>(key: K, value: PortfolioFilter[K]) =>
    setFilter((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      <Toolbar
        note={
          <span>
            Gõ <Kbd>/</Kbd> để nhảy vào ô tìm, <Kbd>Esc</Kbd> để xoá bộ lọc.
            {hiddenCount > 0 && (
              <>
                {" "}
                <strong className="font-medium text-soil-800">
                  {hiddenCount} dự án đang bị bộ lọc ẩn đi.
                </strong>
              </>
            )}
          </span>
        }
      >
        <input
          ref={searchRef}
          type="search"
          value={filter.text}
          onChange={(e) => set("text", e.target.value)}
          placeholder="Tìm theo tên hoặc mô tả…"
          aria-label="Tìm dự án"
          className={`${CONTROL} min-w-[14rem] flex-1`}
        />

        <select
          value={filter.role}
          onChange={(e) => set("role", e.target.value)}
          aria-label="Lọc theo vai trò của tôi"
          className={CONTROL}
        >
          <option value="">Mọi vai trò</option>
          <option value="owner">{PROJECT_ROLE_LABEL.owner}</option>
          <option value="developer">{PROJECT_ROLE_LABEL.developer}</option>
          <option value="viewer">{PROJECT_ROLE_LABEL.viewer}</option>
        </select>

        <select
          value={filter.standard}
          onChange={(e) => set("standard", e.target.value)}
          aria-label="Lọc theo Standard"
          className={CONTROL}
        >
          <option value="">Mọi Standard</option>
          {standards.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        <select
          value={filter.progress}
          onChange={(e) => set("progress", e.target.value)}
          aria-label="Lọc theo tiến độ"
          className={CONTROL}
        >
          <option value="">Mọi tiến độ</option>
          <option value="planning">Còn bước chưa duyệt</option>
          <option value="designed">Đã duyệt đủ 7/7</option>
        </select>

        <label className="flex items-center gap-1.5 text-sm text-soil-700">
          <input
            type="checkbox"
            checked={filter.onlyAttention}
            onChange={(e) => set("onlyAttention", e.target.checked)}
            className="h-4 w-4 rounded border-soil-300"
          />
          Đang có việc chặn
        </label>

        <label className="flex items-center gap-1.5 text-sm text-soil-700">
          <input
            type="checkbox"
            checked={filter.includeDeleted}
            onChange={(e) => set("includeDeleted", e.target.checked)}
            className="h-4 w-4 rounded border-soil-300"
          />
          Gồm dự án đã xoá
        </label>

        <label className="ml-auto flex items-center gap-2 text-sm text-soil-600">
          Sắp xếp
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as PortfolioSort)}
            aria-label="Sắp xếp danh mục"
            className={CONTROL}
          >
            {PORTFOLIO_SORTS.map((key) => (
              <option key={key} value={key}>
                {PORTFOLIO_SORT_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
      </Toolbar>

      {visible.length === 0 ? (
        <Empty
          title="Không có dự án nào khớp bộ lọc"
          hint="Nới bộ lọc, hoặc bấm Esc để xoá hết điều kiện đang đặt."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-soil-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] gap-4 border-b border-soil-200 bg-soil-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-soil-600 lg:grid">
            <div>Dự án</div>
            <div>Bước hiện tại</div>
            <div>Standard · Methodology</div>
            <div>Kỳ giám sát gần nhất</div>
          </div>

          <ul className="divide-y divide-soil-100">
            {visible.map((row) => (
              <PortfolioRowItem key={row.id} row={row} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PortfolioRowItem({ row }: { row: PortfolioRow }) {
  const attention = projectAttention(row);

  return (
    <li>
      <Link
        href={`/du-an/${row.id}`}
        className={`grid gap-3 px-4 py-3.5 transition hover:bg-soil-50 focus:bg-soil-50 focus:outline-none lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] lg:gap-4 ${
          row.deletedAt ? "opacity-60" : ""
        }`}
      >
        {/* Dự án */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-soil-900">{row.name}</span>
            <Badge tone={row.role === "owner" ? "leaf" : "soil"}>
              {PROJECT_ROLE_LABEL[row.role]}
            </Badge>
            {row.methodologyIsSample && <Badge tone="carbon">Methodology MẪU</Badge>}
            {row.deletedAt && <Badge tone="red">Đã xoá</Badge>}
          </div>
          {row.description && (
            <p className="mt-1 line-clamp-1 text-sm text-soil-600">{row.description}</p>
          )}
          <p className="mt-1 text-xs text-soil-500">
            {row.openTasks} việc đang mở
            {row.myOpenTasks > 0 && <> · {row.myOpenTasks} giao cho tôi</>} · cập nhật{" "}
            {formatDate(row.updatedAt)}
          </p>
        </div>

        {/* Bước hiện tại */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tabular-nums text-soil-900">
              {row.approvedStages}/7
            </span>
            <span className="text-xs text-soil-500">bước đã duyệt</span>
          </div>
          <div className="mt-1.5">
            <ProgressBar
              value={row.approvedStages}
              max={7}
              label={`Đã duyệt ${row.approvedStages} trên 7 bước`}
              tone={row.approvedStages === 7 ? "leaf" : "carbon"}
            />
          </div>
          <p className="mt-1.5 truncate text-xs text-soil-600">
            {row.currentStage
              ? `Đang chờ: ${row.currentStage.ordinal}. ${row.currentStage.title}`
              : "Bảy bước thiết kế đã duyệt xong"}
          </p>
        </div>

        {/* Standard · Methodology */}
        <div className="min-w-0 text-xs">
          <p className="truncate text-soil-900">
            <span className="text-soil-500">Standard </span>
            {row.standardCode ?? "chưa chọn"}
            {row.standardCode && !row.standardLockedAt && (
              <span className="text-carbon-700"> · chưa khoá</span>
            )}
          </p>
          <p className="mt-1 truncate text-soil-900">
            <span className="text-soil-500">Methodology </span>
            {row.methodologyCode ? `${row.methodologyCode} · ${row.methodologyVersion}` : "chưa chọn"}
            {row.methodologyCode && !row.methodologyLockedAt && (
              <span className="text-carbon-700"> · chưa khoá</span>
            )}
          </p>
          {row.methodologySchemaHash && (
            <p className="mt-1 truncate font-mono text-[10px] text-soil-500">
              schema_hash {row.methodologySchemaHash.slice(0, 16)}…
            </p>
          )}
        </div>

        {/* Kỳ giám sát + việc đang chặn */}
        <div className="min-w-0 text-xs">
          {row.latestPeriod ? (
            <>
              <p className="truncate text-soil-900">{row.latestPeriod.name}</p>
              <p className="mt-1 text-soil-600">
                {formatDate(row.latestPeriod.startDate)} → {formatDate(row.latestPeriod.endDate)} ·
                bản {row.latestPeriod.version}
              </p>
              <p className="mt-1">
                <Badge tone={row.latestPeriod.status === "locked" ? "leaf" : "carbon"}>
                  {row.latestPeriod.status === "locked" ? "Đã khoá kỳ" : "Kỳ đang mở"}
                </Badge>
              </p>
            </>
          ) : (
            <p className="text-soil-600">
              Chưa có kỳ nào.
              {!row.methodologyLockedAt && " Khoá Methodology ở bước 4 trước đã."}
            </p>
          )}

          {attention.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {attention.map((reason) => (
                <li
                  key={reason}
                  className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
                >
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </li>
  );
}
