"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, CalendarDays,
  CheckCircle2, CircleGauge, Clock3, Layers3, Pencil, Plus, Route, Save,
  Search, Sparkles, Target, Trash2, TrendingUp, UserRound, X,
} from "lucide-react";
import type {
  ConsultingProgram, KpiDirection, KpiFrequency, KpiMeasurement, KpiUnit,
  ProgramStatus, ProjectItem, ProjectItemInput, ProjectItemStatus, ProjectKpi,
  ProjectKpiInput, Unit,
} from "@/lib/types";

const projectColumns: { id: Exclude<ProgramStatus, "cancelled">; label: string; hint: string }[] = [
  { id: "planning", label: "Planejamento", hint: "Escopo e preparação" },
  { id: "active", label: "Em andamento", hint: "Execução em campo" },
  { id: "at_risk", label: "Em risco", hint: "Requer intervenção" },
  { id: "paused", label: "Pausado", hint: "Aguardando retomada" },
  { id: "completed", label: "Concluído", hint: "Histórico de entregas" },
];

const itemColumns: { id: ProjectItemStatus; label: string; hint: string }[] = [
  { id: "backlog", label: "Backlog", hint: "Ideias e demandas" },
  { id: "planned", label: "Planejado", hint: "Próximas ações" },
  { id: "in_progress", label: "Em execução", hint: "Trabalho em curso" },
  { id: "waiting", label: "Aguardando", hint: "Dependência externa" },
  { id: "done", label: "Concluído", hint: "Entregas finalizadas" },
];

const programStatusLabel: Record<ProgramStatus, string> = {
  planning: "Planejamento", active: "Em andamento", at_risk: "Em risco",
  paused: "Pausado", completed: "Concluído", cancelled: "Cancelado",
};

const itemStatusLabel: Record<ProjectItemStatus, string> = {
  backlog: "Backlog", planned: "Planejado", in_progress: "Em execução",
  waiting: "Aguardando", done: "Concluído",
};

