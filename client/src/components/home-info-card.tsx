import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Home, MapPin, Calendar, Maximize, Bed, Bath, ExternalLink, Pencil, Ruler, DollarSign, Zap, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateHome, fetchZillowData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { V2Home, V2System } from "@/lib/api";
import { CircuitMapDialog } from "@/components/circuit-map";

type HomeType = V2Home;
type System = V2System;

interface HomeInfoCardProps {
  home: HomeType;
  systems: System[];
}

const exteriorTypes = ["Brick", "Vinyl Siding", "Wood Siding", "Stucco", "Stone", "Fiber Cement", "Aluminum", "Other"];
const roofTypes = ["Asphalt Shingle", "Metal", "Tile", "Slate", "Wood Shake", "Flat/Built-up", "Other"];

export function HomeInfoCard({ home, systems }: HomeInfoCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    builtYear: home.builtYear?.toString() || "",
    sqFt: home.sqFt?.toString() || "",
    beds: home.beds?.toString() || "",
    baths: home.baths?.toString() || "",
    lotSize: (home as any).lotSize?.toString() || "",
    exteriorType: (home as any).exteriorType || "",
    roofType: (home as any).roofType || "",
    lastSaleYear: (home as any).lastSaleYear?.toString() || "",
    homeValueEstimate: (home as any).homeValueEstimate?.toString() || "",
    zillowUrl: home.zillowUrl || "",
  });

  useEffect(() => {
    setEditData({
      builtYear: home.builtYear?.toString() || "",
      sqFt: home.sqFt?.toString() || "",
      beds: home.beds?.toString() || "",
      baths: home.baths?.toString() || "",
      lotSize: (home as any).lotSize?.toString() || "",
      exteriorType: (home as any).exteriorType || "",
      roofType: (home as any).roofType || "",
      lastSaleYear: (home as any).lastSaleYear?.toString() || "",
      homeValueEstimate: (home as any).homeValueEstimate?.toString() || "",
      zillowUrl: home.zillowUrl || "",
    });
  }, [home]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fetchingZillow, setFetchingZillow] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<HomeType>) => updateHome(home.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home"] });
      setIsEditing(false);
      toast({ title: "Home updated", description: "Your home information has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update home info.", variant: "destructive" });
    },
  });

  const handleFetchZillow = async () => {
    if (!editData.zillowUrl) return;
    setFetchingZillow(true);
    try {
      const data = await fetchZillowData(editData.zillowUrl);
      let fieldsUpdated = 0;
      const updates: Partial<typeof editData> = {};
      if (data.beds && !editData.beds) { updates.beds = data.beds.toString(); fieldsUpdated++; }
      if (data.baths && !editData.baths) { updates.baths = data.baths.toString(); fieldsUpdated++; }
      if (data.sqFt && !editData.sqFt) { updates.sqFt = data.sqFt.toString(); fieldsUpdated++; }
      if (data.builtYear && !editData.builtYear) { updates.builtYear = data.builtYear.toString(); fieldsUpdated++; }
      if (data.homeValueEstimate && !editData.homeValueEstimate) { updates.homeValueEstimate = data.homeValueEstimate.toString(); fieldsUpdated++; }
      setEditData(prev => ({ ...prev, ...updates }));
      toast({
        title: fieldsUpdated > 0 ? "Details fetched" : "No new details found",
        description: fieldsUpdated > 0
          ? `Filled in ${fieldsUpdated} field${fieldsUpdated > 1 ? "s" : ""} from Zillow. Review and save when ready.`
          : "The URL was parsed but no additional property details were found. Zillow URLs typically contain address info only.",
      });
    } catch (err: any) {
      toast({ title: "Couldn't fetch details", description: err.message || "Please check the URL and try again.", variant: "destructive" });
    } finally {
      setFetchingZillow(false);
    }
  };

  const handleSave = () => {
    const errors: string[] = [];
    const currentYear = 2026;

    if (editData.beds) {
      const beds = parseInt(editData.beds);
      if (!Number.isInteger(beds) || beds < 1 || beds > 50) {
        errors.push("Bedrooms must be a whole number between 1 and 50.");
      }
    }
    if (editData.baths) {
      const baths = parseInt(editData.baths);
      if (!Number.isInteger(baths) || baths < 1 || baths > 50) {
        errors.push("Bathrooms must be a whole number between 1 and 50.");
      }
    }
    if (editData.sqFt) {
      const sqFt = parseInt(editData.sqFt);
      if (isNaN(sqFt) || sqFt < 100 || sqFt > 100000) {
        errors.push("Square feet must be between 100 and 100,000.");
      }
    }
    if (editData.builtYear) {
      const year = parseInt(editData.builtYear);
      if (isNaN(year) || year < 1600 || year > currentYear) {
        errors.push(`Year built must be between 1600 and ${currentYear}.`);
      }
    }
    if (editData.lotSize) {
      const lot = parseInt(editData.lotSize);
      if (isNaN(lot) || lot < 0 || lot > 10000000) {
        errors.push("Lot size must be between 0 and 10,000,000 sq ft.");
      }
    }
    if (editData.lastSaleYear) {
      const saleYear = parseInt(editData.lastSaleYear);
      if (isNaN(saleYear) || saleYear < 1600 || saleYear > currentYear) {
        errors.push(`Last sale year must be between 1600 and ${currentYear}.`);
      }
    }
    if (editData.homeValueEstimate) {
      const value = parseInt(editData.homeValueEstimate);
      if (isNaN(value) || value < 0) {
        errors.push("Home value estimate must be 0 or greater.");
      }
    }

    if (errors.length > 0) {
      toast({ title: "Validation Error", description: errors.join(" "), variant: "destructive" });
      return;
    }

    updateMutation.mutate({
      builtYear: editData.builtYear ? parseInt(editData.builtYear) : undefined,
      sqFt: editData.sqFt ? parseInt(editData.sqFt) : undefined,
      beds: editData.beds ? parseInt(editData.beds) : undefined,
      baths: editData.baths ? parseInt(editData.baths) : undefined,
      lotSize: editData.lotSize ? parseInt(editData.lotSize) : undefined,
      exteriorType: editData.exteriorType || undefined,
      roofType: editData.roofType || undefined,
      lastSaleYear: editData.lastSaleYear ? parseInt(editData.lastSaleYear) : undefined,
      homeValueEstimate: editData.homeValueEstimate ? parseInt(editData.homeValueEstimate) : undefined,
      zillowUrl: editData.zillowUrl || undefined,
    } as any);
  };

  const homeAge = home.builtYear ? new Date().getFullYear() - home.builtYear : null;
  const location = home.city && home.state ? `${home.city}, ${home.state}` : home.address?.split(",").slice(-2).join(",").trim() || "Location not set";

  const systemTags = systems.slice(0, 3).map(s => s.category || s.name);
  const electricalSystem = systems.find(s => s.category === "Electrical");
  const [showCircuitMap, setShowCircuitMap] = useState(false);

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Home Information
          </CardTitle>
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-edit-home">
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh]">
              <DialogHeader>
                <DialogTitle>Edit Home Details</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="builtYear">Year Built</Label>
                      <Input
                        id="builtYear"
                        type="number"
                        min={1600}
                        max={2026}
                        placeholder="1990"
                        value={editData.builtYear}
                        onChange={(e) => setEditData({ ...editData, builtYear: e.target.value })}
                        data-testid="input-built-year"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sqFt">Square Feet</Label>
                      <Input
                        id="sqFt"
                        type="number"
                        min={100}
                        max={100000}
                        placeholder="2000"
                        value={editData.sqFt}
                        onChange={(e) => setEditData({ ...editData, sqFt: e.target.value })}
                        data-testid="input-sqft"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="beds">Bedrooms</Label>
                      <Input
                        id="beds"
                        type="number"
                        min={1}
                        max={50}
                        step={1}
                        placeholder="3"
                        value={editData.beds}
                        onChange={(e) => setEditData({ ...editData, beds: e.target.value })}
                        data-testid="input-beds"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="baths">Bathrooms</Label>
                      <Input
                        id="baths"
                        type="number"
                        min={1}
                        max={50}
                        step={1}
                        placeholder="2"
                        value={editData.baths}
                        onChange={(e) => setEditData({ ...editData, baths: e.target.value })}
                        data-testid="input-baths"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lotSize">Lot Size (sq ft)</Label>
                      <Input
                        id="lotSize"
                        type="number"
                        min={0}
                        max={10000000}
                        placeholder="5000"
                        value={editData.lotSize}
                        onChange={(e) => setEditData({ ...editData, lotSize: e.target.value })}
                        data-testid="input-lot-size"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastSaleYear">Last Sale Year</Label>
                      <Input
                        id="lastSaleYear"
                        type="number"
                        min={1600}
                        max={2026}
                        placeholder="2020"
                        value={editData.lastSaleYear}
                        onChange={(e) => setEditData({ ...editData, lastSaleYear: e.target.value })}
                        data-testid="input-last-sale-year"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="exteriorType">Exterior Type</Label>
                      <Select value={editData.exteriorType} onValueChange={(v) => setEditData({ ...editData, exteriorType: v })}>
                        <SelectTrigger data-testid="select-exterior-type">
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {exteriorTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roofType">Roof Type</Label>
                      <Select value={editData.roofType} onValueChange={(v) => setEditData({ ...editData, roofType: v })}>
                        <SelectTrigger data-testid="select-roof-type">
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {roofTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="homeValueEstimate">Estimated Home Value ($)</Label>
                    <Input
                      id="homeValueEstimate"
                      type="number"
                      min={0}
                      placeholder="350000"
                      value={editData.homeValueEstimate}
                      onChange={(e) => setEditData({ ...editData, homeValueEstimate: e.target.value })}
                      data-testid="input-home-value"
                    />
                    <p className="text-xs text-muted-foreground">Estimated value for reference only</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zillowUrl">Zillow URL (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="zillowUrl"
                        type="url"
                        placeholder="https://zillow.com/homedetails/..."
                        value={editData.zillowUrl}
                        onChange={(e) => setEditData({ ...editData, zillowUrl: e.target.value })}
                        data-testid="input-zillow-url"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleFetchZillow}
                        disabled={!editData.zillowUrl || fetchingZillow}
                        data-testid="button-fetch-zillow"
                        className="whitespace-nowrap"
                      >
                        {fetchingZillow ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Fetching...</> : "Fetch Details"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Paste a Zillow listing URL to auto-fill property details</p>
                  </div>
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-home">
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate" data-testid="text-location">{location}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {homeAge !== null && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold" data-testid="text-home-age">{homeAge} yrs</p>
                <p className="text-xs text-muted-foreground">Built {home.builtYear}</p>
              </div>
            </div>
          )}
          {home.sqFt && (
            <div className="flex items-center gap-2">
              <Maximize className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold" data-testid="text-sqft">{home.sqFt.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">sq ft</p>
              </div>
            </div>
          )}
          {home.beds && (
            <div className="flex items-center gap-2">
              <Bed className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold" data-testid="text-beds">{home.beds}</p>
                <p className="text-xs text-muted-foreground">beds</p>
              </div>
            </div>
          )}
          {home.baths && (
            <div className="flex items-center gap-2">
              <Bath className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold" data-testid="text-baths">{home.baths}</p>
                <p className="text-xs text-muted-foreground">baths</p>
              </div>
            </div>
          )}
        </div>

        {systemTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {systemTags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {systems.length > 3 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{systems.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {electricalSystem && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCircuitMap(true)}
            className="w-full justify-start text-sm gap-2"
            data-testid="button-open-circuit-map"
          >
            <Zap className="h-4 w-4 text-primary" />
            Circuit Panel Map
          </Button>
        )}

        {home.zillowUrl && (
          <a
            href={home.zillowUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            data-testid="link-zillow"
          >
            View on Zillow <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>

      {electricalSystem && (
        <CircuitMapDialog
          homeId={home.id}
          systemId={electricalSystem.id}
          isOpen={showCircuitMap}
          onClose={() => setShowCircuitMap(false)}
        />
      )}
    </Card>
  );
}
