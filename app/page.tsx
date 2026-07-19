"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Archive, ArrowLeft, ArrowRight, BarChart3, Bell, BookOpen, Building2, CalendarDays, Check,
  CheckCircle2, ChevronRight, CircleDollarSign, CircleX,
  CircleGauge, ClipboardList, Clock3, Download, FileJson, HeartPulse, Layers3,
  ExternalLink, LayoutDashboard, Link2, LoaderCircle, LogOut, Mail, MapPin, Menu, MoreHorizontal,
  Bot, Pencil, Phone, Plus, Route, Save, Search, Sparkles, Target, Trash2,
  TrendingUp, Trophy, Unplug, Upload, UserPlus, UsersRound, X, RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { KpiModal, ProjectItemModal, ProjectsArea } from "@/app/projects";
import { AICopilot } from "@/app/ai-copilot";
import type { AiProjectDraft } from "@/lib/ai";
import {
  convertToClient, deleteActivity, deleteClient, deleteConsultingProgram, deleteProjectItem, deleteProjectKpi,
  deleteContact, deleteOpportunity, deleteProgramTemplate, deleteUnit,
  ensureDefaultProgramTemplates, fetchCRMData, moveOpportunity, moveProjectItem, saveActivity,
  saveConsultingProgram, saveContact, saveOpportunity, saveProgramTemplate,
  saveProjectItem, saveProjectKpi, saveUnit, setActivityStatus, updateClient, updateConsultingProgram,
  updateProgramPhase,
  updateOpportunityStatus,
} from "@/lib/crm";
import {
  deleteActivityFromGoogle, disconnectGoogleCalendar, getGoogleCalendarStatus,
  listGoogleCalendarEvents, listGoogleCalendars, selectGoogleCalendar,
  startGoogleCalendarConnection, syncActivityToGoogle,
} from "@/lib/google-calendar";
import type {
  GoogleCalendarEvent, GoogleCalendarOption, GoogleCalendarStatus,
} from "@/lib/google-calendar";
import type {
  Activity, ActivityInput, Client, ConsultingProgram, ConsultingProgramInput, Contact, CRMData,
  Opportunity, OpportunityInput, Priority, ProgramRole, ProgramStatus, ProjectItem,
  ProjectItemInput, ProjectItemStatus, ProjectKpi, ProjectKpiInput,
  ProgramTemplate, ProgramTemplateInput, Stage, Unit, UnitInput, View,
} from "@/lib/types";

const stages: { id: Stage; label: string }[] = [
  { id: "lead", label: "Novo lead" }, { id: "qualification", label: "Qualificação" },
  { id: "diagnosis", label: "Diagnóstico" }, { id: "proposal", label: "Proposta" },
  { id: "negotiation", label: "Negociação" },
];

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "copilot", label: "Copiloto IA", icon: Bot },
  { id: "projects", label: "Projetos", icon: Route },
  { id: "units", label: "Unidades", icon: Building2 },
  { id: "programs", label: "Programas", icon: BookOpen },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "pipeline", label: "CRM comercial", icon: Target },
  { id: "contacts", label: "Contatos", icon: UsersRound },
  { id: "clients", label: "Clientes comerciais", icon: ClipboardList },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
];

const headings: Record<View, { kicker: string; title: string; subtitle: string }> = {
  overview: { kicker: "ECOSSISTEMA TUTOREANOS", title: "Visão geral", subtitle: "Sua carteira de unidades e programas em um só lugar." },
  projects: { kicker: "GESTÃO DE PROJETOS", title: "Projetos", subtitle: "Acompanhe portfólio, execução e prioridades das unidades." },
  units: { kicker: "PORTFÓLIO DE CONSULTORIA", title: "Unidades", subtitle: "Acompanhe contexto, programa principal e trilhas de cada unidade." },
  programs: { kicker: "BIBLIOTECA DE ESCOPO", title: "Programas", subtitle: "Modelos padrão e programas personalizados para sua operação." },
  pipeline: { kicker: "OPERAÇÃO COMERCIAL", title: "Pipeline comercial", subtitle: "Conduza cada oportunidade até o fechamento." },
  contacts: { kicker: "RELACIONAMENTOS", title: "Contatos", subtitle: "Decisores, empresas e informações comerciais." },
  clients: { kicker: "CARTEIRA ATIVA", title: "Clientes", subtitle: "Projetos, saúde da conta e expansão." },
  agenda: { kicker: "RITMO COMERCIAL", title: "Agenda", subtitle: "Reuniões, entregas e follow-ups." },
  reports: { kicker: "INTELIGÊNCIA COMERCIAL", title: "Relatórios", subtitle: "Indicadores calculados com seus dados reais." },
  copilot: { kicker: "INTELIGÊNCIA APLICADA", title: "Copiloto IA", subtitle: "Projetos sob medida e recomendações baseadas nos seus dados." },
};

const emptyData: CRMData = { units: [], programTemplates: [], consultingPrograms: [], projectItems: [], projectKpis: [], kpiMeasurements: [], opportunities: [], contacts: [], clients: [], activities: [] };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const programOpenStatuses: ProgramStatus[] = ["planning", "active", "at_risk", "paused"];

