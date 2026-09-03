import React, { useState } from 'react';
import { ASDProject, ASDScenario, ProjectStatus } from '../types';
import { Building2, Clock, Copy, FolderKanban, MapPin, Plus, Search, Trash2, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { detectorKey, statusKey } from '../i18n/labels';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ASDProject[];
  currentProject: ASDProject;
  scenarios: ASDScenario[];
  currentScenario: ASDScenario;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (data: {
    title: string;
    clientName: string;
    clientContact: string;
    facilityName: string;
    location: string;
  }) => void;
  onUpdateProject: (projectId: string, partial: Partial<ASDProject>) => void;
  onDeleteProject: (projectId: string) => void;
  onSaveScenario: (name: string, revision: string) => void;
  onSelectScenario: (scenarioId: string) => void;
}

const STATUSES: ProjectStatus[] = ['draft', 'review', 'approved', 'as-built'];

const STATUS_CLASSES: Record<ProjectStatus, string> = {
  draft: 'bg-surface-3 text-ink-2 border-line-2',
  review: 'bg-warn-wash text-warn border-warn/40',
  approved: 'bg-ok-wash text-ok border-ok/40',
  'as-built': 'bg-info-wash text-info border-info/40',
};

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentProject,
  scenarios,
  currentScenario,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onSaveScenario,
  onSelectScenario,
}) => {
  const { t, n, d } = useI18n();
  const [activeTab, setActiveTab] = useState<'projects' | 'scenarios' | 'new'>('projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [newTitle, setNewTitle] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newFacility, setNewFacility] = useState('');
  const [newLocation, setNewLocation] = useState('Indonesia');

  const [newScenarioName, setNewScenarioName] = useState('');
  const [newScenarioRev, setNewScenarioRev] = useState('Rev 1.1');

  if (!isOpen) return null;

  const filteredProjects = projects.filter((project) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      project.title.toLowerCase().includes(query) ||
      project.clientName.toLowerCase().includes(query) ||
      project.code.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim() || !newClient.trim()) return;
    onCreateProject({
      title: newTitle.trim(),
      clientName: newClient.trim(),
      clientContact: newContact.trim(),
      facilityName: newFacility.trim() || 'Main Facility',
      location: newLocation.trim(),
    });
    setNewTitle('');
    setNewClient('');
    setNewContact('');
    setNewFacility('');
    setActiveTab('projects');
  };

  const handleSaveScenarioSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newScenarioName.trim()) return;
    onSaveScenario(newScenarioName.trim(), newScenarioRev.trim() || 'Rev 1.0');
    setNewScenarioName('');
    setActiveTab('scenarios');
  };

  const tabClass = (active: boolean) =>
    `pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1 ${
      active ? 'border-brand text-brand' : 'border-transparent text-ink-3 hover:text-ink'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="surface-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-6 py-4 bg-surface-3 border-b border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center">
              <FolderKanban className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-ink">{t('pm.title')}</h3>
              <p className="text-xs text-ink-3">{t('pm.subtitle')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('pm.close')}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-line bg-surface-2 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={tabClass(activeTab === 'projects')}
          >
            {t('pm.tabProjects', { n: projects.length })}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scenarios')}
            className={tabClass(activeTab === 'scenarios')}
          >
            {t('pm.tabScenarios', { n: scenarios.length })}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={tabClass(activeTab === 'new')}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('pm.tabNew')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-ink-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t('pm.search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="field pl-9 text-xs"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="field text-xs w-auto"
                >
                  <option value="all">{t('pm.allStatuses')}</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(statusKey[status])}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredProjects.map((project) => {
                  const isCurrent = project.id === currentProject.id;
                  return (
                    <div
                      key={project.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between lift ${
                        isCurrent
                          ? 'border-brand ring-2 ring-brand/20 bg-brand-wash'
                          : 'border-line bg-surface-2'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-xs font-bold text-brand">
                            {project.code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              STATUS_CLASSES[project.status] ?? STATUS_CLASSES.draft
                            }`}
                          >
                            {t(statusKey[project.status] ?? 'opt.status.draft')}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-ink mb-1 leading-snug">
                          {project.title}
                        </h4>

                        <div className="space-y-1 text-xs text-ink-2 mb-3">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                            <span className="font-medium">{project.clientName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-ink-3">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {project.facilityName}, {project.location}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-ink-3 text-[11px]">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {t('pm.updatedBy', {
                                date: d(project.updatedAt),
                                who: project.updatedBy,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                        <select
                          value={project.status}
                          onChange={(e) =>
                            onUpdateProject(project.id, {
                              status: e.target.value as ProjectStatus,
                            })
                          }
                          className="field text-[11px] py-1 w-auto"
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {t(statusKey[status])}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1.5">
                          {projects.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(t('pm.confirmDelete', { title: project.title }))) {
                                  onDeleteProject(project.id);
                                }
                              }}
                              className="p-1.5 text-ink-3 hover:text-bad rounded-lg transition-colors"
                              title={t('pm.deleteProject')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              onSelectProject(project.id);
                              onClose();
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                              isCurrent
                                ? 'bg-brand text-white'
                                : 'bg-surface-3 hover:bg-line text-ink'
                            }`}
                          >
                            {isCurrent ? t('pm.currentProject') : t('pm.loadProject')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'scenarios' && (
            <div className="space-y-5">
              <div className="bg-surface-2 p-4 rounded-2xl border border-line">
                <h4 className="font-bold text-[11px] uppercase tracking-wider text-ink-2 mb-2">
                  {t('pm.saveAsScenario')}
                </h4>
                <form onSubmit={handleSaveScenarioSubmit} className="flex flex-wrap gap-2.5">
                  <input
                    type="text"
                    placeholder={t('pm.scenarioName')}
                    value={newScenarioName}
                    onChange={(e) => setNewScenarioName(e.target.value)}
                    className="field flex-1 min-w-[220px] text-xs"
                  />
                  <input
                    type="text"
                    placeholder={t('pm.revision')}
                    value={newScenarioRev}
                    onChange={(e) => setNewScenarioRev(e.target.value)}
                    className="field w-32 text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-brand hover:brightness-110 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {t('pm.saveScenario')}
                  </button>
                </form>
              </div>

              <div className="space-y-2.5">
                <h4 className="font-bold text-[11px] uppercase tracking-wider text-ink-2">
                  {t('pm.scenariosFor', { title: currentProject.title })}
                </h4>

                <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden bg-surface-2">
                  {scenarios.map((scenario) => {
                    const isCurrent = scenario.id === currentScenario.id;
                    const model = detectorKey[scenario.params.detectorModel];
                    return (
                      <div
                        key={scenario.id}
                        className={`p-3.5 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                          isCurrent ? 'bg-brand-wash' : 'hover:bg-surface-3'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-bold text-sm text-ink">{scenario.name}</span>
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-surface-3 text-ink-2">
                              {scenario.revision}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold text-ok bg-ok-wash px-2 py-0.5 rounded-full">
                                {t('pm.active')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-3">
                            {t('pm.scenarioSummary', {
                              l: n(scenario.params.length, 1),
                              w: n(scenario.params.width, 1),
                              h: n(scenario.params.height, 1),
                              n: scenario.params.pipeCount,
                              model: model ? t(model) : scenario.params.detectorModel,
                            })}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectScenario(scenario.id);
                            onClose();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isCurrent ? 'bg-brand text-white' : 'bg-surface-3 hover:bg-line text-ink'
                          }`}
                        >
                          {isCurrent ? t('pm.loaded') : t('pm.loadScenario')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'new' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4 max-w-xl mx-auto">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  {t('pm.fieldTitle')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('pm.fieldTitlePh')}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="field text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    {t('pm.fieldClient')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('pm.fieldClientPh')}
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    {t('pm.fieldContact')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('pm.fieldContactPh')}
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    className="field text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    {t('pm.fieldFacility')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('pm.fieldFacilityPh')}
                    value={newFacility}
                    onChange={(e) => setNewFacility(e.target.value)}
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    {t('pm.fieldLocation')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('pm.fieldLocationPh')}
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="field text-sm"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('projects')}
                  className="px-4 py-2 text-xs font-semibold text-ink-2 hover:bg-surface-2 rounded-lg transition-colors"
                >
                  {t('pm.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand hover:brightness-110 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {t('pm.create')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
