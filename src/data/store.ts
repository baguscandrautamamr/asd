import { ASDProject, ASDScenario, ActivityLog, CalculationParams, ProjectStatus } from '../types';
import { supabase } from '../lib/supabase';
import type { TranslationKey } from '../i18n/translations';

/**
 * One data interface, two backends.
 *
 * When Supabase is configured every read and write goes there and other
 * sessions are notified over Realtime. When it is not, the same interface is
 * served from localStorage so the calculator stays fully usable offline — the
 * "localStorage first, cloud as sync layer" pattern this project follows.
 */

export interface ProjectDraft {
  title: string;
  clientName: string;
  clientContact: string;
  facilityName: string;
  location: string;
}

export interface ScenarioDraft {
  id?: string;
  name: string;
  revision: string;
  params: CalculationParams;
}

export interface ActivityDraft {
  projectId: string | null;
  actionKey: TranslationKey;
  detailsKey: TranslationKey;
  detailsVars?: Record<string, string | number>;
}

export interface Actor {
  id: string | null;
  name: string;
}

export interface DataStore {
  readonly kind: 'supabase' | 'local';
  listProjects(): Promise<ASDProject[]>;
  listScenarios(projectId: string): Promise<ASDScenario[]>;
  listActivities(): Promise<ActivityLog[]>;
  createProject(
    draft: ProjectDraft,
    params: CalculationParams,
    actor: Actor
  ): Promise<{ project: ASDProject; scenario: ASDScenario }>;
  updateProject(id: string, partial: Partial<ASDProject>, actor: Actor): Promise<ASDProject>;
  deleteProject(id: string, actor: Actor): Promise<void>;
  saveScenario(projectId: string, draft: ScenarioDraft, actor: Actor): Promise<ASDScenario>;
  /** Fires whenever another session changes shared data. Returns an unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

// ---------------------------------------------------------------- utilities --

function nextProjectCode(count: number): string {
  return `ASD-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
}

type ProjectRow = {
  id: string;
  code: string;
  title: string;
  client_name: string;
  client_contact: string;
  facility_name: string;
  location: string;
  status: ProjectStatus;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

function toProject(row: ProjectRow, activeScenarioId = ''): ASDProject {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    clientName: row.client_name,
    clientContact: row.client_contact,
    facilityName: row.facility_name,
    location: row.location,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    updatedBy: row.updated_by,
    activeScenarioId,
  };
}

type ScenarioRow = {
  id: string;
  project_id: string;
  name: string;
  revision: string;
  params: CalculationParams;
  created_at: string;
  updated_at: string;
};

function toScenario(row: ScenarioRow): ASDScenario {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    revision: row.revision,
    params: row.params,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

type ActivityRow = {
  id: string;
  project_id: string | null;
  user_id: string | null;
  user_name: string;
  action_key: string;
  details_key: string;
  details_vars: Record<string, string | number>;
  created_at: string;
};

function toActivity(row: ActivityRow): ActivityLog {
  return {
    id: row.id,
    projectId: row.project_id ?? '',
    userId: row.user_id ?? '',
    userName: row.user_name,
    action: '',
    details: '',
    actionKey: (row.action_key || undefined) as TranslationKey | undefined,
    detailsKey: (row.details_key || undefined) as TranslationKey | undefined,
    detailsVars: row.details_vars,
    timestamp: new Date(row.created_at).getTime(),
  };
}

// ------------------------------------------------------------ supabase store --

class SupabaseStore implements DataStore {
  readonly kind = 'supabase' as const;

  private get client() {
    if (!supabase) throw new Error('Supabase client unavailable');
    return supabase;
  }

  async listProjects(): Promise<ASDProject[]> {
    const { data, error } = await this.client
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as ProjectRow[]).map((row) => toProject(row));
  }

  async listScenarios(projectId: string): Promise<ASDScenario[]> {
    const { data, error } = await this.client
      .from('scenarios')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as ScenarioRow[]).map(toScenario);
  }

  async listActivities(): Promise<ActivityLog[]> {
    const { data, error } = await this.client
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data as ActivityRow[]).map(toActivity);
  }

  private async logActivity(draft: ActivityDraft, actor: Actor) {
    // A failed audit entry must never fail the write it describes.
    const { error } = await this.client.from('activities').insert({
      project_id: draft.projectId,
      user_id: actor.id,
      user_name: actor.name,
      action_key: draft.actionKey,
      details_key: draft.detailsKey,
      details_vars: draft.detailsVars ?? {},
    });
    if (error) console.warn('Activity log failed:', error.message);
  }

  async createProject(draft: ProjectDraft, params: CalculationParams, actor: Actor) {
    if (!actor.id) throw new Error('Sign in required to create a project');

    const { count } = await this.client
      .from('projects')
      .select('id', { count: 'exact', head: true });

    const { data: projectRow, error: projectError } = await this.client
      .from('projects')
      .insert({
        code: nextProjectCode(count ?? 0),
        title: draft.title,
        client_name: draft.clientName,
        client_contact: draft.clientContact,
        facility_name: draft.facilityName,
        location: draft.location,
        status: 'draft',
        owner_id: actor.id,
        updated_by: actor.name,
      })
      .select()
      .single();
    if (projectError) throw projectError;

    const { data: scenarioRow, error: scenarioError } = await this.client
      .from('scenarios')
      .insert({
        project_id: (projectRow as ProjectRow).id,
        name: 'Base Design Calculation',
        revision: 'Rev 1.0',
        params,
      })
      .select()
      .single();
    if (scenarioError) throw scenarioError;

    const scenario = toScenario(scenarioRow as ScenarioRow);
    await this.logActivity(
      {
        projectId: scenario.projectId,
        actionKey: 'act.createProject',
        detailsKey: 'act.createProject.details',
        detailsVars: { title: draft.title },
      },
      actor
    );

    return { project: toProject(projectRow as ProjectRow, scenario.id), scenario };
  }

  async updateProject(id: string, partial: Partial<ASDProject>, actor: Actor) {
    const patch: Record<string, unknown> = { updated_by: actor.name, updated_at: new Date().toISOString() };
    if (partial.status) patch.status = partial.status;
    if (partial.title) patch.title = partial.title;
    if (partial.clientName) patch.client_name = partial.clientName;

    const { data, error } = await this.client
      .from('projects')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    const project = toProject(data as ProjectRow);
    await this.logActivity(
      {
        projectId: id,
        actionKey: partial.status ? 'act.statusChange' : 'act.updateProject',
        detailsKey: partial.status ? 'act.statusChange.details' : 'act.updateProject.details',
        detailsVars: { title: project.title, status: partial.status ?? '' },
      },
      actor
    );
    return project;
  }

  async deleteProject(id: string) {
    const { error } = await this.client.from('projects').delete().eq('id', id);
    if (error) throw error;
  }

  async saveScenario(projectId: string, draft: ScenarioDraft, actor: Actor) {
    let row: ScenarioRow;

    if (draft.id) {
      const { data, error } = await this.client
        .from('scenarios')
        .update({
          name: draft.name,
          revision: draft.revision,
          params: draft.params,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.id)
        .select()
        .single();
      if (error) throw error;
      row = data as ScenarioRow;
    } else {
      const { data, error } = await this.client
        .from('scenarios')
        .insert({
          project_id: projectId,
          name: draft.name,
          revision: draft.revision,
          params: draft.params,
        })
        .select()
        .single();
      if (error) throw error;
      row = data as ScenarioRow;
    }

    await this.client
      .from('projects')
      .update({ updated_at: new Date().toISOString(), updated_by: actor.name })
      .eq('id', projectId);

    await this.logActivity(
      {
        projectId,
        actionKey: 'act.saveScenario',
        detailsKey: 'act.saveScenario.details',
        detailsVars: { name: draft.name, rev: draft.revision },
      },
      actor
    );

    return toScenario(row);
  }

  subscribe(onChange: () => void) {
    const channel = this.client
      .channel('asd-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scenarios' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, onChange)
      .subscribe();

    return () => {
      this.client.removeChannel(channel);
    };
  }
}

// --------------------------------------------------------------- local store --

const LOCAL_KEY = 'asd.localdb.v1';

interface LocalDatabase {
  projects: ASDProject[];
  scenarios: ASDScenario[];
  activities: ActivityLog[];
}

const DEMO_PARAMS: CalculationParams = {
  length: 24,
  width: 16,
  height: 3.8,
  ceilingType: 'suspended_grid',
  ceilingPitchDegrees: 0,
  roomType: 'data_center',
  airChangesPerHour: 28,
  airflowVelocity: 2.2,
  sensitivityClass: 'Class A (High Sensitivity)',
  detectorModel: 'VESDA VEP-A00-P (4-Pipe)',
  pipeCount: 4,
  aspiratorSpeed: 'high',
  detectorLocation: { wall: 'west', positionOffsetRatio: 0.5, heightFromFloor: 1.5 },
  layoutTopology: 'linear',
  pipeRunOrientation: 'lengthwise',
  pipeSpacingMeters: 4.0,
  holeSpacingMeters: 4.0,
  pipeMaterial: 'CPVC Red Fire Alarm 25mm (3/4")',
  capillaryDropEnabled: true,
  capillaryTubeLength: 0.8,
};

function seedDatabase(): LocalDatabase {
  const now = Date.now();
  return {
    projects: [
      {
        id: 'proj-demo-1',
        code: 'ASD-2026-001',
        title: 'Data Center Alpha - Server Hall 1A',
        clientName: 'PT Nusantara Cloud Solutions',
        clientContact: 'engineering@nusantaracloud.id',
        facilityName: 'Cyber Green Building, Jakarta',
        location: 'Jakarta, Indonesia',
        status: 'approved',
        createdAt: now,
        updatedAt: now,
        updatedBy: '—',
        activeScenarioId: 'scen-demo-1',
      },
    ],
    scenarios: [
      {
        id: 'scen-demo-1',
        projectId: 'proj-demo-1',
        name: 'Option A: 4-Pipe High Sensitivity Grid',
        revision: 'Rev 2.0',
        createdAt: now,
        updatedAt: now,
        params: DEMO_PARAMS,
      },
    ],
    activities: [],
  };
}

function readLocal(): LocalDatabase {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as LocalDatabase;
  } catch {
    /* corrupted or unavailable storage — fall through to a fresh seed */
  }
  const seeded = seedDatabase();
  writeLocal(seeded);
  return seeded;
}

