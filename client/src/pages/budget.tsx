import { Layout } from "@/components/layout";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHome, getFunds, getTasks, getExpenses, createFund, updateFund, deleteFund } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Wallet, 
  PiggyBank, 
  TrendingUp, 
  Plus, 
  DollarSign,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  Heart,
  Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import type { Fund, MaintenanceTask } from "@shared/schema";

function BudgetSkeleton() {
  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div className="space-y-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-28" />
      </header>
      <Skeleton className="h-48" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    </div>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function FundCard({ fund, onEdit }: { fund: Fund; onEdit: () => void }) {
  const getFundTypeLabel = (type: string | null) => {
    switch (type) {
      case "emergency": return { label: "Emergency Only", icon: Shield, color: "text-red-600 bg-red-50" };
      case "dedicated": return { label: "Dedicated", icon: PiggyBank, color: "text-blue-600 bg-blue-50" };
      default: return { label: "General", icon: Wallet, color: "text-green-600 bg-green-50" };
    }
  };

  const typeInfo = getFundTypeLabel(fund.fundType);
  const TypeIcon = typeInfo.icon;

  return (
    <Card 
      className="relative overflow-hidden cursor-pointer hover:shadow-md transition-all group"
      style={{ borderLeftColor: fund.color || "#f97316", borderLeftWidth: "4px" }}
      onClick={onEdit}
      data-testid={`card-fund-${fund.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-heading">{fund.name}</CardTitle>
            <Badge variant="outline" className={`text-xs mt-1 ${typeInfo.color}`}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {typeInfo.label}
            </Badge>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{formatCurrency(fund.balance)}</p>
            {fund.monthlyContribution && fund.monthlyContribution > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                <TrendingUp className="h-3 w-3" />
                +{formatCurrency(fund.monthlyContribution)}/mo
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      {(fund.purpose || fund.label) && (
        <CardContent className="pt-0 space-y-2">
          {fund.purpose && (
            <p className="text-sm text-foreground bg-primary/5 p-2 rounded">
              {fund.purpose}
            </p>
          )}
          {fund.label && (
            <p className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
              "{fund.label}"
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function AffordabilityIndicator({ task, totalAvailable }: { task: MaintenanceTask; totalAvailable: number }) {
  const estimatedCost = task.estimatedCost ? parseInt(task.estimatedCost.replace(/[^0-9]/g, '')) * 100 : 0;
  const canAfford = estimatedCost <= totalAvailable;
  const percentage = totalAvailable > 0 ? Math.min(100, (totalAvailable / estimatedCost) * 100) : 0;
  
  if (estimatedCost === 0) {
    return (
      <Badge variant="outline" className="text-xs bg-gray-50">
        <Info className="h-3 w-3 mr-1" />
        Cost TBD
      </Badge>
    );
  }

  if (canAfford) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="text-xs bg-green-100 text-green-700 border-green-200 cursor-help">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            You can afford this
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>You have enough available funds to cover this expense</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (percentage >= 50) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200 cursor-help">
            <Clock className="h-3 w-3 mr-1" />
            Almost there ({Math.round(percentage)}%)
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>You've saved {Math.round(percentage)}% of what you need - keep going!</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200 cursor-help">
          <AlertCircle className="h-3 w-3 mr-1" />
          May need to wait
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>You'll need to save more before tackling this one</p>
      </TooltipContent>
    </Tooltip>
  );
}

function AddFundDialog({ homeId, onSuccess }: { homeId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [fundType, setFundType] = useState("general");
  const [label, setLabel] = useState("");
  const { toast } = useToast();

  const createFundMutation = useMutation({
    mutationFn: (data: Parameters<typeof createFund>[1]) => createFund(homeId, data),
    onSuccess: () => {
      toast({
        title: "Fund created",
        description: "Your new fund has been set up. You're taking a great step toward organized home care!",
      });
      setOpen(false);
      setPurpose("");
      setName("");
      setBalance("");
      setMonthlyContribution("");
      setFundType("general");
      setLabel("");
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Couldn't create fund",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!name || !balance) return;
    createFundMutation.mutate({
      name,
      purpose: purpose || undefined,
      balance: Math.round(parseFloat(balance) * 100),
      monthlyContribution: monthlyContribution ? Math.round(parseFloat(monthlyContribution) * 100) : 0,
      fundType,
      label: label || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20" data-testid="button-add-fund">
          <Plus className="h-4 w-4 mr-2" />
          Add Fund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Create a New Fund</DialogTitle>
          <DialogDescription>
            Set up a fund to track money you've set aside for home repairs. This is just for your planning—no bank connection needed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fund-purpose">What is this fund for?</Label>
            <Textarea
              id="fund-purpose"
              placeholder="e.g., Saving for a new roof in 2025, Emergency repairs fund, General home maintenance"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-fund-purpose"
            />
            <p className="text-xs text-muted-foreground">Describe the goal or purpose of this fund</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fund-name">Fund Name</Label>
            <Input
              id="fund-name"
              placeholder="e.g., Roof Reserve, HVAC Fund, General Repairs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-fund-name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fund-balance">How much have you set aside?</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="fund-balance"
                type="number"
                placeholder="500"
                className="pl-9"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                data-testid="input-fund-balance"
              />
            </div>
            <p className="text-xs text-muted-foreground">This can be money in savings, a checking account, or anywhere you keep it</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fund-contribution">Monthly Contribution (Optional)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="fund-contribution"
                type="number"
                placeholder="100"
                className="pl-9"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                data-testid="input-fund-contribution"
              />
            </div>
            <p className="text-xs text-muted-foreground">If you're saving monthly, we'll help you project when you'll be ready for bigger repairs</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fund-type">Fund Purpose</Label>
            <Select value={fundType} onValueChange={setFundType}>
              <SelectTrigger data-testid="select-fund-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General repairs (can use anytime)</SelectItem>
                <SelectItem value="dedicated">Specific project (e.g., new roof, HVAC)</SelectItem>
                <SelectItem value="emergency">Emergency buffer (try not to touch)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fund-label">Note to Yourself (Optional)</Label>
            <Textarea
              id="fund-label"
              placeholder="e.g., 'For the roof when it's time' or 'Don't touch unless critical'"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-fund-label"
            />
            <p className="text-xs text-muted-foreground">A mental label to help you stay on track</p>
          </div>
        </div>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!name || !balance || createFundMutation.isPending}
            data-testid="button-create-fund"
          >
            {createFundMutation.isPending ? "Creating..." : "Create Fund"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditFundDialog({ 
  fund, 
  open, 
  onOpenChange, 
  onSuccess 
}: { 
  fund: Fund | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [purpose, setPurpose] = useState("");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [fundType, setFundType] = useState("general");
  const [label, setLabel] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (fund && open) {
      setPurpose(fund.purpose || "");
      setName(fund.name);
      setBalance(String(fund.balance / 100));
      setMonthlyContribution(fund.monthlyContribution ? String(fund.monthlyContribution / 100) : "");
      setFundType(fund.fundType || "general");
      setLabel(fund.label || "");
    }
  }, [fund, open]);

  const updateFundMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateFund>[1]) => updateFund(fund!.id, data),
    onSuccess: () => {
      toast({ title: "Fund updated", description: "Your changes have been saved." });
      queryClient.invalidateQueries({ queryKey: ["funds"] });
      onOpenChange(false);
      onSuccess();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteFundMutation = useMutation({
    mutationFn: () => deleteFund(fund!.id),
    onSuccess: () => {
      toast({ title: "Fund deleted", description: "The fund has been removed." });
      queryClient.invalidateQueries({ queryKey: ["funds"] });
      onOpenChange(false);
      onSuccess();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!name || !balance) return;
    updateFundMutation.mutate({
      name,
      purpose: purpose || undefined,
      balance: Math.round(parseFloat(balance) * 100),
      monthlyContribution: monthlyContribution ? Math.round(parseFloat(monthlyContribution) * 100) : 0,
      fundType,
      label: label || undefined,
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this fund? This action cannot be undone.")) {
      deleteFundMutation.mutate();
    }
  };

  if (!fund) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit Fund</DialogTitle>
          <DialogDescription>
            Update the details of your fund.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-fund-purpose">What is this fund for?</Label>
            <Textarea
              id="edit-fund-purpose"
              placeholder="e.g., Saving for a new roof in 2025, Emergency repairs fund"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-edit-fund-purpose"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-fund-name">Fund Name</Label>
            <Input
              id="edit-fund-name"
              placeholder="e.g., Roof Reserve, HVAC Fund"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-edit-fund-name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-fund-balance">Current Balance</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="edit-fund-balance"
                type="number"
                placeholder="500"
                className="pl-9"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                data-testid="input-edit-fund-balance"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-fund-contribution">Monthly Contribution</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="edit-fund-contribution"
                type="number"
                placeholder="100"
                className="pl-9"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                data-testid="input-edit-fund-contribution"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-fund-type">Fund Type</Label>
            <Select value={fundType} onValueChange={setFundType}>
              <SelectTrigger data-testid="select-edit-fund-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General repairs</SelectItem>
                <SelectItem value="dedicated">Specific project</SelectItem>
                <SelectItem value="emergency">Emergency buffer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-fund-label">Note to Yourself</Label>
            <Textarea
              id="edit-fund-label"
              placeholder="e.g., 'Don't touch unless critical'"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-edit-fund-label"
            />
          </div>
        </div>
        
        <div className="flex justify-between gap-3">
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={deleteFundMutation.isPending}
            data-testid="button-delete-fund"
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button 
              onClick={handleSave} 
              disabled={!name || !balance || updateFundMutation.isPending}
              data-testid="button-save-fund"
            >
              {updateFundMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Budget() {
  const queryClient = useQueryClient();
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });

  const { data: funds = [], isLoading: fundsLoading } = useQuery({
    queryKey: ["funds", home?.id],
    queryFn: () => getFunds(home!.id),
    enabled: !!home?.id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", home?.id],
    queryFn: () => getTasks(home!.id),
    enabled: !!home?.id,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", home?.id],
    queryFn: () => getExpenses(home!.id),
    enabled: !!home?.id,
  });

  // Calculate totals
  const totalBalance = funds.reduce((sum, f) => sum + f.balance, 0);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const emergencyFunds = funds.filter(f => f.fundType === "emergency").reduce((sum, f) => sum + f.balance, 0);
  const availableForRepairs = totalBalance - emergencyFunds;

  // Get prioritized tasks that need funding
  const priorityTasks = tasks
    .filter(t => t.status !== "completed" && t.urgency !== "monitor")
    .sort((a, b) => {
      const urgencyOrder = { now: 0, soon: 1, later: 2 };
      return (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 3) - 
             (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 3);
    })
    .slice(0, 5);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["funds"] });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  };

  if (homeLoading || (home && fundsLoading)) {
    return (
      <Layout>
        <BudgetSkeleton />
      </Layout>
    );
  }

  if (!home) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center max-w-md">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Set up your home first</h2>
            <p className="text-muted-foreground">
              Complete your home profile to start tracking your repair budget and funds.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-heading">Budget</h1>
            <p className="text-muted-foreground mt-1">See what you can afford and plan with confidence.</p>
          </div>
          <AddFundDialog homeId={home.id} onSuccess={handleRefresh} />
        </header>

        {/* Repair Readiness Section */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Your Repair Readiness
            </CardTitle>
            <CardDescription>How prepared you are for upcoming home repairs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm cursor-help">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ready to Use</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-available">
                      {formatCurrency(availableForRepairs)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">For planned repairs</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Money available for repairs (excluding emergency buffer)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm cursor-help">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Emergency Buffer</p>
                    <p className={`text-2xl font-bold ${emergencyFunds > 0 ? 'text-foreground' : 'text-muted-foreground'}`} data-testid="text-emergency">
                      {emergencyFunds > 0 ? formatCurrency(emergencyFunds) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {emergencyFunds > 0 ? 'Last resort only' : 'Not set yet'}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{emergencyFunds > 0 ? 'Set aside for unexpected emergencies—try not to touch unless critical' : 'Consider setting up an emergency fund for unexpected repairs'}</p>
                </TooltipContent>
              </Tooltip>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Saved</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-total-funds">
                  {formatCurrency(totalBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Across all funds</p>
              </div>
            </div>
            
            {priorityTasks.length > 0 && (
              <div className="mt-4 p-3 bg-white/60 rounded-lg border border-muted">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Coverage:</span>{' '}
                  {(() => {
                    const affordableCount = priorityTasks.filter(t => {
                      const cost = t.estimatedCost ? parseInt(t.estimatedCost.replace(/[^0-9]/g, '')) * 100 : 0;
                      return cost <= availableForRepairs;
                    }).length;
                    return `You're prepared for ${affordableCount} of ${priorityTasks.length} upcoming repairs.`;
                  })()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Decision Support */}
        {priorityTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-5 w-5 text-primary" />
                What Can I Afford?
              </CardTitle>
              <CardDescription>
                Based on your available funds (excluding emergency reserves)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {priorityTasks.map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  data-testid={`task-affordability-${task.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      task.urgency === 'now' ? 'bg-destructive' : 
                      task.urgency === 'soon' ? 'bg-orange-500' : 'bg-green-500'
                    }`} />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.estimatedCost || "Cost TBD"} • {task.diyLevel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <AffordabilityIndicator task={task} totalAvailable={availableForRepairs} />
                    {task.diyLevel === 'Pro-Only' && (
                      <a
                        href={`https://www.angi.com/search/${encodeURIComponent((task.category || 'home') + ' repair')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors hidden md:inline-flex items-center gap-1"
                        data-testid={`link-find-pro-${task.id}`}
                      >
                        Find pro
                      </a>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Supportive messaging */}
              <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Remember:</span> Spending on preventive maintenance often saves money in the long run. 
                  It's okay to use your funds for important repairs—that's what they're for.
                </p>
              </div>
              
              {/* Provider research note for pro-only tasks */}
              {priorityTasks.some(t => t.diyLevel === 'Pro-Only') && (
                <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-muted text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Need a contractor?</span> For tasks marked Pro-Only, you can research vetted local providers via Angi. 
                  We don't receive payment based on your choice.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Funds List */}
        <div className="space-y-4">
          <h2 className="text-xl font-heading font-semibold">Your Funds</h2>
          
          {fundsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : funds.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <div className="max-w-md mx-auto">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <PiggyBank className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No funds set up yet</h3>
                <p className="text-muted-foreground mb-6">
                  Add your first fund to start tracking what you can afford. This is your personal planning tool—no bank connection required.
                </p>
                <AddFundDialog homeId={home.id} onSuccess={handleRefresh} />
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {funds.map((fund) => (
                <FundCard 
                  key={fund.id} 
                  fund={fund} 
                  onEdit={() => {
                    setEditingFund(fund);
                    setEditDialogOpen(true);
                  }} 
                />
              ))}
              
              {/* Add new fund card */}
              <Card 
                className="flex flex-col justify-center items-center border-dashed cursor-pointer hover:bg-muted/50 transition-colors p-8"
                onClick={() => document.querySelector<HTMLButtonElement>('[data-testid="button-add-fund"]')?.click()}
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="h-6 w-6" />
                  </div>
                  <span className="font-medium">Add Another Fund</span>
                  <span className="text-xs">Optional</span>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Upcoming Costs Timeline */}
        {tasks.filter(t => t.status !== "completed").length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Upcoming Costs Timeline
              </CardTitle>
              <CardDescription>
                When you might need to spend and how much
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Now - Immediate needs */}
                {tasks.filter(t => t.urgency === "now" && t.status !== "completed").length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-destructive" />
                      <span className="text-sm font-medium text-destructive">Immediate</span>
                    </div>
                    <div className="ml-5 space-y-2">
                      {tasks.filter(t => t.urgency === "now" && t.status !== "completed").map(task => (
                        <div key={task.id} className="flex justify-between items-center text-sm p-2 bg-red-50 rounded">
                          <span className="truncate">{task.title}</span>
                          <span className="font-medium text-destructive shrink-0 ml-2">{task.estimatedCost || "TBD"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Soon - Within a few months */}
                {tasks.filter(t => t.urgency === "soon" && t.status !== "completed").length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-orange-500" />
                      <span className="text-sm font-medium text-orange-600">Within 1-3 Months</span>
                    </div>
                    <div className="ml-5 space-y-2">
                      {tasks.filter(t => t.urgency === "soon" && t.status !== "completed").map(task => (
                        <div key={task.id} className="flex justify-between items-center text-sm p-2 bg-orange-50 rounded">
                          <span className="truncate">{task.title}</span>
                          <span className="font-medium text-orange-600 shrink-0 ml-2">{task.estimatedCost || "TBD"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Later - Plan ahead */}
                {tasks.filter(t => t.urgency === "later" && t.status !== "completed").length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-600">3-12 Months</span>
                    </div>
                    <div className="ml-5 space-y-2">
                      {tasks.filter(t => t.urgency === "later" && t.status !== "completed").map(task => (
                        <div key={task.id} className="flex justify-between items-center text-sm p-2 bg-green-50 rounded">
                          <span className="truncate">{task.title}</span>
                          <span className="font-medium text-green-600 shrink-0 ml-2">{task.estimatedCost || "TBD"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total upcoming costs */}
                <div className="pt-3 border-t mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Estimated total upcoming costs</span>
                    <span className="font-bold">
                      {formatCurrency(tasks
                        .filter(t => t.status !== "completed" && t.urgency !== "monitor")
                        .reduce((sum, t) => {
                          const cost = t.estimatedCost ? parseInt(t.estimatedCost.replace(/[^0-9]/g, '')) * 100 : 0;
                          return sum + cost;
                        }, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      <EditFundDialog
        fund={editingFund}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleRefresh}
      />
    </Layout>
  );
}