const unitModelLabel = { home_based: "Home based", physical: "Unidade física", hybrid: "Híbrida" } as const;
const unitLifecycleLabel = { planning: "Em implantação", active: "Ativa", paused: "Pausada", inactive: "Inativa" } as const;
const unitHealthLabel = { no_data: "Aguardando dados", healthy: "Saudável", attention: "Atenção", critical: "Crítica" } as const;
const programStatusLabel = { planning: "Planejamento", active: "Em andamento", at_risk: "Em risco", paused: "Pausado", completed: "Concluído", cancelled: "Cancelado" } as const;

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "--";
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<CRMData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeView, setActiveView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [aiOpportunityId, setAiOpportunityId] = useState<string | null>(null);
  const [opportunityModal, setOpportunityModal] = useState<Opportunity | "new" | null>(null);
  const [contactModal, setContactModal] = useState<Contact | "new" | null>(null);
  const [activityModal, setActivityModal] = useState<Activity | "new" | null>(null);
  const [clientModal, setClientModal] = useState<Client | null>(null);
  const [unitModal, setUnitModal] = useState<Unit | "new" | null>(null);
  const [templateModal, setTemplateModal] = useState<ProgramTemplate | "new" | null>(null);
  const [programModal, setProgramModal] = useState<{ unit: Unit; role: ProgramRole } | null>(null);
  const [managedProgram, setManagedProgram] = useState<ConsultingProgram | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectItemModal, setProjectItemModal] = useState<{ initial: ProjectItem | null; programId: string; defaultStatus: ProjectItemStatus; defaultPhaseIndex: number | null } | null>(null);
  const [kpiModal, setKpiModal] = useState<ProjectKpi | "new" | null>(null);
  const [googleCalendar, setGoogleCalendar] = useState<GoogleCalendarStatus | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarOption[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: auth }) => {
      setSession(auth.session); setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession); setAuthReady(true);
      if (!nextSession) setData(emptyData);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function reload(silent = false) {
    if (!session) return;
    if (!silent) setLoading(true);
    try {
      await ensureDefaultProgramTemplates(supabase, session.user.id);
      setData(await fetchCRMData(supabase)); setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar seus dados.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google_calendar");
    if (!result) return;
    const timer = window.setTimeout(() => {
      setActiveView("agenda");
      if (result === "connected") setNotice("Google Agenda conectado");
      else setError(params.get("google_calendar_message") || "Não foi possível conectar o Google Agenda.");
      params.delete("google_calendar");
      params.delete("google_calendar_message");
      const queryString = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toast(message: string) {
    setNotice(message); window.setTimeout(() => setNotice(""), 2600);
  }

  async function perform(action: () => Promise<void>, message: string, nextView?: View) {
    setBusy(true); setError("");
    try {
      await action(); await reload(true); toast(message);
      if (nextView) setActiveView(nextView);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A operação não pôde ser concluída.");
    } finally { setBusy(false); }
  }

  async function reloadGoogleCalendar(silent = false) {
    if (!session) return;
    if (!silent) setGoogleLoading(true);
    try {
      const status = await getGoogleCalendarStatus();
      setGoogleCalendar(status);
      if (status.connected) {
        const [calendarsResult, eventsResult] = await Promise.all([
          listGoogleCalendars(),
          listGoogleCalendarEvents(),
        ]);
        setGoogleCalendars(calendarsResult.calendars);
        setGoogleEvents(eventsResult.events);
      } else {
        setGoogleCalendars([]);
        setGoogleEvents([]);
      }
    } catch (cause) {
      if (!silent) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o Google Agenda.");
    } finally {
      if (!silent) setGoogleLoading(false);
    }
  }

  useEffect(() => {
    if (!session || activeView !== "agenda") return;
    const timer = window.setTimeout(() => { void reloadGoogleCalendar(); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, activeView]);

  async function connectGoogleCalendar() {
    setGoogleBusy(true); setError("");
    try {
      await startGoogleCalendarConnection();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a conexão com o Google.");
      setGoogleBusy(false);
    }
  }

  async function chooseGoogleCalendar(calendarId: string) {
    setGoogleBusy(true); setError("");
    try {
      await selectGoogleCalendar(calendarId);
      await reloadGoogleCalendar(true);
      toast("Agenda padrão atualizada");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível selecionar a agenda.");
    } finally { setGoogleBusy(false); }
  }

  async function refreshGoogleEvents() {
    setGoogleBusy(true); setError("");
    try {
      await reloadGoogleCalendar(true);
      toast("Compromissos atualizados");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar os compromissos.");
    } finally { setGoogleBusy(false); }
  }

  async function disconnectGoogle() {
    if (!window.confirm("Desconectar o Google Agenda? Os eventos já criados continuarão na sua agenda.")) return;
    setGoogleBusy(true); setError("");
    try {
      await disconnectGoogleCalendar();
      await reload(true);
      await reloadGoogleCalendar(true);
      toast("Google Agenda desconectado");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível desconectar o Google Agenda.");
    } finally { setGoogleBusy(false); }
  }

  const openOpportunities = data.opportunities.filter((item) => item.status === "open");
  const filteredOpportunities = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return openOpportunities.filter((item) => `${item.company} ${item.contact?.name ?? ""} ${item.segment}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [openOpportunities, query]);
  const filteredContacts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return data.contacts.filter((item) => `${item.name} ${item.company} ${item.segment} ${item.email ?? ""}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [data.contacts, query]);
  const filteredUnits = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return data.units.filter((item) => `${item.name} ${item.franchisee_name ?? ""} ${item.city ?? ""} ${item.state ?? ""}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [data.units, query]);
  const selectedUnit = data.units.find((item) => item.id === selectedUnitId) ?? null;
  const selectedProject = data.consultingPrograms.find((item) => item.id === selectedProjectId) ?? null;

  const totalPipeline = openOpportunities.reduce((sum, item) => sum + Number(item.value), 0);
  const weightedPipeline = openOpportunities.reduce((sum, item) => sum + Number(item.value) * item.probability / 100, 0);
  const won = data.opportunities.filter((item) => item.status === "won");
  const lost = data.opportunities.filter((item) => item.status === "lost");
  const conversion = won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
  const now = new Date();
  const overdue = data.activities.filter((item) => item.status === "pending" && new Date(item.due_at) < now);
  const upcoming = data.activities.filter((item) => item.status === "pending").sort((a, b) => a.due_at.localeCompare(b.due_at));

  async function submitOpportunity(input: OpportunityInput) {
    await perform(async () => { await saveOpportunity(supabase, input); }, input.id ? "Oportunidade atualizada" : "Oportunidade criada", "pipeline");
    setOpportunityModal(null); setSelectedOpportunity(null);
  }

  async function handleMove(id: string, stage: Stage) {
    await perform(async () => { await moveOpportunity(supabase, id, stage); }, "Oportunidade movida");
    setSelectedOpportunity(null);
  }

  async function markWon(item: Opportunity) {
    await perform(async () => { await convertToClient(supabase, item.id); }, "Venda ganha e cliente criado", "clients");
    setSelectedOpportunity(null);
  }

  async function markLost(item: Opportunity) {
    const reason = window.prompt("Qual foi o motivo da perda?");
    if (reason === null) return;
    await perform(async () => { await updateOpportunityStatus(supabase, item.id, "lost", reason); }, "Oportunidade marcada como perdida");
    setSelectedOpportunity(null);
  }

  async function archiveOpportunity(item: Opportunity) {
    await perform(async () => { await updateOpportunityStatus(supabase, item.id, "archived"); }, "Oportunidade arquivada");
    setSelectedOpportunity(null);
  }

  async function removeOpportunity(item: Opportunity) {
    if (!window.confirm(`Excluir definitivamente ${item.company}?`)) return;
    await perform(async () => { await deleteOpportunity(supabase, item.id); }, "Oportunidade excluída");
    setSelectedOpportunity(null);
  }

  async function applyAiProject(draft: AiProjectDraft, unitId: string) {
    let createdProjectId = "";
    await perform(async () => {
      const templateId = await saveProgramTemplate(supabase, {
        name: draft.name,
        objective: draft.objective,
        duration_weeks: draft.duration_weeks,
        default_role: "main",
        phases: draft.phases.map((phase) => ({ name: phase.name, objective: phase.objective })),
      });
      const main = data.consultingPrograms.find((program) => program.unit_id === unitId && program.role === "main" && programOpenStatuses.includes(program.status));
      const start = new Date();
      const end = new Date(start.getTime() + draft.duration_weeks * 7 * 86400000);
      createdProjectId = await saveConsultingProgram(supabase, {
        unit_id: unitId,
        template_id: templateId,
        parent_program_id: main?.id,
        role: main ? "track" : "main",
        name: draft.name,
        objective: draft.objective,
        status: "planning",
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        current_phase: draft.phases[0]?.name,
        scope_snapshot: { phases: draft.phases.map((phase) => ({ name: phase.name, objective: phase.objective })), template_name: draft.name, template_version: 1 },
      });
      let position = 1000;
      for (const [phaseIndex, phase] of draft.phases.entries()) {
        for (const activity of phase.activities) {
          const due = new Date(start.getTime() + Math.max(0, activity.week - 1) * 7 * 86400000);
          await saveProjectItem(supabase, {
            program_id: createdProjectId, phase_index: phaseIndex, kind: "action", title: activity.title,
            description: activity.description, board_status: "planned", owner_name: activity.owner,
            due_date: due.toISOString().slice(0, 10), blocked: false,
            gut_gravity: activity.gut[0], gut_urgency: activity.gut[1], gut_tendency: activity.gut[2], position,
          });
          position += 1000;
        }
      }
      const today = start.toISOString().slice(0, 10);
      for (const kpi of draft.kpis) {
        await saveProjectKpi(supabase, {
          program_id: createdProjectId, name: kpi.name, description: kpi.description, category: kpi.category,
          unit: kpi.unit, direction: kpi.direction, baseline_value: kpi.baseline, current_value: kpi.baseline,
          target_value: kpi.target, frequency: kpi.frequency, measured_at: today,
          measurement_note: "Linha de base sugerida pelo Copiloto IA — revisar com a unidade.",
        });
      }
    }, "Projeto criado com escopo, atividades e KPIs", "projects");
    if (createdProjectId) setSelectedProjectId(createdProjectId);
  }

  async function submitContact(contact: Partial<Contact> & Pick<Contact, "name" | "company" | "segment">) {
    await perform(async () => { await saveContact(supabase, contact); }, contact.id ? "Contato atualizado" : "Contato criado");
    setContactModal(null);
  }

  async function removeContact(contact: Contact) {
    if (!window.confirm(`Excluir o contato ${contact.name}?`)) return;
    await perform(async () => { await deleteContact(supabase, contact.id); }, "Contato excluído");
    setContactModal(null);
  }

  async function submitActivity(activity: ActivityInput) {
    let completed = false;
    await perform(async () => {
      const previous = activity.id ? data.activities.find((item) => item.id === activity.id) : null;
      if (previous?.google_event_id && !activity.sync_to_google && !googleCalendar?.connected) {
        throw new Error("Reconecte o Google Agenda antes de remover este evento sincronizado.");
      }
      const id = await saveActivity(supabase, activity);
      if (activity.sync_to_google) await syncActivityToGoogle(id);
      else if (previous?.google_event_id) await deleteActivityFromGoogle(id);
      completed = true;
    }, activity.id ? "Atividade atualizada" : "Atividade criada", "agenda");
    if (completed) {
      setActivityModal(null);
      void reloadGoogleCalendar(true);
    }
  }

  async function completeActivity(activity: Activity) {
    await perform(async () => { await setActivityStatus(supabase, activity.id, "done"); }, "Atividade concluída");
  }

  async function removeActivity(activity: Activity) {
    if (!window.confirm(`Excluir a atividade “${activity.title}”?`)) return;
    await perform(async () => {
      if (activity.google_event_id && googleCalendar?.connected) await deleteActivityFromGoogle(activity.id);
      await deleteActivity(supabase, activity.id);
    }, "Atividade excluída");
    void reloadGoogleCalendar(true);
  }

  async function submitClient(id: string, payload: Partial<Client>) {
    await perform(async () => { await updateClient(supabase, id, payload); }, "Cliente atualizado");
    setClientModal(null);
  }

  async function removeClient(client: Client) {
    if (!window.confirm(`Excluir o cliente ${client.name}?`)) return;
    await perform(async () => { await deleteClient(supabase, client.id); }, "Cliente excluído");
    setClientModal(null);
  }

  async function submitUnit(input: UnitInput) {
    await perform(async () => { await saveUnit(supabase, input); }, input.id ? "Unidade atualizada" : "Unidade criada", "units");
    setUnitModal(null);
  }

  async function removeUnit(unit: Unit) {
    if (!window.confirm(`Excluir a unidade ${unit.name} e todos os programas vinculados?`)) return;
    await perform(async () => { await deleteUnit(supabase, unit.id); }, "Unidade excluída", "units");
    setUnitModal(null); setSelectedUnitId(null);
  }

  async function submitTemplate(input: ProgramTemplateInput) {
    await perform(async () => { await saveProgramTemplate(supabase, input); }, input.id ? "Modelo atualizado" : "Modelo personalizado criado", "programs");
    setTemplateModal(null);
  }

  async function removeTemplate(template: ProgramTemplate) {
    if (template.is_system || !window.confirm(`Excluir o modelo personalizado “${template.name}”?`)) return;
    await perform(async () => { await deleteProgramTemplate(supabase, template.id); }, "Modelo excluído");
    setTemplateModal(null);
  }

  async function submitProgram(input: ConsultingProgramInput) {
    await perform(async () => { await saveConsultingProgram(supabase, input); }, input.role === "main" ? "Programa principal atribuído" : "Trilha complementar adicionada", "units");
    setProgramModal(null); setSelectedUnitId(input.unit_id);
  }

  async function submitManagedProgram(id: string, payload: Partial<ConsultingProgram>) {
    await perform(async () => { await updateConsultingProgram(supabase, id, payload); }, "Programa atualizado");
    setManagedProgram(null);
  }

  async function removeProgram(program: ConsultingProgram) {
    const complement = program.role === "main" ? " As trilhas vinculadas também serão excluídas." : "";
    if (!window.confirm(`Excluir “${program.name}”?${complement}`)) return;
    await perform(async () => { await deleteConsultingProgram(supabase, program.id); }, "Programa excluído");
    setManagedProgram(null);
    if (selectedProjectId === program.id) setSelectedProjectId(null);
  }

  function openProject(id: string) {
    setSelectedProjectId(id); setSelectedUnitId(null); setQuery(""); setActiveView("projects");
  }

  function openNewProjectItem(status: ProjectItemStatus = "backlog", phaseIndex: number | null = null) {
    if (!selectedProject) return;
    setProjectItemModal({ initial: null, programId: selectedProject.id, defaultStatus: status, defaultPhaseIndex: phaseIndex });
  }

  async function submitProjectItem(input: ProjectItemInput) {
    await perform(async () => { await saveProjectItem(supabase, input); }, input.id ? "Item atualizado" : "Item criado no projeto");
    setProjectItemModal(null);
  }

  async function removeProjectItem(item: ProjectItem) {
    if (!window.confirm(`Excluir o item “${item.title}”?`)) return;
    await perform(async () => { await deleteProjectItem(supabase, item.id); }, "Item excluído do projeto");
    setProjectItemModal(null);
  }

  async function handleProjectItemMove(id: string, status: ProjectItemStatus, position: number) {
    await perform(async () => { await moveProjectItem(supabase, id, status, position); }, "Item movido no Kanban");
  }

  async function handleProjectMove(project: ConsultingProgram, status: ProgramStatus) {
    if (project.status === status) return;
    if ((status === "completed" || status === "cancelled") && project.role === "main") {
      const action = status === "completed" ? "concluir" : "cancelar";
      if (!window.confirm(`Deseja ${action} o programa principal “${project.name}”? As trilhas conectadas receberão o mesmo status.`)) return;
    }
    await perform(async () => { await updateConsultingProgram(supabase, project.id, { status }); }, `Projeto movido para ${programStatusLabel[status].toLocaleLowerCase("pt-BR")}`);
  }

  async function handlePhaseUpdate(project: ConsultingProgram, phaseIndex: number, name: string, objective: string, makeCurrent: boolean) {
    await perform(async () => { await updateProgramPhase(supabase, project, phaseIndex, name, objective, makeCurrent); }, "Etapa e objetivo atualizados");
  }

  async function submitProjectKpi(input: ProjectKpiInput) {
    await perform(async () => { await saveProjectKpi(supabase, input); }, input.id ? "KPI e medição atualizados" : "KPI adicionado ao projeto");
    setKpiModal(null);
  }

  async function removeProjectKpi(kpi: ProjectKpi) {
    if (!window.confirm(`Excluir o KPI “${kpi.name}” e seu histórico de medições?`)) return;
    await perform(async () => { await deleteProjectKpi(supabase, kpi.id); }, "KPI excluído do projeto");
    setKpiModal(null);
  }

  function exportOpportunities() {
    const header = ["empresa", "contato", "email", "telefone", "segmento", "valor", "etapa", "prioridade", "probabilidade", "prazo", "status"];
    const rows = data.opportunities.map((item) => [item.company, item.contact?.name, item.contact?.email, item.contact?.phone, item.segment, item.value, item.stage, item.priority, item.probability, item.due_date, item.status]);
    download("nexo-crm-oportunidades.csv", `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\n")}`, "text/csv;charset=utf-8");
    toast("Oportunidades exportadas");
  }

  function exportBackup() {
    download(`nexo-crm-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2), "application/json");
    toast("Backup completo exportado");
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { setError("A planilha não possui registros para importar."); return; }
    const delimiter = lines[0].includes(";") ? ";" : ",";
    const parse = (line: string) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, "").replaceAll('""', '"'));
    const headers = parse(lines[0]).map((item) => item.toLocaleLowerCase("pt-BR"));
    const index = (name: string) => headers.indexOf(name);
    if (index("empresa") < 0 || index("contato") < 0) { setError("A planilha precisa conter as colunas empresa e contato."); return; }
    setBusy(true); setError("");
    try {
      for (const line of lines.slice(1, 101)) {
        const row = parse(line);
        const stage = (row[index("etapa")] || "lead") as Stage;
        await saveOpportunity(supabase, {
          company: row[index("empresa")], contact_name: row[index("contato")],
          contact_email: row[index("email")] || "", contact_phone: row[index("telefone")] || "",
          segment: row[index("segmento")] || "Serviços", value: Number(String(row[index("valor")] || "0").replaceAll(".", "").replace(",", ".")) || 0,
          stage: stages.some((item) => item.id === stage) ? stage : "lead", priority: "normal",
          probability: { lead: 10, qualification: 30, diagnosis: 50, proposal: 70, negotiation: 90 }[stages.some((item) => item.id === stage) ? stage : "lead"],
          due_date: row[index("prazo")] || "",
        });
      }
      await reload(true); toast(`${Math.min(lines.length - 1, 100)} registros importados`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "A importação falhou."); }
    finally { setBusy(false); }
  }

  if (!authReady) return <LoadingScreen label="Preparando seu CRM" />;
  if (!session) return <AuthScreen />;

  const userName = session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Consultor";
  const activePrograms = data.consultingPrograms.filter((item) => programOpenStatuses.includes(item.status));
  const primaryAction = activeView === "copilot"
    ? { label: "IA pronta", icon: <Sparkles size={18} />, run: () => undefined }
    : activeView === "projects"
    ? selectedProject
      ? { label: "Novo item", icon: <Plus size={18} />, run: () => openNewProjectItem() }
      : { label: "Atribuir projeto", icon: <Plus size={18} />, run: () => { setActiveView("units"); setSelectedUnitId(null); } }
    : activeView === "units"
    ? { label: "Nova unidade", icon: <Plus size={18} />, run: () => setUnitModal("new") }
    : activeView === "programs"
      ? { label: "Novo modelo", icon: <Plus size={18} />, run: () => setTemplateModal("new") }
      : activeView === "agenda"
        ? { label: "Nova atividade", icon: <Plus size={18} />, run: () => setActivityModal("new") }
      : { label: "Nova oportunidade", icon: <Plus size={18} />, run: () => setOpportunityModal("new") };

  return <div className="crm-shell">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><span className="brand-mark"><Sparkles size={19} /></span><span>Nexo <strong>CRM</strong></span><button className="icon-button close-menu" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)}><X size={19} /></button></div>
      <nav className="main-nav" aria-label="Navegação principal">{navItems.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={`nav-item ${activeView === id ? "active" : ""}`} onClick={() => { setActiveView(id); if (id !== "copilot") setAiOpportunityId(null); setQuery(""); setSelectedUnitId(null); setSelectedProjectId(null); setSidebarOpen(false); }}><Icon size={19} /><span>{label}</span>{id === "units" && <b>{data.units.length}</b>}{id === "projects" && <b>{activePrograms.length}</b>}{id === "pipeline" && <b>{openOpportunities.length}</b>}</button>)}</nav>
      <div className="sidebar-summary"><span>Portfólio ativo</span><strong>{data.units.filter((item) => item.lifecycle_status === "active").length} <small>unidades</small></strong><div><i style={{ width: `${data.units.length ? data.units.filter((item) => item.lifecycle_status === "active").length / data.units.length * 100 : 0}%` }} /></div><small>{activePrograms.length} programas e trilhas em acompanhamento</small></div>
      <button className="profile" type="button" onClick={() => void supabase.auth.signOut()}><span className="avatar profile-avatar">{initials(userName)}</span><span><strong>{userName}</strong><small>{session.user.email}</small></span><LogOut size={15} /></button>
    </aside>
    {sidebarOpen && <button className="scrim" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}

    <main className="workspace">
      <header className="topbar"><div className="welcome"><button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><div><p>{headings[activeView].kicker}</p><h1>{selectedUnit && activeView === "units" ? selectedUnit.name : selectedProject && activeView === "projects" ? selectedProject.name : headings[activeView].title}</h1><span>{selectedUnit && activeView === "units" ? "Visão 360º da unidade" : selectedProject && activeView === "projects" ? "Hub operacional do projeto" : headings[activeView].subtitle}</span></div></div><div className="top-actions"><button className="icon-button notify" aria-label="Atividades atrasadas" onClick={() => { setSelectedUnitId(null); setSelectedProjectId(null); setActiveView("agenda"); }}><Bell size={20} />{overdue.length > 0 && <span>{overdue.length}</span>}</button><button className="primary-button" type="button" onClick={primaryAction.run}>{primaryAction.icon} {primaryAction.label}</button></div></header>
      {error && <div className="error-banner"><AlertIcon /> <span>{error}</span><button aria-label="Fechar erro" onClick={() => setError("")}><X size={16} /></button></div>}
      {loading ? <LoadingPanel /> : <>
        {activeView === "overview" && <Overview units={data.units} programs={data.consultingPrograms} overdue={overdue} upcoming={upcoming} onOpenUnit={(id) => { setSelectedUnitId(id); setActiveView("units"); }} onAddUnit={() => { setUnitModal("new"); setActiveView("units"); }} onNavigate={setActiveView} />}
        {activeView === "copilot" && <AICopilot units={data.units} opportunities={openOpportunities} initialOpportunityId={aiOpportunityId} onApplyProject={applyAiProject} />}
        {activeView === "projects" && <ProjectsArea selectedProjectId={selectedProjectId} programs={data.consultingPrograms} units={data.units} items={data.projectItems} kpis={data.projectKpis} measurements={data.kpiMeasurements} query={query} setQuery={setQuery} onOpenProject={openProject} onBack={() => setSelectedProjectId(null)} onGoUnits={() => { setSelectedProjectId(null); setActiveView("units"); }} onAddItem={openNewProjectItem} onEditItem={(item) => setProjectItemModal({ initial: item, programId: item.program_id, defaultStatus: item.board_status, defaultPhaseIndex: item.phase_index })} onMoveItem={(id, status, position) => void handleProjectItemMove(id, status, position)} onMoveProject={(project, status) => void handleProjectMove(project, status)} onManageProject={setManagedProgram} onUpdatePhase={(project, phaseIndex, name, objective, makeCurrent) => void handlePhaseUpdate(project, phaseIndex, name, objective, makeCurrent)} onAddKpi={() => setKpiModal("new")} onEditKpi={setKpiModal} />}
        {activeView === "units" && (selectedUnit ? <Unit360 unit={selectedUnit} programs={data.consultingPrograms} onBack={() => setSelectedUnitId(null)} onEdit={() => setUnitModal(selectedUnit)} onDelete={() => void removeUnit(selectedUnit)} onAssign={(role) => setProgramModal({ unit: selectedUnit, role })} onManageProgram={setManagedProgram} onOpenProject={openProject} /> : <UnitsView units={filteredUnits} programs={data.consultingPrograms} query={query} setQuery={setQuery} onAdd={() => setUnitModal("new")} onEdit={setUnitModal} onOpen={setSelectedUnitId} />)}
        {activeView === "programs" && <ProgramsView templates={data.programTemplates} programs={data.consultingPrograms} onAdd={() => setTemplateModal("new")} onEdit={setTemplateModal} onDelete={(template) => void removeTemplate(template)} />}
        {activeView === "pipeline" && <PipelineView opportunities={filteredOpportunities} totalPipeline={totalPipeline} weightedPipeline={weightedPipeline} query={query} setQuery={setQuery} onSelect={setSelectedOpportunity} onMove={handleMove} onAdd={() => setOpportunityModal("new")} onImport={importCsv} onExport={exportOpportunities} />}
        {activeView === "contacts" && <ContactsView contacts={filteredContacts} query={query} setQuery={setQuery} onAdd={() => setContactModal("new")} onEdit={setContactModal} />}
        {activeView === "clients" && <ClientsView clients={data.clients} onEdit={setClientModal} />}
        {activeView === "agenda" && <AgendaView activities={data.activities} googleCalendar={googleCalendar} googleCalendars={googleCalendars} googleEvents={googleEvents} googleLoading={googleLoading} googleBusy={googleBusy} onConnectGoogle={() => void connectGoogleCalendar()} onDisconnectGoogle={() => void disconnectGoogle()} onSelectGoogleCalendar={(id) => void chooseGoogleCalendar(id)} onRefreshGoogle={() => void refreshGoogleEvents()} onAdd={() => setActivityModal("new")} onEdit={setActivityModal} onComplete={completeActivity} onDelete={removeActivity} />}
        {activeView === "reports" && <ReportsView opportunities={data.opportunities} clients={data.clients} activities={data.activities} totalPipeline={totalPipeline} weightedPipeline={weightedPipeline} conversion={conversion} onBackup={exportBackup} />}
      </>}
    </main>

    {opportunityModal && <OpportunityModal initial={opportunityModal === "new" ? null : opportunityModal} busy={busy} onClose={() => setOpportunityModal(null)} onSubmit={submitOpportunity} />}
    {contactModal && <ContactModal initial={contactModal === "new" ? null : contactModal} busy={busy} onClose={() => setContactModal(null)} onSubmit={submitContact} onDelete={removeContact} />}
    {activityModal && <ActivityModal initial={activityModal === "new" ? null : activityModal} opportunities={openOpportunities} clients={data.clients} units={data.units} programs={data.consultingPrograms} googleConnected={Boolean(googleCalendar?.connected)} busy={busy} onClose={() => setActivityModal(null)} onSubmit={submitActivity} />}
    {clientModal && <ClientModal client={clientModal} busy={busy} onClose={() => setClientModal(null)} onSubmit={submitClient} onDelete={removeClient} />}
    {unitModal && <UnitModal initial={unitModal === "new" ? null : unitModal} busy={busy} onClose={() => setUnitModal(null)} onSubmit={submitUnit} onDelete={removeUnit} />}
    {templateModal && <ProgramTemplateModal initial={templateModal === "new" ? null : templateModal} busy={busy} onClose={() => setTemplateModal(null)} onSubmit={submitTemplate} onDelete={removeTemplate} />}
    {programModal && <ProgramAssignmentModal unit={programModal.unit} role={programModal.role} templates={data.programTemplates} programs={data.consultingPrograms} busy={busy} onClose={() => setProgramModal(null)} onSubmit={submitProgram} />}
    {managedProgram && <ProgramManageModal program={managedProgram} busy={busy} onClose={() => setManagedProgram(null)} onSubmit={submitManagedProgram} onDelete={removeProgram} />}
    {projectItemModal && <ProjectItemModal initial={projectItemModal.initial} programId={projectItemModal.programId} phases={data.consultingPrograms.find((program) => program.id === projectItemModal.programId)?.scope_snapshot.phases ?? []} defaultStatus={projectItemModal.defaultStatus} defaultPhaseIndex={projectItemModal.defaultPhaseIndex} nextPosition={Math.max(0, ...data.projectItems.filter((item) => item.program_id === projectItemModal.programId).map((item) => item.position)) + 1000} busy={busy} onClose={() => setProjectItemModal(null)} onSubmit={submitProjectItem} onDelete={(item) => void removeProjectItem(item)} />}
    {kpiModal && selectedProject && <KpiModal key={kpiModal === "new" ? "new" : kpiModal.id} initial={kpiModal === "new" ? null : kpiModal} programId={selectedProject.id} busy={busy} onClose={() => setKpiModal(null)} onSubmit={submitProjectKpi} onDelete={(kpi) => void removeProjectKpi(kpi)} />}
    {selectedOpportunity && <OpportunityDrawer item={selectedOpportunity} busy={busy} onClose={() => setSelectedOpportunity(null)} onMove={handleMove} onEdit={(item) => { setOpportunityModal(item); setSelectedOpportunity(null); }} onAskAi={(item) => { setAiOpportunityId(item.id); setSelectedOpportunity(null); setActiveView("copilot"); }} onWon={markWon} onLost={markLost} onArchive={archiveOpportunity} onDelete={removeOpportunity} />}
    {busy && <div className="busy-indicator"><LoaderCircle size={16} className="spin" /> Salvando</div>}
    {notice && <div className="toast" role="status"><CheckCircle2 size={17} /> {notice}</div>}
  </div>;
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")); const password = String(form.get("password"));
    const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: String(form.get("name") || "Consultor") } } });
    if (result.error) setError(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("Conta criada. Confirme o e-mail enviado pelo Supabase e depois entre no CRM.");
    setBusy(false);
  }
  return <main className="auth-page"><section className="auth-brand"><span className="brand-mark"><Sparkles size={22} /></span><span>Nexo <strong>CRM</strong></span><h1>Seu processo comercial, sob controle.</h1><p>Pipeline, contatos, agenda, clientes e indicadores em um único ambiente.</p><div className="auth-points"><span><CheckCircle2 size={17} /> Dados protegidos no Supabase</span><span><CheckCircle2 size={17} /> Acesso pessoal e persistente</span><span><CheckCircle2 size={17} /> Backup e exportação a qualquer momento</span></div></section><section className="auth-card"><span className="eyebrow">ACESSO SEGURO</span><h2>{mode === "login" ? "Entrar no Nexo CRM" : "Criar seu acesso"}</h2><p>{mode === "login" ? "Use seu e-mail e senha para acessar seus dados." : "Crie a conta pessoal que será dona dos registros."}</p>{error && <div className="auth-message error">{error}</div>}{message && <div className="auth-message success">{message}</div>}<form onSubmit={submit}>{mode === "signup" && <label>Seu nome<input name="name" required placeholder="Eron Gomes" /></label>}<label>E-mail<input name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com.br" /></label><label>Senha<input name="password" type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 6 caracteres" /></label><button className="primary-button auth-submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin" /> : mode === "login" ? <LogOut size={18} /> : <UserPlus size={18} />}{busy ? "Aguarde" : mode === "login" ? "Entrar" : "Criar conta"}</button></form><button className="auth-switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Primeiro acesso? Criar conta" : "Já tenho conta? Entrar"}</button></section></main>;
}

type BoardProps = { opportunities: Opportunity[]; compact?: boolean; onSelect: (item: Opportunity) => void; onMove: (id: string, stage: Stage) => void; onAdd: () => void };
function PipelineBoard({ opportunities, compact = false, onSelect, onMove, onAdd }: BoardProps) {
  return <div className={`kanban ${compact ? "compact" : ""}`}>{stages.map((stage, stageIndex) => { const items = opportunities.filter((item) => item.stage === stage.id); const value = items.reduce((sum, item) => sum + Number(item.value), 0); return <section className="kanban-column" key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onMove(event.dataTransfer.getData("text/plain"), stage.id)}><div className="column-heading"><div><strong>{stage.label}</strong><span>{money.format(value)}</span></div><b>{items.length}</b></div><div className="stage-line"><i style={{ width: `${28 + stageIndex * 17}%` }} /></div><div className="opportunity-list">{items.map((item) => <article className="opportunity-card" key={item.id} draggable tabIndex={0} onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)} onClick={() => onSelect(item)} onKeyDown={(event) => event.key === "Enter" && onSelect(item)}><div className="card-meta"><span className={`priority-dot ${item.priority}`} />{item.segment}<MoreHorizontal size={14} /></div><h3>{item.company}</h3><strong className="card-value">{money.format(item.value)}</strong><div className="contact-line"><span className="avatar">{initials(item.contact?.name || item.company)}</span><span>{item.contact?.name || "Sem contato"}</span></div><div className="card-foot"><span><CalendarDays size={13} /> {item.due_date ? shortDate.format(new Date(`${item.due_date}T12:00:00`)) : "Sem prazo"}</span><span>{item.probability}%</span></div></article>)}</div>{items.length === 0 && <div className="column-empty">Solte uma oportunidade aqui</div>}<button className="add-card" type="button" onClick={onAdd}><Plus size={14} /> Adicionar</button></section>; })}</div>;
}

function currentMain(unitId: string, programs: ConsultingProgram[]) {
  return programs.find((item) => item.unit_id === unitId && item.role === "main" && programOpenStatuses.includes(item.status));
}

function formatProgramDate(value: string | null) {
  return value ? shortDate.format(new Date(`${value}T12:00:00`)) : "A definir";
}

function Overview({ units, programs, overdue, upcoming, onOpenUnit, onAddUnit, onNavigate }: { units: Unit[]; programs: ConsultingProgram[]; overdue: Activity[]; upcoming: Activity[]; onOpenUnit: (id: string) => void; onAddUnit: () => void; onNavigate: (view: View) => void }) {
  const activeUnits = units.filter((item) => item.lifecycle_status === "active");
  const activePrograms = programs.filter((item) => programOpenStatuses.includes(item.status));
  const tracks = activePrograms.filter((item) => item.role === "track");
  const attention = units.filter((item) => item.priority !== "normal" || item.health_status === "attention" || item.health_status === "critical");

  return <>
    <section className="kpi-grid">
      <Kpi icon={<Building2 size={21} />} label="Unidades ativas" value={String(activeUnits.length)} tone="orange" />
      <Kpi icon={<Route size={21} />} label="Programas principais" value={String(activePrograms.filter((item) => item.role === "main").length)} tone="green" />
      <Kpi icon={<Layers3 size={21} />} label="Trilhas complementares" value={String(tracks.length)} tone="purple" />
      <Kpi icon={<HeartPulse size={21} />} label="Unidades em atenção" value={String(attention.length)} tone="red" />
    </section>
    <section className="dashboard-grid">
      <div className="panel portfolio-panel">
        <div className="section-heading"><div><span className="eyebrow">CARTEIRA DE CAMPO</span><h2>Visão rápida das unidades</h2></div><button className="secondary-button" onClick={() => onNavigate("units")}>Ver portfólio <ArrowRight size={15} /></button></div>
        {units.length ? <div className="portfolio-list">{units.slice(0, 6).map((unit) => {
          const main = currentMain(unit.id, programs);
          const trackCount = main ? programs.filter((item) => item.parent_program_id === main.id && programOpenStatuses.includes(item.status)).length : 0;
          return <button key={unit.id} onClick={() => onOpenUnit(unit.id)}>
            <span className="avatar unit-avatar">{initials(unit.name)}</span>
            <span className="portfolio-unit"><strong>{unit.name}</strong><small>{unit.franchisee_name || "Franqueado não informado"} · {[unit.city, unit.state].filter(Boolean).join("/") || "Local a definir"}</small></span>
            <span className="portfolio-program"><small>Programa principal</small><strong>{main?.name || "Ainda não atribuído"}</strong></span>
            <span className="portfolio-tracks"><Layers3 size={14} /> {trackCount} {trackCount === 1 ? "trilha" : "trilhas"}</span>
            <span className={`health-pill ${unit.health_status}`}>{unitHealthLabel[unit.health_status]}</span>
            <ChevronRight size={16} />
          </button>;
        })}</div> : <EmptyState icon={<Building2 />} title="Comece pelas unidades Tutoreanos" text="Cadastre a primeira unidade para montar a carteira de consultoria e atribuir um programa." action="Nova unidade" onAction={onAddUnit} />}
      </div>
      <aside className="right-rail"><UpcomingCard activities={upcoming} onNavigate={() => onNavigate("agenda")} /><PortfolioAlertsCard overdue={overdue.length} unitsWithoutProgram={units.filter((unit) => !currentMain(unit.id, programs)).length} attention={attention.length} onNavigate={onNavigate} /></aside>
    </section>
  </>;
}

function UnitsView({ units, programs, query, setQuery, onAdd, onEdit, onOpen }: { units: Unit[]; programs: ConsultingProgram[]; query: string; setQuery: (value: string) => void; onAdd: () => void; onEdit: (unit: Unit) => void; onOpen: (id: string) => void }) {
  const activePrograms = programs.filter((item) => programOpenStatuses.includes(item.status));
  const withMain = new Set(activePrograms.filter((item) => item.role === "main").map((item) => item.unit_id));
  const tracks = activePrograms.filter((item) => item.role === "track");
  return <section className="view-stack">
    <div className="mini-metrics unit-metrics"><MiniMetric label="Unidades na carteira" value={String(units.length)} /><MiniMetric label="Com programa principal" value={String(withMain.size)} /><MiniMetric label="Trilhas ativas" value={String(tracks.length)} /><MiniMetric label="Aguardando saúde" value={String(units.filter((item) => item.health_status === "no_data").length)} /></div>
    <div className="list-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Buscar unidade, franqueado ou cidade" /><button className="primary-button" onClick={onAdd}><Plus size={16} /> Nova unidade</button></div>
    {units.length ? <div className="unit-grid">{units.map((unit) => {
      const main = currentMain(unit.id, programs);
      const unitTracks = main ? programs.filter((item) => item.parent_program_id === main.id && programOpenStatuses.includes(item.status)) : [];
      return <article className="unit-card" key={unit.id} role="button" aria-label={`Abrir visão 360º de ${unit.name}`} tabIndex={0} onClick={() => onOpen(unit.id)} onKeyDown={(event) => event.key === "Enter" && onOpen(unit.id)}>
        <div className="unit-card-top"><span className={`status-pill ${unit.lifecycle_status}`}>{unitLifecycleLabel[unit.lifecycle_status]}</span><button className="icon-button small" aria-label={`Editar ${unit.name}`} onClick={(event) => { event.stopPropagation(); onEdit(unit); }}><Pencil size={14} /></button></div>
        <div className="unit-identity"><span className="avatar unit-avatar large">{initials(unit.name)}</span><div><h2>{unit.name}</h2><span>{unit.franchisee_name || "Franqueado não informado"}</span></div></div>
        <div className="unit-meta"><span><MapPin size={14} /> {[unit.city, unit.state].filter(Boolean).join("/") || "Local a definir"}</span><span><Building2 size={14} /> {unitModelLabel[unit.model]}</span></div>
        <div className="unit-program"><small>PROGRAMA PRINCIPAL</small><strong>{main?.name || "Nenhum programa atribuído"}</strong><span>{main ? `${programStatusLabel[main.status]} · fase: ${main.current_phase || "a definir"}` : "Abra a Visão 360º para atribuir o escopo."}</span></div>
        <div className="unit-card-foot"><span className={`health-pill ${unit.health_status}`}>{unitHealthLabel[unit.health_status]}</span><span><Layers3 size={14} /> {unitTracks.length} {unitTracks.length === 1 ? "trilha" : "trilhas"}</span><span className="open-360">Abrir 360º <ArrowRight size={14} /></span></div>
      </article>;
    })}</div> : <div className="panel"><EmptyState icon={<Building2 />} title={query ? "Nenhuma unidade encontrada" : "Nenhuma unidade cadastrada"} text={query ? "Ajuste sua busca para localizar a unidade." : "Cadastre a primeira unidade Tutoreanos para iniciar o acompanhamento."} action={query ? undefined : "Nova unidade"} onAction={query ? undefined : onAdd} /></div>}
  </section>;
}

function ProgramsView({ templates, programs, onAdd, onEdit, onDelete }: { templates: ProgramTemplate[]; programs: ConsultingProgram[]; onAdd: () => void; onEdit: (template: ProgramTemplate) => void; onDelete: (template: ProgramTemplate) => void }) {
  return <section className="view-stack">
    <div className="mini-metrics unit-metrics"><MiniMetric label="Modelos disponíveis" value={String(templates.length)} /><MiniMetric label="Modelos padrão" value={String(templates.filter((item) => item.is_system).length)} /><MiniMetric label="Sob medida" value={String(templates.filter((item) => item.is_custom).length)} /><MiniMetric label="Programas atribuídos" value={String(programs.length)} /></div>
    <div className="program-library-head"><div><span className="eyebrow">BIBLIOTECA DE PROGRAMAS</span><h2>Escopos reutilizáveis e personalizados</h2><p>Cada atribuição gera uma fotografia do escopo; futuras edições no modelo não alteram projetos em andamento.</p></div><button className="primary-button" onClick={onAdd}><Plus size={16} /> Novo modelo sob medida</button></div>
    <div className="template-grid">{templates.map((template) => {
      const usage = programs.filter((item) => item.template_id === template.id).length;
      return <article className="template-card" key={template.id}>
        <div className="template-card-top"><span className={`template-kind ${template.is_system ? "system" : "custom"}`}>{template.is_system ? "Modelo Tutoreanos" : "Sob medida"}</span><span>v{template.version}</span></div>
        <div className="template-icon"><BookOpen size={22} /></div><h2>{template.name}</h2><p>{template.objective}</p>
        <div className="template-stats"><span><Clock3 size={14} /> {template.duration_weeks} semanas</span><span><Route size={14} /> {template.phases.length} fases</span><span><Building2 size={14} /> {usage} em uso</span></div>
        <div className="phase-preview">{template.phases.slice(0, 4).map((phase, index) => <span key={`${template.id}-${phase.name}`}><i>{index + 1}</i>{phase.name}</span>)}{template.phases.length > 4 && <small>+ {template.phases.length - 4} fases no escopo</small>}</div>
        {template.is_custom ? <div className="template-actions"><button className="secondary-button" onClick={() => onEdit(template)}><Pencil size={14} /> Editar</button><button className="danger-button" onClick={() => onDelete(template)}><Trash2 size={14} /> Excluir</button></div> : <div className="template-locked"><CheckCircle2 size={15} /> Modelo padrão protegido</div>}
      </article>;
    })}</div>
  </section>;
}

function Unit360({ unit, programs, onBack, onEdit, onDelete, onAssign, onManageProgram, onOpenProject }: { unit: Unit; programs: ConsultingProgram[]; onBack: () => void; onEdit: () => void; onDelete: () => void; onAssign: (role: ProgramRole) => void; onManageProgram: (program: ConsultingProgram) => void; onOpenProject: (id: string) => void }) {
  const main = currentMain(unit.id, programs);
  const unitPrograms = programs.filter((item) => item.unit_id === unit.id);
  const tracks = main ? unitPrograms.filter((item) => item.parent_program_id === main.id) : [];
  const activeTracks = tracks.filter((item) => programOpenStatuses.includes(item.status));
  const closedPrograms = unitPrograms.filter((item) => item.status === "completed" || item.status === "cancelled");
  const phases = main?.scope_snapshot.phases ?? [];
  return <section className="unit360 view-stack">
    <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Voltar para o portfólio</button>
    <div className="unit360-hero panel"><div className="unit360-main"><div className="unit360-badges"><span className={`status-pill ${unit.lifecycle_status}`}>{unitLifecycleLabel[unit.lifecycle_status]}</span><span className={`health-pill ${unit.health_status}`}>{unitHealthLabel[unit.health_status]}</span>{unit.priority !== "normal" && <span className={`priority-pill ${unit.priority}`}>Prioridade {unit.priority === "critical" ? "crítica" : "atenção"}</span>}</div><div className="unit-identity hero"><span className="avatar unit-avatar xlarge">{initials(unit.name)}</span><div><h2>{unit.name}</h2><span>{unit.franchisee_name || "Franqueado não informado"}</span><p><MapPin size={14} /> {[unit.city, unit.state].filter(Boolean).join("/") || "Local a definir"} · {unitModelLabel[unit.model]}</p></div></div></div><div className="unit360-actions"><button className="secondary-button" onClick={onEdit}><Pencil size={15} /> Editar unidade</button>{!main && <button className="primary-button" onClick={() => onAssign("main")}><Plus size={15} /> Atribuir programa</button>}</div></div>
    <div className="unit360-stats"><MiniMetric label="Programa principal" value={main ? "1 ativo" : "Pendente"} /><MiniMetric label="Trilhas complementares" value={String(activeTracks.length)} /><MiniMetric label="Progresso automático" value="Etapa 3" /><MiniMetric label="Saúde automática" value={unit.health_score === null ? "Sem dados" : `${unit.health_score}%`} /></div>
    <div className="unit360-layout"><div className="unit360-content">
      <section className="panel main-program-panel"><div className="section-heading"><div><span className="eyebrow">PROGRAMA PRINCIPAL</span><h2>{main?.name || "Escopo ainda não atribuído"}</h2></div>{main && <div className="program-heading-actions"><button className="secondary-button" onClick={() => onManageProgram(main)}><Pencil size={14} /> Gerenciar</button><button className="primary-button" onClick={() => onOpenProject(main.id)}><Route size={14} /> Abrir projeto</button></div>}</div>
        {main ? <><p className="program-objective">{main.objective}</p><div className="program-summary"><span><Route size={15} /><i><small>Status</small><strong>{programStatusLabel[main.status]}</strong></i></span><span><CalendarDays size={15} /><i><small>Período</small><strong>{formatProgramDate(main.start_date)} — {formatProgramDate(main.end_date)}</strong></i></span><span><CircleGauge size={15} /><i><small>Fase atual</small><strong>{main.current_phase || "A definir"}</strong></i></span></div><div className="automatic-note"><Sparkles size={16} /><span><strong>Progresso 100% automático</strong><small>Na Etapa 3, reuniões, entregas, ações e resultados-chave alimentarão o percentual sem edição manual.</small></span></div><div className="scope-roadmap"><div className="scope-heading"><span>Escopo congelado na atribuição</span><strong>{phases.length} fases</strong></div>{phases.map((phase, index) => <div className={`scope-phase ${phase.name === main.current_phase ? "current" : ""}`} key={`${main.id}-${phase.name}`}><span>{index + 1}</span><div><strong>{phase.name}</strong><small>{phase.objective || "Objetivo a detalhar"}</small></div>{phase.name === main.current_phase && <em>Atual</em>}</div>)}</div></> : <EmptyState icon={<Route />} title="Defina o programa principal" text="Escolha um modelo padrão ou sob medida para registrar o objetivo, período e escopo desta unidade." action="Atribuir programa" onAction={() => onAssign("main")} />}
      </section>
      <section className="panel tracks-panel"><div className="section-heading"><div><span className="eyebrow">TRILHAS COMPLEMENTARES</span><h2>Frentes adicionais de acompanhamento</h2></div><button className="secondary-button" disabled={!main} onClick={() => onAssign("track")}><Plus size={14} /> Adicionar trilha</button></div>{tracks.length ? <div className="track-list">{tracks.map((track) => <button key={track.id} onClick={() => onOpenProject(track.id)}><span className="track-icon"><Layers3 size={17} /></span><span><strong>{track.name}</strong><small>{track.current_phase || "Fase a definir"} · {programStatusLabel[track.status]}</small></span><span>{formatProgramDate(track.end_date)}</span><ChevronRight size={15} /></button>)}</div> : <div className="inline-empty"><Layers3 size={18} /><span><strong>Nenhuma trilha complementar</strong><small>{main ? "Adicione frentes específicas sem substituir o programa principal." : "Atribua primeiro o programa principal da unidade."}</small></span></div>}{closedPrograms.length > 0 && <div className="closed-programs"><span>Histórico</span>{closedPrograms.map((item) => <button key={item.id} onClick={() => onManageProgram(item)}><strong>{item.name}</strong><small>{programStatusLabel[item.status]} · {formatProgramDate(item.end_date)}</small><ChevronRight size={14} /></button>)}</div>}</section>
    </div><aside className="unit360-side">
      <section className="panel unit-profile"><span className="eyebrow">PERFIL DA UNIDADE</span><h2>Contexto 360º</h2><dl><div><dt>Franqueado</dt><dd>{unit.franchisee_name || "Não informado"}</dd></div><div><dt>Modelo</dt><dd>{unitModelLabel[unit.model]}</dd></div><div><dt>E-mail</dt><dd>{unit.email || "Não informado"}</dd></div><div><dt>Telefone</dt><dd>{unit.phone || "Não informado"}</dd></div></dl>{unit.diagnosis && <div className="profile-note"><strong>Diagnóstico inicial</strong><p>{unit.diagnosis}</p></div>}{unit.context && <div className="profile-note"><strong>Contexto atual</strong><p>{unit.context}</p></div>}{unit.notes && <div className="profile-note"><strong>Observações</strong><p>{unit.notes}</p></div>}</section>
      <section className="panel next-package"><Sparkles size={18} /><div><span className="eyebrow">GESTÃO DO PROJETO</span><h3>Kanban e prioridades disponíveis</h3><p>Abra o projeto para acompanhar ações, entregas, marcos e a Matriz GUT da unidade.</p></div></section>
      <button className="danger-link" onClick={onDelete}><Trash2 size={14} /> Excluir unidade e programas</button>
    </aside></div>
  </section>;
}

function PipelineView({ opportunities, totalPipeline, weightedPipeline, query, setQuery, onSelect, onMove, onAdd, onImport, onExport }: { opportunities: Opportunity[]; totalPipeline: number; weightedPipeline: number; query: string; setQuery: (value: string) => void; onSelect: (item: Opportunity) => void; onMove: (id: string, stage: Stage) => void; onAdd: () => void; onImport: (file: File) => void; onExport: () => void }) {
  return <section className="view-stack"><div className="mini-metrics"><MiniMetric label="Valor total" value={money.format(totalPipeline)} /><MiniMetric label="Pipeline ponderado" value={money.format(weightedPipeline)} /><MiniMetric label="Negócios ativos" value={String(opportunities.length)} /><MiniMetric label="Ticket médio" value={money.format(opportunities.length ? totalPipeline / opportunities.length : 0)} /></div><div className="panel pipeline-full"><div className="section-heading"><div><span className="eyebrow">FUNIL COMPLETO</span><h2>Oportunidades por etapa</h2></div><div className="controls wrap"><SearchField value={query} onChange={setQuery} placeholder="Empresa, contato ou segmento" /><label className="secondary-button file-button"><Upload size={15} /> Importar CSV<input type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && onImport(event.target.files[0])} /></label><button className="secondary-button" onClick={onExport}><Download size={15} /> Exportar</button></div></div>{opportunities.length ? <PipelineBoard opportunities={opportunities} onSelect={onSelect} onMove={onMove} onAdd={onAdd} /> : <EmptyState icon={<Target />} title="Nenhuma oportunidade encontrada" text={query ? "Ajuste sua busca ou limpe o filtro." : "Cadastre ou importe suas primeiras oportunidades."} action="Nova oportunidade" onAction={onAdd} />}</div></section>;
}

function ContactsView({ contacts, query, setQuery, onAdd, onEdit }: { contacts: Contact[]; query: string; setQuery: (value: string) => void; onAdd: () => void; onEdit: (contact: Contact) => void }) {
  return <section className="view-stack"><div className="list-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Buscar contato, empresa ou segmento" /><button className="primary-button" onClick={onAdd}><UserPlus size={16} /> Novo contato</button></div><div className="panel table-panel"><div className="table-summary"><div><span className="eyebrow">BASE COMERCIAL</span><h2>Todos os contatos</h2></div><span>{contacts.length} registros</span></div>{contacts.length ? <div className="data-table"><div className="table-row contacts-head table-head"><span>Contato</span><span>Empresa</span><span>Segmento</span><span>Cargo</span><span>Telefone</span><span></span></div>{contacts.map((contact) => <button className="table-row contacts-row" key={contact.id} onClick={() => onEdit(contact)}><span className="person-cell"><i className="avatar">{initials(contact.name)}</i><i><strong>{contact.name}</strong><small>{contact.email || "Sem e-mail"}</small></i></span><span><strong>{contact.company || "Sem empresa"}</strong></span><span><em>{contact.segment}</em></span><span><strong>{contact.role || "Não informado"}</strong></span><span><strong>{contact.phone || "Não informado"}</strong></span><span><Pencil size={15} /></span></button>)}</div> : <EmptyState icon={<UsersRound />} title="Nenhum contato cadastrado" text="Cadastre um decisor ou crie uma oportunidade." action="Novo contato" onAction={onAdd} />}</div></section>;
}

function ClientsView({ clients, onEdit }: { clients: Client[]; onEdit: (client: Client) => void }) {
  const active = clients.filter((item) => item.status === "active"); const recurring = active.reduce((sum, item) => sum + Number(item.monthly_value), 0); const health = active.length ? Math.round(active.reduce((sum, item) => sum + item.health, 0) / active.length) : 0;
  return <section className="view-stack"><div className="client-overview"><MiniMetric label="Clientes ativos" value={String(active.length)} /><MiniMetric label="Receita recorrente" value={money.format(recurring)} /><MiniMetric label="Saúde média" value={`${health}%`} /><MiniMetric label="Projetos concluídos" value={String(clients.filter((item) => item.status === "completed").length)} /></div>{clients.length ? <div className="client-grid">{clients.map((client) => <article className="client-card" key={client.id}><div className="client-top"><span className="avatar client-avatar">{initials(client.name)}</span><div><h2>{client.name}</h2><span>{client.project}</span></div><button className="icon-button" onClick={() => onEdit(client)} aria-label={`Editar ${client.name}`}><Pencil size={16} /></button></div><div className="health-row"><span>Saúde da conta</span><strong className={client.health >= 75 ? "green" : client.health >= 55 ? "orange" : "red"}>{client.health}%</strong></div><div className="health-bar"><i className={client.health >= 75 ? "green" : client.health >= 55 ? "orange" : "red"} style={{ width: `${client.health}%` }} /></div><dl><div><dt>Valor mensal</dt><dd>{money.format(client.monthly_value)}</dd></div><div><dt>Progresso</dt><dd>{client.progress}%</dd></div></dl><div className="client-next"><CalendarDays size={16} /><span><small>Próxima ação</small><strong>{client.next_action || "Definir próximo passo"}</strong></span></div><button className="card-action" onClick={() => onEdit(client)}>Gerenciar cliente <ArrowRight size={15} /></button></article>)}</div> : <EmptyState icon={<Building2 />} title="Nenhum cliente ativo" text="Ao marcar uma oportunidade como ganha, o cliente será criado automaticamente." />}</section>;
}

function AgendaView({ activities, googleCalendar, googleCalendars, googleEvents, googleLoading, googleBusy, onConnectGoogle, onDisconnectGoogle, onSelectGoogleCalendar, onRefreshGoogle, onAdd, onEdit, onComplete, onDelete }: {
  activities: Activity[];
  googleCalendar: GoogleCalendarStatus | null;
  googleCalendars: GoogleCalendarOption[];
  googleEvents: GoogleCalendarEvent[];
  googleLoading: boolean;
  googleBusy: boolean;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onSelectGoogleCalendar: (id: string) => void;
  onRefreshGoogle: () => void;
  onAdd: () => void;
  onEdit: (activity: Activity) => void;
  onComplete: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
}) {
  const pending = activities.filter((item) => item.status === "pending");
  const done = activities.filter((item) => item.status === "done");
  const synced = activities.filter((item) => item.google_sync_status === "synced");
  return <section className="view-stack">
    <GoogleCalendarPanel status={googleCalendar} calendars={googleCalendars} events={googleEvents} loading={googleLoading} busy={googleBusy} onConnect={onConnectGoogle} onDisconnect={onDisconnectGoogle} onSelectCalendar={onSelectGoogleCalendar} onRefresh={onRefreshGoogle} />
    <div className="list-toolbar"><div className="mini-metrics agenda-metrics"><MiniMetric label="Pendentes" value={String(pending.length)} /><MiniMetric label="Concluídas" value={String(done.length)} /><MiniMetric label="Atrasadas" value={String(pending.filter((item) => new Date(item.due_at) < new Date()).length)} /><MiniMetric label="No Google" value={String(synced.length)} /></div><button className="primary-button" onClick={onAdd}><Plus size={16} /> Nova atividade</button></div>
    <div className="panel activity-panel"><div className="table-summary"><div><span className="eyebrow">PRÓXIMOS PASSOS</span><h2>Atividades do CRM</h2></div><span>{activities.length} registros</span></div>{activities.length ? <div className="activity-list">{activities.map((activity) => <article className={`activity-row ${activity.status}`} key={activity.id}><button className="activity-check" aria-label="Concluir atividade" disabled={activity.status !== "pending"} onClick={() => onComplete(activity)}>{activity.status === "done" ? <Check size={15} /> : <span />}</button><span className={`activity-type ${activity.type}`}>{activity.type.replace("_", " ")}</span><button className="activity-main" onClick={() => onEdit(activity)}><strong>{activity.title}</strong><small>{activity.details || "Sem observações"}</small>{activity.google_sync_status !== "not_synced" && <em className={`google-sync-pill ${activity.google_sync_status}`}><CalendarDays size={11} /> {activity.google_sync_status === "synced" ? "Google Agenda" : activity.google_sync_status === "error" ? "Erro de sincronização" : "Sincronizando"}</em>}</button><span className={activity.status === "pending" && new Date(activity.due_at) < new Date() ? "activity-date overdue" : "activity-date"}><Clock3 size={14} /> {dateTime.format(new Date(activity.due_at))}</span>{activity.google_event_link && <a className="icon-button small google-link" href={activity.google_event_link} target="_blank" rel="noreferrer" aria-label="Abrir no Google Agenda"><ExternalLink size={14} /></a>}<button className="icon-button small" onClick={() => onEdit(activity)} aria-label="Editar"><Pencil size={14} /></button><button className="icon-button small danger" onClick={() => onDelete(activity)} aria-label="Excluir"><Trash2 size={14} /></button></article>)}</div> : <EmptyState icon={<CalendarDays />} title="Agenda vazia" text="Crie follow-ups, reuniões e tarefas para manter o ritmo comercial." action="Nova atividade" onAction={onAdd} />}</div>
  </section>;
}

function GoogleCalendarPanel({ status, calendars, events, loading, busy, onConnect, onDisconnect, onSelectCalendar, onRefresh }: {
  status: GoogleCalendarStatus | null;
  calendars: GoogleCalendarOption[];
  events: GoogleCalendarEvent[];
  loading: boolean;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSelectCalendar: (id: string) => void;
  onRefresh: () => void;
}) {
  return <>
    <section className="panel google-calendar-panel">
      <div className="google-calendar-brand"><span className="google-calendar-icon"><CalendarDays size={22} /></span><div><span className="eyebrow">INTEGRAÇÃO DE AGENDA</span><h2>Google Agenda</h2><p>Centralize compromissos e sincronize reuniões dos projetos.</p></div></div>
      {loading ? <div className="google-calendar-loading"><LoaderCircle className="spin" size={19} /> Verificando conexão</div> : !status ? <div className="google-calendar-loading">Aguardando status da integração</div> : !status.configured ? <div className="google-calendar-setup"><span><strong>Configuração segura pendente</strong><small>Adicione as credenciais OAuth do Google Cloud no Supabase para liberar a conexão.</small></span><code>{status.redirect_uri}</code></div> : !status.connected ? <div className="google-calendar-connect"><span><strong>Conecte sua conta Google</strong><small>O CRM solicitará somente acesso às agendas e aos eventos autorizados.</small></span><button className="primary-button" disabled={busy} onClick={onConnect}><Link2 size={16} /> Conectar Google Agenda</button></div> : <div className="google-calendar-connected"><div className="google-account"><span className="connection-dot" /><span><strong>{status.connection?.google_email || "Conta Google conectada"}</strong><small>Sincronização ativa</small></span></div><label>Agenda padrão<select value={status.connection?.calendar_id || "primary"} disabled={busy} onChange={(event) => onSelectCalendar(event.target.value)}>{calendars.length ? calendars.map((calendar) => <option value={calendar.id} key={calendar.id}>{calendar.summary}{calendar.primary ? " · principal" : ""}</option>) : <option value={status.connection?.calendar_id || "primary"}>{status.connection?.calendar_summary || "Agenda principal"}</option>}</select></label><div className="google-calendar-actions"><button className="secondary-button" disabled={busy} onClick={onRefresh}><RefreshCw size={15} className={busy ? "spin" : ""} /> Atualizar</button><button className="secondary-button disconnect" disabled={busy} onClick={onDisconnect}><Unplug size={15} /> Desconectar</button></div></div>}
    </section>
    {status?.connected && <section className="panel google-events-panel"><div className="table-summary"><div><span className="eyebrow">AGENDA GOOGLE</span><h2>Próximos compromissos</h2></div><span>{events.length} eventos</span></div>{events.length ? <div className="google-event-list">{events.slice(0, 12).map((event) => <article key={event.id}><span className="google-event-date"><strong>{event.all_day ? shortDate.format(new Date(`${event.starts_at}T12:00:00`)) : shortDate.format(new Date(event.starts_at))}</strong><small>{event.all_day ? "Dia inteiro" : new Date(event.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></span><span><strong>{event.title}</strong><small>{event.location || event.description || "Compromisso do Google Agenda"}</small></span>{event.html_link && <a href={event.html_link} target="_blank" rel="noreferrer" aria-label={`Abrir ${event.title} no Google Agenda`}><ExternalLink size={15} /></a>}</article>)}</div> : <div className="google-events-empty"><CalendarDays size={20} /><span><strong>Nenhum compromisso futuro</strong><small>A agenda selecionada está livre no período consultado.</small></span></div>}</section>}
  </>;
}

function ReportsView({ opportunities, clients, activities, totalPipeline, weightedPipeline, conversion, onBackup }: { opportunities: Opportunity[]; clients: Client[]; activities: Activity[]; totalPipeline: number; weightedPipeline: number; conversion: number; onBackup: () => void }) {
  const open = opportunities.filter((item) => item.status === "open"); const won = opportunities.filter((item) => item.status === "won"); const lost = opportunities.filter((item) => item.status === "lost"); const wonValue = won.reduce((sum, item) => sum + Number(item.value), 0); const monthly = clients.filter((item) => item.status === "active").reduce((sum, item) => sum + Number(item.monthly_value), 0); const funnel = stages.map((stage) => ({ ...stage, count: open.filter((item) => item.stage === stage.id).length })); const max = Math.max(1, ...funnel.map((item) => item.count));
  return <section className="view-stack"><div className="report-toolbar"><span>Indicadores consolidados</span><button className="secondary-button" onClick={onBackup}><FileJson size={15} /> Exportar backup JSON</button></div><div className="report-kpis"><Kpi icon={<CircleDollarSign size={21} />} label="Pipeline total" value={money.format(totalPipeline)} tone="orange" /><Kpi icon={<Target size={21} />} label="Ponderado" value={money.format(weightedPipeline)} tone="green" /><Kpi icon={<Trophy size={21} />} label="Vendas ganhas" value={money.format(wonValue)} tone="purple" /><Kpi icon={<TrendingUp size={21} />} label="Receita recorrente" value={money.format(monthly)} tone="blue" /></div><div className="reports-grid"><div className="panel chart-panel"><div className="chart-heading"><div><span className="eyebrow">VOLUME ATUAL</span><h2>Oportunidades por etapa</h2></div><strong>{open.length}<small>negócios abertos</small></strong></div>{opportunities.length ? <div className="stage-chart">{funnel.map((item) => <div key={item.id}><span><strong>{item.label}</strong><small>{item.count} oportunidades</small></span><div><i style={{ width: `${item.count / max * 100}%` }} /></div><b>{money.format(open.filter((opportunity) => opportunity.stage === item.id).reduce((sum, opportunity) => sum + Number(opportunity.value), 0))}</b></div>)}</div> : <EmptyState icon={<BarChart3 />} title="Ainda não há dados para analisar" text="Os gráficos serão atualizados conforme você usar o CRM." />}</div><div className="panel funnel-panel"><span className="eyebrow">RESULTADOS</span><h2>Saúde comercial</h2><div className="result-list"><div><span>Conversão</span><strong>{conversion}%</strong></div><div><span>Ganhos</span><strong>{won.length}</strong></div><div><span>Perdidos</span><strong>{lost.length}</strong></div><div><span>Atividades concluídas</span><strong>{activities.filter((item) => item.status === "done").length}</strong></div></div><div className="insight-box"><Sparkles size={17} /><span><strong>Leitura automática</strong><small>{open.length ? `Você possui ${open.length} oportunidades abertas e ${activities.filter((item) => item.status === "pending").length} atividades pendentes.` : "Cadastre oportunidades para começar a gerar inteligência comercial."}</small></span></div></div></div></section>;
}

function UnitModal({ initial, busy, onClose, onSubmit, onDelete }: { initial: Unit | null; busy: boolean; onClose: () => void; onSubmit: (input: UnitInput) => void; onDelete: (unit: Unit) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      id: initial?.id,
      name: String(form.get("name")),
      franchisee_name: String(form.get("franchisee_name") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      city: String(form.get("city") || ""),
      state: String(form.get("state") || ""),
      model: String(form.get("model")) as Unit["model"],
      lifecycle_status: String(form.get("lifecycle_status")) as Unit["lifecycle_status"],
      priority: String(form.get("priority")) as Unit["priority"],
      diagnosis: String(form.get("diagnosis") || ""),
      context: String(form.get("context") || ""),
      notes: String(form.get("notes") || ""),
    });
  }
  return <Modal title={initial ? "Editar unidade" : "Nova unidade Tutoreanos"} kicker="VISÃO 360º" onClose={onClose}><form onSubmit={submit}>
    <label>Nome da unidade<input name="name" required minLength={2} defaultValue={initial?.name} placeholder="Ex.: Tutoreanos Belo Horizonte" /></label>
    <div className="form-row"><label>Franqueado(a)<input name="franchisee_name" defaultValue={initial?.franchisee_name || ""} placeholder="Nome do responsável" /></label><label>Modelo da unidade<select name="model" defaultValue={initial?.model || "physical"}><option value="physical">Unidade física</option><option value="home_based">Home based</option><option value="hybrid">Híbrida</option></select></label></div>
    <div className="form-row"><label>E-mail<input name="email" type="email" defaultValue={initial?.email || ""} placeholder="unidade@tutoreanos.com.br" /></label><label>Telefone<input name="phone" defaultValue={initial?.phone || ""} placeholder="(31) 99999-9999" /></label></div>
    <div className="form-row"><label>Cidade<input name="city" defaultValue={initial?.city || ""} /></label><label>UF<input name="state" maxLength={2} defaultValue={initial?.state || ""} placeholder="MG" /></label></div>
    <div className="form-row"><label>Status da unidade<select name="lifecycle_status" defaultValue={initial?.lifecycle_status || "active"}><option value="planning">Em implantação</option><option value="active">Ativa</option><option value="paused">Pausada</option><option value="inactive">Inativa</option></select></label><label>Prioridade consultiva<select name="priority" defaultValue={initial?.priority || "normal"}><option value="normal">Normal</option><option value="attention">Atenção</option><option value="critical">Crítica</option></select></label></div>
    <label>Diagnóstico inicial<textarea name="diagnosis" rows={3} defaultValue={initial?.diagnosis || ""} placeholder="Maturidade, principais desafios e linha de base da unidade." /></label>
    <label>Contexto atual<textarea name="context" rows={3} defaultValue={initial?.context || ""} placeholder="Momento do negócio, equipe, carteira e prioridades." /></label>
    <label>Observações privadas<textarea name="notes" rows={2} defaultValue={initial?.notes || ""} /></label>
    <div className="modal-footer">{initial && <button className="danger-button" type="button" onClick={() => onDelete(initial)}><Trash2 size={15} /> Excluir</button>}<ModalActions busy={busy} onClose={onClose} label={initial ? "Salvar unidade" : "Criar unidade"} /></div>
  </form></Modal>;
}

function ProgramTemplateModal({ initial, busy, onClose, onSubmit, onDelete }: { initial: ProgramTemplate | null; busy: boolean; onClose: () => void; onSubmit: (input: ProgramTemplateInput) => void; onDelete: (template: ProgramTemplate) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phases = String(form.get("phases") || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name, ...objective] = line.split("|");
      return { name: name.trim(), objective: objective.join("|").trim() };
    }).filter((phase) => phase.name);
    if (!phases.length) return;
    onSubmit({ id: initial?.id, name: String(form.get("name")), objective: String(form.get("objective")), duration_weeks: Number(form.get("duration_weeks")), default_role: String(form.get("default_role")) as ProgramRole, phases });
  }
  const phaseText = initial?.phases.map((phase) => `${phase.name}${phase.objective ? ` | ${phase.objective}` : ""}`).join("\n") || "Diagnóstico | Compreender cenário e prioridades\nPlano de execução | Definir ações e responsáveis\nConsolidação | Sustentar a nova rotina";
  return <Modal title={initial ? "Editar modelo sob medida" : "Novo modelo sob medida"} kicker="BIBLIOTECA DE PROGRAMAS" onClose={onClose}><form onSubmit={submit}>
    <label>Nome do programa<input name="name" required minLength={3} defaultValue={initial?.name} placeholder="Ex.: Expansão da carteira regional" /></label>
    <label>Objetivo do acompanhamento<textarea name="objective" required rows={3} defaultValue={initial?.objective || ""} placeholder="Qual transformação este programa deve produzir?" /></label>
    <div className="form-row"><label>Duração de referência (semanas)<input name="duration_weeks" type="number" min="1" max="260" required defaultValue={initial?.duration_weeks || 12} /></label><label>Uso recomendado<select name="default_role" defaultValue={initial?.default_role || "main"}><option value="main">Programa principal</option><option value="track">Trilha complementar</option></select></label></div>
    <label>Fases do escopo<textarea className="phases-input" name="phases" required rows={8} defaultValue={phaseText} /><small className="field-hint">Uma fase por linha. Use “Nome da fase | objetivo da fase”.</small></label>
    <div className="modal-footer">{initial && <button className="danger-button" type="button" onClick={() => onDelete(initial)}><Trash2 size={15} /> Excluir modelo</button>}<ModalActions busy={busy} onClose={onClose} label={initial ? "Salvar modelo" : "Criar modelo"} /></div>
  </form></Modal>;
}

function ProgramAssignmentModal({ unit, role, templates, programs, busy, onClose, onSubmit }: { unit: Unit; role: ProgramRole; templates: ProgramTemplate[]; programs: ConsultingProgram[]; busy: boolean; onClose: () => void; onSubmit: (input: ConsultingProgramInput) => void }) {
  const [templateId, setTemplateId] = useState(templates.find((item) => item.default_role === role)?.id || templates[0]?.id || "");
  const [initialStart] = useState(() => new Date().toISOString().slice(0, 10));
  const template = templates.find((item) => item.id === templateId);
  const main = programs.find((item) => item.unit_id === unit.id && item.role === "main" && programOpenStatuses.includes(item.status));
  const suggestedEnd = template ? new Date(new Date(`${initialStart}T12:00:00`).getTime() + template.duration_weeks * 7 * 86400000).toISOString().slice(0, 10) : "";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!template || (role === "track" && !main)) return;
    const form = new FormData(event.currentTarget);
    onSubmit({
      unit_id: unit.id,
      template_id: template.id,
      parent_program_id: role === "track" ? main?.id : undefined,
      role,
      name: String(form.get("name")),
      objective: String(form.get("objective")),
      status: String(form.get("status")) as ProgramStatus,
      start_date: String(form.get("start_date") || ""),
      end_date: String(form.get("end_date") || ""),
      current_phase: template.phases[0]?.name || "",
      scope_snapshot: { phases: template.phases, template_name: template.name, template_version: template.version },
    });
  }
  return <Modal title={role === "main" ? "Atribuir programa principal" : "Adicionar trilha complementar"} kicker={unit.name} onClose={onClose}><form onSubmit={submit}>
    <label>Modelo de programa<select name="template_id" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>{templates.map((item) => <option value={item.id} key={item.id}>{item.name}{item.is_custom ? " · sob medida" : ""}</option>)}</select></label>
    {template ? <div className="assignment-template" key={template.id}><div><BookOpen size={18} /><span><strong>{template.name}</strong><small>{template.duration_weeks} semanas · {template.phases.length} fases</small></span></div><p>{template.objective}</p><div className="assignment-phases">{template.phases.map((phase, index) => <span key={phase.name}><i>{index + 1}</i>{phase.name}</span>)}</div><label>Nome nesta unidade<input name="name" required defaultValue={template.name} /></label><label>Objetivo nesta unidade<textarea name="objective" required rows={3} defaultValue={template.objective} /></label><div className="form-row three"><label>Início<input name="start_date" type="date" defaultValue={initialStart} /></label><label>Previsão de término<input name="end_date" type="date" defaultValue={suggestedEnd} /></label><label>Status inicial<select name="status" defaultValue="active"><option value="planning">Planejamento</option><option value="active">Em andamento</option><option value="paused">Pausado</option></select></label></div></div> : <div className="inline-empty"><BookOpen size={18} /><span><strong>Nenhum modelo disponível</strong><small>Crie primeiro um modelo na Biblioteca de Programas.</small></span></div>}
    {role === "track" && !main && <div className="auth-message error">Esta unidade precisa ter um programa principal ativo antes de receber uma trilha.</div>}
    <ModalActions busy={busy || !template || (role === "track" && !main)} onClose={onClose} label={role === "main" ? "Atribuir programa" : "Adicionar trilha"} />
  </form></Modal>;
}

function ProgramManageModal({ program, busy, onClose, onSubmit, onDelete }: { program: ConsultingProgram; busy: boolean; onClose: () => void; onSubmit: (id: string, payload: Partial<ConsultingProgram>) => void; onDelete: (program: ConsultingProgram) => void }) {
  const phases = program.scope_snapshot.phases || [];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(program.id, { name: String(form.get("name")), objective: String(form.get("objective")), status: String(form.get("status")) as ProgramStatus, start_date: String(form.get("start_date") || "") || null, end_date: String(form.get("end_date") || "") || null, current_phase: String(form.get("current_phase") || "") || null });
  }
  return <Modal title={program.role === "main" ? "Gerenciar programa principal" : "Gerenciar trilha"} kicker="ESCOPO DA UNIDADE" onClose={onClose}><form onSubmit={submit}>
    <label>Nome<input name="name" required defaultValue={program.name} /></label><label>Objetivo<textarea name="objective" required rows={3} defaultValue={program.objective} /></label>
    <div className="form-row"><label>Status<select name="status" defaultValue={program.status}><option value="planning">Planejamento</option><option value="active">Em andamento</option><option value="at_risk">Em risco</option><option value="paused">Pausado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></label><label>Fase atual<select name="current_phase" defaultValue={program.current_phase || ""}><option value="">A definir</option>{phases.map((phase) => <option value={phase.name} key={phase.name}>{phase.name}</option>)}</select></label></div>
    <div className="form-row"><label>Início<input name="start_date" type="date" defaultValue={program.start_date || ""} /></label><label>Previsão de término<input name="end_date" type="date" defaultValue={program.end_date || ""} /></label></div>
    <div className="automatic-note compact"><CircleGauge size={16} /><span><strong>Progresso bloqueado para edição manual</strong><small>O cálculo usará reuniões, entregas, ações e resultados-chave na Etapa 3.</small></span></div>
    <div className="modal-footer"><button className="danger-button" type="button" onClick={() => onDelete(program)}><Trash2 size={15} /> Excluir</button><ModalActions busy={busy} onClose={onClose} label="Salvar programa" /></div>
  </form></Modal>;
}

function OpportunityModal({ initial, busy, onClose, onSubmit }: { initial: Opportunity | null; busy: boolean; onClose: () => void; onSubmit: (input: OpportunityInput) => void }) {
  const contact = initial?.contact;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); onSubmit({ id: initial?.id, company: String(form.get("company")), contact_name: String(form.get("contact_name")), contact_email: String(form.get("contact_email") || ""), contact_phone: String(form.get("contact_phone") || ""), contact_role: String(form.get("contact_role") || ""), value: Number(form.get("value")), segment: String(form.get("segment")), stage: String(form.get("stage")) as Stage, priority: String(form.get("priority")) as Priority, probability: Number(form.get("probability")), due_date: String(form.get("due_date") || ""), notes: String(form.get("notes") || "") }); }
  return <Modal title={initial ? "Editar oportunidade" : "Nova oportunidade"} kicker="PIPELINE" onClose={onClose}><form onSubmit={submit}><label>Empresa<input name="company" required defaultValue={initial?.company} placeholder="Ex.: Horizonte Alimentos" /></label><div className="form-row"><label>Contato<input name="contact_name" required defaultValue={contact?.name} placeholder="Nome do decisor" /></label><label>Cargo<input name="contact_role" defaultValue={contact?.role || ""} placeholder="Diretor, sócio..." /></label></div><div className="form-row"><label>E-mail<input name="contact_email" type="email" defaultValue={contact?.email || ""} placeholder="decisor@empresa.com.br" /></label><label>Telefone<input name="contact_phone" defaultValue={contact?.phone || ""} placeholder="(31) 99999-9999" /></label></div><div className="form-row"><label>Segmento<input name="segment" required defaultValue={initial?.segment || "Serviços"} /></label><label>Valor estimado<input name="value" type="number" min="0" step="100" required defaultValue={initial?.value || 0} /></label></div><div className="form-row three"><label>Etapa<select name="stage" defaultValue={initial?.stage || "lead"}>{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.label}</option>)}</select></label><label>Prioridade<select name="priority" defaultValue={initial?.priority || "normal"}><option value="normal">Normal</option><option value="attention">Atenção</option><option value="urgent">Urgente</option></select></label><label>Probabilidade<input name="probability" type="number" min="0" max="100" defaultValue={initial?.probability || 10} /></label></div><label>Próxima ação<input name="due_date" type="date" defaultValue={initial?.due_date || ""} /></label><label>Observações<textarea name="notes" defaultValue={initial?.notes || ""} rows={3} placeholder="Contexto, dor e próximos passos" /></label><ModalActions busy={busy} onClose={onClose} label={initial ? "Salvar alterações" : "Criar oportunidade"} /></form></Modal>;
}

function ContactModal({ initial, busy, onClose, onSubmit, onDelete }: { initial: Contact | null; busy: boolean; onClose: () => void; onSubmit: (contact: Partial<Contact> & Pick<Contact, "name" | "company" | "segment">) => void; onDelete: (contact: Contact) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); onSubmit({ id: initial?.id, name: String(form.get("name")), email: String(form.get("email") || ""), phone: String(form.get("phone") || ""), company: String(form.get("company")), segment: String(form.get("segment")), role: String(form.get("role") || ""), notes: String(form.get("notes") || "") }); }
  return <Modal title={initial ? "Editar contato" : "Novo contato"} kicker="RELACIONAMENTO" onClose={onClose}><form onSubmit={submit}><label>Nome<input name="name" required defaultValue={initial?.name} /></label><div className="form-row"><label>Empresa<input name="company" required defaultValue={initial?.company} /></label><label>Cargo<input name="role" defaultValue={initial?.role || ""} /></label></div><div className="form-row"><label>E-mail<input name="email" type="email" defaultValue={initial?.email || ""} /></label><label>Telefone<input name="phone" defaultValue={initial?.phone || ""} /></label></div><label>Segmento<input name="segment" required defaultValue={initial?.segment || "Serviços"} /></label><label>Observações<textarea name="notes" rows={3} defaultValue={initial?.notes || ""} /></label><div className="modal-footer">{initial && <button className="danger-button" type="button" onClick={() => onDelete(initial)}><Trash2 size={15} /> Excluir</button>}<ModalActions busy={busy} onClose={onClose} label="Salvar contato" /></div></form></Modal>;
}

function ActivityModal({ initial, opportunities, clients, units, programs, googleConnected, busy, onClose, onSubmit }: {
  initial: Activity | null;
  opportunities: Opportunity[];
  clients: Client[];
  units: Unit[];
  programs: ConsultingProgram[];
  googleConnected: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (activity: ActivityInput) => void;
}) {
  const [initialStart] = useState(() => toDateInput(initial?.due_at) || toDateInput(new Date(Date.now() + 86400000).toISOString()));
  const [initialEnd] = useState(() => toDateInput(initial?.ends_at) || toDateInput(new Date(new Date(initial?.due_at || Date.now() + 86400000).getTime() + 60 * 60_000).toISOString()));
  const [startAt, setStartAt] = useState(initialStart);
  const [endAt, setEndAt] = useState(initialEnd);
  const [unitId, setUnitId] = useState(initial?.unit_id || "");
  const [programId, setProgramId] = useState(initial?.program_id || "");
  const [syncGoogle, setSyncGoogle] = useState(Boolean(initial?.sync_to_google));
  const unitPrograms = programs.filter((program) => !unitId || program.unit_id === unitId);

  function changeStart(value: string) {
    setStartAt(value);
    if (!endAt || new Date(endAt) <= new Date(value)) setEndAt(toDateInput(new Date(new Date(value).getTime() + 60 * 60_000).toISOString()));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chosenProgram = programs.find((program) => program.id === programId);
    const attendeeEmails = String(form.get("attendee_emails") || "").split(/[;,\n]/).map((email) => email.trim().toLocaleLowerCase()).filter(Boolean);
    onSubmit({
      id: initial?.id,
      title: String(form.get("title")),
      type: String(form.get("type")) as Activity["type"],
      due_at: new Date(startAt).toISOString(),
      ends_at: new Date(endAt).toISOString(),
      details: String(form.get("details") || ""),
      location: String(form.get("location") || ""),
      attendee_emails: attendeeEmails,
      send_invites: form.get("send_invites") === "on",
      sync_to_google: syncGoogle,
      opportunity_id: String(form.get("opportunity_id") || "") || null,
      client_id: String(form.get("client_id") || "") || null,
      unit_id: chosenProgram?.unit_id || unitId || null,
      program_id: programId || null,
    });
  }

  return <Modal title={initial ? "Editar atividade" : "Nova atividade"} kicker="AGENDA INTEGRADA" onClose={onClose}><form onSubmit={submit}>
    <label>Título<input name="title" required defaultValue={initial?.title} placeholder="Ex.: Reunião de acompanhamento da unidade" /></label>
    <div className="form-row three"><label>Tipo<select name="type" defaultValue={initial?.type || "follow_up"}><option value="meeting">Reunião</option><option value="diagnosis">Diagnóstico</option><option value="proposal">Proposta</option><option value="follow_up">Follow-up</option><option value="delivery">Entrega</option><option value="task">Tarefa</option></select></label><label>Início<input name="due_at" type="datetime-local" required value={startAt} onChange={(event) => changeStart(event.target.value)} /></label><label>Término<input name="ends_at" type="datetime-local" required min={startAt} value={endAt} onChange={(event) => setEndAt(event.target.value)} /></label></div>
    <div className="form-row"><label>Unidade<select name="unit_id" value={unitId} onChange={(event) => { setUnitId(event.target.value); setProgramId(""); }}><option value="">Nenhuma</option>{units.map((unit) => <option value={unit.id} key={unit.id}>{unit.name}</option>)}</select></label><label>Projeto<select name="program_id" value={programId} onChange={(event) => { const value = event.target.value; setProgramId(value); const project = programs.find((program) => program.id === value); if (project) setUnitId(project.unit_id); }}><option value="">Nenhum</option>{unitPrograms.map((program) => <option value={program.id} key={program.id}>{program.name}</option>)}</select></label></div>
    <div className="form-row"><label>Oportunidade<select name="opportunity_id" defaultValue={initial?.opportunity_id || ""}><option value="">Nenhuma</option>{opportunities.map((item) => <option value={item.id} key={item.id}>{item.company}</option>)}</select></label><label>Cliente<select name="client_id" defaultValue={initial?.client_id || ""}><option value="">Nenhum</option>{clients.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>
    <div className="form-row"><label>Local ou link da reunião<input name="location" defaultValue={initial?.location || ""} placeholder="Google Meet, endereço ou sala" /></label><label>Convidados<input name="attendee_emails" type="text" defaultValue={initial?.attendee_emails.join(", ") || ""} placeholder="email1@empresa.com, email2@empresa.com" /></label></div>
    <label>Detalhes<textarea name="details" rows={3} defaultValue={initial?.details || ""} placeholder="Pauta, objetivo e resultado esperado" /></label>
    <section className={`activity-google-box ${syncGoogle ? "selected" : ""}`}><span className="google-calendar-icon small"><CalendarDays size={18} /></span><span><strong>Sincronizar com o Google Agenda</strong><small>{googleConnected ? "O evento será criado ou atualizado na agenda selecionada." : "Conecte sua conta Google na tela de Agenda para habilitar."}</small>{initial?.google_sync_error && <em>{initial.google_sync_error}</em>}</span><label className="switch"><input type="checkbox" checked={syncGoogle} disabled={!googleConnected} onChange={(event) => setSyncGoogle(event.target.checked)} /><i /></label></section>
    {syncGoogle && <label className="invite-toggle"><input type="checkbox" name="send_invites" defaultChecked={initial?.send_invites ?? false} /><span><strong>Enviar convites aos participantes</strong><small>O Google notificará os e-mails informados quando o evento for salvo.</small></span></label>}
    <ModalActions busy={busy} onClose={onClose} label={syncGoogle ? "Salvar e sincronizar" : "Salvar atividade"} />
  </form></Modal>;
}

function ClientModal({ client, busy, onClose, onSubmit, onDelete }: { client: Client; busy: boolean; onClose: () => void; onSubmit: (id: string, payload: Partial<Client>) => void; onDelete: (client: Client) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); onSubmit(client.id, { name: String(form.get("name")), project: String(form.get("project")), monthly_value: Number(form.get("monthly_value")), health: Number(form.get("health")), progress: Number(form.get("progress")), next_action: String(form.get("next_action") || ""), next_action_at: form.get("next_action_at") ? new Date(String(form.get("next_action_at"))).toISOString() : null, status: String(form.get("status")) as Client["status"] }); }
  return <Modal title="Gerenciar cliente" kicker="CARTEIRA" onClose={onClose}><form onSubmit={submit}><label>Cliente<input name="name" required defaultValue={client.name} /></label><label>Projeto<input name="project" required defaultValue={client.project} /></label><div className="form-row three"><label>Valor mensal<input name="monthly_value" type="number" min="0" step="100" defaultValue={client.monthly_value} /></label><label>Saúde (%)<input name="health" type="number" min="0" max="100" defaultValue={client.health} /></label><label>Progresso (%)<input name="progress" type="number" min="0" max="100" defaultValue={client.progress} /></label></div><label>Próxima ação<input name="next_action" defaultValue={client.next_action || ""} /></label><div className="form-row"><label>Data da próxima ação<input name="next_action_at" type="datetime-local" defaultValue={toDateInput(client.next_action_at)} /></label><label>Status<select name="status" defaultValue={client.status}><option value="active">Ativo</option><option value="paused">Pausado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></label></div><div className="modal-footer"><button className="danger-button" type="button" onClick={() => onDelete(client)}><Trash2 size={15} /> Excluir</button><ModalActions busy={busy} onClose={onClose} label="Salvar cliente" /></div></form></Modal>;
}

function OpportunityDrawer({ item, busy, onClose, onMove, onEdit, onAskAi, onWon, onLost, onArchive, onDelete }: { item: Opportunity; busy: boolean; onClose: () => void; onMove: (id: string, stage: Stage) => void; onEdit: (item: Opportunity) => void; onAskAi: (item: Opportunity) => void; onWon: (item: Opportunity) => void; onLost: (item: Opportunity) => void; onArchive: (item: Opportunity) => void; onDelete: (item: Opportunity) => void }) {
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><span className={`priority-pill ${item.priority}`}>{item.priority === "urgent" ? "Prioridade alta" : item.priority === "attention" ? "Atenção" : "Em dia"}</span><button className="icon-button" onClick={onClose}><X size={19} /></button></div><span className="eyebrow">OPORTUNIDADE</span><h2>{item.company}</h2><p className="drawer-value">{money.format(item.value)}</p><button className="ai-lead-cta" onClick={() => onAskAi(item)}><span><Bot size={18} /></span><span><strong>Analisar este lead com IA</strong><small>Próximo passo, riscos e mensagem sugerida</small></span><ArrowRight size={15} /></button><div className="drawer-grid"><div><span>Probabilidade</span><strong>{item.probability}%</strong></div><div><span>Próxima ação</span><strong>{item.due_date ? shortDate.format(new Date(`${item.due_date}T12:00:00`)) : "Sem prazo"}</strong></div></div><div className="drawer-section"><h3>Contato principal</h3><div className="drawer-contact"><span className="avatar">{initials(item.contact?.name || item.company)}</span><span><strong>{item.contact?.name || "Sem contato"}</strong><small>{item.segment}</small></span></div>{item.contact?.email && <a href={`mailto:${item.contact.email}`}><Mail size={15} /> {item.contact.email}</a>}{item.contact?.phone && <a href={`tel:${item.contact.phone.replace(/\D/g, "")}`}><Phone size={15} /> {item.contact.phone}</a>}</div><div className="drawer-section"><h3>Mover para</h3><div className="stage-options">{stages.map((stage) => <button className={item.stage === stage.id ? "active" : ""} disabled={busy} key={stage.id} onClick={() => onMove(item.id, stage.id)}>{stage.label}</button>)}</div></div>{item.notes && <div className="drawer-section"><h3>Observações</h3><p className="drawer-notes">{item.notes}</p></div>}<div className="drawer-actions"><button className="secondary-button" onClick={() => onEdit(item)}><Pencil size={15} /> Editar</button><button className="win-button" onClick={() => onWon(item)}><Trophy size={15} /> Ganhar</button><button className="secondary-button" onClick={() => onLost(item)}><CircleX size={15} /> Perder</button><button className="secondary-button" onClick={() => onArchive(item)}><Archive size={15} /> Arquivar</button><button className="danger-button" onClick={() => onDelete(item)}><Trash2 size={15} /> Excluir</button></div></aside></div>;
}

function Modal({ title, kicker, onClose, children }: { title: string; kicker: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">{kicker}</span><h2>{title}</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></div>{children}</section></div>; }
function ModalActions({ busy, onClose, label }: { busy: boolean; onClose: () => void; label: string }) { return <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} type="submit">{busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{busy ? "Salvando" : label}</button></div>; }
function Kpi({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) { return <article className="kpi-card"><span className={`kpi-icon ${tone}`}>{icon}</span><div><p><span>{label}</span><small className={tone}>tempo real</small></p><strong>{value}</strong><div className={`metric-line ${tone}`} /></div></article>; }
function MiniMetric({ label, value }: { label: string; value: string }) { return <article className="mini-metric"><span>{label}</span><strong>{value}</strong></article>; }
function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="search-field"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />{value && <button onClick={() => onChange("")} type="button"><X size={14} /></button>}</label>; }
function EmptyState({ icon, title, text, action, onAction }: { icon: ReactNode; title: string; text: string; action?: string; onAction?: () => void }) { return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action && onAction && <button className="primary-button" onClick={onAction}><Plus size={15} /> {action}</button>}</div>; }
function UpcomingCard({ activities, onNavigate }: { activities: Activity[]; onNavigate: () => void }) { return <section className="panel rail-card"><div className="rail-heading"><div><span className="eyebrow">COMPROMISSOS</span><h2>Próximas atividades</h2></div><CalendarDays size={18} /></div>{activities.length ? <div className="agenda-list">{activities.slice(0, 4).map((item) => <button key={item.id} onClick={onNavigate}><b className="orange">{new Date(item.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b><span><strong>{item.title}</strong><small>{shortDate.format(new Date(item.due_at))}</small></span><i className="orange" /></button>)}</div> : <p className="rail-empty">Nenhuma atividade pendente.</p>}<button className="text-button" onClick={onNavigate}>Ver agenda completa <ArrowRight size={15} /></button></section>; }
function PortfolioAlertsCard({ overdue, unitsWithoutProgram, attention, onNavigate }: { overdue: number; unitsWithoutProgram: number; attention: number; onNavigate: (view: View) => void }) { return <section className="panel rail-card"><div className="rail-heading"><div><span className="eyebrow">PRIORIDADES</span><h2>Alertas da carteira</h2></div><Bell size={18} /></div><div className="alert-list"><button onClick={() => onNavigate("units")}><span className="alert-icon orange"><Route size={16} /></span><span><strong>{unitsWithoutProgram} unidades sem programa</strong><small>Defina o escopo principal</small></span><ChevronRight size={14} /></button><button onClick={() => onNavigate("units")}><span className="alert-icon red"><HeartPulse size={16} /></span><span><strong>{attention} unidades em atenção</strong><small>Revise prioridades consultivas</small></span><ChevronRight size={14} /></button><button onClick={() => onNavigate("agenda")}><span className="alert-icon purple"><Clock3 size={16} /></span><span><strong>{overdue} atividades atrasadas</strong><small>Retome o ritmo de acompanhamento</small></span><ChevronRight size={14} /></button></div></section>; }
function LoadingScreen({ label }: { label: string }) { return <main className="loading-screen"><span className="brand-mark"><Sparkles size={21} /></span><LoaderCircle size={23} className="spin" /><p>{label}</p></main>; }
function LoadingPanel() { return <div className="loading-panel"><LoaderCircle size={24} className="spin" /><strong>Carregando seus dados</strong></div>; }
function AlertIcon() { return <CircleX size={18} />; }
