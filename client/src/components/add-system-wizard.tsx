import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Home, 
  Wind, 
  Droplets, 
  Zap, 
  Square,
  Layers,
  Building,
  CookingPot,
  Flame,
  Trees,
  Bug,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Info,
  Camera,
  Loader2,
  Sparkles,
  Plus,
  Calendar,
  AlertTriangle,
  X,
  ListChecks,
  RefreshCw,
  Landmark,
  Paintbrush,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSystem, identifySystemFromImage, createTasksBatch, suggestMaintenanceTasks } from "@/lib/api";
import type { V2System, SuggestedTask } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { useLocation } from "wouter";
import { systemCategories, systemConditions } from "@shared/schema";
import { FieldTooltip } from "@/components/field-tooltip";

interface AddSystemWizardProps {
  isOpen: boolean;
  onClose: () => void;
  homeId: string | number;
  existingSystems?: V2System[];
  initialCategory?: string;
}

const categoryIcons: Record<string, any> = {
  "Roof": Home,
  "HVAC": Wind,
  "Plumbing": Droplets,
  "Electrical": Zap,
  "Windows": Square,
  "Siding/Exterior": Layers,
  "Foundation": Building,
  "Chimney": Landmark,
  "Appliances": CookingPot,
  "Water Heater": Flame,
  "Landscaping": Trees,
  "Pest": Bug,
  "Paint": Paintbrush,
  "Other": HelpCircle,
};

const categoryHints: Record<string, string> = {
  "Roof": "Look at the exterior or check attic access",
  "HVAC": "Garage, utility closet, attic, or outdoor unit",
  "Plumbing": "Under sinks, water main, or utility room",
  "Electrical": "Garage, basement, or side of house panel",
  "Windows": "Check labels on window frames for brand/year",
  "Siding/Exterior": "Walk the exterior to assess condition",
  "Foundation": "Basement, crawl space, or exterior base",
  "Chimney": "Fireplace, rooftop, or exterior chimney stack",
  "Appliances": "Kitchen, laundry room - check labels",
  "Water Heater": "Garage or utility room",
  "Landscaping": "Irrigation systems, outdoor lighting",
  "Pest": "Recent pest treatments or contracts",
  "Paint": "Track paint colors for each room and wall",
  "Other": "Any other home system you want to track",
};

const notesPlaceholders: Record<string, string> = {
  "Roof": "e.g., GAF Timberline HDZ in Charcoal, 30-year warranty, installed by ABC Roofing...",
  "HVAC": "e.g., Serial #XYZ123, 10-year parts warranty with Carrier, last serviced 6/2024...",
  "Plumbing": "e.g., Copper pipes throughout, PEX in the addition, main shutoff in garage...",
  "Electrical": "e.g., 200-amp panel, Siemens breakers, whole-home surge protector installed...",
  "Windows": "e.g., Andersen 400 Series, double-hung, Low-E glass, lifetime warranty...",
  "Siding/Exterior": "e.g., James Hardie HardiePlank in Arctic White, 30-year warranty...",
  "Foundation": "e.g., Poured concrete, sealed in 2020, French drain on east side...",
  "Chimney": "e.g., Clay flue liner, stainless steel cap, last swept 10/2024, no cracks found...",
  "Appliances": "e.g., Serial #ABC456, purchased from Home Depot, extended warranty until 2027...",
  "Water Heater": "e.g., 50-gallon tank, Serial #WH789, anode rod replaced 2023...",
  "Landscaping": "e.g., Rain Bird irrigation, 6 zones, winterized each November...",
  "Pest": "e.g., Contract #12345, quarterly treatments, termite bond renewal date 3/2026...",
  "Paint": "e.g., Sherwin-Williams Agreeable Gray SW 7029 in living room, Benjamin Moore White Dove OC-17 for trim...",
};

const notesHints: Record<string, string> = {
  "Roof": "Record the shingle brand, product line, and color so you can get an exact match for repairs.",
  "HVAC": "Include serial number, warranty details, and refrigerant type for faster service calls.",
  "Plumbing": "Note pipe material, water heater serial number, and location of shutoff valves.",
  "Electrical": "Record panel brand, amp rating, and any known circuit assignments.",
  "Windows": "Note the brand, series, and glass type for warranty claims and replacement matching.",
  "Siding/Exterior": "Record the brand, product line, and color code for exact replacement matching.",
  "Foundation": "Note any existing cracks, drainage systems, and waterproofing details.",
  "Chimney": "Record the flue liner type, cap style, and last professional inspection date.",
  "Appliances": "Include serial number, purchase date, and warranty expiration for each appliance.",
  "Water Heater": "Note the tank size, fuel type, serial number, and anode rod replacement date.",
  "Landscaping": "Record irrigation zones, controller model, and winterization schedule.",
  "Pest": "Include contract number, treatment schedule, and any active warranties or bonds.",
  "Paint": "Record the brand, color name, and color code for each room so you can get exact matches for touch-ups.",
};

