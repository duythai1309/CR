"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterTasks,
  sortTasks,
  type BoardTaskCard,
  type StageView,
  type TaskFilter,
  type TaskSort,
} from "@/components/project/rules";

interface FilterSortMember {
  userId: string;
  fullName: string;
}

/**
 * Lọc và sắp xếp card của bảng.
 *
 * `filterTasks`/`sortTasks` nhận và trả `TaskCard`, nên sau khi lọc phải tra ngược về
 * `BoardTaskCard` để giữ lại `columnId` — thứ mà bảng cần để biết card thuộc cột nào.
 */
export function useFilteredSortedTasks({
  tasks,
  stages,
  members,
  filter,
  sort,
  viewerId,
}: {
  tasks: BoardTaskCard[];
  stages: StageView[];
  members: FilterSortMember[];
  filter: TaskFilter;
  sort: TaskSort;
  viewerId: string | null;
}) {
  const memberName = useMemo(
    () => new Map(members.map((member) => [member.userId, member.fullName])),
    [members],
  );
  const nameOf = useCallback(
    (id: string | null) =>
      id === null ? "" : (memberName.get(id) ?? "Thành viên đã rời dự án"),
    [memberName],
  );

  const byId = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const asBoardCards = useCallback(
    (rows: Array<{ id: string }>) =>
      rows.map((row) => byId.get(row.id)).filter((task): task is BoardTaskCard => Boolean(task)),
    [byId],
  );

  const stageOf = useMemo(() => {
    const map = new Map<string, StageView>();
    for (const stage of stages) map.set(stage.id, stage);
    return map;
  }, [stages]);

  // Dùng một mốc thời gian cho cả lần render để các thẻ cạnh nhau không hiển thị mâu thuẫn.
  const [now, setNow] = useState<Date>(() => new Date(0));
  useEffect(() => setNow(new Date()), [tasks]);

  const visible = useMemo(
    () => asBoardCards(filterTasks(tasks, filter, { viewerId, now })),
    [asBoardCards, tasks, filter, viewerId, now],
  );
  const listRows = useMemo(
    () =>
      asBoardCards(
        sortTasks(visible, sort, {
          stageOrdinal: (stageId) => stageOf.get(stageId)?.ordinal ?? 99,
          memberName: (id) => nameOf(id) || "￿",
        }),
      ),
    [asBoardCards, visible, sort, stageOf, nameOf],
  );

  return {
    allTasks: tasks,
    hidden: tasks.length - visible.length,
    listRows,
    nameOf,
    now,
    stageOf,
    visible,
  };
}