function writeLocal(db: LocalDatabase) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Local store write failed:', err);
  }
}

class LocalStore implements DataStore {
  readonly kind = 'local' as const;
  private listeners = new Set<() => void>();

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  async listProjects() {
    return readLocal().projects;
  }

  async listScenarios(projectId: string) {
    return readLocal().scenarios.filter((s) => s.projectId === projectId);
  }

  async listActivities() {
    return readLocal().activities.slice(0, 30);
  }

  private log(db: LocalDatabase, draft: ActivityDraft, actor: Actor) {
    db.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: draft.projectId ?? '',
      userId: actor.id ?? 'local',
      userName: actor.name,
      action: '',
      details: '',
      actionKey: draft.actionKey,
      detailsKey: draft.detailsKey,
      detailsVars: draft.detailsVars,
      timestamp: Date.now(),
    });
  }

  async createProject(draft: ProjectDraft, params: CalculationParams, actor: Actor) {
    const db = readLocal();
    const now = Date.now();
    const project: ASDProject = {
      id: `proj-${now}`,
      code: nextProjectCode(db.projects.length),
      title: draft.title,
      clientName: draft.clientName,
      clientContact: draft.clientContact,
      facilityName: draft.facilityName,
      location: draft.location,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      updatedBy: actor.name,
      activeScenarioId: `scen-${now}`,
    };
    const scenario: ASDScenario = {
      id: `scen-${now}`,
      projectId: project.id,
      name: 'Base Design Calculation',
      revision: 'Rev 1.0',
      createdAt: now,
      updatedAt: now,
      params,
    };

    db.projects.unshift(project);
    db.scenarios.unshift(scenario);
    this.log(
      db,
      {
        projectId: project.id,
        actionKey: 'act.createProject',
        detailsKey: 'act.createProject.details',
        detailsVars: { title: project.title },
      },
      actor
    );
    writeLocal(db);
    this.notify();
    return { project, scenario };
  }

  async updateProject(id: string, partial: Partial<ASDProject>, actor: Actor) {
    const db = readLocal();
    const index = db.projects.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Project not found');

    const project = { ...db.projects[index], ...partial, updatedAt: Date.now(), updatedBy: actor.name };
    db.projects[index] = project;
    this.log(
      db,
      {
        projectId: id,
        actionKey: partial.status ? 'act.statusChange' : 'act.updateProject',
        detailsKey: partial.status ? 'act.statusChange.details' : 'act.updateProject.details',
        detailsVars: { title: project.title, status: partial.status ?? '' },
      },
      actor
    );
    writeLocal(db);
    this.notify();
    return project;
  }

  async deleteProject(id: string) {
    const db = readLocal();
    db.projects = db.projects.filter((p) => p.id !== id);
    db.scenarios = db.scenarios.filter((s) => s.projectId !== id);
    db.activities = db.activities.filter((a) => a.projectId !== id);
    writeLocal(db);
    this.notify();
  }

  async saveScenario(projectId: string, draft: ScenarioDraft, actor: Actor) {
    const db = readLocal();
    const now = Date.now();
    let scenario: ASDScenario;

    const index = draft.id ? db.scenarios.findIndex((s) => s.id === draft.id) : -1;
    if (index !== -1) {
      scenario = {
        ...db.scenarios[index],
        name: draft.name,
        revision: draft.revision,
        params: draft.params,
        updatedAt: now,
      };
      db.scenarios[index] = scenario;
    } else {
      scenario = {
        id: `scen-${now}`,
        projectId,
        name: draft.name,
        revision: draft.revision,
        params: draft.params,
        createdAt: now,
        updatedAt: now,
      };
      db.scenarios.push(scenario);
    }

    const projectIndex = db.projects.findIndex((p) => p.id === projectId);
    if (projectIndex !== -1) {
      db.projects[projectIndex] = {
        ...db.projects[projectIndex],
        updatedAt: now,
        updatedBy: actor.name,
        activeScenarioId: scenario.id,
      };
    }

    this.log(
      db,
      {
        projectId,
        actionKey: 'act.saveScenario',
        detailsKey: 'act.saveScenario.details',
        detailsVars: { name: draft.name, rev: draft.revision },
      },
      actor
    );
    writeLocal(db);
    this.notify();
    return scenario;
  }

  subscribe(onChange: () => void) {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  }
}

export const dataStore: DataStore = supabase ? new SupabaseStore() : new LocalStore();
