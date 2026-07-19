"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, Bot, BrainCircuit, CheckCircle2, CircleGauge, LoaderCircle, Route, Sparkles, Target } from "lucide-react";
import { adviseLead, analyzePipeline, generateCustomProject } from "@/lib/ai";
import type { AiLeadAdvice, AiPipelineAnalysis, AiProjectDraft } from "@/lib/ai";
import type { Opportunity, Unit } from "@/lib/types";

type Mode = "project" | "pipeline" | "lead";

export function AICopilot({ units, opportunities, initialOpportunityId, onApplyProject }: {
  units: Unit[];
  opportunities: Opportunity[];
  initialOpportunityId?: string | null;
  onApplyProject: (draft: AiProjectDraft, unitId: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>(initialOpportunityId ? "lead" : "project");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [leadId, setLeadId] = useState(initialOpportunityId ?? opportunities[0]?.id ?? "");
  const [project, setProject] = useState<AiProjectDraft | null>(null);
  const [pipeline, setPipeline] = useState<AiPipelineAnalysis | null>(null);
  const [lead, setLead] = useState<AiLeadAdvice | null>(null);

  async function run<T>(request: () => Promise<T>, commit: (result: T) => void) {
    setBusy(true); setError("");
    try { commit(await request()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "A IA não concluiu a análise."); }
    finally { setBusy(false); }
  }

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() => generateCustomProject({
      unit_id: unitId,
      challenge: String(form.get("challenge")),
      objective: String(form.get("objective")),
      duration_weeks: Number(form.get("duration_weeks")),
      constraints: String(form.get("constraints") || ""),
    }), setProject);
  }

  async function applyProject() {
    if (!project || !unitId) return;
    setApplying(true); setError("");
    try { await onApplyProject(project, unitId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar o projeto."); }
    finally { setApplying(false); }
  }

  return <section className="ai-shell">
    <div className="panel ai-hero"><span className="ai-orb"><Bot size={28} /></span><div><span className="eyebrow">COPILOTO TUTOREANOS</span><h2>Inteligência aplicada à sua operação</h2><p>A IA usa apenas os dados do seu CRM para estruturar projetos, identificar gargalos e orientar o próximo movimento comercial. Você sempre revisa antes de aplicar.</p></div><span className="ai-status"><i /> IA disponível</span></div>
    <nav className="ai-tabs">
      <button className={mode === "project" ? "active" : ""} onClick={() => setMode("project")}><Route size={17} /><span><strong>Projeto sob medida</strong><small>Escopo, atividades e KPIs</small></span></button>
      <button className={mode === "pipeline" ? "active" : ""} onClick={() => setMode("pipeline")}><BarChart3 size={17} /><span><strong>Análise do pipeline</strong><small>Gargalos e prioridades</small></span></button>
      <button className={mode === "lead" ? "active" : ""} onClick={() => setMode("lead")}><Target size={17} /><span><strong>Próximo passo do lead</strong><small>Recomendação contextual</small></span></button>
    </nav>
    {error && <div className="ai-error"><AlertTriangle size={16} /> {error}</div>}

    {mode === "project" && <div className="ai-workspace"><form className="panel ai-form" onSubmit={submitProject}><div><span className="eyebrow">ARQUITETO DE PROJETOS</span><h2>Desenhar programa personalizado</h2><p>Descreva o resultado esperado. O copiloto combina o contexto da unidade com práticas de consultoria empresarial.</p></div><label>Unidade<select value={unitId} required onChange={(event) => setUnitId(event.target.value)}><option value="">Selecione</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label>Desafio principal<textarea name="challenge" required rows={3} placeholder="Ex.: baixa previsibilidade comercial e pouca disciplina de acompanhamento" /></label><label>Objetivo do acompanhamento<textarea name="objective" required rows={3} placeholder="Ex.: estruturar uma operação comercial previsível e elevar a conversão" /></label><div className="form-row"><label>Duração<select name="duration_weeks" defaultValue="12"><option value="8">8 semanas</option><option value="12">12 semanas</option><option value="16">16 semanas</option><option value="20">20 semanas</option><option value="24">24 semanas</option></select></label><label>Restrições ou contexto<input name="constraints" placeholder="Equipe, orçamento, prazo, maturidade..." /></label></div><button className="primary-button ai-run" disabled={busy || !unitId}>{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{busy ? "Montando projeto" : "Gerar projeto sob medida"}</button></form>{project ? <ProjectResult draft={project} applying={applying} onApply={() => void applyProject()} /> : <AIPlaceholder icon={<BrainCircuit size={28} />} title="Seu projeto aparecerá aqui" text="A IA entregará fases, atividades, Matriz GUT, indicadores e riscos prontos para revisão." />}</div>}

    {mode === "pipeline" && <div className="ai-workspace single"><section className="panel ai-command"><div><span className="eyebrow">INTELIGÊNCIA COMERCIAL</span><h2>Diagnóstico do pipeline</h2><p>Analise volume, valor, aging, atividades e distribuição entre etapas usando os dados atuais.</p></div><button className="primary-button" disabled={busy || !opportunities.length} onClick={() => void run(analyzePipeline, setPipeline)}>{busy ? <LoaderCircle className="spin" size={17} /> : <BarChart3 size={17} />} Analisar pipeline agora</button></section>{pipeline ? <PipelineResult analysis={pipeline} /> : <AIPlaceholder icon={<CircleGauge size={28} />} title="Nenhuma análise gerada" text={opportunities.length ? "Clique em analisar para receber uma leitura executiva e prioridades práticas." : "Cadastre oportunidades para gerar inteligência comercial."} />}</div>}

    {mode === "lead" && <div className="ai-workspace single"><section className="panel ai-command"><div><span className="eyebrow">COACH COMERCIAL</span><h2>Próximo melhor movimento</h2><p>Selecione o lead. A IA considera etapa, contato, valor, prazo, histórico e atividades relacionadas.</p></div><div className="ai-lead-picker"><select value={leadId} onChange={(event) => setLeadId(event.target.value)}><option value="">Selecione um lead</option>{opportunities.map((item) => <option value={item.id} key={item.id}>{item.company} · {item.stage}</option>)}</select><button className="primary-button" disabled={busy || !leadId} onClick={() => void run(() => adviseLead(leadId), setLead)}>{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Recomendar ação</button></div></section>{lead ? <LeadResult advice={lead} /> : <AIPlaceholder icon={<Target size={28} />} title="Selecione uma oportunidade" text="Você receberá uma ação recomendada, perguntas de qualificação, riscos e uma mensagem de follow-up sugerida." />}</div>}
  </section>;
}

function ProjectResult({ draft, applying, onApply }: { draft: AiProjectDraft; applying: boolean; onApply: () => void }) {
  return <section className="panel ai-result"><div className="ai-result-head"><div><span className="eyebrow">PROJETO PROPOSTO</span><h2>{draft.name}</h2><p>{draft.executive_summary}</p></div><button className="primary-button" disabled={applying} onClick={onApply}>{applying ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}{applying ? "Criando" : "Criar na unidade"}</button></div><div className="ai-result-metrics"><span><strong>{draft.duration_weeks}</strong><small>semanas</small></span><span><strong>{draft.phases.length}</strong><small>etapas</small></span><span><strong>{draft.phases.reduce((sum, phase) => sum + phase.activities.length, 0)}</strong><small>atividades</small></span><span><strong>{draft.kpis.length}</strong><small>KPIs</small></span></div><p className="ai-objective"><strong>Objetivo</strong>{draft.objective}</p><div className="ai-phase-list">{draft.phases.map((phase, index) => <article key={`${index}-${phase.name}`}><i>{index + 1}</i><span><strong>{phase.name}</strong><small>{phase.objective}</small><em>{phase.activities.length} atividades</em></span></article>)}</div><div className="ai-kpi-list"><h3>Indicadores sugeridos</h3>{draft.kpis.map((kpi) => <span key={kpi.name}><CheckCircle2 size={14} /><span><strong>{kpi.name}</strong><small>{kpi.description}</small></span></span>)}</div></section>;
}

function PipelineResult({ analysis }: { analysis: AiPipelineAnalysis }) {
  return <section className="panel ai-result"><div className="ai-result-head"><div><span className="eyebrow">LEITURA EXECUTIVA</span><h2>{analysis.headline}</h2><p>{analysis.summary}</p></div><span className="ai-score"><strong>{analysis.health_score}</strong><small>saúde / 100</small></span></div><div className="ai-insight-grid">{analysis.findings.map((finding) => <article className={finding.impact} key={finding.title}><span>{finding.impact === "high" ? <AlertTriangle size={16} /> : <CircleGauge size={16} />}</span><strong>{finding.title}</strong><p>{finding.evidence}</p></article>)}</div><div className="ai-action-list"><h3>Prioridades recomendadas</h3>{analysis.actions.sort((a, b) => a.priority - b.priority).map((item) => <article key={item.priority}><i>{item.priority}</i><span><strong>{item.action}</strong><small>{item.reason}</small></span><ArrowRight size={14} /></article>)}</div></section>;
}

function LeadResult({ advice }: { advice: AiLeadAdvice }) {
  return <section className="panel ai-result"><div className="ai-result-head"><div><span className="eyebrow">RECOMENDAÇÃO DO COPILOTO</span><h2>{advice.headline}</h2><p>{advice.summary}</p></div><span className="ai-score"><strong>{advice.qualification_score}</strong><small>qualificação</small></span></div><div className="ai-next-action"><Sparkles size={20} /><span><small>PRÓXIMO MELHOR PASSO</small><strong>{advice.next_best_action}</strong><em>Prazo sugerido: {advice.suggested_due_days === 0 ? "hoje" : `${advice.suggested_due_days} dia(s)`}</em></span></div><div className="ai-lead-columns"><div><h3>Perguntas para avançar</h3>{advice.questions_to_ask.map((question) => <p key={question}><CheckCircle2 size={13} /> {question}</p>)}</div><div><h3>Informações faltantes</h3>{advice.missing_information.map((item) => <p key={item}><AlertTriangle size={13} /> {item}</p>)}</div></div><div className="ai-message"><span className="eyebrow">MENSAGEM SUGERIDA</span><p>{advice.suggested_message}</p></div></section>;
}

function AIPlaceholder({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="panel ai-placeholder"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>;
}
