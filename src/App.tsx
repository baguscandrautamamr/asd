import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ASDProject,
  ASDScenario,
  CalculationParams,
  ActivityLog,
  NotificationToast,
  ProjectStatus,
} from './types';
import { calculateASD } from './utils/nfpa72Calculator';
import { generateTechnicalReportPDF } from './utils/pdfGenerator';
import { FloorPlanCanvas, FloorPlanCanvasRef } from './components/FloorPlanCanvas';
import { ParameterForm } from './components/ParameterForm';
import { ComplianceMatrixTab } from './components/ComplianceMatrixTab';
import { BillOfMaterialsTab } from './components/BillOfMaterialsTab';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import {
  Flame,
  FileDown,
  FolderKanban,
  Bell,
  Save,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
  Check,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';

const defaultParams: CalculationParams = {
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

export default function App() {
  // Projects & Scenarios state
  const [projects, setProjects] = useState<ASDProject[]>([]);
  const [currentProject, setCurrentProject] = useState<ASDProject>({
    id: 'proj-1',
    code: 'ASD-2026-001',
    title: 'Data Center Alpha - Server Hall 1A',
    clientName: 'PT Nusantara Cloud Solutions',
    clientContact: 'engineering@nusantaracloud.id',
    facilityName: 'Cyber Green Building, Jakarta',
    location: 'Jakarta, Indonesia',
    status: 'approved',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    updatedBy: 'Andi Saputra, ST',
    activeScenarioId: 'scen-1',
  });

  const [scenarios, setScenarios] = useState<ASDScenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<ASDScenario>({
    id: 'scen-1',
    projectId: 'proj-1',
    name: 'Option A: 4-Pipe High Sensitivity Grid',
    revision: 'Rev 2.0 (Approved)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    params: defaultParams,
  });

  const [params, setParams] = useState<CalculationParams>(defaultParams);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'compliance' | 'boq'>('visualizer');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Real-time Collaboration & WebSocket State
  const [onlineCount, setOnlineCount] = useState(1);
  const [wsConnected, setWsConnected] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const floorPlanRef = useRef<FloorPlanCanvasRef>(null);

  // Calculate NFPA 72 results in real-time
  const results = useMemo(() => {
    return calculateASD(params);
  }, [params]);

  // Add toast notification
  const addToast = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const newToast: NotificationToast = {
      id: `toast-${Date.now()}-${Math.random()}`,
      title,
      message,
      type,
      timestamp: Date.now(),
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 5000);
  }, []);

  // Fetch initial projects & activities from backend
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0 && !currentProject.id) {
          setCurrentProject(data[0]);
        }
      }
    } catch (err) {
      console.warn('API fetch projects:', err);
    }
  }, [currentProject.id]);

  const fetchScenarios = useCallback(async (projId: string) => {
    try {
      const res = await fetch(`/api/projects/${projId}/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data);
        if (data.length > 0) {
          setCurrentScenario(data[0]);
          setParams(data[0].params);
        }
      }
    } catch (err) {
      console.warn('API fetch scenarios:', err);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/activities');
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.warn('API fetch activities:', err);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchActivities();
  }, [fetchProjects, fetchActivities]);

  useEffect(() => {
    if (currentProject?.id) {
      fetchScenarios(currentProject.id);
    }
  }, [currentProject.id, fetchScenarios]);

  // Connect to WebSocket for real-time cloud sync
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    let socket: WebSocket;

    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init:connected' || msg.type === 'presence:update') {
            setOnlineCount(msg.payload.onlineCount || 1);
          } else if (msg.type === 'scenario:saved') {
            addToast('Calculation Updated', msg.payload.activity.details, 'success');
            fetchActivities();
            if (msg.payload.scenario.projectId === currentProject.id) {
              setScenarios((prev) =>
                prev.map((s) => (s.id === msg.payload.scenario.id ? msg.payload.scenario : s))
              );
            }
          } else if (msg.type === 'project:created') {
            addToast('New Project Created', msg.payload.activity.details, 'info');
            fetchProjects();
            fetchActivities();
          } else if (msg.type === 'project:updated') {
            addToast('Project Status Changed', msg.payload.activity.details, 'info');
            fetchProjects();
            fetchActivities();
          }
        } catch (e) {
          console.error('WS parse error', e);
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
      };
    } catch (err) {
      console.warn('WebSocket connection error:', err);
    }

    return () => {
      if (socket) socket.close();
    };
  }, [addToast, currentProject.id, fetchActivities, fetchProjects]);

  // Quick preset loader
  const handleQuickPreset = (presetName: string) => {
    let p: Partial<CalculationParams> = {};
    if (presetName === 'data_center') {
      p = {
        length: 24,
        width: 16,
        height: 3.8,
        roomType: 'data_center',
        airChangesPerHour: 28,
        airflowVelocity: 2.2,
        sensitivityClass: 'Class A (High Sensitivity)',
        detectorModel: 'VESDA VEP-A00-P (4-Pipe)',
        pipeCount: 4,
        aspiratorSpeed: 'high',
        pipeSpacingMeters: 4.0,
        holeSpacingMeters: 4.0,
        capillaryDropEnabled: true,
      };
    } else if (presetName === 'clean_room') {
      p = {
        length: 18,
        width: 12,
        height: 3.2,
        roomType: 'clean_room',
        airChangesPerHour: 45,
        airflowVelocity: 3.0,
        sensitivityClass: 'Class A (High Sensitivity)',
        detectorModel: 'Securiton ASD 535 (2-Pipe)',
        pipeCount: 2,
        aspiratorSpeed: 'high',
        pipeSpacingMeters: 5.0,
        holeSpacingMeters: 3.5,
        capillaryDropEnabled: false,
      };
    } else if (presetName === 'warehouse') {
      p = {
        length: 40,
        width: 25,
        height: 9.0,
        roomType: 'warehouse',
        airChangesPerHour: 4,
        airflowVelocity: 0.3,
        sensitivityClass: 'Class B (Enhanced)',
        detectorModel: 'VESDA VEU-A00 (High-Sensitivity 4-Pipe)',
        pipeCount: 4,
        aspiratorSpeed: 'high',
        pipeSpacingMeters: 6.0,
        holeSpacingMeters: 6.0,
        capillaryDropEnabled: false,
      };
    } else if (presetName === 'commercial') {
      p = {
        length: 20,
        width: 15,
        height: 3.0,
        roomType: 'general_commercial',
        airChangesPerHour: 6,
        airflowVelocity: 0.5,
        sensitivityClass: 'Class C (Standard)',
        detectorModel: 'VESDA VEP-A00-P (4-Pipe)',
        pipeCount: 2,
        aspiratorSpeed: 'medium',
        pipeSpacingMeters: 6.0,
        holeSpacingMeters: 6.0,
        capillaryDropEnabled: false,
      };
    }
    setParams((prev) => ({ ...prev, ...p }));
    addToast('Preset Applied', `Loaded NFPA 72 parameters for ${presetName.replace('_', ' ')}`, 'info');
  };

  // Save current calculation to database
  const handleSaveCalculation = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentScenario.id,
          name: currentScenario.name,
          revision: currentScenario.revision,
          params,
          author: 'User (You)',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentScenario(data.scenario);
        setSaveFeedback('Calculation Saved!');
        addToast('Saved to Cloud', `Scenario ${data.scenario.name} saved successfully`, 'success');
        fetchActivities();
        setTimeout(() => setSaveFeedback(null), 2500);
      }
    } catch (err) {
      console.error('Error saving calculation:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Generate Technical PDF Report
  const handleExportPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      // Capture 2D floor plan snapshot as high-res PNG
      const planImg = await floorPlanRef.current?.getCanvasImageBase64();
      generateTechnicalReportPDF(currentProject, currentScenario, results, planImg);
      addToast('PDF Report Generated', `Downloaded technical report for ${currentProject.code}`, 'success');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      addToast('Export Failed', 'An error occurred during PDF generation', 'warning');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Create Project handler
  const handleCreateProject = async (data: any) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          params,
          author: 'User (You)',
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setProjects((prev) => [result.project, ...prev]);
        setCurrentProject(result.project);
        setCurrentScenario(result.scenario);
        setParams(result.scenario.params);
        addToast('Project Created', `Initialized project ${result.project.code}`, 'success');
      }
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  // Update Project handler
  const handleUpdateProject = async (projectId: string, partial: Partial<ASDProject>) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...partial,
          updatedBy: 'User (You)',
          statusChange: !!partial.status,
          changeDescription: partial.status ? `Status changed to ${partial.status}` : undefined,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setProjects((prev) => prev.map((p) => (p.id === projectId ? result.project : p)));
        if (currentProject.id === projectId) {
          setCurrentProject(result.project);
        }
        addToast('Project Updated', `Project metadata updated`, 'info');
      }
    } catch (err) {
      console.error('Error updating project:', err);
    }
  };

  // Delete Project handler
  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        const remain = projects.filter((p) => p.id !== projectId);
        setProjects(remain);
        if (remain.length > 0) {
          setCurrentProject(remain[0]);
          fetchScenarios(remain[0].id);
        }
        addToast('Project Deleted', 'Project removed from cloud database', 'info');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  // Save new scenario / revision handler
  const handleSaveScenario = async (name: string, revision: string) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          revision,
          params,
          author: 'User (You)',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setScenarios((prev) => [...prev, data.scenario]);
        setCurrentScenario(data.scenario);
        addToast('Scenario Created', `Saved scenario "${name}" (${revision})`, 'success');
      }
    } catch (err) {
      console.error('Error saving scenario:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand & Project Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-700 to-rose-500 flex items-center justify-center shadow-md">
              <Flame className="w-6 h-6 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight">
                  ASD Pipe &amp; Sampling Calculator
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  NFPA 72 STD
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(true)}
                  className="hover:text-white flex items-center gap-1 font-medium transition-colors"
                >
                  <span className="font-mono text-rose-400 font-bold">{currentProject.code}</span>:
                  <span>{currentProject.title}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-time Cloud Sync Pill */}
            <button
              onClick={() => setIsNotificationDrawerOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition-colors"
              title="Cloud Synchronization & Active Team"
            >
              <div className="relative">
                <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                {wsConnected && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                )}
              </div>
              <span className="hidden md:inline font-medium">
                {wsConnected ? `Cloud Sync (${onlineCount})` : 'Offline'}
              </span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setIsNotificationDrawerOpen(true)}
              className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Activity & Notifications"
            >
              <Bell className="w-4 h-4" />
              {activities.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500"></span>
              )}
            </button>

            {/* Save to Cloud Button */}
            <button
              onClick={handleSaveCalculation}
              disabled={isSaving}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors shadow-xs"
            >
              {saveFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isSaving ? 'Saving...' : 'Save Scenario'}</span>
                </>
              )}
            </button>

            {/* Export PDF Report Button */}
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-md disabled:opacity-75"
            >
              <FileDown className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Building PDF...' : 'Export PDF Report'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Parameter & NFPA 72 Configuration Panel (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            {/* Scenario revision header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Active Calculation
                </span>
                <h2 className="font-bold text-sm text-slate-900">{currentScenario.name}</h2>
              </div>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {currentScenario.revision}
              </span>
            </div>

            {/* Parameter Input Form */}
            <ParameterForm
              params={params}
              onChange={setParams}
              onQuickPreset={handleQuickPreset}
            />
          </div>
        </section>

        {/* Right Column: Visualization & Technical Results Tabs (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          {/* Quick Metrics Header Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Sampling Ports
              </span>
              <span className="text-xl font-mono font-extrabold text-slate-900">
                {results.totalHolesCalculated}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {(results.roomAreaM2 / results.totalHolesCalculated).toFixed(1)} m²/port
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Total Pipe Run
              </span>
              <span className="text-xl font-mono font-extrabold text-slate-900">
                {results.totalPipeLengthM} m
              </span>
              <span className="text-[10px] text-slate-500 block">
                {params.pipeCount} Active branches
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Transport Time
              </span>
              <span
                className={`text-xl font-mono font-extrabold ${
                  results.estimatedTransportTimeSec <= results.maxAllowedTransportTimeSec
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {results.estimatedTransportTimeSec} s
              </span>
              <span className="text-[10px] text-slate-500 block">
                Limit: ≤ {results.maxAllowedTransportTimeSec} s
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                NFPA 72 Status
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {results.isCompliant ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Compliant
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5" /> Attention
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Balance: {results.flowBalanceRatioPercent}%
              </span>
            </div>
          </div>

          {/* Navigation Tab Bar */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 rounded-xl shadow-2xs">
            <div className="flex space-x-2 sm:space-x-4">
              <button
                type="button"
                onClick={() => setActiveTab('visualizer')}
                className={`py-3 px-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'visualizer'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                2D Real-Time Pipe Plan
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('compliance')}
                className={`py-3 px-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'compliance'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                NFPA 72 Compliance &amp; Drill Schedule
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('boq')}
                className={`py-3 px-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'boq'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Bill of Materials (BoQ)
              </button>
            </div>
          </div>

          {/* Active Tab View */}
          <div className="flex-1 min-h-[500px]">
            {activeTab === 'visualizer' && (
              <div className="h-[520px]">
                <FloorPlanCanvas
                  ref={floorPlanRef}
                  params={params}
                  results={results}
                  onUpdateParams={(p) => setParams((prev) => ({ ...prev, ...p }))}
                />
              </div>
            )}

            {activeTab === 'compliance' && (
              <ComplianceMatrixTab results={results} params={params} />
            )}

            {activeTab === 'boq' && (
              <BillOfMaterialsTab results={results} params={params} />
            )}
          </div>
        </section>
      </main>

      {/* Floating Real-Time Notification Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-start gap-3 animate-slideIn"
          >
            <div className="mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {toast.type === 'info' && <Radio className="w-4 h-4 text-sky-400 animate-pulse" />}
            </div>
            <div className="flex-1 text-xs">
              <span className="font-bold text-slate-100 block">{toast.title}</span>
              <p className="text-slate-300 mt-0.5">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Project & Scenario Management Modal */}
      <ProjectManagerModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projects={projects}
        currentProject={currentProject}
        scenarios={scenarios}
        currentScenario={currentScenario}
        onSelectProject={(id) => {
          const p = projects.find((proj) => proj.id === id);
          if (p) {
            setCurrentProject(p);
            fetchScenarios(p.id);
          }
        }}
        onCreateProject={handleCreateProject}
        onUpdateProject={handleUpdateProject}
        onDeleteProject={handleDeleteProject}
        onSaveScenario={handleSaveScenario}
        onSelectScenario={(id) => {
          const s = scenarios.find((sc) => sc.id === id);
          if (s) {
            setCurrentScenario(s);
            setParams(s.params);
          }
        }}
      />

      {/* Team Presence & Activity Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        activities={activities}
        notifications={toasts}
        onlineCount={onlineCount}
        onClearNotifications={() => setToasts([])}
      />
    </div>
  );
}
