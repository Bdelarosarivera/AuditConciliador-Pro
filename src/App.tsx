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
  Sparkles,
  CloudUpload,
  LogOut,
  ShieldCheck,
  History
} from "lucide-react";
import { InventoryItem, AuditSummary, ExecutiveReport, ProcessingState } from "./types";
import KPICards from "./components/KPICards";
import GaugeChart from "./components/GaugeChart";
import ExecutiveReportPanel from "./components/ExecutiveReportPanel";
import PreviewModal from "./components/PreviewModal";
import InteractiveTable from "./components/InteractiveTable";
import DemoPresets from "./components/DemoPresets";
import { useAuth } from "./context/AuthContext";
import { AuthInterface } from "./components/AuthInterface";
import { saveAuditToCloud, saveExecutiveReportToCloud } from "./services/firebaseService";
import HistoryPanel from "./components/HistoryPanel";

export default function App() {
  const { currentUser, userProfile, logout } = useAuth();
  const [savingToCloud, setSavingToCloud] = useState(false);

  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "table" | "report" | "presets" | "history">("dashboard");

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

  // Local/Direct Gemini configuration for static hosts (GitHub Pages)
  const [clientApiKey, setClientApiKey] = useState(() => {
    return localStorage.getItem("GEMINI_CLIENT_API_KEY") || "";
  });
  const [showKeyInput, setShowKeyInput] = useState(false);

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem("GEMINI_CLIENT_API_KEY", key);
    setClientApiKey(key.trim());
    addToast(key ? "Clave API de Gemini guardada localmente." : "Clave API de Gemini eliminada.", "info");
  };

  // Preview Modal States
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<"pdf" | "excel">("excel");
  const [previewTitle, setPreviewTitle] = useState("");

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

  // Firebase Firestore saving trigger
  const handleSaveToCloud = async () => {
    if (items.length === 0 || !summary) {
      addToast("No existen SKUs de arqueo o discrepancias cargadas en memoria.", "error");
      return;
    }
    setSavingToCloud(true);
    addToast("Empaquetando documentos y conectando con Firebase en tiempo real...", "info");

    try {
      // compile excel blob
      let excelBlob: Blob | null = null;
      try {
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
        if (response.ok) {
          excelBlob = await response.blob();
        }
      } catch (err) {
        console.warn("Could not fetch remote excel stream, archiving dry schema.", err);
      }

      // decode base64 file blob if from PDF upload
      let pdfBlob: Blob | null = null;
      if (currentFileBase64 && currentFileBase64.startsWith("data:")) {
        pdfBlob = base64ToBlob(currentFileBase64);
      }

      const auditTitle = selectedFile?.name || "Acta de Reconciliación Física";
      const bodega = "Bodega Central SD";

      const auditId = await saveAuditToCloud(
        auditTitle,
        bodega,
        currentUser?.uid || "uid-anonimo",
        userProfile?.name || currentUser?.displayName || currentUser?.email?.split("@")[0] || "Auditor Autorizado",
        pdfBlob,
        excelBlob,
        items,
        summary
      );

      if (report) {
        await saveExecutiveReportToCloud(auditId, currentUser?.uid || "uid-anonimo", report);
      }

      addToast(`Sincronizado! Se creó la auditoría: "${auditTitle}" en Firestore con éxito.`, "success");
      setSavingToCloud(false);
      
      // Clean up browser file input and base64 caches so subsequent/multiple loads are totally fresh
      setCurrentFileBase64(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      setActiveTab("history"); // Move them to history so they see their cloud rows instantly!
    } catch (error: any) {
      console.error(error);
      addToast(`Error al sincronizar con Firestore: ${error.message || error}`, "error");
    } finally {
      setSavingToCloud(false);
    }
  };

  const handleImportSavedAudit = (
    fetchedItems: InventoryItem[],
    fetchedSummary: AuditSummary,
    fetchedReport: ExecutiveReport | null,
    fileMetadata: { name: string; sizeText: string; totalPages: number }
  ) => {
    setItems(fetchedItems);
    setOriginalItems(JSON.parse(JSON.stringify(fetchedItems)));
    setSummary(fetchedSummary);
    setReport(fetchedReport);
    setSelectedFile(fileMetadata);
    setProcessState("finalized");
    setActiveTab("dashboard");
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
      try {
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
          return;
        } else {
          throw new Error(body.error || "Fallo procesando el documento.");
        }
      } catch (backendError) {
        console.warn("Backend API unavailable or error. Checking client-side API Key alternative...", backendError);
        
        const clientSavedKey = localStorage.getItem("GEMINI_CLIENT_API_KEY") || "";
        if (clientSavedKey) {
          try {
            setProgressPercent(90);
            setProgressText("Estableciendo conexión segura con Google Gemini (Llave del Cliente)...");
            
            const ocrPrompt = `Actúa como un experto en OCR y auditoría de inventario. Examina este documento de inventario de principio a fin, analizando todas las páginas.
Por favor, asegúrate de:
1. ¡MUY IMPORTANTE!: Escanear, analizar y extraer los artículos de TODAS y cada una de las páginas que componen el documento PDF de principio a fin. El documento puede ser multipáginas (varias páginas escaneadas). No te limites solo a la primera página; recorre todas las tablas y secciones de todas las páginas del archivo.
2. Identificar columnas clave: Código, Descripción/Artículo, Unidad, Cantidad Física (Físico), Stock Teórico (Teórico), Costo Unitario en RD$ (Costo), Familia/Categoría del Producto y Clasificación (si no están, infiere la clasificación ABC basándote en que el tipo A son los más caros/importantes, B intermedios y C los de menor valor).
3. Limpiar espacios extraños, caracteres erróneos, saltos de línea e inconsistencias métricas.
4. Devolver un JSON bien estructurado que tenga un array de todos los artículos recopilados de todo el documento.
5. Identificar si el documento parece un escaneo/imagen (isScanned: true) o un PDF digital puro con texto seleccionable (isScanned: false).`;

            let cleanedBase64 = base64Content;
            let mimeType = "application/pdf";
            const match = base64Content.match(/^data:(.*);base64,(.*)$/);
            if (match) {
              mimeType = match[1];
              cleanedBase64 = match[2];
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${clientSavedKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  { parts: [{ inlineData: { mimeType, data: cleanedBase64 } }, { text: ocrPrompt }] }
                ],
                generationConfig: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: "OBJECT",
                    properties: {
                      items: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            codigo: { type: "STRING" },
                            descripcion: { type: "STRING" },
                            unidad: { type: "STRING" },
                            fisico: { type: "NUMBER" },
                            teorico: { type: "NUMBER" },
                            costo: { type: "NUMBER" },
                            familia: { type: "STRING" },
                            clasificacion: { type: "STRING" }
                          },
                          required: ["codigo", "descripcion", "fisico", "teorico", "costo"]
                        }
                      },
                      isScanned: { type: "BOOLEAN" }
                    },
                    required: ["items", "isScanned"]
                  }
                }
              })
            });

            if (!response.ok) {
              const errInfo = await response.json().catch(() => ({}));
              throw new Error(errInfo.error?.message || `Error con API Gemini (${response.status})`);
            }

            const resJson = await response.json();
            const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const parsedObj = JSON.parse(responseText.trim());
            const rawExtracted = parsedObj.items || [];
            const clientIsScanned = !!parsedObj.isScanned;

            const processedItems = rawExtracted.map((item: any, idx: number) => {
              const fisico = Number(item.fisico) || 0;
              const teorico = Number(item.teorico) || 0;
              const diferencia = fisico - teorico;
              const costo = Number(item.costo) || 0;
              const diferenciaRD = diferencia * costo;

              return {
                id: `sku-direct-${idx + 1}`,
                codigo: (item.codigo || `SKU-${1000 + idx}`).toString().trim(),
                descripcion: (item.descripcion || `Artículo ${idx + 1}`).trim(),
                unidad: (item.unidad || "Und").trim(),
                fisico,
                teorico,
                diferencia,
                costo,
                diferenciaRD,
                familia: (item.familia || "General").trim(),
                clasificacion: ["A", "B", "C"].includes(item.clasificacion) ? item.clasificacion : costo > 5000 ? "A" : costo > 1000 ? "B" : "C",
                usuario: "Auditor Local Directo",
                fecha: new Date().toISOString().split("T")[0],
              };
            });

            const localSummary = calculateSummaryMetrics(processedItems);
            const localReport = compileReportTextMetrics(processedItems, localSummary);

            setProgressPercent(100);
            setProgressText("Petición a Gemini concluida con éxito.");
            await sleep(300);

            setItems(processedItems);
            setOriginalItems(JSON.parse(JSON.stringify(processedItems)));
            setSummary(localSummary);
            setReport(localReport);
            setSelectedFile({
              name: name || "reconciliacion_inventario.pdf",
              sizeText: sizeStr || "1.5 MB",
              totalPages: Math.ceil(processedItems.length / 10) || 1,
            });
            setProcessState("finalized");
            setActiveTab("dashboard");
            addToast(`OCR Directo: ${processedItems.length} SKUs reales extraídos de tu PDF con éxito.`, "success");
            return;
          } catch (directError: any) {
            console.error("Direct key failed, moving to mockup fallback", directError);
            addToast(`Clave Gemini falló: ${directError.message || directError}`, "error");
          }
        }

        // Execute dynamic client-side compilation
        setProgressPercent(100);
        setProgressText("Concluido con éxito (Motor Autónomo Local).");
        await sleep(300);

        const fileLow = (name || "").toLowerCase();
        const style = fileLow.includes("farmacia") ? "farmacia" : fileLow.includes("electronica") ? "electronica" : demoStyle || "general";

        const localItems = generateClientMockDataset(style);
        const localSummary = calculateSummaryMetrics(localItems);
        const localReport = compileReportTextMetrics(localItems, localSummary);

        setItems(localItems);
        setOriginalItems(JSON.parse(JSON.stringify(localItems)));
        setSummary(localSummary);
        setReport(localReport);
        setSelectedFile({
          name: name || "conciliacion_inventario.pdf",
          sizeText: sizeStr || "1.5 MB",
          totalPages: Math.ceil(localItems.length / 5) || 1,
        });
        setProcessState("finalized");
        setActiveTab("dashboard");

        addToast(
          "Servidor ausente (GitHub Pages). Se cargó un ejemplo del rubro coincidente.",
          "warning"
        );
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
      e.target.value = ""; // Clear input value so same file name can be picked sequentially
    }
  };

  const handlePickedFile = (file: File) => {
    const isPDF = file.name.endsWith(".pdf") || file.type === "application/pdf";
    const isCSV = file.name.endsWith(".csv") || file.type === "text/csv";
    const isTXT = file.name.endsWith(".txt") || file.type === "text/plain";

    if (!isPDF && !isCSV && !isTXT) {
      addToast("Solo se admiten documentos en formato PDF, CSV o TXT de inventario.", "error");
      return;
    }

    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + " MB";

    if (isCSV || isTXT) {
      const reader = new FileReader();
      setProcessState("uploading");
      setProgressPercent(30);
      setProgressText("Cargando y decodificando archivo de datos regional...");
      
      reader.onload = async (uploadEvent) => {
        try {
          setProgressPercent(70);
          setProgressText("Procesando columnas y calculando discrepancias (RD$)...");
          await sleep(500);

          const text = uploadEvent.target?.result as string;
          const parsedItems = parseClientSideCSV(text);

          if (parsedItems.length === 0) {
            throw new Error("No se detectaron filas de inventario válidas o con el formato correcto.");
          }

          const localSummary = calculateSummaryMetrics(parsedItems);
          const localReport = compileReportTextMetrics(parsedItems, localSummary);

          setProgressPercent(100);
          setProgressText("Concluido con éxito.");
          await sleep(200);

          setItems(parsedItems);
          setOriginalItems(JSON.parse(JSON.stringify(parsedItems)));
          setSummary(localSummary);
          setReport(localReport);
          setSelectedFile({
            name: file.name,
            sizeText: sizeStr,
            totalPages: 1,
          });
          setProcessState("finalized");
          setActiveTab("dashboard");
          addToast(`Archivo procesado directamente en el navegador: ${parsedItems.length} SKUs cargados de forma real.`, "success");
        } catch (err: any) {
          setProcessState("error");
          addToast(`Error leyendo archivo: ${err.message}`, "error");
        }
      };
      
      reader.onerror = () => {
        setProcessState("error");
        addToast("Fallo la lectura física del archivo.", "error");
      };
      reader.readAsText(file, "UTF-8");
    } else {
      // Standard PDF flow
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
    }
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
      console.warn("Server-side Excel export failed, falling back to client-side CSV export...", err);
      try {
        addToast("Servidor remoto offline. Exportando a CSV inteligente...", "warning");
        
        let csvContent = "\uFEFF"; // UTF-8 BOM for Spanish characters
        csvContent += "CONCILIACIÓN DE INVENTARIO - AUDITCONCILIADOR PRO\n";
        csvContent += `Documento:;${selectedFile?.name || "RECONCILIACIÓN"}\n`;
        csvContent += `Fecha:;${new Date().toLocaleDateString("es-DO")}\n\n`;
        
        if (summary) {
          csvContent += "Métricas Generales;Valor\n";
          csvContent += `Total de Artículos;${summary.totalArticulos}\n`;
          csvContent += `Confiabilidad del Stock;${summary.confiabilidad}%\n`;
          csvContent += `Nivel de Confiabilidad;${summary.confiabilidadNivel}\n`;
          csvContent += `Exactitud por Monto;${summary.exactitudMonto}%\n`;
          csvContent += `Diferencia Financiera Neta;RD$ ${summary.diferenciaNeta}\n`;
          csvContent += `Excedentes (Diferencias +);RD$ ${summary.diferenciasPositivas}\n`;
          csvContent += `Faltantes (Diferencias -);RD$ ${summary.diferenciasNegativas}\n`;
          csvContent += `Valor Total Teórico;RD$ ${summary.valorTotalTeorico}\n`;
          csvContent += `Valor Total Físico;RD$ ${summary.valorTotalFisico}\n\n`;
        }
        
        csvContent += "Código;Descripción;Familia;Clasificación;Unidad;Costo;Físico;Teorico;Diferencia;Diferencia RD$\n";
        
        items.forEach((item) => {
          csvContent += `"${item.codigo}";"${item.descripcion.replace(/"/g, '""')}";"${item.familia}";"${item.clasificacion}";"${item.unidad}";${item.costo};${item.fisico};${item.teorico};${item.diferencia};${item.diferenciaRD}\n`;
        });
        
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `CONCILIACION_INVENTARIO_${selectedFile?.name?.replace(".pdf", "") || "REPORTE"}.csv`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        addToast("Libro CSV exportado correctamente.", "success");
      } catch (fallbackErr: any) {
        addToast(`Error generando CSV local: ${fallbackErr.message}`, "error");
      }
    }
  };

  // Trigger File Picker click helper
  const onTriggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Auth gate checks
  if (!currentUser) {
    return <AuthInterface />;
  }

  if (userProfile?.status === "suspended") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200 p-6 text-center">
        <AlertOctagon className="w-16 h-16 text-rose-500 mb-4 animate-pulse shrink-0" />
        <h2 className="text-md font-black uppercase tracking-tight text-white mb-2">Acceso Corporativo Suspendido</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          Su cuenta asociada a <strong className="text-slate-200">{currentUser.email}</strong> ha sido suspendida por el Administrador de Auditoría Interna. Favor ponerse en contacto con seguridad.
        </p>
        <button
          onClick={() => logout()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
        >
          Cerrar Sesión Activa
        </button>
      </div>
    );
  }

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
          sidebarOpen ? "w-64 opacity-100 border-r" : "w-0 opacity-0 pointer-events-none border-r-0"
        } bg-slate-900 text-slate-100 flex flex-col shrink-0 border-slate-800 transition-all duration-300 z-30 relative overflow-hidden h-screen`}
      >
        <div className="w-64 h-full flex flex-col justify-between shrink-0">
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
            <div className="p-4 mx-3 my-3 bg-slate-800/40 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-xs shrink-0 select-none uppercase shadow-inner">
                  {(userProfile?.name || currentUser.displayName || currentUser.email || "AU").substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-200 truncate leading-tight">
                    {userProfile?.name || currentUser.displayName || "Usuario"}
                  </p>
                  <span className="text-[9px] font-extrabold text-indigo-400 uppercase tracking-widest mt-0.5 block truncate">
                    {userProfile?.role || "Auditor"}
                  </span>
                  <span className="text-[8px] text-slate-500 font-mono block truncate">
                    {currentUser.email}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => logout()}
                title="Cerrar sesión corporativa segura"
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg shrink-0 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
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
                  Herramientas Cloud
                </span>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-medium transition-all group cursor-pointer ${
                    activeTab === "history" ? "bg-indigo-600/95 text-white shadow-3xs" : "hover:bg-slate-800"
                  }`}
                >
                  <History className="w-4 h-4 text-slate-400 group-hover:text-white" />
                  <span>Historial de Auditorías</span>
                </button>

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
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/25 space-y-3">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block">
              Servidor & Claves API
            </span>
            {showKeyInput ? (
              <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <label className="text-[9px] text-slate-300 font-extrabold uppercase tracking-wider block">Llave de Gemini API</label>
                <input
                  type="password"
                  placeholder="Pegar clave AI..."
                  value={clientApiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-950 border border-slate-700/80 rounded p-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                />
                <p className="text-[9px] text-slate-400 leading-normal font-sans">
                  Su clave se guarda localmente en su propio explorador para habilitar el motor OCR real en GitHub Pages sin servidor remoto.
                </p>
                <button
                  onClick={() => setShowKeyInput(false)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold py-1 cursor-pointer transition-colors font-sans"
                >
                  Cerrar Configuración
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowKeyInput(true)}
                className="w-full flex items-center justify-between p-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg text-[10px] font-bold text-slate-300 cursor-pointer transition-all font-sans"
              >
                <span className="flex items-center gap-1.5">🔑 Gemini API Key</span>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${clientApiKey ? "bg-emerald-950 text-emerald-400 border border-emerald-900" : "bg-indigo-950 text-indigo-400 border border-indigo-900"}`}>
                  {clientApiKey ? "CONECTADA" : "CONFIGURAR"}
                </span>
              </button>
            )}

            <div className="pt-2 text-[10px] font-mono text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Ubicación base:</span>
                <span>Rep. Dominicana</span>
              </div>
              <p className="text-[10px] text-slate-500 pt-1 text-center font-sans">
                Diseño Premium SAP Partner
              </p>
            </div>
          </div>
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
              
              {/* Active Tab Logic Selector for Idle state */}
              {activeTab === "history" ? (
                <HistoryPanel 
                  onLoadAuditToDashboard={handleImportSavedAudit} 
                  addToast={addToast} 
                />
              ) : (
                <>
                  {/* GitHub Pages Host Informational Notice */}
                  <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-4 flex gap-3 text-xs text-amber-900 leading-relaxed shadow-3xs">
                    <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-extrabold uppercase tracking-wider text-amber-950 text-[11px] flex items-center gap-1.5">
                        <span>Aviso de Ejecución (Deploy en GitHub Pages)</span>
                      </h4>
                      <p>
                        GitHub Pages funciona de manera estática y <strong>no ejecuta ambientes de fondo (backends) activos</strong> de Node/Express de forma remota. Por eso, al subir un PDF real sin un servidor activo, el sistema de demostración genera un set de datos de muestra para ilustrar la interfaz.
                      </p>
                      <p className="font-bold text-amber-950 pt-1">
                        💡 ¡Tienes dos alternativas excepcionales para auditar tu información real hoy mismo en este enlace!
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>
                          <strong>Carga archivos CSV o archivos de texto (.txt):</strong> Estos se decodifican y procesan 100% en tiempo real directamente en tu navegador mediante nuestro motor local de Javascript, calculando discrepancias al instante.
                        </li>
                        <li>
                          <strong>Conecta tu propia Gemini API Key:</strong> Puedes configurar tu propia llave gratuita en el extremo inferior del menú lateral izquierdo. Esto habilitará el OCR inteligente del PDF real directamente desde la ventana de tu navegador de manera segura.
                        </li>
                      </ul>
                    </div>
                  </div>

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
                    <div className="p-4 bg-slate-50 border group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-2xl text-slate-400 transition-colors">
                      <Upload className="w-10 h-10 stroke-[1.5]" />
                    </div>

                    <div className="space-y-1.5 max-w-sm">
                      <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider group-hover:text-indigo-600">
                        Cargar Acta de Inventario
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed font-sans">
                        Arrastra y suelta tu archivo <strong className="text-slate-700">PDF, CSV o TXT</strong> o <span className="text-indigo-600 font-bold underline">búscalo localmente</span>. Soportado para conciliaciones físicas de almacén y hojas estructuradas.
                      </p>
                    </div>

                    <div className="pt-2">
                      <span className="px-3.5 py-1.5 bg-slate-900 border border-slate-950 text-white rounded-lg text-xs font-semibold shadow-3xs group-hover:bg-slate-800 transition-colors inline-block">
                        Seleccionar Archivo
                      </span>
                    </div>

                    <div className="text-[10px] text-gray-400 font-mono tracking-wide pt-4 border-t border-gray-50 w-full max-w-xs justify-center flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Automatizado con Gemini 3.5-Flash & Motor Directo</span>
                    </div>
                  </div>

                  {/* Presets segment shown immediately when idle */}
                  <DemoPresets onLoadPreset={handleLoadPreset} isLoading={processState !== "idle"} />
                </>
              )}
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
                  {/* Cargar PDF trigger */}
                  <button
                    onClick={onTriggerFilePicker}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    title="Cargar un nuevo archivo (PDF, CSV, TXT)"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Cargar Archivo</span>
                  </button>

                  {/* Descargar Excel trigger with Preview */}
                  <button
                    onClick={() => {
                      if (items.length === 0) {
                        addToast("No hay registros auditados para previsualizar.", "error");
                        return;
                      }
                      setPreviewType("excel");
                      setPreviewTitle(`Libro de Excel: ${selectedFile?.name?.replace(".pdf", "")?.toUpperCase() || "RECONCILIACIÓN"}`);
                      setPreviewOpen(true);
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    title="Previsualizar y descargar libro Excel de 4 hojas"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Excel</span>
                  </button>

                  {/* Descargar PDF trigger with Preview */}
                  <button
                    onClick={() => {
                      if (items.length === 0) {
                        addToast("No existen SKUs cargados para compilar el acta PDF.", "error");
                        return;
                      }
                      setPreviewType("pdf");
                      setPreviewTitle(`Acta de Auditoría PDF: ${selectedFile?.name?.replace(".pdf", "")?.toUpperCase() || "ACTA_CONCILIACION"}`);
                      setPreviewOpen(true);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    title="Previsualizar y generar Acta de Auditoría en PDF"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Descargar PDF</span>
                  </button>

                  {/* Guardar en Firebase Cloud trigger */}
                  <button
                    onClick={handleSaveToCloud}
                    disabled={savingToCloud}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    title="Guardar arqueo de inventario y documentos originales en Firebase Cloud"
                  >
                    <CloudUpload className={`w-3.5 h-3.5 ${savingToCloud ? "animate-pulse" : ""}`} />
                    <span>{savingToCloud ? "Sincronizando..." : "Guardar en la Nube"}</span>
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
                  onClick={() => setActiveTab("history")}
                  className={`pb-3 relative transition-all cursor-pointer ${
                    activeTab === "history" ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Historial Cloud
                  {activeTab === "history" && (
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

              {/* Tab: File History */}
              {activeTab === "history" && (
                <HistoryPanel 
                  onLoadAuditToDashboard={handleImportSavedAudit} 
                  addToast={addToast} 
                />
              )}

              {/* Tab: Presets */}
              {activeTab === "presets" && (
                <DemoPresets onLoadPreset={handleLoadPreset} isLoading={processState !== "idle"} />
              )}

            </div>
          )}

        </main>
      </div>
      {/* Absolute persistent file picker input bound to ref */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.csv,.txt"
        className="hidden"
      />
      {/* Interactive File Preview Modal */}
      <PreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        type={previewType}
        title={previewTitle}
        activeItems={items}
        activeSummary={summary}
        activeReport={report}
        onConfirmDownload={() => {
          if (previewType === "excel") {
            handleDownloadExcel();
          } else {
            // For active PDF report, print layout can be triggered or we can alert
            window.print();
          }
        }}
      />
    </div>
  );
}

// Utility Sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Robust synchronous Base64-to-Blob converter to prevent Chrome/Safari storage URI/Fetch size limits
function base64ToBlob(base64: string, defaultType = "application/pdf"): Blob {
  try {
    const parts = base64.split(";base64,");
    const contentType = parts[0]?.split(":")[1] || defaultType;
    const raw = window.atob(parts[1] || base64);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (e) {
    console.error("Fallo de conversión base64ToBlob:", e);
    return new Blob([], { type: defaultType });
  }
}

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

function generateClientMockDataset(type: string): InventoryItem[] {
  let rawItems: any[] = [];
  if (type === "farmacia") {
    rawItems = [
      { codigo: "MED-5011", descripcion: "Acetaminofén Genfar 500mg (Caja 100 Tab)", unidad: "Cja", fisico: 44, teorico: 48, costo: 320, familia: "Medicamentos de Venta Libre", clasificacion: "B" },
      { codigo: "MED-9020", descripcion: "Amoxicilina Suspensión Oral 250mg/5ml", unidad: "Fco", fisico: 120, teorico: 120, costo: 210, familia: "Farmacia con Receta", clasificacion: "C" },
      { codigo: "MED-1104", descripcion: "Insulina Glargina Lantus Inyección", unidad: "Und", fisico: 14, teorico: 20, costo: 2450, familia: "Enfermedades Crónicas", clasificacion: "A" },
      { codigo: "MED-7721", descripcion: "Vitaminas Pharmaton Geriátrico (60 Caps)", unidad: "Fco", fisico: 85, teorico: 80, costo: 1100, familia: "Suplementos y Vitaminas", clasificacion: "B" },
      { codigo: "MED-3420", descripcion: "Ibuprofeno 400mg Analgésico (Caja 50)", unidad: "Cja", fisico: 110, teorico: 110, costo: 180, familia: "Medicamentos de Venta Libre", clasificacion: "C" },
      { codigo: "MED-8802", descripcion: "Atorvastatina Lipitor 20mg (30 Tab)", unidad: "Cja", fisico: 30, teorico: 35, costo: 1850, familia: "Enfermedades Crónicas", clasificacion: "A" },
      { codigo: "MED-0044", descripcion: "Termómetro Digital Infrarrojo Braun", unidad: "Und", fisico: 15, teorico: 15, costo: 3200, familia: "Equipos Médicos", clasificacion: "A" },
      { codigo: "MED-6523", descripcion: "Curitas Elásticas Adhesivas Band-Aid", unidad: "Cja", fisico: 200, teorico: 198, costo: 145, familia: "Primeros Auxilios", clasificacion: "C" },
      { codigo: "MED-1290", descripcion: "Alcohol Isopropílico Desinfectante 70%", unidad: "Fco", fisico: 350, teorico: 352, costo: 95, familia: "Primeros Auxilios", clasificacion: "C" },
      { codigo: "MED-7023", descripcion: "Omeprazol Sandoz Gastroprotector 20mg", unidad: "Cja", fisico: 90, teorico: 90, costo: 410, familia: "Medicamentos de Venta Libre", clasificacion: "B" },
    ];
  } else if (type === "electronica") {
    rawItems = [
      { codigo: "TEC-1090", descripcion: "iPhone 15 Pro Max 256GB Titanium", unidad: "Und", fisico: 18, teorico: 20, costo: 72000, familia: "Dispositivos Móviles", clasificacion: "A" },
      { codigo: "TEC-4451", descripcion: "Samsung Galaxy S24 Ultra Android", unidad: "Und", fisico: 12, teorico: 12, costo: 64000, familia: "Dispositivos Móviles", clasificacion: "A" },
      { codigo: "TEC-8002", descripcion: "Laptop ASUS Zenbook OLED 14 Intel i7", unidad: "Und", fisico: 9, teorico: 10, costo: 55000, familia: "Cómputo Ejecutivo", clasificacion: "A" },
      { codigo: "TEC-1299", descripcion: "Disco Duro Externo SSD Kingston 1TB", unidad: "Und", fisico: 145, teorico: 140, costo: 5200, familia: "Almacenamiento y Redes", clasificacion: "B" },
      { codigo: "TEC-7712", descripcion: "Audífonos Inalámbricos JBL Tune", unidad: "Und", fisico: 60, teorico: 64, costo: 2800, familia: "Accesorios de Audio", clasificacion: "B" },
      { codigo: "TEC-3211", descripcion: "Teclado Mecánico Logitech MX Keys", unidad: "Und", fisico: 35, teorico: 35, costo: 4500, familia: "Accesorios Cómputo", clasificacion: "B" },
      { codigo: "TEC-0456", descripcion: "Monitor Curvo Gaming Samsung Odyssey 27\"", unidad: "Und", fisico: 15, teorico: 15, costo: 16500, familia: "Cómputo Ejecutivo", clasificacion: "A" },
      { codigo: "TEC-0012", descripcion: "Cargador Rápido USB-C Anker Nano 30W", unidad: "Und", fisico: 400, teorico: 395, costo: 950, familia: "Accesorios Cómputo", clasificacion: "C" },
    ];
  } else {
    rawItems = [
      { codigo: "SKU-3112", descripcion: "Café Santo Domingo Molido Especial 454g", unidad: "Lb", fisico: 420, teorico: 420, costo: 285, familia: "Cafetería y Alimentos", clasificacion: "B" },
      { codigo: "SKU-4912", descripcion: "Aceite de Oliva Fígaro Extra Virgen 500ml", unidad: "Fco", fisico: 180, teorico: 205, costo: 610, familia: "Cafetería y Alimentos", clasificacion: "B" },
      { codigo: "SKU-0021", descripcion: "Whisky Johnnie Walker Black Label 12 Años", unidad: "Bot", fisico: 32, teorico: 35, costo: 2200, familia: "Bebidas Alcohólicas", clasificacion: "A" },
      { codigo: "SKU-8821", descripcion: "Papel Higiénico Scott Rinde Mas (12 Rollos)", unidad: "Cja", fisico: 75, teorico: 75, costo: 340, familia: "Limpieza y Hogar", clasificacion: "C" },
      { codigo: "SKU-1122", descripcion: "Jabón Líquido Antibacterial Protex 221ml", unidad: "Und", fisico: 140, teorico: 125, costo: 160, familia: "Limpieza y Hogar", clasificacion: "C" },
      { codigo: "SKU-5201", descripcion: "Leche Evaporada Carnation Nestlé 315g", unidad: "Cja", fisico: 250, teorico: 250, costo: 55, familia: "Granos y Conservas", clasificacion: "C" },
      { codigo: "SKU-6344", descripcion: "Arroz Premium La Garza Súper Selecto 10Lb", unidad: "Saco", fisico: 95, teorico: 100, costo: 420, familia: "Granos y Conservas", clasificacion: "B" },
      { codigo: "SKU-9023", descripcion: "Detergente Líquido Ariel Poder y Cuidado 3L", unidad: "Und", fisico: 112, teorico: 115, costo: 645, familia: "Limpieza y Hogar", clasificacion: "B" },
      { codigo: "SKU-7703", descripcion: "Ron Barceló Imperial Premium 30 Aniv.", unidad: "Bot", fisico: 6, teorico: 8, costo: 6500, familia: "Bebidas Alcohólicas", clasificacion: "A" },
      { codigo: "SKU-2090", descripcion: "Atún Claro en Aceite Paco Fish 170g", unidad: "Und", fisico: 600, teorico: 600, costo: 110, familia: "Granos y Conservas", clasificacion: "C" },
    ];
  }

  return rawItems.map((item, index) => {
    const fisico = Number(item.fisico);
    const teorico = Number(item.teorico);
    const diferencia = fisico - teorico;
    const costo = Number(item.costo);
    const diferenciaRD = diferencia * costo;

    return {
      id: `${type}-sku-${index + 1}`,
      codigo: item.codigo,
      descripcion: item.descripcion,
      unidad: item.unidad,
      fisico,
      teorico,
      diferencia,
      costo,
      diferenciaRD,
      familia: item.familia,
      clasificacion: item.clasificacion as 'A' | 'B' | 'C',
      usuario: "Auditor Senior",
      fecha: new Date().toISOString().split("T")[0],
    };
  });
}

function parseClientSideCSV(text: string): InventoryItem[] {
  const lines = text.split(/\r?\n/);
  const itemsList: InventoryItem[] = [];
  
  // Find separator (comma or semicolon)
  let separator = ",";
  if (lines[0] && lines[0].includes(";")) {
    separator = ";";
  } else if (lines[0] && lines[0].includes("\t")) {
    separator = "\t";
  }

  let startIndex = 0;
  // Let's analyze lines to find a row that looks like numbers/text or headers
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const cols = lines[i].split(separator);
    const hasNumbers = cols.some(col => !isNaN(Number(col.trim())) && col.trim() !== "");
    if (hasNumbers) {
      startIndex = i;
      break;
    } else if (lines[i].toLowerCase().includes("código") || lines[i].toLowerCase().includes("codigo") || lines[i].toLowerCase().includes("sku")) {
      startIndex = i + 1;
      break;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // split ignoring separators inside quotes
    const cols: string[] = [];
    let insideQuote = false;
    let current = "";
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === separator && !insideQuote) {
        cols.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cols.push(current.trim());

    if (cols.length < 3) continue;

    const rawCodigo = cols[0] || "";
    // Clean up quotes
    const codigo = rawCodigo.replace(/^"|"$/g, "").trim() || `SKU-${1000 + i}`;
    const descripcion = (cols[1] || "").replace(/^"|"$/g, "").trim() || `Artículo ${i + 1}`;
    
    let fisico = 0;
    let teorico = 0;
    let costo = 0;
    let unidad = "Und";
    let familia = "General";
    
    // Simple heuristic parser
    if (cols.length >= 6) {
      fisico = parseFloat(cols[3].replace(/[^0-9.-]/g, "")) || 0;
      teorico = parseFloat(cols[4].replace(/[^0-9.-]/g, "")) || 0;
      costo = parseFloat(cols[5].replace(/[^0-9.-]/g, "")) || 0;
      unidad = cols[2].replace(/^"|"$/g, "").trim() || "Und";
      if (cols[6]) {
        familia = cols[6].replace(/^"|"$/g, "").trim();
      }
    } else {
      // Find numeric columns
      const numbers: number[] = [];
      cols.forEach(c => {
        const num = parseFloat(c.replace(/[^0-9.-]/g, ""));
        if (!isNaN(num)) numbers.push(num);
      });
      if (numbers.length >= 3) {
        fisico = numbers[0];
        teorico = numbers[1];
        costo = numbers[2];
      } else if (numbers.length === 2) {
        fisico = numbers[0];
        teorico = numbers[1];
        costo = 100; // default RD$100
      }
    }

    const diferencia = fisico - teorico;
    const diferenciaRD = diferencia * costo;

    itemsList.push({
      id: `local-sku-${i + 1}`,
      codigo,
      descripcion,
      unidad,
      fisico,
      teorico,
      diferencia,
      costo,
      diferenciaRD,
      familia,
      clasificacion: (costo > 5000 ? "A" : costo > 1000 ? "B" : "C") as 'A' | 'B' | 'C',
      usuario: "Auditor Local Directo",
      fecha: new Date().toISOString().split("T")[0],
    });
  }

  return itemsList;
}
