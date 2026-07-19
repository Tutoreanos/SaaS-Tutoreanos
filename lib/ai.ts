import { supabase } from "./supabase";

export type AiProjectDraft = {
  name: string;
  objective: string;
  executive_summary: string;
  duration_weeks: number;
  phases: Array<{
    name: string;
    objective: string;
    activities: Array<{ title: string; description: string; owner: string; week: number; gut: [number, number, number] }>;
  }>;
  kpis: Array<{
    name: string;
    description: string;
    category: string;
    unit: "number" | "percent" | "currency" | "days" | "hours" | "score";
    direction: "increase" | "decrease" | "maintain";
    baseline: number;
    target: number;
    frequency: "weekly" | "biweekly" | "monthly" | "quarterly";
  }>;
  risks: Array<{ risk: string; mitigation: string; severity: "low" | "medium" | "high" }>;
};

export type AiPipelineAnalysis = {
  headline: string;
  summary: string;
  health_score: number;
  findings: Array<{ title: string; evidence: string; impact: "low" | "medium" | "high" }>;
  actions: Array<{ action: string; reason: string; priority: number }>;
  metrics: Array<{ label: string; value: string; interpretation: string }>;
};

export type AiLeadAdvice = {
  headline: string;
  summary: string;
  qualification_score: number;
  next_best_action: string;
  suggested_message: string;
  suggested_due_days: number;
  risks: string[];
  missing_information: string[];
  questions_to_ask: string[];
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai-copilot", { body });
  if (error) {
    const context = "context" in error ? error.context : null;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: string };
        if (payload.error) throw new Error(payload.error);
      } catch (cause) {
        if (cause instanceof Error && cause.message !== "Unexpected end of JSON input") throw cause;
      }
    }
    throw new Error(error.message || "A IA não conseguiu concluir esta análise.");
  }
  return data as T;
}

export function generateCustomProject(input: { unit_id: string; challenge: string; objective: string; duration_weeks: number; constraints: string }) {
  return invoke<AiProjectDraft>({ action: "custom_project", ...input });
}

export function analyzePipeline() {
  return invoke<AiPipelineAnalysis>({ action: "pipeline_analysis" });
}

export function adviseLead(opportunityId: string) {
  return invoke<AiLeadAdvice>({ action: "lead_advice", opportunity_id: opportunityId });
}
