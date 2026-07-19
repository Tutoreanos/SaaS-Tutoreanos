export type View = "overview" | "projects" | "units" | "programs" | "pipeline" | "contacts" | "clients" | "agenda" | "reports";
export type Stage = "lead" | "qualification" | "diagnosis" | "proposal" | "negotiation";
export type Priority = "normal" | "attention" | "urgent";
export type OpportunityStatus = "open" | "won" | "lost" | "archived";
export type ActivityStatus = "pending" | "done" | "cancelled";
export type UnitModel = "home_based" | "physical" | "hybrid";
export type UnitLifecycleStatus = "planning" | "active" | "paused" | "inactive";
export type UnitHealthStatus = "no_data" | "healthy" | "attention" | "critical";
export type UnitPriority = "normal" | "attention" | "critical";
export type ProgramRole = "main" | "track";
export type ProgramStatus = "planning" | "active" | "at_risk" | "paused" | "completed" | "cancelled";
export type ProjectItemKind = "action" | "deliverable" | "milestone";
export type ProjectItemStatus = "backlog" | "planned" | "in_progress" | "waiting" | "done";
export type KpiUnit = "number" | "percent" | "currency" | "days" | "hours" | "score";
export type KpiDirection = "increase" | "decrease" | "maintain";
export type KpiFrequency = "weekly" | "biweekly" | "monthly" | "quarterly";

export type ProgramPhase = {
  name: string;
  objective: string;
};

export type Unit = {
  id: string;
  user_id: string;
  name: string;
  franchisee_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  model: UnitModel;
  lifecycle_status: UnitLifecycleStatus;
  health_status: UnitHealthStatus;
  health_score: number | null;
  priority: UnitPriority;
  diagnosis: string | null;
  context: string | null;
  notes: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProgramTemplate = {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  objective: string;
  category: string;
  duration_weeks: number;
  default_role: ProgramRole;
  is_custom: boolean;
  is_system: boolean;
  version: number;
  status: "active" | "archived";
  phases: ProgramPhase[];
  created_at: string;
  updated_at: string;
};

export type ConsultingProgram = {
  id: string;
  user_id: string;
  unit_id: string;
  template_id: string | null;
  parent_program_id: string | null;
  role: ProgramRole;
  name: string;
  objective: string;
  status: ProgramStatus;
  progress: number;
  health_score: number | null;
  start_date: string | null;
  end_date: string | null;
  current_phase: string | null;
  scope_snapshot: { phases: ProgramPhase[]; template_name?: string; template_version?: number };
  created_at: string;
  updated_at: string;
};

export type ProjectItem = {
  id: string;
  user_id: string;
  program_id: string;
  phase_index: number | null;
  kind: ProjectItemKind;
  title: string;
  description: string | null;
  board_status: ProjectItemStatus;
  owner_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  blocked: boolean;
  block_reason: string | null;
  gut_gravity: number | null;
  gut_urgency: number | null;
  gut_tendency: number | null;
  gut_score: number | null;
  position: number;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ProjectKpi = {
  id: string;
  user_id: string;
  program_id: string;
  preset_key: string | null;
  name: string;
  description: string | null;
  category: string;
  unit: KpiUnit;
  direction: KpiDirection;
  baseline_value: number;
  current_value: number;
  target_value: number;
  frequency: KpiFrequency;
  active: boolean;
  last_measured_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KpiMeasurement = {
  id: string;
  user_id: string;
  kpi_id: string;
  value: number;
  measured_at: string;
  note: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string;
  segment: string;
  role: string | null;
  notes: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type Opportunity = {
  id: string;
  user_id: string;
  contact_id: string | null;
  company: string;
  value: number;
  stage: Stage;
  status: OpportunityStatus;
  priority: Priority;
  segment: string;
  probability: number;
  due_date: string | null;
  notes: string | null;
  lost_reason: string | null;
  won_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact | null;
};

export type Client = {
  id: string;
  user_id: string;
  source_opportunity_id: string | null;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  segment: string;
  project: string;
  monthly_value: number;
  health: number;
  progress: number;
  next_action: string | null;
  next_action_at: string | null;
  status: "active" | "paused" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  user_id: string;
  opportunity_id: string | null;
  client_id: string | null;
  unit_id: string | null;
  program_id: string | null;
  title: string;
  details: string | null;
  type: "meeting" | "diagnosis" | "proposal" | "follow_up" | "delivery" | "task";
  due_at: string;
  ends_at: string | null;
  location: string | null;
  attendee_emails: string[];
  send_invites: boolean;
  sync_to_google: boolean;
  google_event_id: string | null;
  google_calendar_id: string | null;
  google_event_link: string | null;
  google_sync_status: "not_synced" | "pending" | "synced" | "error";
  google_sync_error: string | null;
  google_last_synced_at: string | null;
  status: ActivityStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityInput = Pick<Activity, "title" | "type" | "due_at"> & Partial<Pick<Activity,
  "id" | "opportunity_id" | "client_id" | "unit_id" | "program_id" | "details" | "ends_at" |
  "location" | "attendee_emails" | "send_invites" | "sync_to_google"
>>;

export type CRMData = {
  units: Unit[];
  programTemplates: ProgramTemplate[];
  consultingPrograms: ConsultingProgram[];
  projectItems: ProjectItem[];
  projectKpis: ProjectKpi[];
  kpiMeasurements: KpiMeasurement[];
  opportunities: Opportunity[];
  contacts: Contact[];
  clients: Client[];
  activities: Activity[];
};

export type OpportunityInput = {
  id?: string;
  company: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  contact_role?: string;
  value: number;
  segment: string;
  stage: Stage;
  priority: Priority;
  probability: number;
  due_date?: string;
  notes?: string;
};

export type UnitInput = Pick<Unit, "name" | "model" | "lifecycle_status" | "priority"> & {
  id?: string;
  franchisee_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  diagnosis?: string;
  context?: string;
  notes?: string;
};

export type ProgramTemplateInput = {
  id?: string;
  name: string;
  objective: string;
  duration_weeks: number;
  default_role: ProgramRole;
  phases: ProgramPhase[];
};

export type ConsultingProgramInput = {
  id?: string;
  unit_id: string;
  template_id?: string;
  parent_program_id?: string;
  role: ProgramRole;
  name: string;
  objective: string;
  status: ProgramStatus;
  start_date?: string;
  end_date?: string;
  current_phase?: string;
  scope_snapshot: ConsultingProgram["scope_snapshot"];
};

export type ProjectItemInput = {
  id?: string;
  program_id: string;
  phase_index?: number | null;
  kind: ProjectItemKind;
  title: string;
  description?: string;
  board_status: ProjectItemStatus;
  owner_name?: string;
  due_date?: string;
  blocked: boolean;
  block_reason?: string;
  gut_gravity?: number | null;
  gut_urgency?: number | null;
  gut_tendency?: number | null;
  position?: number;
};

export type ProjectKpiInput = {
  id?: string;
  program_id: string;
  preset_key?: string | null;
  name: string;
  description?: string;
  category: string;
  unit: KpiUnit;
  direction: KpiDirection;
  baseline_value: number;
  current_value: number;
  target_value: number;
  frequency: KpiFrequency;
  measured_at: string;
  measurement_note?: string;
};
