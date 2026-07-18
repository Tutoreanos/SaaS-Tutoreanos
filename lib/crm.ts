import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Activity, CRMData, Client, ConsultingProgram, ConsultingProgramInput, Contact,
  KpiMeasurement, Opportunity, OpportunityInput, ProgramTemplate, ProgramTemplateInput,
  ProjectItem, ProjectItemInput, ProjectItemStatus, ProjectKpi, ProjectKpiInput,
  Stage, Unit, UnitInput,
} from "./types";

const probabilityByStage: Record<Stage, number> = {
  lead: 10,
  qualification: 30,
  diagnosis: 50,
  proposal: 70,
  negotiation: 90,
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function requireData<T>(data: T | null, message = "O Supabase não retornou o registro criado."): T {
  if (data === null) throw new Error(message);
  return data;
}

const defaultProgramTemplates = [
  {
    slug: "acompanhamento-tatico-comercial",
    name: "Acompanhamento tático-comercial",
    objective: "Transformar a estratégia comercial da unidade em rotina, cadência e resultados mensuráveis.",
    category: "comercial",
    duration_weeks: 16,
    default_role: "main",
    is_custom: false,
    is_system: true,
    phases: [
      { name: "Diagnóstico comercial e metas", objective: "Estabelecer cenário, prioridades e linha de base." },
      { name: "ICP, oferta e posicionamento", objective: "Aprimorar foco de mercado e proposta de valor." },
      { name: "Funil, pipeline e processo", objective: "Estruturar etapas, critérios e visibilidade comercial." },
      { name: "Prospecção", objective: "Criar uma rotina previsível de geração de oportunidades." },
      { name: "Qualificação e vendas", objective: "Elevar a qualidade das oportunidades e das conversões." },
      { name: "Propostas e negociação", objective: "Aumentar clareza, velocidade e taxa de fechamento." },
      { name: "Indicadores e rotina", objective: "Implantar acompanhamento periódico dos indicadores." },
      { name: "Consolidação e autonomia", objective: "Garantir continuidade da operação pela unidade." },
    ],
  },
  {
    slug: "gestao-carteira-consultoria-empresarial",
    name: "Gestão de carteira de consultoria empresarial",
    objective: "Organizar a carteira da unidade para entregar valor, reter clientes e gerar expansão sustentável.",
    category: "carteira",
    duration_weeks: 20,
    default_role: "main",
    is_custom: false,
    is_system: true,
    phases: [
      { name: "Mapeamento da carteira", objective: "Consolidar clientes, contratos, escopos e situação atual." },
      { name: "Segmentação e priorização", objective: "Definir níveis de atenção, potencial e risco." },
      { name: "Escopo e rotina", objective: "Padronizar acordos, cadências e pontos de controle." },
      { name: "Gestão das entregas", objective: "Dar previsibilidade aos compromissos da carteira." },
      { name: "Acompanhamento de resultados", objective: "Evidenciar valor e evolução em cada projeto." },
      { name: "Retenção, renovação e expansão", objective: "Antecipar movimentos e ampliar valor por cliente." },
      { name: "Indicações e oportunidades", objective: "Ativar novas oportunidades a partir da carteira." },
      { name: "Governança da carteira", objective: "Consolidar a rotina gerencial da unidade." },
    ],
  },
] as const;

export async function ensureDefaultProgramTemplates(client: SupabaseClient, userId: string) {
  const { error } = await client.from("program_templates").upsert(defaultProgramTemplates.map((template) => ({ ...template, user_id: userId })), {
    onConflict: "user_id,slug",
    ignoreDuplicates: true,
  });
  fail(error);
}

export async function fetchCRMData(client: SupabaseClient): Promise<CRMData> {
  const [unitsResult, templatesResult, programsResult, projectItemsResult, projectKpisResult, kpiMeasurementsResult, opportunitiesResult, contactsResult, clientsResult, activitiesResult] = await Promise.all([
    client.from("units").select("*").order("name"),
    client.from("program_templates").select("*").eq("status", "active").order("is_system", { ascending: false }).order("name"),
    client.from("consulting_programs").select("*").order("created_at", { ascending: false }),
    client.from("project_items").select("*").order("position").order("created_at"),
    client.from("project_kpis").select("*").eq("active", true).order("created_at"),
    client.from("kpi_measurements").select("*").order("measured_at"),
    client.from("opportunities").select("*, contact:contacts(*)").order("created_at", { ascending: false }),
    client.from("contacts").select("*").order("name"),
    client.from("clients").select("*").order("created_at", { ascending: false }),
    client.from("activities").select("*").order("due_at"),
  ]);

  fail(unitsResult.error);
  fail(templatesResult.error);
  fail(programsResult.error);
  fail(projectItemsResult.error);
  fail(projectKpisResult.error);
  fail(kpiMeasurementsResult.error);
  fail(opportunitiesResult.error);
  fail(contactsResult.error);
  fail(clientsResult.error);
  fail(activitiesResult.error);

  return {
    units: (unitsResult.data ?? []) as Unit[],
    programTemplates: (templatesResult.data ?? []) as ProgramTemplate[],
    consultingPrograms: (programsResult.data ?? []) as ConsultingProgram[],
    projectItems: (projectItemsResult.data ?? []) as ProjectItem[],
    projectKpis: (projectKpisResult.data ?? []) as ProjectKpi[],
    kpiMeasurements: (kpiMeasurementsResult.data ?? []) as KpiMeasurement[],
    opportunities: (opportunitiesResult.data ?? []) as Opportunity[],
    contacts: (contactsResult.data ?? []) as Contact[],
    clients: (clientsResult.data ?? []) as Client[],
    activities: (activitiesResult.data ?? []) as Activity[],
  };
}

export async function saveUnit(client: SupabaseClient, input: UnitInput) {
  const payload = {
    name: input.name.trim(),
    franchisee_name: input.franchisee_name?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim().toUpperCase() || null,
    model: input.model,
    lifecycle_status: input.lifecycle_status,
    priority: input.priority,
    diagnosis: input.diagnosis?.trim() || null,
    context: input.context?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const { error } = await client.from("units").update(payload).eq("id", input.id);
    fail(error);
    return input.id;
  }

  const { data, error } = await client.from("units").insert(payload).select("id").single();
  fail(error);
  return requireData(data).id as string;
}

export async function deleteUnit(client: SupabaseClient, id: string) {
  const { error } = await client.from("units").delete().eq("id", id);
  fail(error);
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "programa";
}

export async function saveProgramTemplate(client: SupabaseClient, input: ProgramTemplateInput) {
  const payload = {
    name: input.name.trim(),
    objective: input.objective.trim(),
    duration_weeks: input.duration_weeks,
    default_role: input.default_role,
    phases: input.phases.map((phase) => ({ name: phase.name.trim(), objective: phase.objective.trim() })),
  };

  if (input.id) {
    const { error } = await client.from("program_templates").update(payload).eq("id", input.id).eq("is_system", false);
    fail(error);
    return input.id;
  }

  const { data, error } = await client.from("program_templates").insert({
    ...payload,
    slug: `personalizado-${slugify(input.name)}-${Date.now().toString(36)}`,
    category: "personalizado",
    is_custom: true,
    is_system: false,
  }).select("id").single();
  fail(error);
  return requireData(data).id as string;
}

export async function deleteProgramTemplate(client: SupabaseClient, id: string) {
  const { error } = await client.from("program_templates").delete().eq("id", id).eq("is_system", false);
  fail(error);
}

export async function saveConsultingProgram(client: SupabaseClient, input: ConsultingProgramInput) {
  const payload = {
    unit_id: input.unit_id,
    template_id: input.template_id || null,
    parent_program_id: input.parent_program_id || null,
    role: input.role,
    name: input.name.trim(),
    objective: input.objective.trim(),
    status: input.status,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    current_phase: input.current_phase?.trim() || null,
    scope_snapshot: input.scope_snapshot,
  };

  if (input.id) {
    const { error } = await client.from("consulting_programs").update(payload).eq("id", input.id);
    fail(error);
    return input.id;
  }

  const { data, error } = await client.from("consulting_programs").insert(payload).select("id").single();
  if (error?.code === "23505") throw new Error("Esta unidade já possui um programa principal em andamento.");
  fail(error);
  return requireData(data).id as string;
}

export async function updateConsultingProgram(client: SupabaseClient, id: string, payload: Partial<ConsultingProgram>) {
  const allowed = {
    name: payload.name,
    objective: payload.objective,
    status: payload.status,
    start_date: payload.start_date,
    end_date: payload.end_date,
    current_phase: payload.current_phase,
    scope_snapshot: payload.scope_snapshot,
  };
  const { error } = await client.from("consulting_programs").update(allowed).eq("id", id);
  if (error?.code === "23505") throw new Error("Esta unidade já possui outro programa principal em andamento.");
  fail(error);
  if (payload.status === "completed" || payload.status === "cancelled") {
    const { error: tracksError } = await client.from("consulting_programs").update({ status: payload.status }).eq("parent_program_id", id);
    fail(tracksError);
  }
}

export async function updateProgramPhase(client: SupabaseClient, program: ConsultingProgram, phaseIndex: number, name: string, objective: string, makeCurrent: boolean) {
  const phases = [...(program.scope_snapshot.phases ?? [])];
  const previous = phases[phaseIndex];
  if (!previous) throw new Error("A etapa selecionada não existe mais neste projeto.");
  const nextName = name.trim();
  phases[phaseIndex] = { name: nextName, objective: objective.trim() };
  const currentPhase = makeCurrent || program.current_phase === previous.name ? nextName : program.current_phase;
  const { error } = await client.from("consulting_programs").update({
    scope_snapshot: { ...program.scope_snapshot, phases },
    current_phase: currentPhase,
  }).eq("id", program.id);
  fail(error);
}

export async function deleteConsultingProgram(client: SupabaseClient, id: string) {
  const { error } = await client.from("consulting_programs").delete().eq("id", id);
  fail(error);
}

export async function saveProjectItem(client: SupabaseClient, input: ProjectItemInput) {
  const payload = {
    program_id: input.program_id,
    phase_index: input.phase_index ?? null,
    kind: input.kind,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    board_status: input.board_status,
    owner_name: input.owner_name?.trim() || null,
    due_date: input.due_date || null,
    completed_at: input.board_status === "done" ? new Date().toISOString() : null,
    blocked: input.blocked,
    block_reason: input.blocked ? input.block_reason?.trim() || null : null,
    gut_gravity: input.gut_gravity ?? null,
    gut_urgency: input.gut_urgency ?? null,
    gut_tendency: input.gut_tendency ?? null,
    ...(input.position === undefined ? {} : { position: input.position }),
  };

  if (input.id) {
    const { error } = await client.from("project_items").update(payload).eq("id", input.id);
    fail(error);
    return input.id;
  }

  const { data, error } = await client.from("project_items").insert(payload).select("id").single();
  fail(error);
  return requireData(data).id as string;
}

export async function moveProjectItem(client: SupabaseClient, id: string, boardStatus: ProjectItemStatus, position: number) {
  const { error } = await client.from("project_items").update({
    board_status: boardStatus,
    position,
    completed_at: boardStatus === "done" ? new Date().toISOString() : null,
  }).eq("id", id);
  fail(error);
}

export async function deleteProjectItem(client: SupabaseClient, id: string) {
  const { error } = await client.from("project_items").delete().eq("id", id);
  fail(error);
}

export async function saveProjectKpi(client: SupabaseClient, input: ProjectKpiInput) {
  const payload = {
    program_id: input.program_id,
    preset_key: input.preset_key || null,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    category: input.category.trim() || "personalizado",
    unit: input.unit,
    direction: input.direction,
    baseline_value: input.baseline_value,
    current_value: input.current_value,
    target_value: input.target_value,
    frequency: input.frequency,
    last_measured_at: input.measured_at,
  };

  let id = input.id;
  if (id) {
    const { error } = await client.from("project_kpis").update(payload).eq("id", id);
    fail(error);
  } else {
    const { data, error } = await client.from("project_kpis").insert(payload).select("id").single();
    if (error?.code === "23505") throw new Error("Este KPI já foi selecionado para o projeto.");
    fail(error);
    id = requireData(data).id as string;
  }

  const { error: measurementError } = await client.from("kpi_measurements").upsert({
    kpi_id: id,
    value: input.current_value,
    measured_at: input.measured_at,
    note: input.measurement_note?.trim() || null,
  }, { onConflict: "kpi_id,measured_at" });
  fail(measurementError);
  return id;
}

export async function deleteProjectKpi(client: SupabaseClient, id: string) {
  const { error } = await client.from("project_kpis").delete().eq("id", id);
  fail(error);
}

async function findOrCreateContact(client: SupabaseClient, input: OpportunityInput): Promise<string> {
  const email = input.contact_email?.trim() || null;
  if (email) {
    const { data, error } = await client.from("contacts").select("id").ilike("email", email).limit(1).maybeSingle();
    fail(error);
    if (data?.id) {
      const { error: updateError } = await client.from("contacts").update({
        name: input.contact_name,
        phone: input.contact_phone?.trim() || null,
        company: input.company,
        segment: input.segment,
        role: input.contact_role?.trim() || null,
      }).eq("id", data.id);
      fail(updateError);
      return data.id;
    }
  }

  const { data, error } = await client.from("contacts").insert({
    name: input.contact_name,
    email,
    phone: input.contact_phone?.trim() || null,
    company: input.company,
    segment: input.segment,
    role: input.contact_role?.trim() || null,
  }).select("id").single();
  fail(error);
  return requireData(data).id;
}

export async function saveOpportunity(client: SupabaseClient, input: OpportunityInput) {
  const contactId = await findOrCreateContact(client, input);
  const payload = {
    contact_id: contactId,
    company: input.company.trim(),
    value: input.value,
    stage: input.stage,
    priority: input.priority,
    segment: input.segment,
    probability: input.probability,
    due_date: input.due_date || null,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const { error } = await client.from("opportunities").update(payload).eq("id", input.id);
    fail(error);
    return input.id;
  }

  const { data, error } = await client.from("opportunities").insert(payload).select("id").single();
  fail(error);
  return requireData(data).id as string;
}

export async function moveOpportunity(client: SupabaseClient, id: string, stage: Stage) {
  const { error } = await client.from("opportunities").update({ stage, probability: probabilityByStage[stage] }).eq("id", id);
  fail(error);
}

export async function updateOpportunityStatus(client: SupabaseClient, id: string, status: "lost" | "archived", lostReason?: string) {
  const payload = status === "lost"
    ? { status, lost_reason: lostReason || null, probability: 0 }
    : { status, lost_reason: lostReason || null };
  const { error } = await client.from("opportunities").update(payload).eq("id", id);
  fail(error);
}

export async function convertToClient(client: SupabaseClient, id: string) {
  const { data, error } = await client.rpc("convert_opportunity_to_client", { p_opportunity_id: id });
  fail(error);
  return requireData(data, "Não foi possível criar o cliente.") as string;
}

export async function deleteOpportunity(client: SupabaseClient, id: string) {
  const { error } = await client.from("opportunities").delete().eq("id", id);
  fail(error);
}

export async function saveContact(client: SupabaseClient, contact: Partial<Contact> & Pick<Contact, "name" | "company" | "segment">) {
  const payload = { name: contact.name.trim(), email: contact.email?.trim() || null, phone: contact.phone?.trim() || null, company: contact.company.trim(), segment: contact.segment, role: contact.role?.trim() || null, notes: contact.notes?.trim() || null };
  if (contact.id) {
    const { error } = await client.from("contacts").update(payload).eq("id", contact.id);
    fail(error);
    return contact.id;
  }
  const { data, error } = await client.from("contacts").insert(payload).select("id").single();
  fail(error);
  return requireData(data).id as string;
}

export async function deleteContact(client: SupabaseClient, id: string) {
  const { error } = await client.from("contacts").delete().eq("id", id);
  fail(error);
}

export async function saveActivity(client: SupabaseClient, activity: Partial<Activity> & Pick<Activity, "title" | "type" | "due_at">) {
  const payload = { opportunity_id: activity.opportunity_id || null, client_id: activity.client_id || null, title: activity.title.trim(), details: activity.details?.trim() || null, type: activity.type, due_at: activity.due_at };
  if (activity.id) {
    const { error } = await client.from("activities").update(payload).eq("id", activity.id);
    fail(error);
    return activity.id;
  }
  const { data, error } = await client.from("activities").insert(payload).select("id").single();
  fail(error);
  return requireData(data).id as string;
}

export async function setActivityStatus(client: SupabaseClient, id: string, status: "done" | "cancelled") {
  const { error } = await client.from("activities").update({ status, completed_at: status === "done" ? new Date().toISOString() : null }).eq("id", id);
  fail(error);
}

export async function deleteActivity(client: SupabaseClient, id: string) {
  const { error } = await client.from("activities").delete().eq("id", id);
  fail(error);
}

export async function updateClient(client: SupabaseClient, id: string, payload: Partial<Client>) {
  const { error } = await client.from("clients").update(payload).eq("id", id);
  fail(error);
}

export async function deleteClient(client: SupabaseClient, id: string) {
  const { error } = await client.from("clients").delete().eq("id", id);
  fail(error);
}
