import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ASDProject,
  ASDScenario,
  ActivityLog,
  CalculationParams,
  NotificationToast,
} from './types';
import { calculateASD } from './utils/nfpa72Calculator';
import { generateTechnicalReportPDF } from './utils/pdfGenerator';
import { FloorPlanCanvas, FloorPlanCanvasRef } from './components/FloorPlanCanvas';
import { Room3DView, Room3DViewRef } from './components/Room3DView';
import { ParameterForm } from './components/ParameterForm';
import { ComplianceMatrixTab } from './components/ComplianceMatrixTab';
import { BillOfMaterialsTab } from './components/BillOfMaterialsTab';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { useI18n } from './context/I18nContext';
import { useTheme } from './context/ThemeContext';
import type { TranslationKey } from './i18n/translations';
import {
  AlertTriangle,
  Bell,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Flame,
  Languages,
  Layers,
  Moon,
  Radio,
  Save,
  Sun,
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

const PRESETS: Record<string, Partial<CalculationParams>> = {
  data_center: {
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
  },
  clean_room: {
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
  },
  warehouse: {
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
  },
  commercial: {
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
  },
};

const PRESET_LABEL_KEYS: Record<string, TranslationKey> = {
  data_center: 'form.presets.dataCenter',
  clean_room: 'form.presets.cleanRoom',
  warehouse: 'form.presets.warehouse',
  commercial: 'form.presets.commercial',
};

type TabId = 'model3d' | 'visualizer' | 'compliance' | 'boq';

export default function App() {
  const { t, n, lang, toggleLang } = useI18n();
  const { isDark, toggleTheme } = useTheme();

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
    revision: 'Rev 2.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    params: defaultParams,
  });

  const [params, setParams] = useState<CalculationParams>(defaultParams);
  const [activeTab, setActiveTab] = useState<TabId>('model3d');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);

  const [onlineCount, setOnlineCount] = useState(1);
  const [wsConnected, setWsConnected] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  const floorPlanRef = useRef<FloorPlanCanvasRef>(null);
  const modelRef = useRef<Room3DViewRef>(null);

  const results = useMemo(() => calculateASD(params), [params]);

  const addToast = useCallback(
    (title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
      const toast: NotificationToast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        title,
        message,
        type,
        timestamp: Date.now(),
      };
      setToasts((prev) => [toast, ...prev.slice(0, 4)]);
      setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== toast.id)), 5000);
    },
    []
  );

  // --------------------------------------------------------------- API layer
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) setProjects(await res.json());
    } catch (err) {
      console.warn('API fetch projects:', err);
    }
  }, []);

  const fetchScenarios = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/scenarios`);
      if (!res.ok) return;
      const data: ASDScenario[] = await res.json();
      setScenarios(data);
      if (data.length > 0) {
        setCurrentScenario(data[0]);
        setParams(data[0].params);
      }
    } catch (err) {
      console.warn('API fetch scenarios:', err);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/activities');
      if (res.ok) setActivities(await res.json());
    } catch (err) {
      console.warn('API fetch activities:', err);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchActivities();
  }, [fetchProjects, fetchActivities]);

  useEffect(() => {
    if (currentProject.id) fetchScenarios(currentProject.id);
  }, [currentProject.id, fetchScenarios]);

  // The socket must outlive project switches, so the handler reads the current
  // project from a ref instead of forcing the effect to re-subscribe.
  const currentProjectIdRef = useRef(currentProject.id);
  currentProjectIdRef.current = currentProject.id;

  const handlersRef = useRef({ addToast, fetchActivities, fetchProjects, t });
  handlersRef.current = { addToast, fetchActivities, fetchProjects, t };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let socket: WebSocket;

    try {
      socket = new WebSocket(`${protocol}//${window.location.host}`);
    } catch (err) {
      console.warn('WebSocket connection error:', err);
      return;
    }

    socket.onopen = () => setWsConnected(true);
    socket.onclose = () => setWsConnected(false);
    socket.onerror = () => setWsConnected(false);

    socket.onmessage = (event) => {
      const handlers = handlersRef.current;
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'init:connected':
          case 'presence:update':
            setOnlineCount(message.payload.onlineCount || 1);
            break;
          case 'scenario:saved':
            handlers.addToast(
              handlers.t('toast.remoteScenarioTitle'),
              message.payload.activity?.details ?? '',
              'success'
            );
            handlers.fetchActivities();
            if (message.payload.scenario?.projectId === currentProjectIdRef.current) {
              setScenarios((prev) =>
                prev.map((item) =>
                  item.id === message.payload.scenario.id ? message.payload.scenario : item
                )
              );
            }
            break;
          case 'project:created':
            handlers.addToast(
              handlers.t('toast.remoteProjectTitle'),
              message.payload.activity?.details ?? '',
              'info'
            );
            handlers.fetchProjects();
            handlers.fetchActivities();
            break;
          case 'project:updated':
            handlers.addToast(
              handlers.t('toast.remoteStatusTitle'),
              message.payload.activity?.details ?? '',
              'info'
            );
            handlers.fetchProjects();
            handlers.fetchActivities();
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    return () => socket.close();
  }, []);

  // ------------------------------------------------------------------ actions
  const handleQuickPreset = (presetName: string) => {
    const preset = PRESETS[presetName];
    if (!preset) return;
    setParams((prev) => ({ ...prev, ...preset }));
    addToast(
      t('toast.presetTitle'),
      t('toast.presetBody', { name: t(PRESET_LABEL_KEYS[presetName]) }),
      'info'
    );
  };

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
          author: t('user.you'),
        }),
      });
      if (!res.ok) throw new Error(`Save failed with status ${res.status}`);
      const data = await res.json();
      setCurrentScenario(data.scenario);
      setSaveFeedback(true);
      addToast(t('toast.savedTitle'), t('toast.savedBody', { name: data.scenario.name }), 'success');
      fetchActivities();
      setTimeout(() => setSaveFeedback(false), 2500);
    } catch (err) {
      console.error('Error saving calculation:', err);
      addToast(t('toast.saveFailedTitle'), t('toast.saveFailedBody'), 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const planImage = await floorPlanRef.current?.getCanvasImageBase64();
      const modelImage = modelRef.current?.getImageBase64();
      generateTechnicalReportPDF(
        currentProject,
        { ...currentScenario, params },
        results,
        { t, n, d: (value) => new Date(value).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US') },
        { planImage, modelImage }
      );
      addToast(t('toast.pdfTitle'), t('toast.pdfBody', { code: currentProject.code }), 'success');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      addToast(t('toast.pdfFailedTitle'), t('toast.pdfFailedBody'), 'warning');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCreateProject = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, params, author: t('user.you') }),
      });
      if (!res.ok) return;
      const result = await res.json();
      setProjects((prev) => [result.project, ...prev]);
      setCurrentProject(result.project);
      setCurrentScenario(result.scenario);
      setParams(result.scenario.params);
      addToast(
        t('toast.projectCreatedTitle'),
        t('toast.projectCreatedBody', { code: result.project.code }),
        'success'
      );
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  const handleUpdateProject = async (projectId: string, partial: Partial<ASDProject>) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...partial,
          updatedBy: t('user.you'),
          statusChange: !!partial.status,
          changeDescription: partial.status ? `Status changed to ${partial.status}` : undefined,
        }),
      });
      if (!res.ok) return;
      const result = await res.json();
      setProjects((prev) => prev.map((p) => (p.id === projectId ? result.project : p)));
      if (currentProject.id === projectId) setCurrentProject(result.project);
      addToast(t('toast.projectUpdatedTitle'), t('toast.projectUpdatedBody'), 'info');
    } catch (err) {
      console.error('Error updating project:', err);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) return;
      const remaining = projects.filter((p) => p.id !== projectId);
      setProjects(remaining);
      if (remaining.length > 0) setCurrentProject(remaining[0]);
      addToast(t('toast.projectDeletedTitle'), t('toast.projectDeletedBody'), 'info');
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleSaveScenario = async (name: string, revision: string) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, revision, params, author: t('user.you') }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setScenarios((prev) => [...prev, data.scenario]);
      setCurrentScenario(data.scenario);
      addToast(
        t('toast.scenarioCreatedTitle'),
        t('toast.scenarioCreatedBody', { name, rev: revision }),
        'success'
      );
    } catch (err) {
      console.error('Error saving scenario:', err);
    }
  };

  // --------------------------------------------------------------------- view
  const transportOk = results.estimatedTransportTimeSec <= results.maxAllowedTransportTimeSec;
  const areaPerPort = results.roomAreaM2 / Math.max(1, results.totalHolesCalculated);

  const metrics = [
    {
      label: t('metric.ports'),
      value: n(results.totalHolesCalculated),
      sub: t('metric.portsSub', { v: n(areaPerPort, 1) }),
      tone: 'text-ink',
    },
    {
      label: t('metric.pipeRun'),
      value: `${n(results.totalPipeLengthM, 1)} m`,
      sub: t('metric.pipeRunSub', { n: params.pipeCount }),
      tone: 'text-ink',
    },
    {
      label: t('metric.transport'),
      value: `${n(results.estimatedTransportTimeSec, 1)} s`,
      sub: t('metric.transportLimit', { v: results.maxAllowedTransportTimeSec }),
      tone: transportOk ? 'text-ok' : 'text-bad',
    },
  ];

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'model3d', label: t('tab.model3d'), icon: <Boxes className="w-4 h-4" /> },
    { id: 'visualizer', label: t('tab.plan2d'), icon: <Layers className="w-4 h-4" /> },
    { id: 'compliance', label: t('tab.compliance'), icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'boq', label: t('tab.boq'), icon: <FileSpreadsheet className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      {/* A soft brand glow behind the header gives the shell a sense of depth. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-72 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--color-brand) 22%, transparent), transparent 70%)',
        }}
      />

      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand to-brand-2 flex items-center justify-center shadow-lg shrink-0">
              <Flame className="w-6 h-6 text-white" />
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base tracking-tight truncate">
                  {t('app.title')}
                </h1>
                <span className="hidden md:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-brand-wash text-brand border border-brand/30 shrink-0">
                  {t('app.badge')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(true)}
                title={t('header.openProjects')}
                className="text-xs text-ink-3 hover:text-ink flex items-center gap-1 font-medium transition-colors max-w-full"
              >
                <span className="font-mono text-brand font-bold">{currentProject.code}</span>
                <span className="truncate">· {currentProject.title}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              title={t('header.language')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-xs font-bold text-ink-2 transition-colors"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="uppercase">{lang}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? t('header.switchToLight') : t('header.switchToDark')}
              className="p-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-ink-2 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setIsNotificationDrawerOpen(true)}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-xs text-ink-2 transition-colors"
              title={t('header.syncTitle')}
            >
              <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'text-ok animate-pulse' : 'text-ink-3'}`} />
              <span className="hidden lg:inline font-medium">
                {wsConnected ? `${t('header.cloudSync')} (${onlineCount})` : t('header.offline')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsNotificationDrawerOpen(true)}
              className="relative p-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-3 transition-colors"
              title={t('header.notifications')}
            >
              <Bell className="w-4 h-4" />
              {activities.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand" />
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveCalculation}
              disabled={isSaving}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-surface-2 hover:bg-surface-3 text-ink border border-line transition-colors disabled:opacity-60"
            >
              {saveFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-ok" />
                  {t('header.saved')}
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-brand" />
                  {isSaving ? t('header.saving') : t('header.save')}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-brand hover:brightness-110 text-white transition shadow-lg disabled:opacity-75"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isGeneratingPdf ? t('header.buildingPdf') : t('header.exportPdf')}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-4 xl:col-span-4 flex flex-col gap-4">
          <div className="surface-card surface-raised p-5">
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-line">
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3 block">
                  {t('scenario.active')}
                </span>
                <h2 className="font-bold text-sm text-ink truncate">{currentScenario.name}</h2>
              </div>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-3 text-ink-2 border border-line shrink-0">
                {currentScenario.revision}
              </span>
            </div>

            <ParameterForm params={params} onChange={setParams} onQuickPreset={handleQuickPreset} />
          </div>
        </section>

        <section className="lg:col-span-8 xl:col-span-8 flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="surface-card surface-raised lift p-3">
                <span className="text-[11px] font-semibold text-ink-3 uppercase block">
                  {metric.label}
                </span>
                <span className={`text-xl font-mono font-extrabold ${metric.tone}`}>
                  {metric.value}
                </span>
                <span className="text-[10px] text-ink-3 block">{metric.sub}</span>
              </div>
            ))}

            <div className="surface-card surface-raised lift p-3">
              <span className="text-[11px] font-semibold text-ink-3 uppercase block">
                {t('metric.status')}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {results.isCompliant ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-ok bg-ok-wash px-2 py-0.5 rounded-full border border-ok/30">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('metric.compliant')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-warn bg-warn-wash px-2 py-0.5 rounded-full border border-warn/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> {t('metric.attention')}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-ink-3 block mt-0.5">
                {t('metric.balanceShort', { v: n(results.flowBalanceRatioPercent, 1) })}
              </span>
            </div>
          </div>

          <div className="surface-card px-2 sm:px-4 overflow-x-auto">
            <div className="flex gap-1 sm:gap-3 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 px-2 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-brand text-brand'
                      : 'border-transparent text-ink-3 hover:text-ink'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-[520px]">
            {/* The 3D scene keeps its WebGL context alive across tab switches so
                the PDF export can always grab a fresh snapshot. */}
            <div className={activeTab === 'model3d' ? 'h-[560px]' : 'hidden'}>
              <Room3DView ref={modelRef} params={params} results={results} />
            </div>

            <div className={activeTab === 'visualizer' ? 'h-[560px]' : 'hidden'}>
              <FloorPlanCanvas ref={floorPlanRef} params={params} results={results} />
            </div>

            {activeTab === 'compliance' && (
              <ComplianceMatrixTab results={results} params={params} />
            )}

            {activeTab === 'boq' && <BillOfMaterialsTab results={results} params={params} />}
          </div>
        </section>
      </main>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto surface-card glass px-4 py-3 flex items-start gap-3 animate-slideIn shadow-2xl"
          >
            <span className="mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-ok" />}
              {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-warn" />}
              {toast.type === 'info' && <Radio className="w-4 h-4 text-info animate-pulse" />}
            </span>
            <div className="flex-1 text-xs">
              <span className="font-bold text-ink block">{toast.title}</span>
              <p className="text-ink-2 mt-0.5">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>

      <ProjectManagerModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projects={projects}
        currentProject={currentProject}
        scenarios={scenarios}
        currentScenario={currentScenario}
        onSelectProject={(id) => {
          const project = projects.find((item) => item.id === id);
          if (project) setCurrentProject(project);
        }}
        onCreateProject={handleCreateProject}
        onUpdateProject={handleUpdateProject}
        onDeleteProject={handleDeleteProject}
        onSaveScenario={handleSaveScenario}
        onSelectScenario={(id) => {
          const scenario = scenarios.find((item) => item.id === id);
          if (scenario) {
            setCurrentScenario(scenario);
            setParams(scenario.params);
          }
        }}
      />

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
