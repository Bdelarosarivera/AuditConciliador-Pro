import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, 
  Upload, 
  Download, 
  X, 
  FolderPlus, 
  Eraser, 
  RefreshCw, 
  AlertOctagon, 
  LayoutDashboard, 
  TableProperties, 
  FilePieChart, 
  HelpCircle,
  Menu,
  Activity,
  Award,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Sparkles
} from "lucide-react";
import { InventoryItem, AuditSummary, ExecutiveReport, ProcessingState } from "./types";
import KPICards from "./components/KPICards";
import GaugeChart from "./components/GaugeChart";
import ExecutiveReportPanel from "./components/ExecutiveReportPanel";
import InteractiveTable from "./components/InteractiveTable";
import DemoPresets from "./components/DemoPresets";

export default function App() {
  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "table" | "report" | "presets">("dashboard");

  // App core states
  const [processState, setProcessState] = useState<ProcessingState>("idle");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ name: string; sizeText: string; totalPages: number } | null>(null);

  // Loaded audit data states (or defaults if none loaded yet)
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [report, setReport] = useState<ExecutiveReport | null>(null);

  // Original pristine data for revert fallback
  const [originalItems, setOriginalItems] = useState<InventoryItem[]>([]);

  // Toast notification state
  const [toasts, setToasts] = useState<{ id: string; text: string; type: "success" | "info" | "error" | "warning" }[]>([]);

  // Drag and drop states
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentFileBase64, setCurrentFileBase64] = useState<string | null>(null);

  // Time metrics check
  const [utcTime, setUtcTime] = useState("");
  useEffect(() => {
    // Keep a beautiful formatted live tracker
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toLocaleString("es-DO", { timeZone: "UTC" }) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Add toast helper
  const addToast = (text: string, type: "success" | "info" | "error" | "warning" = "success") => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Re-calculate math summary locally on-the-fly when user edits cells in the responsive table
  const handleUpdateItemInTable = (updatedItem: InventoryItem) => {
    const nextItems = items.map((it) => (it.id === updatedItem.id ? updatedItem : it));
    setItems(nextItems);

    // Recalculate summary metrics from updated items
    const nextSummary = calculateSummaryMetrics(nextItems);
    setSummary(nextSummary);

    // Regenerate report highlights based on modifications
    const nextReport = compileReportTextMetrics(nextItems, nextSummary);
    setReport(nextReport);

    addToast(`Artículo ${updatedItem.codigo} actualizado. Métricas recalculadas.`, "info");
  };

  // Trigger full reset of modified counts to original scanned values
  const handleResetToScanned = () => {
    if (originalItems.length === 0) return;
    setItems(JSON.parse(JSON.stringify(originalItems)));
    
    const originalSummary = calculateSummaryMetrics(originalItems);
    setSummary(originalSummary);
    setReport(compileReportTextMetrics(originalItems, originalSummary));
    
    addToast("Todos los conteos fueron restablecidos a los valores originales extraídos.", "warning");
  };

  // Cancel processing mid-way
  const handleCancelProcess = () => {
    setProcessState("idle");
    setProgressPercent(0);
    setProgressText("");
    setSelectedFile(null);
    setCurrentFileBase64(null);
    addToast("Procesamiento de documento cancelado.", "warning");
  };

  // Reset/flush all loaded databases
  const handleClearData = () => {
    setItems([]);
    setSummary(null);
    setReport(null);
    setOriginalItems([]);
    setSelectedFile(null);
    setCurrentFileBase64(null);
    setProcessState("idle");
    addToast("Base de datos de auditoría limpiada correctamente.", "info");
  };

  // Run dynamic simulated multi-tier OCR pipeline linked to api
  const processPipeline = async (base64Content: string, name: string, sizeStr: string, isDemo = false, demoStyle = "general") => {
    try {
      setProcessState("uploading");
      setProgressPercent(15);
      setProgressText("Cargando y transmitiendo binario de inventario...");

      // Phase 2: Analizando páginas
      await sleep(600);
      setProcessState("detecting");
      setProgressPercent(35);
      setProgressText("Leyendo páginas. Detectando si es PDF nativo o escaneado...");

      // Phase 3: Aplicando OCR
      await sleep(800);
      setProcessState("ocr_reading");
      setProgressPercent(60);
      setProgressText("Aplicando OCR inteligente. Reconstruyendo celdas y filas...");

      // Phase 4: Data extracting
      await sleep(700);
      setProcessState("data_extracting");
      setProgressPercent(85);
      setProgressText("Extrayendo datos y resolviendo formatos dominicanos (RD$)...");

      // Reach backend process
      const res = await fetch("/api/process-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64Content,
          fileName: name,
          fileSize: sizeStr,
          isDemoResource: isDemo,
          demoType: demoStyle,
          usuario: "Auditor Principal Senior",
        }),
      });

      if (!res.ok) {
        throw new Error(`Error en el servidor: ${res.statusText}`);
      }

      const body = await res.json();

      if (body.success) {
        // Complete the progress animation
        setProgressPercent(100);
        setProgressText("Concluido con éxito.");
        await sleep(300);

        setItems(body.data);
        setOriginalItems(JSON.parse(JSON.stringify(body.data)));
        setSummary(body.summary);
        setReport(body.report);
        setSelectedFile({
          name: body.fileName,
          sizeText: body.fileSizeText,
          totalPages: body.pagesCount,
        });
        setProcessState("finalized");
        setActiveTab("dashboard");

        addToast(
          `Documento compilado. OCR detectó: ${body.isScanned ? "Escaneo (Imagen)" : "PDF seleccionable"}.`,
          "success"
        );
      } else {
        throw new Error(body.error || "Fallo procesando el documento.");
      }
    } catch (err: any) {
      console.error(err);
      setProcessState("error");
      addToast(`Error al procesar: ${err.message || err}`, "error");
    }
  };

  // Preset quick trigger
  const handleLoadPreset = (presetType: "farmacia" | "electronica" | "general", name: string) => {
    processPipeline("demo-data", `${presetType}_reconciliacion_firmada.pdf`, "1.4 MB", true, presetType);
  };

  // Re-trigger OCR on currently loaded base64 content
  const handleReprocessOCR = () => {
    if (!currentFileBase64 && !selectedFile) {
      addToast("No hay ningún documento activo para reprocesar.", "error");
      return;
    }
    const name = selectedFile?.name || "reconciliacion_reproceso.pdf";
    const size = selectedFile?.sizeText || "1.0 MB";
    const b64 = currentFileBase64 || "demo-data";
    const isDemo = b64 === "demo-data";
    const demoType = name.includes("farmacia") ? "farmacia" : name.includes("electronica") ? "electronica" : "general";

    processPipeline(b64, name, size, isDemo, demoType);
    addToast("Iniciando reprocesamiento de OCR avanzado...", "info");
  };

  // File dropzone trigger
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePickedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handlePickedFile(e.target.files[0]);
    }
  };

  const handlePickedFile = (file: File) => {
    if (file.type !== "application/pdf") {
      addToast("Solo se admiten documentos en formato PDF corporativo.", "error");
      return;
    }

    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + " MB";
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const b64 = uploadEvent.target?.result as string;
      setCurrentFileBase64(b64);
      processPipeline(b64, file.name, sizeStr, false, "general");
    };
    reader.onerror = () => {
      addToast("Fallo la lectura binaria del archivo.", "error");
    };
    reader.readAsDataURL(file);
  };

  // Direct Excel workbook API trigger
  const handleDownloadExcel = async () => {
    if (items.length === 0) {
      addToast("No hay registros auditados para exportar a Excel.", "error");
      return;
    }

    try {
      addToast("Compilando Excel corporativo con fórmulas...", "info");

      const response = await fetch("/api/export-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          summary,
          report,
          title: selectedFile?.name?.replace(".pdf", "")?.toUpperCase() || "RECONCILIACIÓN",
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo generar la hoja de cálculo del servidor.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CONCILIACION_INVENTARIO_${selectedFile?.name?.replace(".pdf", "") || "REPORTE"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addToast("Libro Excel descargado correctamente con 4 hojas estilizadas.", "success");
    } catch (err: any) {
      addToast(`Error descargando Excel: ${err.message}`, "error");
    }
  };

  // Trigger File Picker click helper
  const onTriggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex text-slate-900 font-sans selection:bg-indigo-500 selection:text-white transition-all overflow-x-hidden md:overflow-hidden md:h-screen">
      
      {/* Dynamic Toast System */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={`p-4 rounded-xl border shadow-lg pointer-events-auto flex items-start gap-2.5 bg-white text-xs ${
                toast.type === "success"
                  ? "border-emerald-200 text-emerald-900 shadow-emerald-100/40"
                  : toast.type === "error"
                  ? "border-rose-200 text-rose-950 shadow-rose-100/40"
                  : toast.type === "warning"
                  ? "border-amber-200 text-amber-950 shadow-amber-100/40"
                  : "border-slate-200 text-slate-900 shadow-slate-100/40"
              }`}
            >
              <div className={`mt-0.5 rounded-full p-1 ${
                toast.type === "success" ? "text-emerald-500 bg-emerald-50" :
                toast.type === "error" ? "text-rose-500 bg-rose-50" :
                toast.type === "warning" ? "text-amber-500 bg-amber-50" : "text-sky-500 bg-sky-50"
              }`}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="font-semibold flex-1 leading-normal">{toast.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Corporate Left Sidebar */}
      <aside 
        className={`${
          sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-0"
        } bg-slate-900 text-slate-100 flex flex-col justify-between shrink-0 border-r border-slate-800 transition-all duration-300 z-30 relative`}
      >
        <div className="flex flex-col">
          {/* Sidebar Header Brand */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-600 rounded-lg text-white shadow-2xs">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-sm font-black tracking-tight leading-none text-white">
                  AuditConciliador
                </h1>
                <span className="text-[10px] font-bold text-slate-400">CORPORATE SUITE v2.8</span>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Connected User Badge */}
          <div className="p-4 mx-3 my-3 bg-slate-800/40 border border-slate-800/80 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-900 font-extrabold text-xs">
              AD
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200 leading-none">Bartolo De La Rosa</p>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 inline-block">
                Auditor Senior
              </span>
            </div>
          </div>

          {/* Navigation Segments */}
          <nav className="p-3 space-y-1 text-slate-300 text-xs">
            <span className="px-3 py-1.5 text-[10px] uppercase font-extrabold text-slate-500 tracking-wider block">
              Auditoría Activa
            </span>
            
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-all group cursor-pointer ${
                activeTab === "dashboard" ? "bg-indigo-600/95 text-white shadow-3xs" : "hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-slate-400 group-hover:text-white" />
                <span>Dashboard de Estado</span>
              </div>
              {summary && (
                <span className="text-[9px] font-bold bg-indigo-900/60 text-indigo-200 px-1.5 py-0.5 rounded-full">
                  {summary.confiabilidad}%
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("table")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-all group cursor-pointer ${
                activeTab === "table" ? "bg-indigo-600/95 text-white shadow-3xs" : "hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <TableProperties className="w-4 h-4 text-slate-400 group-hover:text-white" />
                <span>Tabla de Ajustes</span>
              </div>
              {items.length > 0 && (
                <span className="text-[9px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                  {items.length} SKUs
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("report")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-all group cursor-pointer ${
                activeTab === "report" ? "bg-indigo-600/95 text-white shadow-3xs" : "hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FilePieChart className="w-4 h-4 text-slate-400 group-hover:text-white" />
                <span>Informe Gerencial</span>
              </div>
              {report && (
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
              )}
            </button>

            <div className="pt-4">
              <span className="px-3 py-1.5 text-[10px] uppercase font-extrabold text-slate-500 tracking-wider block">
                Herramientas Demo
              </span>
              <button
                onClick={() => setActiveTab("presets")}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-medium transition-all group cursor-pointer ${
                  activeTab === "presets" ? "bg-indigo-600/95 text-white shadow-3xs" : "hover:bg-slate-800"
                }`}
              >
                <Layers className="w-4 h-4 text-slate-400 group-hover:text-white" />
                <span>Modelos Industriales</span>
              </button>
            </div>
          </nav>
        </div>

        {/* System parameters */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20 space-y-2 text-[10px] font-mono text-slate-400">
          <div className="flex items-center justify-between">
            <span>Servicio:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block"></span>
              LINEA-OK
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Ubicación base:</span>
            <span>Rep. Dominicana</span>
          </div>
          <p className="text-[10px] text-slate-500 pt-1 text-center">
            Diseño Premium SAP Partner
          </p>
        </div>
      </aside>

      {/* Main Container Work Area */}
      <div className="flex-1 flex flex-col overflow-y-auto md:overflow-hidden h-screen">
        
        {/* Executive Top Row Header */}
        <header className="bg-white border-b border-gray-100 p-4 shrink-0 flex items-center justify-between gap-4 shadow-3xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 hover:bg-gray-100 rounded-md text-slate-600 cursor-pointer"
              title="Abrir/Cerrar menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-sm font-extrabold text-gray-800 leading-none">
                Consola Central de Reconciliación
              </h2>
              <span className="text-[10px] text-gray-400 font-semibold tracking-wide">
                Auditoría certificada para diferencias físicas y teóricas (RD$)
              </span>
            </div>
          </div>

          {/* Time & Session Indicators */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border text-gray-500 font-mono text-[11px]">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>{utcTime}</span>
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2 py-1 px-2.5 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg text-[11px] font-mono">
                <span className="font-bold truncate max-w-[120px]">{selectedFile.name}</span>
                <span>• {selectedFile.totalPages} pág(s)</span>
              </div>
            )}
          </div>
        </header>

        {/* Mid-screen workspace scroll */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          
          {/* Active processing / Loading State Overlay */}
          <AnimatePresence>
            {processState !== "idle" && processState !== "finalized" && processState !== "error" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-xl border border-indigo-100 shadow-md p-8 text-center max-w-lg mx-auto space-y-6 my-10"
              >
                <div className="flex flex-col items-center">
                  {/* Rotating status wheel */}
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full animate-bounce">
                    <RefreshCw className="w-10 h-10 animate-spin stroke-[1.5]" />
                  </div>
                  <h3 className="text-md font-bold text-gray-800 mt-4 uppercase tracking-wider">
                    Análisis & OCR en Proceso
                  </h3>
                  <p className="text-xs text-indigo-800 font-semibold uppercase mt-0.5">
                    {processState === "uploading" && "Fase 1 de 5: Cargando Archivo"}
                    {processState === "detecting" && "Fase 2 de 5: Detectando Estructura"}
                    {processState === "ocr_reading" && "Fase 3 de 5: Reconstruyendo con OCR"}
                    {processState === "data_extracting" && "Fase 4 de 5: Resolviendo Celdas"}
                    {processState === "excel_generating" && "Fase 5 de 5: Generando Excel"}
                  </p>
                </div>

                {/* Animated status text and bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono font-bold text-gray-500 px-1">
                    <span>{progressText}</span>
                    <span className="text-indigo-600">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-gray-150">
                    <motion.div
                      layoutId="loading-bar-active"
                      className="bg-indigo-600 h-full rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ ease: "easeInOut", duration: 0.4 }}
                    />
                  </div>
                </div>

                {/* Cancel mid flow trigger */}
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={handleCancelProcess}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-lg text-xs font-bold border border-rose-100 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar Prototipo OCR</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Idle Screen: Upload Document area */}
          {processState === "idle" && items.length === 0 && (
            <div className="space-y-6">
              {/* Massive styled Dropzone panel */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={onTriggerFilePicker}
                className={`border-2 border-dashed rounded-2xl p-10 md:p-14 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-4 group min-h-[350px] ${
                  dragActive 
                    ? "border-indigo-500 bg-indigo-50/40 shadow-inner" 
                    : "border-gray-200 bg-white hover:border-indigo-400 hover:shadow-xs"
                }`}
              >
                <input
                  type="file"
                  id="pdf-upload-file-picker"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="hidden"
                />

                <div className="p-4 bg-slate-50 border group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-2xl text-slate-400 transition-colors">
                  <Upload className="w-10 h-10 stroke-[1.5]" />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider group-hover:text-indigo-600">
                    Cargar Acta de Inventario Físico
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed font-sans">
                    Arrastra y suelta tu archivo PDF o <span className="text-indigo-600 font-bold underline">búscalo localmente</span>. Soportado para formatos estructurados, escaneos de campo o firmas registradas.
                  </p>
                </div>

                <div className="pt-2">
                  <span className="px-3.5 py-1.5 bg-slate-900 border border-slate-950 text-white rounded-lg text-xs font-semibold shadow-3xs group-hover:bg-slate-800 transition-colors inline-block">
                    Seleccionar PDF
                  </span>
                </div>

                <div className="text-[10px] text-gray-400 font-mono tracking-wide pt-4 border-t border-gray-50 w-full max-w-xs justify-center flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Automatizado con Gemini 3.5-Flash</span>
                </div>
              </div>

              {/* Presets segment shown immediately when idle */}
              <DemoPresets onLoadPreset={handleLoadPreset} isLoading={processState !== "idle"} />
            </div>
          )}

          {/* Active Data Dashboard Mode (when items are loaded) */}
          {items.length > 0 && (
            <div className="space-y-6">
              
              {/* Master Control Buttons Tray */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-4 shadow-3xs">
                
                {/* File info indicator */}
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase leading-none">
                      {selectedFile?.name || "CONCILIACION_INVENTARIO.PDF"}
                    </h4>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {selectedFile?.sizeText || "1.5 MB"} • {items.length} filas procesadas
                    </span>
                  </div>
                </div>

                {/* Right control triggers */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf"
                    className="hidden"
                  />
                  
                  {/* Cargar PDF trigger */}
                  <button
                    onClick={onTriggerFilePicker}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    title="Cargar un nuevo archivo PDF"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Cargar PDF</span>
                  </button>

                  {/* Descargar Excel trigger */}
                  <button
                    onClick={handleDownloadExcel}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    title="Generar y descargar libro Excel de 4 hojas"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Excel</span>
                  </button>

                  {/* Reprocesar OCR trigger */}
                  <button
                    onClick={handleReprocessOCR}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Volver a procesar con OCR de Gemini"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reprocesar OCR</span>
                  </button>

                  {/* Limpiar Datos trigger */}
                  <button
                    onClick={handleClearData}
                    className="px-3 py-2 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-gray-600 hover:text-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Eliminar todos los datos activos de pantalla"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Limpiar Datos</span>
                  </button>

                  {/* Nuevo Documento trigger */}
                  <button
                    onClick={() => {
                      handleClearData();
                      setTimeout(() => fileInputRef.current?.click(), 100);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer text-slate-700"
                    title="Cerrar documento e iniciar nuevo escaneo"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Nuevo Documento</span>
                  </button>
                </div>
              </div>

              {/* Segment Toggle Bar */}
              <div className="flex border-b border-gray-200 space-x-6 text-xs font-bold uppercase tracking-wider">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`pb-3 relative transition-all cursor-pointer ${
                    activeTab === "dashboard" ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Dashboard General
                  {activeTab === "dashboard" && (
                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("table")}
                  className={`pb-3 relative transition-all cursor-pointer ${
                    activeTab === "table" ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Tabla de Conciliaciones
                  {activeTab === "table" && (
                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("report")}
                  className={`pb-3 relative transition-all cursor-pointer ${
                    activeTab === "report" ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Reporte Directivo
                  {activeTab === "report" && (
                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("presets")}
                  className={`pb-3 relative transition-all cursor-pointer ${
                    activeTab === "presets" ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Presets & Demos
                  {activeTab === "presets" && (
                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                  )}
                </button>
              </div>

              {/* Tab: Dashboard Summary */}
              {activeTab === "dashboard" && summary && (
                <div className="space-y-6">
                  {/* Top KPIs Row */}
                  <KPICards summary={summary} />

                  {/* Visual Charts & Gauge Block */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Column 1: Dial Chart */}
                    <div className="lg:col-span-1">
                      <GaugeChart percentage={summary.confiabilidad} level={summary.confiabilidadNivel} />
                    </div>

                    {/* Column 2 & 3: Category Variations & Quick Diagnostics */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-6">
                      <div className="flex items-center justify-between border-b pb-3.5">
                        <div>
                          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                            Desviación Financiera por Categoría
                          </h3>
                          <span className="text-[10px] text-gray-400">Distribución de diferencias netas en pesos dominicanos</span>
                        </div>
                        <span className="p-1 px-2.5 bg-slate-100 border text-slate-700 text-[10px] rounded font-mono uppercase font-semibold">
                          Consolidadas
                        </span>
                      </div>

                      {/* Render styled bars representing families deviations */}
                      <div className="space-y-4">
                        {report?.analisisFamilias.slice(0, 4).map((fam, index) => {
                          const netAbs = Math.abs(fam.impacto);
                          const totalTeo = summary.valorTotalTeorico || 1;
                          const ratio = Math.min(100, (netAbs / totalTeo) * 500); // normalized scaling for visual representation
                          
                          return (
                            <div key={index} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-gray-700">{fam.familia}</span>
                                <div className="space-x-1.5 font-mono">
                                  <span className="text-gray-400 text-[10px]">({fam.cantidad} SKUs)</span>
                                  <strong className={fam.impacto < 0 ? "text-rose-600" : "text-emerald-600"}>
                                    {fam.impacto > 0 ? "+" : ""}{fam.impacto.toLocaleString("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).replace("DOP", "RD$")}
                                  </strong>
                                </div>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden p-0.5 border">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.max(4, ratio)}%` }}
                                  className={`h-full rounded-full ${fam.impacto < 0 ? "bg-rose-500" : "bg-emerald-500"}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Financial diagnosis badge info */}
                      <div className="p-4 bg-slate-50 border border-slate-100/80 rounded-xl space-y-2 text-xs text-gray-600">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                          <Activity className="w-4 h-4 text-indigo-600" />
                          <span>Diagnóstico Operativo Automático</span>
                        </div>
                        <p className="font-sans text-[11px] leading-relaxed text-justify">
                          El arqueo de este almacén refleja una exactitud contable del <strong>{summary.exactitudMonto}%</strong>. Se recomienda priorizar un reconteo selectivo inmediato para {report?.diferenciasCriticas.length} SKUs con variaciones negativas críticas de alta incidencia.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Interactive Table */}
              {activeTab === "table" && (
                <InteractiveTable 
                  items={items} 
                  onUpdateItem={handleUpdateItemInTable} 
                  onResetItems={handleResetToScanned} 
                />
              )}

              {/* Tab: Report */}
              {activeTab === "report" && (
                <ExecutiveReportPanel report={report} />
              )}

              {/* Tab: Presets */}
              {activeTab === "presets" && (
                <DemoPresets onLoadPreset={handleLoadPreset} isLoading={processState !== "idle"} />
              )}

            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// Utility Sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mirror/Replicate backend calculations on client cell adjustments dynamically to keep client reactive
function calculateSummaryMetrics(items: InventoryItem[]): AuditSummary {
  const totalArticulos = items.length;
  let conDiferencia = 0;
  let sinDiferencia = 0;
  let diferenciasPositivas = 0;
  let diferenciasNegativas = 0;
  let valorTotalFisico = 0;
  let valorTotalTeorico = 0;

  items.forEach((item) => {
    const fisVal = item.fisico * item.costo;
    const teoVal = item.teorico * item.costo;
    valorTotalFisico += fisVal;
    valorTotalTeorico += teoVal;

    if (item.diferencia === 0) {
      sinDiferencia++;
    } else {
      conDiferencia++;
      if (item.diferenciaRD > 0) {
        diferenciasPositivas += item.diferenciaRD;
      } else {
        diferenciasNegativas += Math.abs(item.diferenciaRD);
      }
    }
  });

  const diferenciaNeta = diferenciasPositivas - diferenciasNegativas;
  const totalCorrectos = sinDiferencia;
  
  const reliabilityPercent = totalArticulos > 0 ? (totalCorrectos / totalArticulos) * 100 : 100;
  let level: 'EXCELLENT' | 'GOOD' | 'CRITICAL' = "EXCELLENT";
  if (reliabilityPercent < 85) {
    level = "CRITICAL";
  } else if (reliabilityPercent < 95) {
    level = "GOOD";
  }

  const discrepancyMagnitude = Math.abs(diferenciaNeta);
  const exactitudValue = valorTotalTeorico > 0 ? Math.max(0, 100 - (discrepancyMagnitude / valorTotalTeorico) * 100) : 100;

  return {
    totalArticulos,
    conDiferencia,
    sinDiferencia,
    diferenciasPositivas,
    diferenciasNegativas,
    diferenciaNeta,
    valorTotalFisico,
    valorTotalTeorico,
    confiabilidad: Math.round(reliabilityPercent * 10) / 10,
    confiabilidadNivel: level,
    totalErrores: conDiferencia,
    exactitudMonto: Math.round(exactitudValue * 10) / 10,
  };
}

function compileReportTextMetrics(items: InventoryItem[], summary: AuditSummary): ExecutiveReport {
  const familiesMap: { [key: string]: { sumImpact: number; count: number } } = {};
  items.forEach((item) => {
    if (!familiesMap[item.familia]) {
      familiesMap[item.familia] = { sumImpact: 0, count: 0 };
    }
    familiesMap[item.familia].sumImpact += item.diferenciaRD;
    familiesMap[item.familia].count++;
  });

  const analisisFamilias = Object.keys(familiesMap).map((key) => ({
    familia: key,
    impacto: familiesMap[key].sumImpact,
    cantidad: familiesMap[key].count,
  }));

  const sortedFamilies = [...analisisFamilias].sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto));

  const sortedDiscrepancies = items
    .filter((item) => item.diferencia !== 0)
    .sort((a, b) => a.diferenciaRD - b.diferenciaRD)
    .slice(0, 5)
    .map((item) => ({
      codigo: item.codigo,
      descripcion: item.descripcion,
      diferenciaRD: item.diferenciaRD,
      diferencia: item.diferencia,
    }));

  const isNetaNegativa = summary.diferenciaNeta < 0;
  const netText = isNetaNegativa
    ? `pérdida financiera de RD$ ${Math.abs(summary.diferenciaNeta).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
    : `superávit contable neto de RD$ ${summary.diferenciaNeta.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;

  const topFamText = sortedFamilies.length > 0 
    ? `La categoría con la desviación económica más notable es "${sortedFamilies[0].familia}", registrando un impacto de RD$ ${sortedFamilies[0].impacto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}.`
    : "No se identificó ningún impacto sectorizado crítico.";

  const recommendationsList = [
    "Programar conteos cíclicos semanales para productos con clasificación de alta rotación 'Clase-A'.",
    "Auditar el proceso de recepción y despacho físico para mitigar errores de digitación o mermas.",
    "Revisar el acoplamiento de registros en tiempo real en la base de datos de SAP/sistema ERP.",
    "Establecer capacitaciones especializadas para operadores de almacén en sistemas de trazabilidad por lote y SKU.",
  ];

  if (summary.confiabilidad < 90) {
    recommendationsList.unshift("Realizar un reconteo físico urgente e interactivo de los 5 SKUs con mayor variación económica identificados en este reporte.");
  }

  return {
    titulo: "INFORME EJECUTIVO DE AUDITORÍA Y CONCILIACIÓN DE INVENTARIO",
    fecha: new Date().toLocaleDateString("es-DO", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    resumenEjecutivo: `Durante la reciente auditoría general de stock físico, se evaluaron un total de ${summary.totalArticulos} artículos. El análisis determinó un nivel de confiablidad de stock del ${summary.confiabilidad}%, indicando un estado general de clase: ${summary.confiabilidadNivel}. El sistema arrojó ${summary.totalErrores} SKUs con discrepancias de cantidades, con ${summary.sinDiferencia} SKUs completamente limpios y ajustados.`,
    impactoEconomico: `El impacto financiero neto cuantificado en las diferencias asciende a una ${netText}, con diferencias físicas positivas (excedentes) de RD$ ${summary.diferenciasPositivas.toLocaleString("es-DO", { minimumFractionDigits: 2 })} y diferencias físicas negativas (faltantes) de RD$ ${summary.diferenciasNegativas.toLocaleString("es-DO", { minimumFractionDigits: 2 })}. ${topFamText}`,
    analisisFamilias: sortedFamilies,
    diferenciasCriticas: sortedDiscrepancies,
    recomendaciones: recommendationsList,
  };
}
