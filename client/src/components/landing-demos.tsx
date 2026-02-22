import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { CheckCircle2, Clock, AlertTriangle, MessageSquare, Bot, Wrench, DollarSign, TrendingUp, PiggyBank } from "lucide-react";

function DashboardDemo() {
  const [activeTask, setActiveTask] = useState(0);
  const tasks = [
    { label: "Replace HVAC filter", urgency: "Now", urgencyColor: "bg-red-500", icon: AlertTriangle, status: "overdue" },
    { label: "Clean gutters", urgency: "Soon", urgencyColor: "bg-amber-500", icon: Clock, status: "upcoming" },
    { label: "Test smoke detectors", urgency: "Soon", urgencyColor: "bg-amber-500", icon: Clock, status: "upcoming" },
    { label: "Seal driveway cracks", urgency: "Later", urgencyColor: "bg-blue-500", icon: Clock, status: "planned" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTask((prev) => {
        if (prev < tasks.length - 1) return prev + 1;
        setTimeout(() => setActiveTask(0), 2000);
        return prev;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm" data-testid="demo-dashboard">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <span className="text-sm font-heading font-bold text-foreground">Next Up</span>
        <span className="text-xs text-muted-foreground">{tasks.length} tasks</span>
      </div>
      <div className="p-3 space-y-2">
        {tasks.map((task, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: i <= activeTask ? 1 : 0.3, x: 0 }}
            transition={{ delay: i * 0.2, duration: 0.4 }}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50 border border-border/30"
          >
            <AnimatePresence mode="wait">
              {i < activeTask ? (
                <motion.div
                  key="done"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="h-7 w-7 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center shrink-0"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="pending"
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                    i === activeTask ? "bg-primary/15" : "bg-muted"
                  }`}
                >
                  <task.icon className={`h-3.5 w-3.5 ${i === activeTask ? "text-primary" : "text-muted-foreground"}`} />
                </motion.div>
              )}
            </AnimatePresence>
            <span className={`text-xs font-medium flex-1 ${i < activeTask ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {task.label}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full text-white font-medium ${task.urgencyColor}`}>
              {task.urgency}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ChatDemo() {
  const [visibleMessages, setVisibleMessages] = useState(0);
  const messages = [
    { role: "user", text: "My faucet is dripping, what should I do?" },
    { role: "assistant", text: "A dripping faucet is usually caused by a worn washer or O-ring. Here's what I'd suggest:" },
    { role: "assistant", text: "1. Turn off the water supply\n2. Remove the handle and replace the washer (~$5)\n3. This is a great DIY project!" },
    { role: "assistant", text: "Estimated cost: $5-15 DIY, $150-300 for a plumber. You've got this!" },
  ];

  useEffect(() => {
    if (visibleMessages < messages.length) {
      const timeout = setTimeout(() => {
        setVisibleMessages((prev) => prev + 1);
      }, visibleMessages === 0 ? 800 : 1500);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => setVisibleMessages(0), 3000);
      return () => clearTimeout(timeout);
    }
  }, [visibleMessages]);

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm h-full flex flex-col" data-testid="demo-chat">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-heading font-bold text-foreground">AI Assistant</span>
        <span className="h-2 w-2 rounded-full bg-green-500 ml-auto" />
      </div>
      <div className="p-3 space-y-2 flex-1 overflow-hidden">
        {messages.slice(0, visibleMessages).map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[11px] leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm"
            }`}>
              {msg.text.split('\n').map((line, j) => (
                <span key={j}>{line}{j < msg.text.split('\n').length - 1 && <br />}</span>
              ))}
            </div>
          </motion.div>
        ))}
        {visibleMessages > 0 && visibleMessages < messages.length && messages[visibleMessages].role === "assistant" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-muted px-3 py-2 rounded-xl rounded-bl-sm">
              <div className="flex gap-1">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function BudgetDemo() {
  const [progress, setProgress] = useState(0);
  const funds = [
    { label: "Emergency Fund", current: 2400, target: 5000, color: "bg-red-500" },
    { label: "HVAC Replacement", current: 3200, target: 8000, color: "bg-primary" },
    { label: "Roof Repair", current: 1800, target: 4000, color: "bg-amber-500" },
  ];

  useEffect(() => {
    const timeout = setTimeout(() => {
      setProgress((prev) => (prev < 100 ? prev + 2 : 0));
    }, 50);
    return () => clearTimeout(timeout);
  }, [progress]);

  const animFactor = Math.min(progress / 100, 1);

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm" data-testid="demo-budget">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <span className="text-sm font-heading font-bold text-foreground">Budget Overview</span>
        <PiggyBank className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <motion.p
              className="text-2xl font-heading font-bold text-foreground"
              animate={{ opacity: [0.7, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              ${Math.round(7400 * animFactor).toLocaleString()}
            </motion.p>
            <p className="text-xs text-muted-foreground">Total saved</p>
          </div>
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">+12%</span>
          </div>
        </div>
        <div className="space-y-3">
          {funds.map((fund, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-foreground font-medium">{fund.label}</span>
                <span className="text-muted-foreground">
                  ${Math.round(fund.current * animFactor).toLocaleString()} / ${fund.target.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${fund.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(fund.current / fund.target) * 100 * animFactor}%` }}
                  transition={{ duration: 0.5, delay: i * 0.2 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { DashboardDemo, ChatDemo, BudgetDemo };
