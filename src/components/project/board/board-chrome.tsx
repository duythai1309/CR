"use client";

import type { ReactNode } from "react";
import { Alert, Kbd } from "@/components/ui";
import type { BoardView } from "./toolbar";

/**
 * Phần khung quanh bảng: cảnh báo, khối thêm việc, dòng hướng dẫn cuối trang.
 *
 * Chúng là JSX thuần, không giữ trạng thái nào của riêng mình. Để trong `board.tsx` thì
 * chỗ lắp ráp bị chôn giữa hàng chục dòng đánh dấu và rất khó thấy bảng đang nối những gì.
 */

/** Cảnh báo trạng thái của bảng — chỉ xem, và bảng chưa có cột nào. */
export function BoardNotices({
  canWrite,
  columnCount,
}: {
  canWrite: boolean;
  columnCount: number;
}) {
  return (
    <>
      {!canWrite && (
        <Alert tone="warn" title="Chỉ xem">
          Dự án đã bị xoá nên không sửa được công việc. Lọc, sắp xếp và đổi chế độ xem vẫn
          dùng được.
        </Alert>
      )}

      {columnCount === 0 && (
        <Alert tone="warn" title="Bảng chưa có cột nào">
          Thêm cột đầu tiên để bắt đầu xếp việc. Nếu bảng vừa được nâng cấp mà vẫn trống,
          rất có thể migration 0021 chưa được áp lên cơ sở dữ liệu.
        </Alert>
      )}
    </>
  );
}

/** Khối "Thêm công việc" gập được — phím tắt `c` mở nó qua `newTaskRef`. */
export function NewTaskToggle({
  open,
  onToggle,
  panelRef,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-soil-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="font-semibold text-soil-900">Thêm công việc</span>
        <span className="flex items-center gap-2 text-xs text-soil-600">
          <Kbd>c</Kbd>
          <span aria-hidden>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div ref={panelRef} className="border-t border-soil-200 px-5 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Dòng hướng dẫn cuối bảng.
 *
 * Nói đủ CẢ HAI lối cho mỗi thao tác kéo — kéo được thì cũng bấm được — vì người không
 * dùng chuột phải biết lối kia tồn tại thì mới tìm tới nó.
 */
export function BoardHint({ onSwitchToList }: { onSwitchToList: (view: BoardView) => void }) {
  return (
    <p className="text-xs text-soil-600">
      Kéo card sang cột khác để chuyển cột, kéo lên xuống trong một cột để đổi thứ tự, và
      kéo tiêu đề cột để sắp xếp lại bảng. Không dùng chuột thì ô chọn <em>Cột</em> ngay
      trên card làm được cùng việc đó. Bấm vào tên việc để sửa nhanh tại chỗ. Cần đổi nhiều
      việc một lúc thì sang chế độ{" "}
      <button
        type="button"
        onClick={() => onSwitchToList("list")}
        className="font-medium text-leaf-800 hover:underline"
      >
        Danh sách
      </button>
      .
    </p>
  );
}
