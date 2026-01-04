import { Layout } from "@/components/layout";
import { useState } from "react";
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
  Info,
  Sparkles,
  Heart
} from "lucide-react";
import type { Fund, MaintenanceTask } from "@shared/schema";

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
      {fund.label && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
            "{fund.label}"
          </p>
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
      <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        You can afford this
      </Badge>
    );
  }

  if (percentage >= 50) {
    return (
      <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
        <Clock className="h-3 w-3 mr-1" />
        Almost there ({Math.round(percentage)}%)
      </Badge>
    );
  }

  return (
    <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200">
      <AlertCircle className="h-3 w-3 mr-1" />
      May need to wait
    </Badge>
  );
}

function AddFundDialog({ homeId, onSuccess }: { homeId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
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
            <Label htmlFor="fund-name">Fund Name</Label>
            <Input
              id="fund-name"
              placeholder="e.g., Home Repair Fund, Emergency Savings"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-fund-name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fund-balance">Current Balance</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="fund-balance"
                type="number"
                placeholder="0"
                className="pl-9"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                data-testid="input-fund-balance"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fund-contribution">Monthly Contribution (Optional)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="fund-contribution"
                type="number"
                placeholder="0"
                className="pl-9"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                data-testid="input-fund-contribution"
              />
            </div>
            <p className="text-xs text-muted-foreground">How much you plan to add each month</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fund-type">Fund Type</Label>
            <Select value={fundType} onValueChange={setFundType}>
              <SelectTrigger data-testid="select-fund-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General - For any home repairs</SelectItem>
                <SelectItem value="dedicated">Dedicated - For specific projects</SelectItem>
                <SelectItem value="emergency">Emergency Only - Last resort funds</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fund-label">Personal Note (Optional)</Label>
            <Textarea
              id="fund-label"
              placeholder="e.g., 'Only touch for major repairs' or 'Save for roof replacement'"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-fund-label"
            />
            <p className="text-xs text-muted-foreground">A reminder to yourself about this fund's purpose</p>
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

export default function Budget() {
  const queryClient = useQueryClient();

  const { data: home } = useQuery({
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

  if (!home) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Please complete your home profile first.</p>
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

        {/* Quick Answer Section */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              At a Glance
            </CardTitle>
            <CardDescription>Your home repair budget summary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Funds</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-total-funds">
                  {formatCurrency(totalBalance)}
                </p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Available</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-available">
                  {formatCurrency(availableForRepairs)}
                </p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Emergency Reserve</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-emergency">
                  {formatCurrency(emergencyFunds)}
                </p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Spent YTD</p>
                <p className="text-2xl font-bold text-muted-foreground" data-testid="text-spent">
                  {formatCurrency(totalSpent)}
                </p>
              </div>
            </div>
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
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${
                      task.urgency === 'now' ? 'bg-destructive' : 
                      task.urgency === 'soon' ? 'bg-orange-500' : 'bg-green-500'
                    }`} />
                    <div>
                      <p className="font-medium text-foreground">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.estimatedCost || "Cost TBD"} • {task.diyLevel}
                      </p>
                    </div>
                  </div>
                  <AffordabilityIndicator task={task} totalAvailable={availableForRepairs} />
                </div>
              ))}
              
              {/* Supportive messaging */}
              <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Remember:</strong> Spending on preventive maintenance often saves money in the long run. 
                  It's okay to use your funds for important repairs—that's what they're for!
                </p>
              </div>
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
                  onEdit={() => {/* TODO: Edit fund modal */}} 
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

        {/* Helpful tips */}
        <Card className="bg-muted/30">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Info className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium mb-1">Budget Tips</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Keep an emergency fund separate for unexpected repairs</li>
                  <li>• Consider setting up a monthly contribution to build your repair fund over time</li>
                  <li>• Prioritize repairs that protect your home from bigger issues later</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
