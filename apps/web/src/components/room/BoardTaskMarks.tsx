import type { RoomBoardAssignee, RoomTaskPriority } from "@t3tools/contracts";
import {
  CalendarIcon,
  FlameIcon,
  type LucideIcon,
  SignalHighIcon,
  SignalLowIcon,
  SignalMediumIcon,
} from "lucide-react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { BoardChip, type BoardChipTone, PersonDot } from "./BoardChrome";
import { BOARD_PLAN_PRIORITIES, boardPlanDue } from "./boardPlan.logic";

const PRIORITY_LOOK: Readonly<
  Record<RoomTaskPriority, { readonly icon: LucideIcon; readonly tone: BoardChipTone }>
> = {
  urgent: { icon: FlameIcon, tone: "error" },
  high: { icon: SignalHighIcon, tone: "warning" },
  medium: { icon: SignalMediumIcon, tone: "info" },
  low: { icon: SignalLowIcon, tone: "neutral" },
};

const priorityTitle = (priority: RoomTaskPriority) =>
  BOARD_PLAN_PRIORITIES.find((one) => one.priority === priority)?.title ?? priority;

/** A task's priority as a small marker: its icon, with its name unless `iconOnly`. */
export function TaskPriorityMark({
  priority,
  iconOnly = false,
  paper = false,
}: {
  readonly priority: RoomTaskPriority;
  readonly iconOnly?: boolean;
  readonly paper?: boolean;
}) {
  const { icon: Icon, tone } = PRIORITY_LOOK[priority];
  const title = priorityTitle(priority);
  return (
    <BoardChip
      tone={tone}
      aria-label={`Priority: ${title}`}
      title={`Priority: ${title}`}
      className={paper && tone === "neutral" ? "text-paint-ink-muted" : undefined}
    >
      <Icon aria-hidden className="size-3" />
      {iconOnly ? null : title}
    </BoardChip>
  );
}

/** The icon a priority shows with, for menus and pickers. */
export function TaskPriorityIcon({ priority }: { readonly priority: RoomTaskPriority }) {
  const { icon: Icon } = PRIORITY_LOOK[priority];
  return <Icon aria-hidden />;
}

/** A task's due day: when it is due, in the error tone once it passed and the task is not done. */
export function TaskDueChip({
  due,
  today,
  done,
  paper = false,
}: {
  readonly due: string;
  readonly today: string;
  readonly done: boolean;
  readonly paper?: boolean;
}) {
  const { label, overdue } = boardPlanDue(due, today);
  const bareDay = !label.startsWith("Due") && !label.startsWith("Overdue");
  const tone = overdue && !done ? "error" : "neutral";
  return (
    <BoardChip
      tone={tone}
      className={paper && tone === "neutral" ? "text-paint-ink-muted" : undefined}
    >
      <CalendarIcon aria-hidden className="size-3" />
      {bareDay ? <span className="sr-only">{"Due "}</span> : null}
      {label}
    </BoardChip>
  );
}

/** Who a task is for: their initial in their colour, named on hover. */
export function TaskAssigneeDot({
  assignee,
  name,
  color,
}: {
  readonly assignee: RoomBoardAssignee;
  readonly name: string;
  readonly color: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={`For ${name}`}
            data-assignee={assignee.guestId ?? "owner"}
            className="flex shrink-0"
          />
        }
      >
        <PersonDot color={color} className="size-5 text-3xs leading-none font-semibold">
          {name.trim().charAt(0).toUpperCase()}
        </PersonDot>
      </TooltipTrigger>
      <TooltipPopup side="top">For {name}</TooltipPopup>
    </Tooltip>
  );
}
