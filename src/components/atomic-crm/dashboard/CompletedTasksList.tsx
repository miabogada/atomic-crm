import { CheckCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

import { CompletedTasksListContent } from "../tasks/CompletedTasksListContent";

export const CompletedTasksList = () => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="mr-3 flex">
          <CheckCheck className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground flex-1">
          Completed Tasks
        </h2>
      </div>
      <Card className="p-4 mb-2">
        <CompletedTasksListContent />
      </Card>
    </div>
  );
};