const maintenanceTemplates: Record<string, SuggestedTask[]> = {
  "HVAC": [
    { title: "Replace HVAC air filter", description: "Dirty filters reduce efficiency and air quality. Replace every 1-3 months depending on usage and filter type.", urgency: "soon", diyLevel: "DIY-Safe", cadence: "quarterly", monthsUntilDue: 1, estimatedCost: "$10-40", safetyWarning: null },
    { title: "Schedule professional HVAC tune-up", description: "Annual professional service extends system life and catches issues early. Best done before peak heating/cooling season.", urgency: "later", diyLevel: "Pro-Only", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$100-200", safetyWarning: null },
    { title: "Clean outdoor condenser unit", description: "Remove debris, leaves, and dirt from around the outdoor unit to maintain airflow and efficiency.", urgency: "later", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 3, estimatedCost: "$0-20", safetyWarning: "Turn off power to the unit before cleaning" },
    { title: "Inspect ductwork for leaks", description: "Leaky ducts waste energy and reduce comfort. Check accessible ductwork for gaps or disconnections.", urgency: "later", diyLevel: "Caution", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$0-50", safetyWarning: null },
    { title: "Test thermostat accuracy", description: "Ensure your thermostat reads the correct temperature and programs are set for efficiency.", urgency: "later", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 3, estimatedCost: "$0", safetyWarning: null },
  ],
  "Roof": [
    { title: "Inspect roof for damage", description: "Check for missing, cracked, or curling shingles and any signs of wear from the ground or with binoculars.", urgency: "later", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 3, estimatedCost: "$0", safetyWarning: "Do not walk on roof without proper safety equipment" },
    { title: "Clean gutters and downspouts", description: "Clogged gutters cause water backup that damages fascia, soffits, and foundation. Clean in spring and fall.", urgency: "soon", diyLevel: "Caution", cadence: "semi-annually", monthsUntilDue: 2, estimatedCost: "$0-150", safetyWarning: "Use a stable ladder and have someone spot you" },
    { title: "Check attic for leaks or moisture", description: "Inspect the underside of the roof from the attic for water stains, mold, or daylight peeking through.", urgency: "later", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$0", safetyWarning: null },
    { title: "Trim overhanging branches", description: "Branches rubbing on the roof damage shingles and provide pest access. Keep a 10-foot clearance.", urgency: "later", diyLevel: "Caution", cadence: "annually", monthsUntilDue: 4, estimatedCost: "$0-300", safetyWarning: "Hire a pro for large or high branches" },
  ],
  "Plumbing": [
    { title: "Check for leaks under sinks", description: "Inspect under all sinks for drips, moisture, or water stains. Small leaks become expensive damage.", urgency: "soon", diyLevel: "DIY-Safe", cadence: "quarterly", monthsUntilDue: 1, estimatedCost: "$0", safetyWarning: null },
    { title: "Test water heater pressure relief valve", description: "The T&P valve is a critical safety device. Test it annually to ensure it operates properly.", urgency: "later", diyLevel: "Caution", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$0", safetyWarning: "Hot water will discharge — keep clear" },
    { title: "Flush water heater tank", description: "Sediment buildup reduces efficiency and tank life. Drain and flush annually.", urgency: "later", diyLevel: "Caution", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$0-30", safetyWarning: "Water will be very hot — use caution" },
    { title: "Inspect toilet for running water", description: "A running toilet wastes water and money. Check flapper, fill valve, and flush mechanism.", urgency: "later", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 3, estimatedCost: "$0-20", safetyWarning: null },
    { title: "Locate and test main water shutoff", description: "Know where your main shutoff is and confirm it works. Essential for emergencies.", urgency: "now", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 0, estimatedCost: "$0", safetyWarning: null },
  ],
  "Electrical": [
    { title: "Test all GFCI outlets", description: "GFCI outlets in kitchens, bathrooms, and outdoor areas protect against shock. Test monthly using the test/reset buttons.", urgency: "soon", diyLevel: "DIY-Safe", cadence: "monthly", monthsUntilDue: 0, estimatedCost: "$0", safetyWarning: null },
    { title: "Test smoke and CO detectors", description: "Press the test button on each detector. Replace batteries annually and units every 10 years.", urgency: "now", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 0, estimatedCost: "$0-30", safetyWarning: null },
    { title: "Check breaker panel for issues", description: "Look for tripped breakers, scorch marks, or unusual warmth. Schedule a pro if anything looks off.", urgency: "later", diyLevel: "Caution", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$0", safetyWarning: "Never touch wires inside the panel" },
    { title: "Inspect outdoor lighting and outlets", description: "Check weatherproof covers, replace burned-out bulbs, and test GFCI protection on outdoor outlets.", urgency: "later", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 3, estimatedCost: "$0-50", safetyWarning: null },
  ],
  "Windows": [
    { title: "Inspect window seals and weatherstripping", description: "Damaged seals let in drafts, moisture, and pests. Check for gaps, condensation between panes, or visible wear.", urgency: "later", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 3, estimatedCost: "$0-50", safetyWarning: null },
    { title: "Clean window tracks and weep holes", description: "Dirt-clogged tracks and weep holes prevent proper drainage and can lead to water damage.", urgency: "later", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 3, estimatedCost: "$0", safetyWarning: null },
    { title: "Check window hardware and locks", description: "Test all latches, cranks, and locks to ensure they operate smoothly and securely.", urgency: "later", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$0-30", safetyWarning: null },
  ],
  "Siding/Exterior": [
    { title: "Inspect siding for damage", description: "Walk the perimeter checking for cracks, warping, loose panels, or pest damage. Catch issues before water gets behind.", urgency: "later", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 3, estimatedCost: "$0", safetyWarning: null },
    { title: "Power wash exterior", description: "Remove dirt, mildew, and algae that degrade siding over time. Improves curb appeal and extends life.", urgency: "later", diyLevel: "Caution", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$50-200", safetyWarning: "Excessive pressure can damage siding" },
    { title: "Check and repair caulking around openings", description: "Re-caulk around windows, doors, and penetrations where old caulk has cracked or pulled away.", urgency: "later", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$10-30", safetyWarning: null },
  ],
  "Foundation": [
    { title: "Inspect foundation for cracks", description: "Walk around the exterior and check interior basement walls for new or widening cracks. Small cracks are normal; monitor growth.", urgency: "later", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 3, estimatedCost: "$0", safetyWarning: null },
    { title: "Check grading and drainage", description: "Ensure soil slopes away from the foundation at least 6 inches over 10 feet. Poor grading causes water intrusion.", urgency: "later", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 4, estimatedCost: "$0-200", safetyWarning: null },
    { title: "Inspect sump pump operation", description: "Pour water into the pit to confirm the pump activates and drains properly. Test the backup battery if applicable.", urgency: "soon", diyLevel: "DIY-Safe", cadence: "quarterly", monthsUntilDue: 1, estimatedCost: "$0", safetyWarning: null },
  ],
  "Appliances": [
    { title: "Clean refrigerator coils", description: "Dusty coils force the compressor to work harder, raising energy costs and shortening lifespan. Clean behind or underneath.", urgency: "later", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 3, estimatedCost: "$0", safetyWarning: "Unplug before cleaning" },
    { title: "Clean dishwasher filter and spray arms", description: "A clogged filter reduces cleaning performance and can cause odors. Remove and rinse monthly.", urgency: "later", diyLevel: "DIY-Safe", cadence: "monthly", monthsUntilDue: 1, estimatedCost: "$0", safetyWarning: null },
    { title: "Deep clean washing machine", description: "Run a hot cycle with cleaning tablets or vinegar to remove detergent buildup and mildew.", urgency: "later", diyLevel: "DIY-Safe", cadence: "monthly", monthsUntilDue: 1, estimatedCost: "$0-10", safetyWarning: null },
    { title: "Clean dryer vent and lint trap", description: "Lint buildup is a fire hazard. Clean the trap after every load and have the vent professionally cleaned annually.", urgency: "soon", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 3, estimatedCost: "$0-150", safetyWarning: "Lint buildup is a leading cause of house fires" },
  ],
  "Water Heater": [
    { title: "Flush water heater tank", description: "Sediment accumulates at the bottom, reducing heating efficiency and shortening tank life.", urgency: "later", diyLevel: "Caution", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$0-30", safetyWarning: "Water will be very hot — use caution" },
    { title: "Test T&P relief valve", description: "The temperature and pressure relief valve is a critical safety device. Lift the lever briefly to verify it releases water.", urgency: "later", diyLevel: "Caution", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$0", safetyWarning: "Hot water will discharge" },
    { title: "Check anode rod", description: "The sacrificial anode rod prevents tank corrosion. Replace when heavily corroded, typically every 3-5 years.", urgency: "later", diyLevel: "Caution", cadence: "every-2-years", monthsUntilDue: 24, estimatedCost: "$20-50", safetyWarning: null },
    { title: "Inspect for leaks around base", description: "Check the base, connections, and relief valve discharge pipe for signs of moisture or dripping.", urgency: "soon", diyLevel: "DIY-Safe", cadence: "quarterly", monthsUntilDue: 1, estimatedCost: "$0", safetyWarning: null },
  ],
  "Landscaping": [
    { title: "Water lawn on schedule", description: "Most lawns need about 1 inch of water per week. Deep, infrequent watering encourages strong roots.", urgency: "soon", diyLevel: "DIY-Safe", cadence: "as-needed", monthsUntilDue: 0, estimatedCost: "$0-50", safetyWarning: null },
    { title: "Fertilize lawn seasonally", description: "Apply appropriate fertilizer in spring and fall to promote healthy growth and crowd out weeds.", urgency: "later", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 2, estimatedCost: "$20-60", safetyWarning: null },
    { title: "Inspect and winterize irrigation system", description: "Before the first freeze, drain and blow out irrigation lines to prevent pipe damage.", urgency: "later", diyLevel: "Caution", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$50-150", safetyWarning: null },
    { title: "Mow lawn to proper height", description: "Keep grass at recommended height for your grass type. Never cut more than one-third of the blade at once.", urgency: "soon", diyLevel: "DIY-Safe", cadence: "as-needed", monthsUntilDue: 0, estimatedCost: "$0-40", safetyWarning: null },
    { title: "Edge beds and walkways", description: "Clean edges improve curb appeal and prevent grass from encroaching into garden beds.", urgency: "later", diyLevel: "DIY-Safe", cadence: "monthly", monthsUntilDue: 1, estimatedCost: "$0", safetyWarning: null },
  ],
  "Chimney": [
    { title: "Schedule annual chimney inspection", description: "A certified chimney sweep should inspect and clean the flue annually to prevent creosote buildup, blockages, and structural issues. Required before each burning season.", urgency: "soon", diyLevel: "Pro-Only", cadence: "annually", monthsUntilDue: 3, estimatedCost: "$150-350", safetyWarning: "Creosote buildup is a leading cause of chimney fires" },
    { title: "Check chimney cap and spark arrestor", description: "Inspect the chimney cap for damage or rust, and ensure the spark arrestor screen is intact. Caps prevent rain, animals, and debris from entering the flue.", urgency: "later", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 3, estimatedCost: "$0-200", safetyWarning: "Inspect from the ground or with binoculars — do not climb on roof without safety equipment" },
    { title: "Inspect flashing and mortar joints", description: "Check the chimney flashing where it meets the roof for gaps or lifting, and look for cracked or missing mortar between bricks. Water intrusion causes expensive damage.", urgency: "later", diyLevel: "Caution", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$0-500", safetyWarning: null },
    { title: "Test fireplace damper operation", description: "Open and close the damper to make sure it moves freely and seals properly. A stuck-open damper wastes heated/cooled air year-round.", urgency: "later", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 6, estimatedCost: "$0", safetyWarning: null },
  ],
  "Pest": [
    { title: "Schedule pest inspection", description: "Annual pest inspection catches infestations early. Critical for termites, rodents, and carpenter ants.", urgency: "soon", diyLevel: "Pro-Only", cadence: "annually", monthsUntilDue: 3, estimatedCost: "$75-200", safetyWarning: null },
    { title: "Seal entry points around home", description: "Inspect and seal gaps around pipes, vents, doors, and foundations where pests can enter.", urgency: "later", diyLevel: "DIY-Safe", cadence: "annually", monthsUntilDue: 3, estimatedCost: "$10-50", safetyWarning: null },
    { title: "Clear vegetation from foundation", description: "Keep mulch, wood, and plants at least 12 inches from the foundation to discourage pest nesting.", urgency: "later", diyLevel: "DIY-Safe", cadence: "semi-annually", monthsUntilDue: 2, estimatedCost: "$0", safetyWarning: null },
  ],
};

const cadenceLabels: Record<string, string> = {
  "monthly": "Every month",
  "quarterly": "Every 3 months",
  "semi-annually": "Every 6 months",
  "annually": "Once a year",
  "every-2-years": "Every 2 years",
  "every-5-years": "Every 5 years",
  "as-needed": "As needed",
};

const urgencyColors: Record<string, string> = {
  "now": "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  "soon": "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  "later": "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  "monitor": "bg-gray-100 text-gray-700 dark:bg-gray-950/40 dark:text-gray-400",
};

export function AddSystemWizard({ isOpen, onClose, homeId, existingSystems = [], initialCategory }: AddSystemWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [showHints, setShowHints] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    category: "",
    name: "",
    installYear: "",
    condition: "Unknown",
    notes: "",
    make: "",
    model: "",
    material: "",
    energyRating: "",
    provider: "",
    treatmentType: "",
    recurrenceInterval: "",
  });

  const [suggestedTasks, setSuggestedTasks] = useState<(SuggestedTask & { approved: boolean })[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [enableRecurring, setEnableRecurring] = useState(true);
  const [createdSystemId, setCreatedSystemId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const countsByType: Record<string, number> = {};
  for (const cat of systemCategories) {
    countsByType[cat] = existingSystems.filter(s => s.category === cat).length;
  }

  const getNextInstanceNumber = (category: string) => {
    return countsByType[category] + 1;
  };

  const initialFormData = {
    category: "",
    name: "",
    installYear: "",
    condition: "Unknown",
    notes: "",
    make: "",
    model: "",
    material: "",
    energyRating: "",
    provider: "",
    treatmentType: "",
    recurrenceInterval: "",
  };

  useEffect(() => {
    if (isOpen) {
      if (initialCategory && systemCategories.includes(initialCategory as any)) {
        const instanceNum = getNextInstanceNumber(initialCategory);
        setFormData({
          ...initialFormData,
          category: initialCategory,
          name: `${initialCategory} ${instanceNum}`,
        });
        setStep(2);
      } else {
        setStep(1);
        setFormData(initialFormData);
      }
      setShowHints(false);
      setIsAnalyzing(false);
      setSavedSystemName("");
      setSuggestedTasks([]);
      setIsLoadingSuggestions(false);
      setEnableRecurring(true);
      setCreatedSystemId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen]);
  
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const result = await identifySystemFromImage(base64);
          
          const validCategory = systemCategories.includes(result.category as any) 
            ? result.category 
            : "";
          
          setFormData(prev => ({
            ...prev,
            category: validCategory || prev.category,
            name: result.name || prev.name,
            make: result.make || prev.make,
            model: result.model || prev.model,
            condition: result.condition || prev.condition,
            material: result.material || prev.material,
            notes: result.notes ? `${prev.notes}${prev.notes ? "\n" : ""}AI: ${result.notes}` : prev.notes,
          }));
          
          if (validCategory) {
            setStep(2);
          }
          
          toast({
            title: "System identified",
            description: result.name ? `Detected: ${result.name}` : "Photo analyzed - please verify details",
          });
        } catch (error) {
          toast({
            title: "Analysis failed",
            description: "Could not identify the system. Please select a category manually.",
            variant: "destructive",
          });
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsAnalyzing(false);
      toast({
        title: "Error",
        description: "Failed to process image",
        variant: "destructive",
      });
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const [savedSystemName, setSavedSystemName] = useState("");

  const loadMaintenanceSuggestions = async (category: string, name: string, notes?: string) => {
    setIsLoadingSuggestions(true);
    try {
      const templates = maintenanceTemplates[category];
      if (templates && templates.length > 0) {
        setSuggestedTasks(templates.map(t => ({ ...t, approved: true })));
      } else {
        const aiTasks = await suggestMaintenanceTasks(name, category, notes, createdSystemId || undefined);
        setSuggestedTasks(aiTasks.map(t => ({ ...t, approved: true })));
      }
    } catch (error) {
      setSuggestedTasks([]);
      toast({
        title: "Could not load suggestions",
        description: "You can still add maintenance tasks manually later.",
      });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => createSystem(homeId, {
      category: data.category,
      name: data.name,
      installYear: data.installYear ? parseInt(data.installYear) : undefined,
      condition: data.category === "Pest" ? undefined : data.condition,
      notes: data.notes || undefined,
      make: data.make || undefined,
      model: data.model || undefined,
      material: data.material || undefined,
      energyRating: data.energyRating || undefined,
      provider: data.provider || undefined,
      treatmentType: data.treatmentType || undefined,
      recurrenceInterval: data.recurrenceInterval || undefined,
      source: "manual",
    } as any),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["systems", homeId] });
      trackEvent("system_instance_created", "systems", formData.category);
      setSavedSystemName(formData.name);
      setCreatedSystemId(result?.id || result?.systemId || null);
      loadMaintenanceSuggestions(formData.category, formData.name, formData.notes);
      setStep(4);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not add system.", variant: "destructive" });
    },
  });

  const tasksMutation = useMutation({
    mutationFn: async () => {
      const approved = suggestedTasks.filter(t => t.approved);
      if (approved.length === 0) return [];
      
      const now = new Date();
      const tasksToCreate = approved.map(t => {
        const dueDate = new Date(now);
        dueDate.setMonth(dueDate.getMonth() + t.monthsUntilDue);
        
        return {
          title: t.title,
          systemId: createdSystemId || undefined,
          dueAt: dueDate.toISOString(),
          estimates: {
            description: t.description,
            urgency: t.urgency,
            diyLevel: t.diyLevel,
            category: formData.category,
            estimatedCost: t.estimatedCost,
            safetyWarning: t.safetyWarning,
            createdFrom: "maintenance-schedule",
            isRecurring: enableRecurring,
            recurrenceCadence: enableRecurring ? t.cadence : null,
            namespacePrefix: (t as any).namespacePrefix || undefined,
          },
        };
      });
      
      return createTasksBatch(homeId, tasksToCreate);
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      const count = results?.length || 0;
      trackEvent("maintenance_schedule_created", "systems", formData.category);
      toast({
        title: `${count} task${count !== 1 ? 's' : ''} added`,
        description: enableRecurring 
          ? "Tasks have been added to your maintenance schedule with recurring reminders." 
          : "Tasks have been added to your to-do list.",
      });
      setStep(5);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not create tasks. You can add them manually later.", variant: "destructive" });
      setStep(5);
    },
  });

  const handleClose = () => {
    onClose();
  };

  const showsCondition = (cat: string) => !["Pest"].includes(cat);
  const showsMakeModel = (cat: string) => ["HVAC", "Appliances", "Water Heater"].includes(cat);
  const showsMaterial = (cat: string) => ["Roof", "Windows", "Siding/Exterior", "Foundation", "Chimney"].includes(cat);
  const showsEnergyRating = (cat: string) => ["HVAC", "Windows", "Water Heater"].includes(cat);
  const showsPestFields = (cat: string) => cat === "Pest";

  const handleCategorySelect = (category: string) => {
    const count = countsByType[category] || 0;
    const instanceNum = getNextInstanceNumber(category);
    const autoName = `${category} ${instanceNum}`;
    setFormData({ ...formData, category, name: autoName });
    trackEvent("system_instance_add_started", "systems", category);
    if (count > 0) {
      setStep(1.5);
    } else {
      setStep(2);
    }
  };

  const handleSubmit = () => {
    createMutation.mutate(formData);
  };

  const toggleTaskApproval = (index: number) => {
    setSuggestedTasks(prev => prev.map((t, i) => 
      i === index ? { ...t, approved: !t.approved } : t
    ));
  };

  const approvedCount = suggestedTasks.filter(t => t.approved).length;

  const getStepTitle = () => {
    if (step === 5) return "Success!";
    if (step === 4) return "Maintenance Schedule";
    if (step === 1.5) return `${formData.category} Systems`;
    return "Add Home System";
  };

  const getStepDescription = () => {
    if (step === 1) return "Choose the type of system you want to add.";
    if (step === 1.5) return `You already have ${countsByType[formData.category]} ${formData.category} system${countsByType[formData.category] > 1 ? "s" : ""}. Would you like to review them or add another?`;
    if (step === 2) return `Adding details for ${formData.name}.`;
    if (step === 3) return "Review and save.";
    if (step === 4) return `We recommend these maintenance tasks for your ${savedSystemName}. Select the ones you'd like to add.`;
    if (step === 5) return "Your system and maintenance tasks are set up.";
    return "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
              data-testid="input-photo-capture"
            />
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Select a category</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowHints(!showHints)}
                className="text-xs"
              >
                <Info className="h-3 w-3 mr-1" />
                {showHints ? "Hide tips" : "Where to find"}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {systemCategories.map((category) => {
                const Icon = categoryIcons[category] || HelpCircle;
                const count = countsByType[category] || 0;
                return (
                  <button
                    key={category}
                    onClick={() => handleCategorySelect(category)}
                    disabled={isAnalyzing}
                    className="relative flex flex-col items-center gap-2 p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                    data-testid={`button-category-${category.toLowerCase().replace(/\//g, "-")}`}
                  >
                    {count > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center" data-testid={`badge-count-${category.toLowerCase().replace(/\//g, "-")}`}>
                        {count}
                      </span>
                    )}
                    <Icon className="h-6 w-6 text-primary" />
                    <span className="text-xs text-center font-medium">{category}</span>
                  </button>
                );
              })}
            </div>
            {showHints && (
              <Card className="p-4 bg-muted/30 border-muted">
                <p className="text-sm font-medium mb-2">Where to find system info:</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {Object.entries(categoryHints).slice(0, 6).map(([cat, hint]) => (
                    <li key={cat}>
                      <span className="font-medium text-foreground">{cat}:</span> {hint}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="w-full gap-2"
                data-testid="button-photo-identify"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing photo...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    <Sparkles className="h-3 w-3" />
                    Can't find it? Take a photo
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                AI will identify the system and auto-fill details
              </p>
            </div>
          </div>
        )}

        {step === 1.5 && (
          <div className="space-y-4">
            <div className="space-y-3">
              {existingSystems
                .filter(s => s.category === formData.category)
                .map((sys) => (
                  <div
                    key={sys.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    data-testid={`card-existing-system-${sys.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{sys.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[sys.make, sys.model, sys.condition].filter(Boolean).join(" · ") || "No details"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onClose();
                        navigate(`/systems/${sys.id}`);
                      }}
                      data-testid={`button-review-system-${sys.id}`}
                    >
                      Review
                    </Button>
                  </div>
                ))}
            </div>
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="button-back-to-categories">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setStep(2)} data-testid="button-add-new-instance">
                <Plus className="h-4 w-4 mr-2" />
                Add New {formData.category}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">{formData.category}</Badge>
              <span className="text-xs text-muted-foreground">{categoryHints[formData.category]}</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1">System Name <FieldTooltip termSlug="system-category" screenName="add-system" /></Label>
              <Input
                id="name"
                placeholder={`e.g., Main ${formData.category} - Carrier`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-system-name"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="installYear" className="flex items-center gap-1">Install Year <span className="text-muted-foreground text-xs">(opt.)</span> <FieldTooltip termSlug="install-year" screenName="add-system" /></Label>
                <Input
                  id="installYear"
                  type="number"
                  placeholder="2015"
                  value={formData.installYear}
                  onChange={(e) => setFormData({ ...formData, installYear: e.target.value })}
                  data-testid="input-install-year"
                />
              </div>
              {showsCondition(formData.category) && (
                <div className="space-y-2">
                  <Label htmlFor="condition" className="flex items-center gap-1">Condition <FieldTooltip termSlug="system-condition" screenName="add-system" /></Label>
                  <Select value={formData.condition} onValueChange={(v) => setFormData({ ...formData, condition: v })}>
                    <SelectTrigger data-testid="select-condition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {systemConditions.map((cond) => (
                        <SelectItem key={cond} value={cond}>{cond}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            {showsMakeModel(formData.category) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="make" className="flex items-center gap-1">Make/Brand <FieldTooltip termSlug="make-brand" screenName="add-system" /></Label>
                  <Input
                    id="make"
                    placeholder="e.g., Carrier, Lennox"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    data-testid="input-make"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model" className="flex items-center gap-1">Model <FieldTooltip termSlug="system-model" screenName="add-system" /></Label>
                  <Input
                    id="model"
                    placeholder="Model number"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    data-testid="input-model"
                  />
                </div>
              </div>
            )}
            
            {showsMaterial(formData.category) && (
              <div className="space-y-2">
                <Label htmlFor="material" className="flex items-center gap-1">Material <FieldTooltip termSlug="system-material" screenName="add-system" /></Label>
                <Input
                  id="material"
                  placeholder={formData.category === "Roof" ? "e.g., Asphalt Shingle, Metal" : formData.category === "Chimney" ? "e.g., Brick, Stone, Metal" : "e.g., Vinyl, Wood, Aluminum"}
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  data-testid="input-material"
                />
              </div>
            )}
            
            {showsEnergyRating(formData.category) && (
              <div className="space-y-2">
                <Label htmlFor="energyRating" className="flex items-center gap-1">Energy Rating <span className="text-muted-foreground text-xs">(opt.)</span> <FieldTooltip termSlug="energy-rating" screenName="add-system" /></Label>
                <Input
                  id="energyRating"
                  placeholder="e.g., SEER 16, Energy Star"
                  value={formData.energyRating}
                  onChange={(e) => setFormData({ ...formData, energyRating: e.target.value })}
                  data-testid="input-energy-rating"
                />
              </div>
            )}
            
            {showsPestFields(formData.category) && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="provider">Pest Control Provider</Label>
                  <Input
                    id="provider"
                    placeholder="e.g., Terminix, Orkin, local company"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    data-testid="input-provider"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="treatmentType">Treatment Type</Label>
                    <Input
                      id="treatmentType"
                      placeholder="e.g., Termite, General Pest"
                      value={formData.treatmentType}
                      onChange={(e) => setFormData({ ...formData, treatmentType: e.target.value })}
                      data-testid="input-treatment-type"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurrenceInterval" className="flex items-center gap-1">Service Frequency <FieldTooltip termSlug="service-cadence" screenName="add-system" /></Label>
                    <Select value={formData.recurrenceInterval} onValueChange={(v) => setFormData({ ...formData, recurrenceInterval: v })}>
                      <SelectTrigger data-testid="select-recurrence">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="biannual">Twice a year</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="one-time">One-time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder={notesPlaceholders[formData.category] || "Serial number, warranty info, or any relevant details..."}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                data-testid="input-notes"
              />
              {notesHints[formData.category] && (
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  {notesHints[formData.category]}
                </p>
              )}
            </div>
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!formData.name}>
                Review
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Card className="p-4 bg-muted/30">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = categoryIcons[formData.category] || HelpCircle;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  <span className="font-medium">{formData.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <span className="ml-2">{formData.category}</span>
                  </div>
                  {showsCondition(formData.category) && (
                    <div>
                      <span className="text-muted-foreground">Condition:</span>
                      <span className="ml-2">{formData.condition}</span>
                    </div>
                  )}
                  {formData.installYear && (
                    <div>
                      <span className="text-muted-foreground">Installed:</span>
                      <span className="ml-2">{formData.installYear}</span>
                    </div>
                  )}
                  {formData.make && (
                    <div>
                      <span className="text-muted-foreground">Make:</span>
                      <span className="ml-2">{formData.make}</span>
                    </div>
                  )}
                  {formData.model && (
                    <div>
                      <span className="text-muted-foreground">Model:</span>
                      <span className="ml-2">{formData.model}</span>
                    </div>
                  )}
                  {formData.material && (
                    <div>
                      <span className="text-muted-foreground">Material:</span>
                      <span className="ml-2">{formData.material}</span>
                    </div>
                  )}
                  {formData.energyRating && (
                    <div>
                      <span className="text-muted-foreground">Energy:</span>
                      <span className="ml-2">{formData.energyRating}</span>
                    </div>
                  )}
                  {formData.provider && (
                    <div>
                      <span className="text-muted-foreground">Provider:</span>
                      <span className="ml-2">{formData.provider}</span>
                    </div>
                  )}
                  {formData.treatmentType && (
                    <div>
                      <span className="text-muted-foreground">Treatment:</span>
                      <span className="ml-2">{formData.treatmentType}</span>
                    </div>
                  )}
                  {formData.recurrenceInterval && (
                    <div>
                      <span className="text-muted-foreground">Frequency:</span>
                      <span className="ml-2">{formData.recurrenceInterval}</span>
                    </div>
                  )}
                </div>
                {formData.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="mt-1 text-foreground">{formData.notes}</p>
                  </div>
                )}
              </div>
            </Card>
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-save-system">
                {createMutation.isPending ? "Saving..." : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Add System
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-300">
                <span className="font-medium">{savedSystemName}</span> has been added to your home.
              </p>
            </div>

            {isLoadingSuggestions ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {formData.category === "Other" 
                    ? "AI is researching maintenance best practices..." 
                    : "Loading recommended maintenance tasks..."}
                </p>
              </div>
            ) : suggestedTasks.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      {approvedCount} of {suggestedTasks.length} tasks selected
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const allApproved = suggestedTasks.every(t => t.approved);
                      setSuggestedTasks(prev => prev.map(t => ({ ...t, approved: !allApproved })));
                    }}
                    data-testid="button-toggle-all-tasks"
                  >
                    {suggestedTasks.every(t => t.approved) ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {suggestedTasks.map((task, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        task.approved 
                          ? "bg-primary/5 border-primary/30" 
                          : "bg-muted/20 border-muted opacity-60"
                      }`}
                      onClick={() => toggleTaskApproval(index)}
                      data-testid={`card-suggested-task-${index}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          task.approved 
                            ? "bg-primary border-primary text-primary-foreground" 
                            : "border-muted-foreground/30"
                        }`}>
                          {task.approved && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{task.title}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${urgencyColors[task.urgency]}`}>
                              {task.urgency}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {cadenceLabels[task.cadence] || task.cadence}
                            </span>
                            <span>{task.estimatedCost}</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">{task.diyLevel}</Badge>
                          </div>
                          {task.safetyWarning && (
                            <div className="flex items-center gap-1 mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>{task.safetyWarning}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Recurring schedule</p>
                      <p className="text-xs text-muted-foreground">Automatically remind you based on each task's cadence</p>
                    </div>
                  </div>
                  <Switch
                    checked={enableRecurring}
                    onCheckedChange={setEnableRecurring}
                    data-testid="switch-recurring"
                  />
                </div>

                <p className="text-xs text-muted-foreground text-center italic">
                  These are general best-practice recommendations. Adjust based on your specific system and local conditions.
                </p>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  No maintenance tasks to suggest for this system type.
                </p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(5)} data-testid="button-skip-tasks">
                Skip
              </Button>
              <Button 
                onClick={() => tasksMutation.mutate()} 
                disabled={approvedCount === 0 || tasksMutation.isPending}
                data-testid="button-add-tasks"
              >
                {tasksMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding tasks...
                  </>
                ) : (
                  <>
                    <ListChecks className="h-4 w-4 mr-2" />
                    Add {approvedCount} Task{approvedCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {savedSystemName} Added!
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Your system has been added to your home profile. You can view and manage it from the dashboard.
              </p>
            </div>
            
            <div className="flex flex-col gap-2 pt-4">
              <Button onClick={handleClose} data-testid="button-done-success">
                Done
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setStep(1)}
                data-testid="button-add-another"
              >
                Add Another System
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
