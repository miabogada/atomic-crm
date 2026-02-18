import type { Task } from "../types";
import { TaskList } from "./TaskList";

export default {
  list: TaskList,
  recordRepresentation: (record: Task) =>
    record?.text || `Task #${record?.id}`,
};
