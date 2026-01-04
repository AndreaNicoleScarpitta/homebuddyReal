import { Calendar, AlertTriangle, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface TaskProps {
  task: {
    id: number;
    title: string;
    category: string;
    dueDate: string;
    priority: string;
    status: string;
    estimatedCost: string;
    difficulty: string;
  };
}

export function MaintenanceCard({ task }: TaskProps) {
  const isOverdue = task.status === "overdue";
  const isHighPriority = task.priority === "high";

  return (
    <Card className={`group overflow-hidden border-l-4 transition-all duration-300 hover:shadow-md ${
      isOverdue ? "border-l-destructive" : isHighPriority ? "border-l-orange-500" : "border-l-primary"
    }`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                {task.category}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">Overdue</Badge>
              )}
            </div>
            <h3 className="font-heading font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
              {task.title}
            </h3>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground group-hover:text-primary">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className={isOverdue ? "text-destructive font-medium" : ""}>
              Due: {new Date(task.dueDate).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{task.difficulty}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground">{task.estimatedCost}</span>
            <span className="text-xs">est. cost</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