const itemKindLabel = { action: "Ação", deliverable: "Entrega", milestone: "Marco" } as const;
const frequencyLabel: Record<KpiFrequency, string> = { weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal", quarterly: "Trimestral" };
const directionLabel: Record<KpiDirection, string> = { increase: "Aumentar", decrease: "Reduzir", maintain: "Manter próximo da meta" };
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const moneyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const kpiPresets: { key: string; name: string; category: string; description: string; unit: KpiUnit; direction: KpiDirection }[] = [
  { key: "qualified_leads", name: "Leads qualificados", category: "Comercial", description: "Oportunidades aderentes ao perfil ideal geradas no período.", unit: "number", direction: "increase" },
  { key: "conversion_rate", name: "Taxa de conversão", category: "Comercial", description: "Percentual de oportunidades convertidas em clientes.", unit: "percent", direction: "increase" },
  { key: "sales_cycle", name: "Ciclo médio de vendas", category: "Comercial", description: "Tempo médio entre a oportunidade e o fechamento.", unit: "days", direction: "decrease" },
  { key: "average_ticket", name: "Ticket médio", category: "Financeiro", description: "Valor médio dos contratos fechados pela unidade.", unit: "currency", direction: "increase" },
  { key: "portfolio_revenue", name: "Receita da carteira", category: "Carteira", description: "Receita recorrente gerada pela carteira de consultoria.", unit: "currency", direction: "increase" },
  { key: "active_clients", name: "Clientes ativos", category: "Carteira", description: "Quantidade de clientes ativos na carteira acompanhada.", unit: "number", direction: "increase" },
  { key: "retention_rate", name: "Retenção da carteira", category: "Carteira", description: "Percentual de clientes mantidos no período.", unit: "percent", direction: "increase" },
  { key: "renewal_rate", name: "Taxa de renovação", category: "Carteira", description: "Percentual de contratos renovados ao término do ciclo.", unit: "percent", direction: "increase" },
  { key: "nps", name: "NPS / satisfação", category: "Experiência", description: "Percepção de valor e recomendação dos clientes.", unit: "score", direction: "increase" },
  { key: "on_time_delivery", name: "Entregas no prazo", category: "Operação", description: "Percentual de entregas concluídas dentro do prazo acordado.", unit: "percent", direction: "increase" },
  { key: "consulting_hours", name: "Horas de consultoria entregues", category: "Operação", description: "Horas efetivamente entregues aos clientes no período.", unit: "hours", direction: "increase" },
  { key: "overdue_actions", name: "Ações atrasadas", category: "Operação", description: "Quantidade de ações vencidas ainda não concluídas.", unit: "number", direction: "decrease" },
];

function formatDate(value: string | null) {
  return value ? shortDate.format(new Date(`${value}T12:00:00`)) : "Sem prazo";
}

function isOverdue(item: ProjectItem) {
  return Boolean(item.due_date && item.board_status !== "done" && new Date(`${item.due_date}T23:59:59`) < new Date());
}

function gutBand(score: number | null) {
  if (score === null) return { label: "A classificar", tone: "unrated" };
  if (score >= 81) return { label: "Crítica", tone: "critical" };
  if (score >= 41) return { label: "Alta", tone: "high" };
  if (score >= 21) return { label: "Média", tone: "medium" };
  return { label: "Baixa", tone: "low" };
}

function kpiProgress(kpi: ProjectKpi) {
  const baseline = Number(kpi.baseline_value);
  const current = Number(kpi.current_value);
  const target = Number(kpi.target_value);
  let progress = 0;
  if (kpi.direction === "increase") progress = target === baseline ? (current >= target ? 100 : 0) : (current - baseline) / (target - baseline) * 100;
  if (kpi.direction === "decrease") progress = target === baseline ? (current <= target ? 100 : 0) : (baseline - current) / (baseline - target) * 100;
  if (kpi.direction === "maintain") progress = target === 0 ? (current === 0 ? 100 : 0) : 100 - Math.abs(current - target) / Math.abs(target) * 100;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function kpiTone(progress: number) {
  return progress >= 80 ? "green" : progress >= 50 ? "orange" : "red";
}

function formatKpiValue(kpi: Pick<ProjectKpi, "unit">, value: number) {
  if (kpi.unit === "currency") return moneyFormat.format(value);
  if (kpi.unit === "percent") return `${numberFormat.format(value)}%`;
  if (kpi.unit === "days") return `${numberFormat.format(value)} dias`;
  if (kpi.unit === "hours") return `${numberFormat.format(value)}h`;
  if (kpi.unit === "score") return `${numberFormat.format(value)} pts`;
  return numberFormat.format(value);
}

type ProjectsAreaProps = {
  selectedProjectId: string | null;
  programs: ConsultingProgram[];
  units: Unit[];
  items: ProjectItem[];
  kpis: ProjectKpi[];
  measurements: KpiMeasurement[];
  query: string;
  setQuery: (value: string) => void;
  onOpenProject: (id: string) => void;
  onBack: () => void;
  onGoUnits: () => void;
  onAddItem: (status?: ProjectItemStatus, phaseIndex?: number | null) => void;
  onEditItem: (item: ProjectItem) => void;
  onMoveItem: (id: string, status: ProjectItemStatus, position: number) => void;
  onMoveProject: (project: ConsultingProgram, status: ProgramStatus) => void;
  onManageProject: (project: ConsultingProgram) => void;
  onUpdatePhase: (project: ConsultingProgram, phaseIndex: number, name: string, objective: string, makeCurrent: boolean) => void;
  onAddKpi: () => void;
  onEditKpi: (kpi: ProjectKpi) => void;
};

export function ProjectsArea(props: ProjectsAreaProps) {
  const selected = props.programs.find((program) => program.id === props.selectedProjectId) ?? null;
  if (selected) return <ProjectHub key={selected.id} project={selected} {...props} />;
  return <ProjectPortfolio {...props} />;
}

function ProjectPortfolio({ programs, units, items, query, setQuery, onOpenProject, onGoUnits, onMoveProject }: ProjectsAreaProps) {
  const [role, setRole] = useState<"all" | "main" | "track">("all");
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return programs.filter((project) => project.status !== "cancelled")
      .filter((project) => role === "all" || project.role === role)
      .filter((project) => {
        const unit = units.find((candidate) => candidate.id === project.unit_id);
        return `${project.name} ${project.current_phase ?? ""} ${unit?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(term);
      });
  }, [programs, query, role, units]);
  const visibleIds = new Set(programs.filter((project) => project.status !== "cancelled").map((project) => project.id));
  const portfolioItems = items.filter((item) => visibleIds.has(item.program_id));
  return <section className="view-stack project-portfolio">
    <div className="project-metrics">
      <ProjectMetric label="Projetos em andamento" value={String(programs.filter((project) => project.status === "active").length)} />
      <ProjectMetric label="Projetos em risco" value={String(programs.filter((project) => project.status === "at_risk").length)} tone={programs.some((project) => project.status === "at_risk") ? "red" : undefined} />
      <ProjectMetric label="Itens em aberto" value={String(portfolioItems.filter((item) => item.board_status !== "done").length)} />
      <ProjectMetric label="Itens atrasados" value={String(portfolioItems.filter(isOverdue).length)} tone="red" />
    </div>
    <div className="project-toolbar panel">
      <div><span className="eyebrow">GESTÃO CONSOLIDADA</span><h2>Kanban dos projetos das unidades</h2><p>Arraste um projeto para atualizar seu estágio de acompanhamento.</p></div>
      <div className="project-toolbar-actions">
        <label className="project-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projeto ou unidade" />{query && <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}><X size={14} /></button>}</label>
        <div className="project-filters" aria-label="Filtrar projetos"><button className={role === "all" ? "active" : ""} onClick={() => setRole("all")}>Todos</button><button className={role === "main" ? "active" : ""} onClick={() => setRole("main")}>Principais</button><button className={role === "track" ? "active" : ""} onClick={() => setRole("track")}>Trilhas</button></div>
      </div>
    </div>
    {programs.length ? <div className="project-board">{projectColumns.map((column) => {
      const columnProjects = filtered.filter((project) => project.status === column.id);
      return <section className={`project-column ${column.id}`} key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        const id = event.dataTransfer.getData("application/x-nexo-project") || event.dataTransfer.getData("text/plain");
        const project = programs.find((candidate) => candidate.id === id);
        if (project && project.status !== column.id) onMoveProject(project, column.id);
      }}><div className="project-column-head"><span><strong>{column.label}</strong><small>{column.hint}</small></span><b>{columnProjects.length}</b></div><div className="project-column-line" /><div className="project-card-list">{columnProjects.map((project) => {
        const unit = units.find((candidate) => candidate.id === project.unit_id);
        const projectItems = items.filter((item) => item.program_id === project.id);
        const open = projectItems.filter((item) => item.board_status !== "done").length;
        const overdue = projectItems.filter(isOverdue).length;
        const blocked = projectItems.filter((item) => item.blocked && item.board_status !== "done").length;
        return <button type="button" className="project-card" key={project.id} draggable aria-label={`Abrir projeto ${project.name}`} onDragStart={(event) => { event.dataTransfer.setData("application/x-nexo-project", project.id); event.dataTransfer.setData("text/plain", project.id); }} onClick={() => onOpenProject(project.id)}><div className="project-card-top"><span className={`project-role ${project.role}`}>{project.role === "main" ? "Principal" : "Trilha"}</span><Route size={15} /></div><span className="project-unit">{unit?.name || "Unidade não encontrada"}</span><h3>{project.name}</h3><div className="project-phase"><CircleGauge size={13} /><span><small>Fase atual</small><strong>{project.current_phase || "A definir"}</strong></span></div><div className="project-card-stats"><span><strong>{open}</strong><small>abertos</small></span><span className={overdue ? "danger" : ""}><strong>{overdue}</strong><small>atrasados</small></span><span className={blocked ? "warning" : ""}><strong>{blocked}</strong><small>bloqueados</small></span></div><div className="project-card-foot"><span><CalendarDays size={13} /> {formatDate(project.end_date)}</span><span>Abrir <ArrowRight size={13} /></span></div></button>;
      })}{columnProjects.length === 0 && <div className="project-column-empty">Solte um projeto aqui</div>}</div></section>;
    })}</div> : <div className="panel project-empty"><Route size={28} /><h3>Os projetos nascem dos programas das unidades</h3><p>Cadastre uma unidade e atribua o programa principal ou uma trilha para começar a gestão.</p><button className="primary-button" onClick={onGoUnits}><Plus size={15} /> Ir para unidades</button></div>}
  </section>;
}

type HubTab = "dashboard" | "planning" | "kanban" | "gut" | "kpis";

function ProjectHub(props: ProjectsAreaProps & { project: ConsultingProgram }) {
  const { project, programs, units, items, kpis, measurements, onBack, onAddItem, onEditItem, onMoveItem, onMoveProject, onManageProject, onOpenProject, onUpdatePhase, onAddKpi, onEditKpi } = props;
  const [tab, setTab] = useState<HubTab>("dashboard");
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState(0);
  const unit = units.find((candidate) => candidate.id === project.unit_id);
  const projectItems = items.filter((item) => item.program_id === project.id);
  const projectKpis = kpis.filter((kpi) => kpi.program_id === project.id);
  const open = projectItems.filter((item) => item.board_status !== "done");
  const done = projectItems.filter((item) => item.board_status === "done");
  const overdue = open.filter(isOverdue);
  const blocked = open.filter((item) => item.blocked);
  return <section className="view-stack project-hub">
    <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Voltar para todos os projetos</button>
    <div className="project-hub-hero panel"><div className="project-hub-title"><div className="project-hub-badges"><span className={`project-role ${project.role}`}>{project.role === "main" ? "Programa principal" : "Trilha complementar"}</span><span className={`project-status ${project.status}`}>{programStatusLabel[project.status]}</span></div><span className="eyebrow">{unit?.name || "UNIDADE"}</span><h2>{project.name}</h2><p>{project.objective}</p></div><div className="project-hub-actions"><label>Status do projeto<select value={project.status} onChange={(event) => onMoveProject(project, event.target.value as ProgramStatus)}><option value="planning">Planejamento</option><option value="active">Em andamento</option><option value="at_risk">Em risco</option><option value="paused">Pausado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></label><button className="secondary-button" onClick={() => onManageProject(project)}><Pencil size={14} /> Editar escopo</button><button className="primary-button" onClick={() => onAddItem("backlog")}><Plus size={15} /> Novo item</button></div></div>
    <div className="project-hub-metrics"><ProjectMetric label="Itens em aberto" value={String(open.length)} /><ProjectMetric label="Atrasados" value={String(overdue.length)} tone={overdue.length ? "red" : undefined} /><ProjectMetric label="Bloqueados" value={String(blocked.length)} tone={blocked.length ? "orange" : undefined} /><ProjectMetric label="Concluídos" value={String(done.length)} tone="green" /></div>
    <nav className="project-tabs" aria-label="Visões do projeto"><button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}><BarChart3 size={15} /> Dashboard</button><button className={tab === "planning" ? "active" : ""} onClick={() => setTab("planning")}><Activity size={15} /> Planejamento</button><button className={tab === "kanban" ? "active" : ""} onClick={() => setTab("kanban")}><Route size={15} /> Kanban</button><button className={tab === "kpis" ? "active" : ""} onClick={() => setTab("kpis")}><TrendingUp size={15} /> KPIs</button><button className={tab === "gut" ? "active" : ""} onClick={() => setTab("gut")}><Target size={15} /> Matriz GUT</button></nav>
    {tab === "dashboard" && <ProjectDashboard project={project} programs={programs} items={projectItems} kpis={projectKpis} measurements={measurements} onPlanning={(index) => { setSelectedPhaseIndex(index); setTab("planning"); }} onKpis={() => setTab("kpis")} onEditKpi={onEditKpi} onOpenProject={onOpenProject} />}
    {tab === "planning" && <PlanningView project={project} items={projectItems} selectedPhaseIndex={selectedPhaseIndex} onSelectPhase={setSelectedPhaseIndex} onUpdatePhase={onUpdatePhase} onAddItem={onAddItem} onEditItem={onEditItem} />}
    {tab === "kanban" && <OperationalKanban items={projectItems} onAdd={onAddItem} onEdit={onEditItem} onMove={onMoveItem} />}
    {tab === "kpis" && <KpisView kpis={projectKpis} measurements={measurements} onAdd={onAddKpi} onEdit={onEditKpi} />}
    {tab === "gut" && <GutMatrix items={projectItems} onAdd={() => onAddItem("backlog")} onEdit={onEditItem} />}
  </section>;
}

function ProjectDashboard({ project, programs, items, kpis, measurements, onPlanning, onKpis, onEditKpi, onOpenProject }: { project: ConsultingProgram; programs: ConsultingProgram[]; items: ProjectItem[]; kpis: ProjectKpi[]; measurements: KpiMeasurement[]; onPlanning: (index: number) => void; onKpis: () => void; onEditKpi: (kpi: ProjectKpi) => void; onOpenProject: (id: string) => void }) {
  const done = items.filter((item) => item.board_status === "done").length;
  const completion = items.length ? Math.round(done / items.length * 100) : 0;
  const onTrack = kpis.filter((kpi) => kpiProgress(kpi) >= 80).length;
  const averageKpi = kpis.length ? Math.round(kpis.reduce((sum, kpi) => sum + kpiProgress(kpi), 0) / kpis.length) : 0;
  const related = project.role === "main" ? programs.filter((item) => item.parent_program_id === project.id) : programs.filter((item) => item.id === project.parent_program_id);
  const topPriorities = [...items].filter((item) => item.gut_score !== null).sort((a, b) => Number(b.gut_score) - Number(a.gut_score)).slice(0, 4);
  return <div className="project-dashboard-layout"><div className="project-dashboard-main">
    <section className="panel progress-overview"><div className="section-heading"><div><span className="eyebrow">ANDAMENTO GERAL</span><h2>Execução do projeto</h2></div><strong className="big-progress">{completion}%</strong></div><div className="dashboard-progress-bar" role="progressbar" aria-label="Progresso de execução do projeto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}><i style={{ width: `${completion}%` }} /></div><div className="dashboard-progress-stats"><span><strong>{done}</strong><small>itens concluídos</small></span><span><strong>{items.filter((item) => item.board_status !== "done").length}</strong><small>em aberto</small></span><span><strong>{items.filter(isOverdue).length}</strong><small>atrasados</small></span><span><strong>{project.scope_snapshot.phases?.length ?? 0}</strong><small>etapas no escopo</small></span></div></section>
    <section className="panel dashboard-kpi-panel"><div className="section-heading"><div><span className="eyebrow">PAINEL DE KPIs</span><h2>Resultados acompanhados</h2></div><button className="text-inline-button" onClick={onKpis}>{kpis.length ? "Gerenciar KPIs" : "Selecionar KPIs"} <ArrowRight size={14} /></button></div>{kpis.length ? <><div className="kpi-dashboard-summary"><span><strong>{averageKpi}%</strong><small>avanço médio das metas</small></span><span><strong>{onTrack}/{kpis.length}</strong><small>indicadores no caminho</small></span></div><div className="dashboard-kpi-grid">{kpis.slice(0, 4).map((kpi) => <KpiCard key={kpi.id} kpi={kpi} measurements={measurements.filter((item) => item.kpi_id === kpi.id)} compact onEdit={() => onEditKpi(kpi)} />)}</div></> : <InlineCallout icon={<TrendingUp size={20} />} title="Defina os indicadores deste projeto" text="Escolha os KPIs que melhor demonstram a evolução da unidade e registre metas e resultados." action="Selecionar KPIs" onAction={onKpis} />}</section>
    <section className="panel dashboard-phases"><div className="section-heading"><div><span className="eyebrow">PLANEJAMENTO</span><h2>Etapas e atividades</h2></div><button className="text-inline-button" onClick={() => onPlanning(0)}>Abrir planejamento <ArrowRight size={14} /></button></div><div className="dashboard-phase-list">{project.scope_snapshot.phases?.map((phase, index) => { const phaseItems = items.filter((item) => item.phase_index === index); const phaseDone = phaseItems.filter((item) => item.board_status === "done").length; return <button key={`${project.id}-${index}`} onClick={() => onPlanning(index)}><i className={phase.name === project.current_phase ? "current" : ""}>{index + 1}</i><span><strong>{phase.name}</strong><small>{phaseItems.length ? `${phaseDone} de ${phaseItems.length} atividades concluídas` : "Nenhuma atividade cadastrada"}</small></span><b>{phaseItems.length ? `${Math.round(phaseDone / phaseItems.length * 100)}%` : "—"}</b><ArrowRight size={14} /></button>; })}</div></section>
  </div><aside className="project-dashboard-side">
    <section className="panel project-priorities"><div className="section-heading"><div><span className="eyebrow">PRIORIDADE GUT</span><h2>Ações críticas</h2></div></div>{topPriorities.length ? <div className="priority-action-list">{topPriorities.map((item) => { const band = gutBand(item.gut_score); return <div key={item.id}><span className={`gut-score ${band.tone}`}>{item.gut_score}</span><span><strong>{item.title}</strong><small>{item.owner_name || "Sem responsável"}</small></span><span className={`gut-band ${band.tone}`}>{band.label}</span></div>; })}</div> : <p className="dashboard-empty-copy">Nenhuma ação classificada na Matriz GUT.</p>}</section>
    <section className="panel connected-projects"><span className="eyebrow">ECOSSISTEMA DA UNIDADE</span><h2>{project.role === "main" ? "Trilhas conectadas" : "Programa principal"}</h2>{related.length ? <div>{related.map((item) => <button key={item.id} onClick={() => onOpenProject(item.id)}><span className="track-icon"><Layers3 size={15} /></span><span><strong>{item.name}</strong><small>{programStatusLabel[item.status]}</small></span><ArrowRight size={14} /></button>)}</div> : <p>Nenhum projeto complementar conectado.</p>}</section>
    <section className="panel project-period-card"><CalendarDays size={18} /><div><span className="eyebrow">CRONOGRAMA</span><strong>{formatDate(project.start_date)} — {formatDate(project.end_date)}</strong><small>Fase atual: {project.current_phase || "a definir"}</small></div></section>
  </aside></div>;
}

function PlanningView({ project, items, selectedPhaseIndex, onSelectPhase, onUpdatePhase, onAddItem, onEditItem }: { project: ConsultingProgram; items: ProjectItem[]; selectedPhaseIndex: number; onSelectPhase: (index: number) => void; onUpdatePhase: ProjectsAreaProps["onUpdatePhase"]; onAddItem: ProjectsAreaProps["onAddItem"]; onEditItem: (item: ProjectItem) => void }) {
  const phases = project.scope_snapshot.phases ?? [];
  const safeIndex = phases[selectedPhaseIndex] ? selectedPhaseIndex : 0;
  const phase = phases[safeIndex];
  if (!phase) return <div className="panel project-empty compact"><Activity size={26} /><h3>Este projeto ainda não possui etapas</h3><p>Edite o escopo do programa para definir o planejamento.</p></div>;
  const phaseItems = items.filter((item) => item.phase_index === safeIndex);
  return <div className="planning-layout"><aside className="panel phase-selector"><div><span className="eyebrow">ETAPAS DO PROGRAMA</span><h2>Planejamento</h2><p>Selecione uma etapa para detalhar o objetivo e suas atividades.</p></div><nav>{phases.map((candidate, index) => { const candidateItems = items.filter((item) => item.phase_index === index); const done = candidateItems.filter((item) => item.board_status === "done").length; return <button className={safeIndex === index ? "active" : ""} key={`${project.id}-${index}`} onClick={() => onSelectPhase(index)}><i>{index + 1}</i><span><strong>{candidate.name}</strong><small>{candidateItems.length ? `${done}/${candidateItems.length} concluídas` : "Sem atividades"}</small></span>{candidate.name === project.current_phase && <em>Atual</em>}<ArrowRight size={14} /></button>; })}</nav></aside><PhasePlanner key={`${project.id}-${safeIndex}-${phase.name}-${phase.objective}`} project={project} phaseIndex={safeIndex} phase={phase} items={phaseItems} onUpdatePhase={onUpdatePhase} onAddItem={onAddItem} onEditItem={onEditItem} /></div>;
}

function PhasePlanner({ project, phaseIndex, phase, items, onUpdatePhase, onAddItem, onEditItem }: { project: ConsultingProgram; phaseIndex: number; phase: { name: string; objective: string }; items: ProjectItem[]; onUpdatePhase: ProjectsAreaProps["onUpdatePhase"]; onAddItem: ProjectsAreaProps["onAddItem"]; onEditItem: (item: ProjectItem) => void }) {
  const done = items.filter((item) => item.board_status === "done").length;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); onUpdatePhase(project, phaseIndex, String(form.get("name")), String(form.get("objective")), form.get("make_current") === "on"); }
  return <section className="panel phase-planner"><div className="phase-planner-head"><div><span className="phase-number">ETAPA {phaseIndex + 1}</span><h2>{phase.name}</h2><p>{phase.objective}</p></div><span className="phase-completion"><strong>{items.length ? Math.round(done / items.length * 100) : 0}%</strong><small>concluído</small></span></div><form className="phase-edit-form" onSubmit={submit}><div className="form-row"><label>Nome da etapa<input name="name" required minLength={2} defaultValue={phase.name} /></label><label className="phase-current-check"><input name="make_current" type="checkbox" defaultChecked={phase.name === project.current_phase} /><span><strong>Fase atual</strong><small>Destacar no dashboard</small></span></label></div><label>Objetivo da etapa<textarea name="objective" rows={3} required defaultValue={phase.objective} /></label><div className="phase-edit-actions"><span><Sparkles size={14} /> Esta edição personaliza somente o projeto desta unidade.</span><button className="secondary-button" type="submit"><Save size={14} /> Salvar etapa</button></div></form><div className="phase-items-heading"><div><span className="eyebrow">PLANO DE EXECUÇÃO</span><h3>Atividades para alcançar o objetivo</h3></div><button className="primary-button" onClick={() => onAddItem("planned", phaseIndex)}><Plus size={15} /> Nova atividade</button></div>{items.length ? <div className="phase-item-list">{items.map((item) => <button key={item.id} onClick={() => onEditItem(item)}><span className={`phase-item-check ${item.board_status === "done" ? "done" : ""}`}>{item.board_status === "done" && <CheckCircle2 size={13} />}</span><span><strong>{item.title}</strong><small>{itemKindLabel[item.kind]} · {item.owner_name || "Sem responsável"} · {formatDate(item.due_date)}</small></span><span className={`phase-item-status ${item.board_status}`}>{itemStatusLabel[item.board_status]}</span>{item.blocked && <AlertTriangle size={14} className="orange" />}<Pencil size={13} /></button>)}</div> : <InlineCallout icon={<Activity size={20} />} title="Transforme o objetivo em atividades" text="Cadastre ações, entregas e marcos e acompanhe a execução no Kanban." action="Adicionar primeira atividade" onAction={() => onAddItem("planned", phaseIndex)} />}</section>;
}

function OperationalKanban({ items, onAdd, onEdit, onMove }: { items: ProjectItem[]; onAdd: ProjectsAreaProps["onAddItem"]; onEdit: (item: ProjectItem) => void; onMove: ProjectsAreaProps["onMoveItem"] }) {
  return <div className="operational-board">{itemColumns.map((column) => { const columnItems = items.filter((item) => item.board_status === column.id).sort((a, b) => a.position - b.position); return <section className={`operational-column ${column.id}`} key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("application/x-nexo-item") || event.dataTransfer.getData("text/plain"); const item = items.find((candidate) => candidate.id === id); if (!item || item.board_status === column.id) return; onMove(item.id, column.id, Math.max(0, ...columnItems.map((candidate) => candidate.position)) + 1000); }}><div className="operational-column-head"><span><strong>{column.label}</strong><small>{column.hint}</small></span><b>{columnItems.length}</b></div><div className="operational-list">{columnItems.map((item) => <WorkItemCard item={item} key={item.id} onEdit={onEdit} />)}{!columnItems.length && <div className="operational-empty">Solte um item aqui</div>}</div><button className="operational-add" onClick={() => onAdd(column.id)}><Plus size={14} /> Adicionar item</button></section>; })}</div>;
}

function WorkItemCard({ item, onEdit }: { item: ProjectItem; onEdit: (item: ProjectItem) => void }) {
  const band = gutBand(item.gut_score); const overdue = isOverdue(item);
  return <button type="button" className={`work-item-card ${item.blocked ? "blocked" : ""}`} draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-nexo-item", item.id); event.dataTransfer.setData("text/plain", item.id); }} onClick={() => onEdit(item)}><div className="work-item-top"><span className={`item-kind ${item.kind}`}>{itemKindLabel[item.kind]}</span>{item.gut_score !== null && <span className={`gut-score mini ${band.tone}`}>GUT {item.gut_score}</span>}</div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}<div className="work-item-owner"><UserRound size={13} /> {item.owner_name || "Sem responsável"}</div>{item.blocked && <div className="work-item-alert"><AlertTriangle size={13} /> {item.block_reason}</div>}<div className={`work-item-foot ${overdue ? "overdue" : ""}`}><span><CalendarDays size={13} /> {formatDate(item.due_date)}</span><Pencil size={13} /></div></button>;
}

function KpisView({ kpis, measurements, onAdd, onEdit }: { kpis: ProjectKpi[]; measurements: KpiMeasurement[]; onAdd: () => void; onEdit: (kpi: ProjectKpi) => void }) {
  const average = kpis.length ? Math.round(kpis.reduce((sum, kpi) => sum + kpiProgress(kpi), 0) / kpis.length) : 0;
  return <section className="view-stack"><div className="kpi-library-head panel"><div><span className="eyebrow">INDICADORES DO PROJETO</span><h2>Painel de KPIs</h2><p>Selecione apenas os indicadores que ajudam a tomar decisões neste projeto e atualize os resultados ao longo do acompanhamento.</p></div><button className="primary-button" onClick={onAdd}><Plus size={15} /> Selecionar KPI</button></div>{kpis.length ? <><div className="project-hub-metrics"><ProjectMetric label="KPIs acompanhados" value={String(kpis.length)} /><ProjectMetric label="No caminho" value={String(kpis.filter((kpi) => kpiProgress(kpi) >= 80).length)} tone="green" /><ProjectMetric label="Precisam de atenção" value={String(kpis.filter((kpi) => kpiProgress(kpi) < 50).length)} tone="red" /><ProjectMetric label="Avanço médio" value={`${average}%`} tone={kpiTone(average)} /></div><div className="kpi-card-grid">{kpis.map((kpi) => <KpiCard key={kpi.id} kpi={kpi} measurements={measurements.filter((item) => item.kpi_id === kpi.id)} onEdit={() => onEdit(kpi)} />)}</div></> : <div className="panel project-empty"><TrendingUp size={28} /><h3>Selecione os KPIs do projeto</h3><p>Use a biblioteca comercial, de carteira e operação ou crie um indicador personalizado.</p><button className="primary-button" onClick={onAdd}><Plus size={15} /> Selecionar primeiro KPI</button></div>}</section>;
}

function KpiCard({ kpi, measurements, onEdit, compact = false }: { kpi: ProjectKpi; measurements: KpiMeasurement[]; onEdit: () => void; compact?: boolean }) {
  const progress = kpiProgress(kpi); const tone = kpiTone(progress); const ordered = [...measurements].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  return <button className={`kpi-card-project ${compact ? "compact" : ""}`} onClick={onEdit}><div className="kpi-card-head"><span>{kpi.category}</span><i className={tone}>{progress >= 80 ? "No caminho" : progress >= 50 ? "Atenção" : "Fora da meta"}</i></div><h3>{kpi.name}</h3><div className="kpi-current"><strong>{formatKpiValue(kpi, Number(kpi.current_value))}</strong><span>Meta: {formatKpiValue(kpi, Number(kpi.target_value))}</span></div><div className="kpi-progress" role="progressbar" aria-label={`Progresso do KPI ${kpi.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i className={tone} style={{ width: `${progress}%` }} /></div><div className="kpi-card-foot"><span><CircleGauge size={13} /> {progress}% da meta</span><span><Clock3 size={13} /> {frequencyLabel[kpi.frequency]}</span></div>{!compact && <KpiSparkline measurements={ordered} tone={tone} />}</button>;
}

function KpiSparkline({ measurements, tone }: { measurements: KpiMeasurement[]; tone: string }) {
  if (measurements.length < 2) return <div className="kpi-no-history"><BarChart3 size={14} /> O histórico aparecerá nas próximas atualizações.</div>;
  const values = measurements.slice(-8).map((item) => Number(item.value)); const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1; const points = values.map((value, index) => `${index / Math.max(values.length - 1, 1) * 100},${34 - (value - min) / range * 28}`).join(" ");
  return <div className={`kpi-sparkline ${tone}`}><svg viewBox="0 0 100 38" preserveAspectRatio="none" role="img" aria-label="Evolução recente do KPI"><polyline points={points} /></svg><span>{measurements.length} medições</span></div>;
}

function GutMatrix({ items, onAdd, onEdit }: { items: ProjectItem[]; onAdd: () => void; onEdit: (item: ProjectItem) => void }) {
  const sorted = [...items].sort((a, b) => Number(b.gut_score ?? -1) - Number(a.gut_score ?? -1)); const critical = items.filter((item) => Number(item.gut_score) >= 81).length; const unclassified = items.filter((item) => item.gut_score === null).length;
  return <section className="panel gut-panel"><div className="gut-heading"><div><span className="eyebrow">MATRIZ DE PRIORIZAÇÃO</span><h2>Gravidade × Urgência × Tendência</h2><p>A pontuação vai de 1 a 125 e ordena automaticamente as ações mais importantes.</p></div><div><span><strong>{critical}</strong><small>críticas</small></span><span><strong>{unclassified}</strong><small>a classificar</small></span><button className="primary-button" onClick={onAdd}><Plus size={15} /> Nova ação</button></div></div>{sorted.length ? <div className="gut-table-wrap"><div className="gut-table"><div className="gut-row gut-table-head"><span>Ação</span><span>Responsável</span><span>Status</span><span>G</span><span>U</span><span>T</span><span>Pontuação</span><span>Prioridade</span></div>{sorted.map((item) => { const band = gutBand(item.gut_score); return <button className="gut-row" key={item.id} onClick={() => onEdit(item)}><span><strong>{item.title}</strong><small>{itemKindLabel[item.kind]} · {formatDate(item.due_date)}</small></span><span>{item.owner_name || "Não definido"}</span><span>{itemStatusLabel[item.board_status]}</span><span>{item.gut_gravity ?? "—"}</span><span>{item.gut_urgency ?? "—"}</span><span>{item.gut_tendency ?? "—"}</span><span><b className={`gut-score ${band.tone}`}>{item.gut_score ?? "—"}</b></span><span><i className={`gut-band ${band.tone}`}>{band.label}</i></span></button>; })}</div></div> : <div className="project-empty compact"><Target size={25} /><h3>Nenhuma ação para priorizar</h3><p>Crie o primeiro item do projeto e classifique G, U e T.</p><button className="primary-button" onClick={onAdd}><Plus size={15} /> Nova ação</button></div>}</section>;
}

function ProjectMetric({ label, value, tone }: { label: string; value: string; tone?: string }) { return <article className={`project-metric ${tone || ""}`}><span>{label}</span><strong>{value}</strong></article>; }
function InlineCallout({ icon, title, text, action, onAction }: { icon: ReactNode; title: string; text: string; action: string; onAction: () => void }) { return <div className="project-inline-callout">{icon}<span><strong>{title}</strong><small>{text}</small></span><button className="secondary-button" onClick={onAction}>{action}</button></div>; }

type ProjectItemModalProps = { initial: ProjectItem | null; programId: string; phases: { name: string; objective: string }[]; defaultStatus: ProjectItemStatus; defaultPhaseIndex: number | null; nextPosition: number; busy: boolean; onClose: () => void; onSubmit: (input: ProjectItemInput) => void; onDelete: (item: ProjectItem) => void };

export function ProjectItemModal({ initial, programId, phases, defaultStatus, defaultPhaseIndex, nextPosition, busy, onClose, onSubmit, onDelete }: ProjectItemModalProps) {
  const [blocked, setBlocked] = useState(initial?.blocked ?? false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const score = (name: string) => { const value = String(form.get(name) || ""); return value ? Number(value) : null; }; const phaseValue = String(form.get("phase_index") || ""); onSubmit({ id: initial?.id, program_id: programId, phase_index: phaseValue === "" ? null : Number(phaseValue), kind: String(form.get("kind")) as ProjectItemInput["kind"], title: String(form.get("title")), description: String(form.get("description") || ""), board_status: String(form.get("board_status")) as ProjectItemStatus, owner_name: String(form.get("owner_name") || ""), due_date: String(form.get("due_date") || ""), blocked, block_reason: String(form.get("block_reason") || ""), gut_gravity: score("gut_gravity"), gut_urgency: score("gut_urgency"), gut_tendency: score("gut_tendency"), position: initial?.position ?? nextPosition }); }
  const gutOptions = <><option value="">Não classificado</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</>;
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal project-item-modal" role="dialog" aria-modal="true" aria-label={initial ? "Editar item do projeto" : "Novo item do projeto"} onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">OPERAÇÃO DO PROJETO</span><h2>{initial ? "Editar item" : "Novo item"}</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><div className="form-row"><label>Tipo<select name="kind" defaultValue={initial?.kind || "action"}><option value="action">Ação</option><option value="deliverable">Entrega</option><option value="milestone">Marco</option></select></label><label>Coluna<select name="board_status" defaultValue={initial?.board_status || defaultStatus}><option value="backlog">Backlog</option><option value="planned">Planejado</option><option value="in_progress">Em execução</option><option value="waiting">Aguardando</option><option value="done">Concluído</option></select></label></div><label>Etapa do planejamento<select name="phase_index" defaultValue={initial?.phase_index ?? defaultPhaseIndex ?? ""}><option value="">Sem etapa vinculada</option>{phases.map((phase, index) => <option value={index} key={`${index}-${phase.name}`}>{index + 1}. {phase.name}</option>)}</select></label><label>Título<input name="title" required minLength={2} maxLength={180} defaultValue={initial?.title} placeholder="Ex.: Validar metas comerciais da unidade" /></label><label>Descrição<textarea name="description" rows={3} defaultValue={initial?.description || ""} placeholder="Contexto, resultado esperado e critérios de conclusão" /></label><div className="form-row"><label>Responsável<input name="owner_name" defaultValue={initial?.owner_name || ""} placeholder="Eron, franqueado, equipe..." /></label><label>Prazo<input name="due_date" type="date" defaultValue={initial?.due_date || ""} /></label></div><fieldset className="gut-fields"><legend>Matriz GUT <small>1 = menor impacto · 5 = maior impacto</small></legend><div><label>Gravidade<select name="gut_gravity" defaultValue={initial?.gut_gravity ?? ""}>{gutOptions}</select></label><label>Urgência<select name="gut_urgency" defaultValue={initial?.gut_urgency ?? ""}>{gutOptions}</select></label><label>Tendência<select name="gut_tendency" defaultValue={initial?.gut_tendency ?? ""}>{gutOptions}</select></label></div></fieldset><label className="blocked-toggle"><input type="checkbox" checked={blocked} onChange={(event) => setBlocked(event.target.checked)} /><span><strong>Este item está bloqueado</strong><small>Marque quando houver uma dependência que impeça o avanço.</small></span></label>{blocked && <label>Motivo do bloqueio<input name="block_reason" required defaultValue={initial?.block_reason || ""} placeholder="O que precisa acontecer para liberar?" /></label>}<div className="modal-footer">{initial && <button className="danger-button" type="button" onClick={() => onDelete(initial)}><Trash2 size={15} /> Excluir</button>}<div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} type="submit"><Save size={16} /> {busy ? "Salvando" : initial ? "Salvar alterações" : "Criar item"}</button></div></div></form></section></div>;
}

type KpiFormState = { presetKey: string; name: string; description: string; category: string; unit: KpiUnit; direction: KpiDirection; baseline: string; current: string; target: string; frequency: KpiFrequency; measuredAt: string; note: string };

export function KpiModal({ initial, programId, busy, onClose, onSubmit, onDelete }: { initial: ProjectKpi | null; programId: string; busy: boolean; onClose: () => void; onSubmit: (input: ProjectKpiInput) => void; onDelete: (kpi: ProjectKpi) => void }) {
  const [form, setForm] = useState<KpiFormState>({ presetKey: initial?.preset_key || "custom", name: initial?.name || "", description: initial?.description || "", category: initial?.category || "Personalizado", unit: initial?.unit || "number", direction: initial?.direction || "increase", baseline: String(initial?.baseline_value ?? 0), current: String(initial?.current_value ?? 0), target: String(initial?.target_value ?? 0), frequency: initial?.frequency || "monthly", measuredAt: initial?.last_measured_at || new Date().toISOString().slice(0, 10), note: "" });
  function update<K extends keyof KpiFormState>(key: K, value: KpiFormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function choosePreset(key: string) { if (key === "custom") { setForm((current) => ({ ...current, presetKey: key, name: "", description: "", category: "Personalizado", unit: "number", direction: "increase" })); return; } const preset = kpiPresets.find((item) => item.key === key); if (preset) setForm((current) => ({ ...current, presetKey: key, name: preset.name, description: preset.description, category: preset.category, unit: preset.unit, direction: preset.direction })); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onSubmit({ id: initial?.id, program_id: programId, preset_key: form.presetKey === "custom" ? null : form.presetKey, name: form.name, description: form.description, category: form.category, unit: form.unit, direction: form.direction, baseline_value: Number(form.baseline), current_value: Number(form.current), target_value: Number(form.target), frequency: form.frequency, measured_at: form.measuredAt, measurement_note: form.note }); }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal kpi-modal" role="dialog" aria-modal="true" aria-label={initial ? "Atualizar KPI" : "Selecionar KPI"} onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PAINEL DE INDICADORES</span><h2>{initial ? "Atualizar KPI" : "Selecionar KPI"}</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}>{!initial && <label>KPI da biblioteca<select value={form.presetKey} onChange={(event) => choosePreset(event.target.value)}><option value="custom">KPI personalizado</option>{[...new Set(kpiPresets.map((item) => item.category))].map((category) => <optgroup label={category} key={category}>{kpiPresets.filter((item) => item.category === category).map((preset) => <option value={preset.key} key={preset.key}>{preset.name}</option>)}</optgroup>)}</select></label>}<div className="form-row"><label>Nome do indicador<input required minLength={2} value={form.name} onChange={(event) => update("name", event.target.value)} /></label><label>Categoria<input required value={form.category} onChange={(event) => update("category", event.target.value)} /></label></div><label>O que este KPI mede<textarea rows={2} value={form.description} onChange={(event) => update("description", event.target.value)} /></label><div className="form-row three"><label>Unidade<select value={form.unit} onChange={(event) => update("unit", event.target.value as KpiUnit)}><option value="number">Número</option><option value="percent">Percentual</option><option value="currency">Valor em R$</option><option value="days">Dias</option><option value="hours">Horas</option><option value="score">Pontuação</option></select></label><label>Direção desejada<select value={form.direction} onChange={(event) => update("direction", event.target.value as KpiDirection)}><option value="increase">Aumentar</option><option value="decrease">Reduzir</option><option value="maintain">Manter na meta</option></select></label><label>Periodicidade<select value={form.frequency} onChange={(event) => update("frequency", event.target.value as KpiFrequency)}><option value="weekly">Semanal</option><option value="biweekly">Quinzenal</option><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option></select></label></div><div className="kpi-values-form"><label>Linha de base<input type="number" step="0.01" required value={form.baseline} onChange={(event) => update("baseline", event.target.value)} /></label><label>Valor atual<input type="number" step="0.01" required value={form.current} onChange={(event) => update("current", event.target.value)} /></label><label>Meta<input type="number" step="0.01" required value={form.target} onChange={(event) => update("target", event.target.value)} /></label></div><div className="kpi-form-note"><TrendingUp size={16} /><span><strong>Direção: {directionLabel[form.direction]}</strong><small>O dashboard calcula automaticamente o avanço entre a linha de base, o resultado atual e a meta.</small></span></div><div className="form-row"><label>Data da medição<input type="date" required value={form.measuredAt} onChange={(event) => update("measuredAt", event.target.value)} /></label><label>Nota da medição<input value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="Contexto do resultado" /></label></div><div className="modal-footer">{initial && <button className="danger-button" type="button" onClick={() => onDelete(initial)}><Trash2 size={15} /> Excluir KPI</button>}<div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} type="submit"><Save size={16} /> {busy ? "Salvando" : initial ? "Salvar medição" : "Adicionar KPI"}</button></div></div></form></section></div>;
}
