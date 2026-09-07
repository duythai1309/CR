"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterTasks,
  sortTasks,
  type StageView,
  type TaskCard,
  type TaskFilter,
  type TaskSort,
} from "@/components/project/rules";

interface FilterSortMember {
  userId: string;
  fullName: string;
}

export function useFilteredSortedTasks({
  columns,
  members,
  filter,
  sort,
  viewerId,
}: {
  columns: Array<{ stage: StageView; tasks: TaskCard[] }>;
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

  const allTasks = useMemo(() => columns.flatMap((column) => column.tasks), [columns]);
  const stageOf = useMemo(() => {
    const map = new Map<string, StageView>();
    for (const column of columns) map.set(column.stage.id, column.stage);
    return map;
  }, [columns]);

  // Dùng một mốc thời gian cho cả lần render để các thẻ cạnh nhau không hiển thị mâu thuẫn.
  const [now, setNow] = useState<Date>(() => new Date(0));
  useEffect(() => setNow(new Date()), [columns]);

  const visible = useMemo(
    () => filterTasks(allTasks, filter, { viewerId, now }),
    [allTasks, filter, viewerId, now],
  );
  const listRows = useMemo(
    () =>
      sortTasks(visible, sort, {
        stageOrdinal: (stageId) => stageOf.get(stageId)?.ordinal ?? 99,
        memberName: (id) => nameOf(id) || "￿",
      }),
    [visible, sort, stageOf, nameOf],
  );

  return {
    allTasks,
    hidden: allTasks.length - visible.length,
    listRows,
    nameOf,
    now,
    stageOf,
    visible,
  };
}
