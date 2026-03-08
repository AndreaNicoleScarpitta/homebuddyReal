import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, Clock, AlertTriangle, Bot, FileText, Shield, FileCheck, Upload,
  Scan, Wrench, Zap, RotateCcw, CalendarClock, Thermometer, Droplets, CircuitBoard,
  Home, ChevronRight, Sparkles, ArrowRight
} from "lucide-react";

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
                backgroundColor: isChecking ? "rgba(249,115,22,0.06)" : "rgba(0,0,0,0.0001)",
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

function DocumentAnalysisDemo() {
  const phases = ["idle", "uploading", "scanning", "extracting", "complete"] as const;
  type Phase = typeof phases[number];

  const findings = [
    { label: "HVAC System — Carrier 24ACC636", type: "System", color: "text-blue-500", icon: Thermometer },
    { label: "Water heater — age 12 years", type: "Issue", color: "text-amber-500", icon: Droplets },
    { label: "Schedule furnace tune-up", type: "Task", color: "text-green-500", icon: Wrench },
    { label: "Electrical panel — needs GFCI", type: "Safety", color: "text-red-500", icon: CircuitBoard },
  ];

  const [phase, setPhase] = useState<Phase>("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [visibleFindings, setVisibleFindings] = useState(0);

  const runCycle = useCallback(() => {
    setPhase("idle");
    setScanProgress(0);
    setVisibleFindings(0);

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setPhase("uploading"), 800));
    timers.push(setTimeout(() => setPhase("scanning"), 2200));

    for (let p = 0; p <= 100; p += 5) {
      timers.push(setTimeout(() => setScanProgress(p), 2200 + p * 25));
    }

    timers.push(setTimeout(() => setPhase("extracting"), 4800));

    findings.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleFindings(i + 1), 5200 + i * 600));
    });

    timers.push(setTimeout(() => setPhase("complete"), 5200 + findings.length * 600 + 400));

    timers.push(setTimeout(runCycle, 5200 + findings.length * 600 + 3500));

    return timers;
  }, []);

  useEffect(() => {
    const timers = runCycle();
    return () => timers.forEach(clearTimeout);
  }, [runCycle]);

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm" data-testid="demo-analysis">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scan className="h-4 w-4 text-primary" />
          <span className="text-sm font-heading font-bold text-foreground">Document Analysis</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          {phase === "complete" ? "Done" : phase === "idle" ? "Ready" : "Processing"}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <motion.div
          animate={{
            borderColor: phase === "uploading" ? "rgba(249,115,22,0.5)" : "rgba(0,0,0,0.1)",
            backgroundColor: phase === "uploading" ? "rgba(249,115,22,0.03)" : "rgba(0,0,0,0.0001)",
          }}
          className="border-2 border-dashed rounded-lg p-3 flex items-center gap-3"
        >
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-500 ${
            phase === "idle" ? "bg-muted" : "bg-primary/10"
          }`}>
            {phase === "uploading" ? (
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                <Upload className="h-5 w-5 text-primary" />
              </motion.div>
            ) : (
              <FileText className={`h-5 w-5 ${phase === "idle" ? "text-muted-foreground" : "text-primary"}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {phase === "idle" ? "Drop a file to analyze..." : "Home_Inspection_2026.pdf"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {phase === "idle" ? "PDF, images, or documents" : "2.4 MB"}
            </p>
          </div>
        </motion.div>

        {(phase === "scanning" || phase === "extracting" || phase === "complete") && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground font-medium">
                  {phase === "scanning" ? "Scanning document..." : "Analysis complete"}
                </span>
                <span className="text-primary font-semibold">{phase === "scanning" ? `${scanProgress}%` : "100%"}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: phase === "scanning" ? `${scanProgress}%` : "100%" }}
                  transition={{ duration: 0.15 }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {(phase === "extracting" || phase === "complete") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Findings</p>
            {findings.slice(0, visibleFindings).map((finding, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg bg-muted/50"
              >
                <finding.icon className={`h-3.5 w-3.5 shrink-0 ${finding.color}`} />
                <span className="text-[11px] font-medium text-foreground flex-1">{finding.label}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  finding.type === "Safety" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" :
                  finding.type === "Issue" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                  finding.type === "Task" ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" :
                  "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                }`}>{finding.type}</span>
              </motion.div>
            ))}
          </motion.div>
        )}

        {phase === "complete" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30"
          >
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <span className="text-[10px] text-green-700 dark:text-green-400 font-medium">
              4 findings extracted — 1 system, 1 issue, 1 task, 1 safety alert
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function TaskGenerationDemo() {
  const systems = [
    { name: "HVAC", icon: Thermometer, color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-950/40" },
    { name: "Plumbing", icon: Droplets, color: "text-cyan-500", bgColor: "bg-cyan-100 dark:bg-cyan-950/40" },
    { name: "Electrical", icon: CircuitBoard, color: "text-amber-500", bgColor: "bg-amber-100 dark:bg-amber-950/40" },
  ];

  const taskSets = [
    [
      { label: "Replace air filter", cadence: "Every 90 days", urgency: "bg-amber-500" },
      { label: "Professional tune-up", cadence: "Every 6 months", urgency: "bg-blue-500" },
      { label: "Clean condensate drain", cadence: "Every 3 months", urgency: "bg-amber-500" },
    ],
    [
      { label: "Flush water heater", cadence: "Yearly", urgency: "bg-blue-500" },
      { label: "Check for leaks", cadence: "Every 3 months", urgency: "bg-amber-500" },
      { label: "Test sump pump", cadence: "Every 6 months", urgency: "bg-blue-500" },
    ],
    [
      { label: "Test GFCI outlets", cadence: "Monthly", urgency: "bg-red-500" },
      { label: "Inspect panel", cadence: "Yearly", urgency: "bg-blue-500" },
      { label: "Check smoke detectors", cadence: "Monthly", urgency: "bg-red-500" },
    ],
  ];

  const [activeSystem, setActiveSystem] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [visibleTasks, setVisibleTasks] = useState(0);
  const [showSchedule, setShowSchedule] = useState(false);

  const runCycle = useCallback(() => {
    setActiveSystem(0);
    setGenerating(false);
    setVisibleTasks(0);
    setShowSchedule(false);

    const timers: ReturnType<typeof setTimeout>[] = [];
    let offset = 0;

    for (let s = 0; s < systems.length; s++) {
      timers.push(setTimeout(() => {
        setActiveSystem(s);
        setGenerating(true);
        setVisibleTasks(0);
        setShowSchedule(false);
      }, offset));

      timers.push(setTimeout(() => setGenerating(false), offset + 1000));

      taskSets[s].forEach((_, i) => {
        timers.push(setTimeout(() => setVisibleTasks(i + 1), offset + 1200 + i * 500));
      });

      timers.push(setTimeout(() => setShowSchedule(true), offset + 1200 + taskSets[s].length * 500 + 300));

      offset += 1200 + taskSets[s].length * 500 + 2200;
    }

    timers.push(setTimeout(runCycle, offset + 800));
    return timers;
  }, []);

  useEffect(() => {
    const timers = runCycle();
    return () => timers.forEach(clearTimeout);
  }, [runCycle]);

  const currentTasks = taskSets[activeSystem] || [];
  const currentSystem = systems[activeSystem];

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm" data-testid="demo-tasks">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span className="text-sm font-heading font-bold text-foreground">Recurring Tasks</span>
        </div>
        <div className="flex items-center gap-1">
          <RotateCcw className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Auto-generated</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          {systems.map((sys, i) => (
            <motion.div
              key={i}
              animate={{
                scale: i === activeSystem ? 1.05 : 0.95,
                opacity: i === activeSystem ? 1 : 0.5,
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors duration-300 ${
                i === activeSystem ? "border-primary/40 bg-primary/5" : "border-border/30 bg-muted/30"
              }`}
            >
              <sys.icon className={`h-3.5 w-3.5 ${i === activeSystem ? sys.color : "text-muted-foreground"}`} />
              <span className={`text-[10px] font-medium ${i === activeSystem ? "text-foreground" : "text-muted-foreground"}`}>
                {sys.name}
              </span>
            </motion.div>
          ))}
        </div>

        {generating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 py-2"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
            />
            <span className="text-[11px] text-muted-foreground">
              Generating maintenance schedule for {currentSystem.name}...
            </span>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={activeSystem} className="space-y-1.5">
            {currentTasks.slice(0, visibleTasks).map((task, i) => (
              <motion.div
                key={`${activeSystem}-${i}`}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg bg-muted/50"
              >
                <Wrench className={`h-3.5 w-3.5 shrink-0 ${currentSystem.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground">{task.label}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <RotateCcw className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground">{task.cadence}</span>
                  </div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded text-white font-medium ${task.urgency}`}>
                  {task.urgency === "bg-red-500" ? "High" : task.urgency === "bg-amber-500" ? "Med" : "Low"}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {showSchedule && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/10"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-medium text-primary">Schedule active</span>
            </div>
            <span className="text-[9px] text-muted-foreground">{currentTasks.length} recurring tasks</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function DocumentsDemo() {
  const documents = [
    { name: "Home Insurance Policy", type: "Insurance", icon: Shield, color: "text-blue-500" },
    { name: "HVAC Warranty Certificate", type: "Warranty", icon: FileCheck, color: "text-green-500" },
    { name: "Roof Inspection Report", type: "Inspection", icon: FileText, color: "text-amber-500" },
    { name: "Kitchen Remodel Permit", type: "Permit", icon: FileText, color: "text-primary" },
  ];

  const [uploadedDocs, setUploadedDocs] = useState<number[]>([]);
  const [uploading, setUploading] = useState<number | null>(null);

  const runCycle = useCallback(() => {
    setUploadedDocs([]);
    setUploading(null);

    const timers: ReturnType<typeof setTimeout>[] = [];
    documents.forEach((_, i) => {
      timers.push(setTimeout(() => setUploading(i), 800 + i * 1400));
      timers.push(setTimeout(() => {
        setUploadedDocs(prev => [...prev, i]);
        setUploading(null);
      }, 800 + i * 1400 + 700));
    });

    timers.push(setTimeout(() => {
      setUploadedDocs([]);
      setUploading(null);
      setTimeout(runCycle, 600);
    }, 800 + documents.length * 1400 + 2000));

    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const cleanup = runCycle();
    return cleanup;
  }, [runCycle]);

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm" data-testid="demo-documents">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <span className="text-sm font-heading font-bold text-foreground">Document Vault</span>
        <Upload className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="p-4 space-y-2">
        {documents.map((doc, i) => {
          const isUploaded = uploadedDocs.includes(i);
          const isUploading = uploading === i;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{
                opacity: isUploaded || isUploading ? 1 : 0.3,
                x: isUploaded || isUploading ? 0 : -10,
              }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50"
            >
              <doc.icon className={`h-4 w-4 shrink-0 ${isUploaded ? doc.color : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{doc.name}</p>
                <p className="text-[10px] text-muted-foreground">{doc.type}</p>
              </div>
              {isUploading && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
                />
              )}
              {isUploaded && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <FileCheck className="h-4 w-4 text-green-500" />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export { DashboardDemo, ChatDemo, DocumentsDemo, DocumentAnalysisDemo, TaskGenerationDemo };
