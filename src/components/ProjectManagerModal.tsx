import React, { useState } from 'react';
import { ASDProject, ASDScenario, ProjectStatus, CalculationParams } from '../types';
import {
  FolderKanban,
  Plus,
  Search,
  CheckCircle,
  Clock,
  Building2,
  MapPin,
  User,
  Trash2,
  Copy,
  FileCheck,
  X,
  ExternalLink,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'projects' | 'scenarios' | 'new'>('projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New Project Form State
  const [newTitle, setNewTitle] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newFacility, setNewFacility] = useState('');
  const [newLocation, setNewLocation] = useState('Indonesia');

  // Save Scenario Form State
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newScenarioRev, setNewScenarioRev] = useState('Rev 1.1');

  if (!isOpen) return null;

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleSaveScenarioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenarioName.trim()) return;
    onSaveScenario(newScenarioName.trim(), newScenarioRev.trim() || 'Rev 1.0');
    setNewScenarioName('');
    setActiveTab('scenarios');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-600 flex items-center justify-center text-white">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Project & Scenario Management</h3>
              <p className="text-xs text-slate-400">
                Customer calculation records, revisions, and status tracking.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('projects')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'projects'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            All Projects ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'scenarios'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Scenarios & Revisions ({scenarios.length})
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'new'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: ALL PROJECTS LIST */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by client, project title, or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="review">In Review</option>
                    <option value="approved">Approved</option>
                    <option value="as-built">As-Built</option>
                  </select>
                </div>
              </div>

              {/* Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredProjects.map((proj) => {
                  const isCurrent = proj.id === currentProject.id;
                  const statusColors = {
                    draft: 'bg-slate-100 text-slate-700 border-slate-200',
                    review: 'bg-amber-50 text-amber-800 border-amber-200',
                    approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    'as-built': 'bg-blue-50 text-blue-800 border-blue-200',
                  };

                  return (
                    <div
                      key={proj.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        isCurrent
                          ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold text-rose-600">
                            {proj.code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              statusColors[proj.status] || statusColors.draft
                            }`}
                          >
                            {proj.status}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-slate-900 mb-1 leading-snug">
                          {proj.title}
                        </h4>

                        <div className="space-y-1 text-xs text-slate-600 mb-3">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium text-slate-800">{proj.clientName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {proj.facilityName}, {proj.location}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              Updated {new Date(proj.updatedAt).toLocaleDateString('id-ID')} by{' '}
                              {proj.updatedBy}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {/* Status dropdown */}
                        <select
                          value={proj.status}
                          onChange={(e) =>
                            onUpdateProject(proj.id, {
                              status: e.target.value as ProjectStatus,
                            })
                          }
                          className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-700 bg-slate-50 font-medium"
                        >
                          <option value="draft">Draft</option>
                          <option value="review">In Review</option>
                          <option value="approved">Approved</option>
                          <option value="as-built">As-Built</option>
                        </select>

                        <div className="flex items-center gap-1.5">
                          {projects.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete project "${proj.title}"?`)) {
                                  onDeleteProject(proj.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Delete project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              onSelectProject(proj.id);
                              onClose();
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              isCurrent
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            }`}
                          >
                            {isCurrent ? 'Current Project' : 'Load Project'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SCENARIOS & REVISIONS */}
          {activeTab === 'scenarios' && (
            <div className="space-y-5">
              {/* Save current calculation as revision box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">
                  Save Current Calculation as New Scenario
                </h4>
                <form onSubmit={handleSaveScenarioSubmit} className="flex flex-wrap gap-2.5">
                  <input
                    type="text"
                    placeholder="Scenario name (e.g. Option B: 4-Pipe Branched)"
                    value={newScenarioName}
                    onChange={(e) => setNewScenarioName(e.target.value)}
                    className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Revision (e.g. Rev 1.1)"
                    value={newScenarioRev}
                    onChange={(e) => setNewScenarioRev(e.target.value)}
                    className="w-28 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Save Scenario
                  </button>
                </form>
              </div>

              {/* Scenarios List */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Calculation Scenarios for {currentProject.title}
                </h4>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {scenarios.map((scen) => {
                    const isCurrent = scen.id === currentScenario.id;
                    return (
                      <div
                        key={scen.id}
                        className={`p-3.5 flex items-center justify-between gap-4 transition-colors ${
                          isCurrent ? 'bg-rose-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-sm text-slate-900">{scen.name}</span>
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {scen.revision}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            Room: {scen.params.length}m × {scen.params.width}m × {scen.params.height}m |{' '}
                            {scen.params.pipeCount} Pipes | {scen.params.detectorModel}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectScenario(scen.id);
                            onClose();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isCurrent
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {isCurrent ? 'Loaded' : 'Load Scenario'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CREATE NEW PROJECT */}
          {activeTab === 'new' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4 max-w-xl mx-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Center Bravo - Main Colocation Hall"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PT Cloud Nusantara"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Client Contact / Email
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. safety@client.co.id"
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Facility / Building
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cyber 2 Tower Level 5"
                    value={newFacility}
                    onChange={(e) => setNewFacility(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City / Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jakarta, Indonesia"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('projects')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Create Project & Default Scenario
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
