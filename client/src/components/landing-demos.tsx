import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Clock, AlertTriangle, Bot, TrendingUp, PiggyBank, Plus } from "lucide-react";

function DashboardDemo() {
  const tasks = [
    { label: "Replace HVAC filter", urgency: "Now", urgencyColor: "bg-red-500", icon: AlertTriangle },
    { label: "Clean gutters", urgency: "Soon", urgencyColor: "bg-amber-500", icon: Clock },
    { label: "Test smoke detectors", urgency: "Soon", urgencyColor: "bg-amber-500", icon: Clock },
    { label: "Seal driveway cracks", urgency: "Later", urgencyColor: "bg-blue-500", icon: Clock },
  ];

  const [checkedItems, setCheckedItems] = useState<number[]>([]);
  const [currentlyChecking, setCurrentlyChecking] = useState<number | null>(null);

  const runCycle = useCallback(() => {
    setCheckedItems([]);
    setCurrentlyChecking(null);

    const timers: ReturnType<typeof setTimeout>[] = [];
    tasks.forEach((_, i) => {
      timers.push(setTimeout(() => setCurrentlyChecking(i), 1200 + i * 1600));
      timers.push(setTimeout(() => {
        setCheckedItems(prev => [...prev, i]);
        setCurrentlyChecking(null);
      }, 1200 + i * 1600 + 800));
    });

    timers.push(setTimeout(() => {
      setCheckedItems([]);
      setCurrentlyChecking(null);
      runCycle();
    }, 1200 + tasks.length * 1600 + 1500));

    return timers;
  }, []);

  useEffect(() => {
    const timers = runCycle();
    return () => timers.forEach(clearTimeout);
  }, [runCycle]);

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm" data-testid="demo-dashboard">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <span className="text-sm font-heading font-bold text-foreground">Next Up</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          {tasks.length - checkedItems.length} remaining
        </span>
      </div>
      <div className="p-3 space-y-2">
        {tasks.map((task, i) => {
          const isChecked = checkedItems.includes(i);
          const isChecking = currentlyChecking === i;
          return (
            <motion.div
              key={i}
              animate={{
                opacity: isChecked ? 0.4 : 1,
                scale: isChecking ? 1.02 : 1,
                backgroundColor: isChecking ? "rgba(249,115,22,0.06)" : "rgba(0,0,0,0)",
              }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30"
            >
              <motion.div
                animate={{
                  scale: isChecking ? [1, 1.3, 1] : 1,
                  rotate: isChecked ? [0, 10, -10, 0] : 0,
                }}
                transition={{ duration: 0.5 }}
                className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
                  isChecked
                    ? "bg-green-100 dark:bg-green-950/40"
                    : isChecking
                    ? "bg-primary/20"
                    : "bg-muted"
                }`}
              >
                {isChecked ? (
                  <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300 }}>
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </motion.div>
                ) : (
                  <task.icon className={`h-3.5 w-3.5 ${isChecking ? "text-primary" : "text-muted-foreground"}`} />
                )}
              </motion.div>
              <span className={`text-xs font-medium flex-1 transition-all duration-300 ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {task.label}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full text-white font-medium ${task.urgencyColor} ${isChecked ? "opacity-40" : ""}`}>
                {task.urgency}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ChatDemo() {
  const conversations = [
    [
      { role: "user" as const, text: "My faucet is dripping" },
      { role: "assistant" as const, text: "Usually a worn washer or O-ring. Try turning off water supply, then replace the washer (~$5)." },
      { role: "assistant" as const, text: "Cost: $5-15 DIY, $150-300 plumber. You've got this!" },
    ],
    [
      { role: "user" as const, text: "When should I replace my roof?" },
      { role: "assistant" as const, text: "Asphalt shingles last 20-25 years. Look for curling, missing shingles, or granule loss." },
      { role: "assistant" as const, text: "Average cost: $8,000-15,000. Start a savings fund now!" },
    ],
  ];

  const [convoIndex, setConvoIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const convo = conversations[convoIndex];

  useEffect(() => {
    if (visibleCount < convo.length) {
      setIsTyping(true);
      const typingDelay = visibleCount === 0 ? 600 : 1200;
      const showDelay = typingDelay + 800;

      const t1 = setTimeout(() => {
        setIsTyping(false);
        setVisibleCount(prev => prev + 1);
      }, showDelay);

      return () => clearTimeout(t1);
    } else {
      const t = setTimeout(() => {
        setVisibleCount(0);
        setConvoIndex(prev => (prev + 1) % conversations.length);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [visibleCount, convoIndex, convo.length]);

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm h-full flex flex-col" data-testid="demo-chat">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-heading font-bold text-foreground">AI Assistant</span>
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="h-2 w-2 rounded-full bg-green-500 ml-auto"
        />
      </div>
      <div className="p-3 space-y-2.5 flex-1 min-h-[200px]">
        {convo.slice(0, visibleCount).map((msg, i) => (
          <motion.div
            key={`${convoIndex}-${i}`}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, type: "spring", stiffness: 200 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[11px] leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm"
            }`}>
              {msg.text}
            </div>
          </motion.div>
        ))}
        {isTyping && visibleCount < convo.length && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${convo[visibleCount].role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`px-3 py-2.5 rounded-xl ${
              convo[visibleCount].role === "user"
                ? "bg-primary/80 rounded-br-sm"
                : "bg-muted rounded-bl-sm"
            }`}>
              <div className="flex gap-1.5 items-center">
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className={`h-1.5 w-1.5 rounded-full ${convo[visibleCount].role === "user" ? "bg-primary-foreground/60" : "bg-muted-foreground/60"}`} />
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className={`h-1.5 w-1.5 rounded-full ${convo[visibleCount].role === "user" ? "bg-primary-foreground/60" : "bg-muted-foreground/60"}`} />
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className={`h-1.5 w-1.5 rounded-full ${convo[visibleCount].role === "user" ? "bg-primary-foreground/60" : "bg-muted-foreground/60"}`} />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function BudgetDemo() {
  const funds = [
    { label: "Emergency Fund", current: 2400, target: 5000, color: "bg-red-500" },
    { label: "HVAC Replacement", current: 3200, target: 8000, color: "bg-primary" },
    { label: "Roof Repair", current: 1800, target: 4000, color: "bg-amber-500" },
  ];

  const [deposits, setDeposits] = useState<{ fundIndex: number; amount: number; id: number }[]>([]);
  const [totalExtra, setTotalExtra] = useState(0);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const fundIndex = Math.floor(Math.random() * funds.length);
      const amount = [50, 75, 100, 150, 200, 250][Math.floor(Math.random() * 6)];
      setDeposits(prev => [...prev.slice(-4), { fundIndex, amount, id: nextId }]);
      setTotalExtra(prev => prev + amount);
      setNextId(prev => prev + 1);
    }, 2200);

    const resetInterval = setInterval(() => {
      setDeposits([]);
      setTotalExtra(0);
    }, 18000);

    return () => {
      clearInterval(interval);
      clearInterval(resetInterval);
    };
  }, [nextId]);

  const fundTotals = funds.map((fund, i) => {
    const extra = deposits.filter(d => d.fundIndex === i).reduce((sum, d) => sum + d.amount, 0);
    return Math.min(fund.current + extra, fund.target);
  });

  const grandTotal = fundTotals.reduce((s, v) => s + v, 0);

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
              key={grandTotal}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-2xl font-heading font-bold text-foreground"
            >
              ${grandTotal.toLocaleString()}
            </motion.p>
            <p className="text-xs text-muted-foreground">Total saved</p>
          </div>
          <motion.div
            animate={{ scale: totalExtra > 0 ? [1, 1.15, 1] : 1 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-1 text-green-600 dark:text-green-400"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">+${totalExtra}</span>
          </motion.div>
        </div>

        <div className="space-y-3 relative">
          {funds.map((fund, i) => {
            const fillPct = Math.min((fundTotals[i] / fund.target) * 100, 100);
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground font-medium">{fund.label}</span>
                  <motion.span
                    key={fundTotals[i]}
                    initial={{ scale: 1.2, color: "#22c55e" }}
                    animate={{ scale: 1, color: "inherit" }}
                    className="text-muted-foreground"
                  >
                    ${fundTotals[i].toLocaleString()} / ${fund.target.toLocaleString()}
                  </motion.span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${fund.color}`}
                    animate={{ width: `${fillPct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })}

          {deposits.slice(-1).map(dep => (
            <motion.div
              key={dep.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -30, scale: 0.8 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute right-2 bottom-0 flex items-center gap-1 text-green-600 dark:text-green-400 font-bold text-xs pointer-events-none"
            >
              <Plus className="h-3 w-3" />${dep.amount}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { DashboardDemo, ChatDemo, BudgetDemo };
