"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Save, 
  ChevronDown,
  Info,
  Sparkles,
  Type,
  Baseline,
  CaseSensitive,
  ALargeSmall,
  Eraser
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { templateApi } from "@/services/api";
import { extractApiError } from "@/lib/utils";

const AVAILABLE_VARIABLES = [
  { label: "Campaign Name", value: "campaign_name" },
  { label: "Ad Set Name", value: "adset_name" },
  { label: "Ad Name", value: "ad_name" },
  { label: "Date", value: "date" },
  { label: "Time", value: "time" },
  { label: "Budget", value: "budget" },
  { label: "Country", value: "country" },
  { label: "Placement", value: "placement" },
  { label: "Objective", value: "objective" },
  { label: "Iteration #", value: "iteration_number" },
  { label: "Angle", value: "angle" },
  { label: "Ad Account", value: "ad_account_name" },
  { label: "Custom Text", value: "custom_text" },
];

const TRANSFORMS = [
  { label: "UPPERCASE", value: "upper", icon: <Type className="w-3 h-3" /> },
  { label: "lowercase", value: "lower", icon: <Baseline className="w-3 h-3" /> },
  { label: "snake_case", value: "snake", icon: <CaseSensitive className="w-3 h-3" /> },
  { label: "camelCase", value: "camel", icon: <ALargeSmall className="w-3 h-3" /> },
  { label: "PascalCase", value: "pascal", icon: <ALargeSmall className="w-3 h-3" /> },
];

interface NamingTemplateEditorProps {
  onPatternChange: (pattern: string) => void;
  initialPattern?: string;
  type: "CAMPAIGN" | "ADSET" | "AD" | "ALL";
}

export const NamingTemplateEditor = ({ onPatternChange, initialPattern, type }: NamingTemplateEditorProps) => {
  const [pattern, setPattern] = useState(initialPattern || "{{campaign_name}} - Copy");
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await templateApi.getTemplates();
      setTemplates(response.data);
    } catch (error) {
      console.error("Failed to fetch templates");
    }
  };

  const insertVariable = (variable: string, transform?: string) => {
    const placeholder = transform ? `{{${variable}|${transform}}}` : `{{${variable}}}`;
    const newPattern = `${pattern}${placeholder}`;
    setPattern(newPattern);
    onPatternChange(newPattern);
  };

  const saveTemplate = async () => {
    const name = prompt("Enter a name for this template:");
    if (!name) return;

    try {
      await templateApi.createTemplate({
        name,
        pattern,
        type,
        isDefault: false
      });
      toast.success("Template saved!");
      fetchTemplates();
    } catch (error: any) {
      toast.error(extractApiError(error, "Couldn't save the template. The name may already be in use."));
    }
  };

  const selectTemplate = (p: string) => {
    setPattern(p);
    onPatternChange(p);
  };

  return (
    <div className="space-y-4 bg-gray-950 p-4 rounded-xl border border-gray-800">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          Naming Engine
        </Label>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-3 py-2 gap-1 border border-gray-800 bg-transparent text-gray-400">
            Presets <ChevronDown className="w-3 h-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-900 border-gray-800 text-gray-100">
            <DropdownMenuGroup>
              {templates.length === 0 && (
                <div className="p-2 text-xs text-gray-500 italic">No saved templates</div>
              )}
              {templates.map((t) => (
                <DropdownMenuItem 
                  key={t.id} 
                  onClick={() => selectTemplate(t.pattern)}
                  className="hover:bg-gray-800 cursor-pointer"
                >
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex gap-2">
        <Input 
          value={pattern}
          onChange={(e) => {
            setPattern(e.target.value);
            onPatternChange(e.target.value);
          }}
          className="bg-gray-900 border-gray-800 focus:border-blue-500 font-mono text-sm h-10"
          placeholder="{{country}}-{{angle}}-{{date}}"
        />
        <Button 
          variant="outline" 
          onClick={saveTemplate}
          className="border-gray-800 hover:bg-gray-800 h-10 px-3"
        >
          <Save className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_VARIABLES.map((v) => (
            <DropdownMenu key={v.value}>
              <DropdownMenuTrigger className="px-2 py-1 text-[10px] bg-blue-900/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-900/30 transition-colors flex items-center gap-1">
                {v.label} <Plus className="w-2 h-2" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-900 border-gray-800 text-gray-100">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => insertVariable(v.value)} className="text-xs">
                    Standard: {`{{${v.value}}}`}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  {TRANSFORMS.map((t) => (
                    <DropdownMenuItem key={t.value} onClick={() => insertVariable(v.value, t.value)} className="text-xs gap-2">
                      {t.icon} {t.label}: {`{{${v.value}|${t.value}}}`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-gray-900 flex items-center justify-between">
        <p className="text-[10px] text-gray-500 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Select a variable and choose a format.
        </p>
        <button 
          onClick={() => { setPattern(""); onPatternChange(""); }}
          className="text-[10px] text-red-500 hover:underline flex items-center gap-1"
        >
          <Eraser className="w-3 h-3" /> Clear
        </button>
      </div>
    </div>
  );
};
