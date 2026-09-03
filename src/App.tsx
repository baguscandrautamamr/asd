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
import { CalculationTab } from './components/CalculationTab';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { LoginScreen } from './components/LoginScreen';
import { useI18n } from './context/I18nContext';
import { useAuth } from './context/AuthContext';
import { usePresence } from './hooks/usePresence';
import { dataStore } from './data/store';
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
  FunctionSquare,
  Info,
  Layers,
  Loader2,
  LogOut,
  Save,
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

type TabId = 'model3d' | 'visualizer' | 'calculation' | 'compliance' | 'boq';

const FALLBACK_PROJECT: ASDProject = {
  id: '',
  code: 'ASD-2026-000',
  title: '—',
  clientName: '',
  clientContact: '',
  facilityName: '',
  location: '',
  status: 'draft',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  updatedBy: '',
  activeScenarioId: '',
};

const FALLBACK_SCENARIO: ASDScenario = {
  id: '',
  projectId: '',
  name: 'Base Design Calculation',
  revision: 'Rev 1.0',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  params: defaultParams,
};

function Workspace() {
  const { t, n, lang, setLang, locale } = useI18n();
  const { user, signOut, configured } = useAuth();

  // In local mode there is no account, but the roster should still show the
  // person using the app rather than reporting nobody online.
  const presenceUser = useMemo(
    () => user ?? (configured ? null : { id: 'local', email: '—', name: t('user.you') }),
    [user, configured, t]
  );
  const people = usePresence(presenceUser);

  const [projects, setProjects] = useState<ASDProject[]>([]);
  const [currentProject, setCurrentProject] = useState<ASDProject>(FALLBACK_PROJECT);
  const [scenarios, setScenarios] = useState<ASDScenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<ASDScenario>(FALLBACK_SCENARIO);

  const [params, setParams] = useState<CalculationParams>(defaultParams);
  const [activeTab, setActiveTab] = useState<TabId>('model3d');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  const floorPlanRef = useRef<FloorPlanCanvasRef>(null);
  const modelRef = useRef<Room3DViewRef>(null);

  const results = useMemo(() => calculateASD(params), [params]);

  const actor = useMemo(
    () => ({ id: user?.id ?? null, name: user?.name ?? t('user.you') }),
    [user, t]
  );

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

  // ------------------------------------------------------------------- data
  const refreshProjects = useCallback(async () => {
    try {
      const list = await dataStore.listProjects();
      setProjects(list);
      setCurrentProject((prev) => {
        if (prev.id && list.some((p) => p.id === prev.id)) {
          return list.find((p) => p.id === prev.id) ?? prev;
        }
        return list[0] ?? FALLBACK_PROJECT;
      });
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, []);

  const refreshActivities = useCallback(async () => {
    try {
      setActivities(await dataStore.listActivities());
    } catch (err) {
      console.error('Failed to load activities:', err);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
    refreshActivities();
  }, [refreshProjects, refreshActivities]);

  // Loading scenarios must not clobber edits in flight, so it only resets the
  // form when the project actually changed.
  const loadedProjectRef = useRef<string>('');
  useEffect(() => {
    if (!currentProject.id) return;
    let cancelled = false;

    dataStore
      .listScenarios(currentProject.id)
      .then((list) => {
        if (cancelled) return;
        setScenarios(list);
        if (loadedProjectRef.current !== currentProject.id && list.length > 0) {
          loadedProjectRef.current = currentProject.id;
          setCurrentScenario(list[0]);
          setParams(list[0].params);
        }
      })
      .catch((err) => console.error('Failed to load scenarios:', err));

    return () => {
      cancelled = true;
    };
  }, [currentProject.id]);

  // Another session changed shared data.
  useEffect(
    () =>
      dataStore.subscribe(() => {
        refreshProjects();
        refreshActivities();
      }),
    [refreshProjects, refreshActivities]
  );

  // ---------------------------------------------------------------- actions
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
    if (!currentProject.id) return;
    setIsSaving(true);
    try {
      const saved = await dataStore.saveScenario(
        currentProject.id,
        {
          id: currentScenario.id || undefined,
          name: currentScenario.name,
          revision: currentScenario.revision,
          params,
        },
        actor
      );
      setCurrentScenario(saved);
      setScenarios((prev) =>
        prev.some((s) => s.id === saved.id)
          ? prev.map((s) => (s.id === saved.id ? saved : s))
          : [...prev, saved]
      );
      setSaveFeedback(true);
      addToast(t('toast.savedTitle'), t('toast.savedBody', { name: saved.name }), 'success');
      refreshActivities();
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
        { t, n, d: (value) => new Date(value).toLocaleDateString(locale) },
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

  const handleCreateProject = async (draft: {
    title: string;
    clientName: string;
    clientContact: string;
    facilityName: string;
    location: string;
  }) => {
    try {
      const { project, scenario } = await dataStore.createProject(draft, params, actor);
      setProjects((prev) => [project, ...prev]);
      loadedProjectRef.current = project.id;
      setCurrentProject(project);
      setCurrentScenario(scenario);
      setParams(scenario.params);
      addToast(
        t('toast.projectCreatedTitle'),
        t('toast.projectCreatedBody', { code: project.code }),
        'success'
      );
      refreshActivities();
    } catch (err) {
      console.error('Error creating project:', err);
      addToast(t('toast.saveFailedTitle'), t('toast.saveFailedBody'), 'warning');
    }
  };

  const handleUpdateProject = async (projectId: string, partial: Partial<ASDProject>) => {
    try {
      const project = await dataStore.updateProject(projectId, partial, actor);
      setProjects((prev) => prev.map((p) => (p.id === projectId ? project : p)));
      if (currentProject.id === projectId) setCurrentProject(project);
      addToast(t('toast.projectUpdatedTitle'), t('toast.projectUpdatedBody'), 'info');
      refreshActivities();
    } catch (err) {
      console.error('Error updating project:', err);
      addToast(t('toast.saveFailedTitle'), t('toast.saveFailedBody'), 'warning');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await dataStore.deleteProject(projectId, actor);
      const remaining = projects.filter((p) => p.id !== projectId);
      setProjects(remaining);
      if (currentProject.id === projectId) {
        loadedProjectRef.current = '';
        setCurrentProject(remaining[0] ?? FALLBACK_PROJECT);
      }
      addToast(t('toast.projectDeletedTitle'), t('toast.projectDeletedBody'), 'info');
    } catch (err) {
      console.error('Error deleting project:', err);
      addToast(t('toast.saveFailedTitle'), t('toast.saveFailedBody'), 'warning');
    }
  };

  const handleSaveScenario = async (name: string, revision: string) => {
    if (!currentProject.id) return;
    try {
      const saved = await dataStore.saveScenario(
        currentProject.id,
        { name, revision, params },
        actor
      );
      setScenarios((prev) => [...prev, saved]);
      setCurrentScenario(saved);
      addToast(
        t('toast.scenarioCreatedTitle'),
        t('toast.scenarioCreatedBody', { name, rev: revision }),
        'success'
      );
      refreshActivities();
    } catch (err) {
      console.error('Error saving scenario:', err);
      addToast(t('toast.saveFailedTitle'), t('toast.saveFailedBody'), 'warning');
    }
  };

  // ------------------------------------------------------------------- view
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
    { id: 'model3d', label: t('tab.model3d'), icon: <Boxes className="w-3.5 h-3.5" /> },
    { id: 'visualizer', label: t('tab.plan2d'), icon: <Layers className="w-3.5 h-3.5" /> },
    {
      id: 'calculation',
      label: t('tab.calculation'),
      icon: <FunctionSquare className="w-3.5 h-3.5" />,
    },
    { id: 'compliance', label: t('tab.compliance'), icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { id: 'boq', label: t('tab.boq'), icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      <header className="sticky top-0 z-30 bg-shell border-b-[3px] border-brand-2">
        <div className="max-w-[1500px] mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 text-white" />
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="font-extrabold text-sm text-white truncate">{t('app.title')}</h1>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(true)}
                title={t('header.openProjects')}
                className="text-2xs text-white/55 hover:text-white flex items-center gap-1 transition-colors max-w-full"
              >
                <span className="font-mono text-brand-2 font-bold">{currentProject.code}</span>
                <span className="truncate">· {currentProject.title}</span>
                <ChevronDown className="w-3 h-3 shrink-0" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="pill-group">
              {(['id', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`pill ${
                    lang === code ? 'bg-brand-2 text-shell' : 'text-white/70 hover:text-white'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              title={t('presence.title')}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white/85 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-brand-2" />
              <span className="tabular-nums">{people.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="relative p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title={t('header.notifications')}
            >
              <Bell className="w-4 h-4" />
              {activities.length > 0 && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-brand-2" />
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveCalculation}
              disabled={isSaving || !currentProject.id}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-50"
            >
              {saveFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-brand-2" />
                  {t('header.saved')}
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-brand-2" />
                  {isSaving ? t('header.saving') : t('header.save')}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand hover:bg-brand-ink text-white transition-colors disabled:opacity-75"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isGeneratingPdf ? t('header.buildingPdf') : t('header.exportPdf')}
              </span>
            </button>

            {user && (
              <div className="hidden lg:flex items-center gap-2 pl-2 ml-1 border-l border-white/15">
                <span className="text-2xs text-white/60 max-w-[12rem] truncate">{user.email}</span>
                <button
                  type="button"
                  onClick={signOut}
                  title={t('auth.signOut')}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-2xs font-bold text-white transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  {t('auth.signOut')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {!configured && (
        <div className="bg-warn-wash border-b border-warn/30">
          <div className="max-w-[1500px] mx-auto px-3 sm:px-5 py-2 flex items-start gap-2 text-2xs text-ink-2">
            <Info className="w-3.5 h-3.5 text-warn shrink-0 mt-0.5" />
            <p>
              <strong className="font-bold">{t('auth.localModeTitle')}</strong> —{' '}
              {t('auth.localModeBody')}
            </p>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1500px] w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
          <div className="surface-card p-4">
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-3.5 border-b border-line">
              <div className="min-w-0">
                <span className="text-2xs font-bold uppercase tracking-wider text-ink-3 block">
                  {t('scenario.active')}
                </span>
                <h2 className="font-bold text-sm text-ink truncate">{currentScenario.name}</h2>
              </div>
              <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded bg-surface-3 text-ink-2 border border-line shrink-0">
                {currentScenario.revision}
              </span>
            </div>

            <ParameterForm params={params} onChange={setParams} onQuickPreset={handleQuickPreset} />
          </div>
        </section>

        <section className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="surface-card lift p-3">
                <span className="text-2xs font-semibold text-ink-3 uppercase block">
                  {metric.label}
                </span>
                <span className={`text-xl font-mono font-extrabold ${metric.tone}`}>
                  {metric.value}
                </span>
                <span className="text-2xs text-ink-3 block">{metric.sub}</span>
              </div>
            ))}

            <div className="surface-card lift p-3">
              <span className="text-2xs font-semibold text-ink-3 uppercase block">
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
              <span className="text-2xs text-ink-3 block mt-0.5">
                {t('metric.balanceShort', { v: n(results.flowBalanceRatioPercent, 1) })}
              </span>
            </div>
          </div>

          <div className="surface-card px-2 sm:px-3 overflow-x-auto">
            <div className="flex gap-1 sm:gap-2 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2.5 px-2 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
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
            {/* Both viewports stay mounted so the PDF export can always take a
                fresh snapshot, whichever tab is open. */}
            <div className={activeTab === 'model3d' ? 'h-[560px]' : 'hidden'}>
              <Room3DView ref={modelRef} params={params} results={results} />
            </div>

            <div className={activeTab === 'visualizer' ? 'h-[560px]' : 'hidden'}>
              <FloorPlanCanvas
                ref={floorPlanRef}
                params={params}
                results={results}
                onUpdateParams={(partial) => setParams((prev) => ({ ...prev, ...partial }))}
              />
            </div>

            {activeTab === 'calculation' && <CalculationTab results={results} params={params} />}
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
            className="pointer-events-auto surface-card px-4 py-2.5 flex items-start gap-2.5 animate-slideIn shadow-xl"
          >
            <span className="mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-ok" />}
              {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-warn" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-info" />}
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
          if (project) {
            loadedProjectRef.current = '';
            setCurrentProject(project);
          }
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
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activities={activities}
        people={people}
        liveEnabled={configured}
      />
    </div>
  );
}

export default function App() {
  const { configured, loading, user } = useAuth();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center gap-2 text-ink-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-brand" />
        {t('auth.loading')}
      </div>
    );
  }

  // Without Supabase there is no account system, so the workspace opens
  // straight away in local mode and says so in the banner.
  if (configured && !user) return <LoginScreen />;

  return <Workspace />;
}
