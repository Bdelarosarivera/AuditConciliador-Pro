import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  query, 
  orderBy, 
  onSnapshot, 
  writeBatch,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from "firebase/storage";
import { db, storage, handleFirestoreError, OperationType } from "../firebase";
import { InventoryItem, AuditSummary, ExecutiveReport } from "../types";

export interface DBReviewAudit {
  id: string;
  auditName: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  pdfUrl: string;
  excelUrl: string;
  totalItems: number;
  inventoryAccuracy: number;
  differenceValue: number;
  status: "draft" | "approved" | "finalized";
  processingTime: number;
  warehouse: string;
  summary: AuditSummary;
  createdAt: string;
}

export interface DBExecutiveReport {
  id: string;
  auditId: string;
  generatedBy: string;
  generatedAt: string;
  reportUrl?: string;
  executiveSummary: string;
  impactoEconomico: string;
  recomendaciones: string[];
  recommendations?: string[];
}

/**
 * Uploads a raw File binary or Base64 string to Firebase Storage and returns the public download URL.
 */
export async function uploadToStorage(
  fileOrBlob: Blob | File,
  folderPath: string,
  fileName: string
): Promise<string> {
  const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const storageRef = ref(storage, `${folderPath}/${cleanFileName}`);
  
  try {
    const uploadTask = await uploadBytesResumable(storageRef, fileOrBlob);
    const downloadURL = await getDownloadURL(uploadTask.ref);
    return downloadURL;
  } catch (error) {
    console.error("Storage upload error for " + fileName, error);
    throw new Error(`Fallo guardando el archivo en la nube: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Saves a finalized stock audit to Cloud Firestore.
 * Handles dual-level insertion: audit header record, plus batch uploading of sub-collection SKUs securely.
 */
export async function saveAuditToCloud(
  auditName: string,
  warehouse: string,
  userId: string,
  userName: string,
  pdfFileOrBlob: Blob | File | null,
  excelFileOrBlob: Blob | File | null,
  items: InventoryItem[],
  summary: AuditSummary,
  processingTimeMs = 3000
): Promise<string> {
  const auditId = `audit-${Date.now()}`;
  
  let pdfUrl = "";
  let excelUrl = "";

  // 1. Upload files to Storage if present with active grace fallbacks (CORS & missing container guards)
  if (pdfFileOrBlob) {
    try {
      const uploadWithTimeout = Promise.race([
        uploadToStorage(pdfFileOrBlob, "uploads/pdfs", `${auditId}_acta.pdf`),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Timeout de conexión con Firebase Storage (5000ms).")), 5000))
      ]);
      pdfUrl = await uploadWithTimeout;
    } catch (err) {
      console.warn("Firebase Storage PDF upload bypassed/failed (usually CORS, bucket not initialized, or timeout):", err);
      pdfUrl = "pending-storage-activation";
    }
  }
  if (excelFileOrBlob) {
    try {
      const uploadWithTimeout = Promise.race([
        uploadToStorage(excelFileOrBlob, "exports/excel", `${auditId}_reconciliacion.xlsx`),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Timeout de conexión con Firebase Storage (5000ms).")), 5000))
      ]);
      excelUrl = await uploadWithTimeout;
    } catch (err) {
      console.warn("Firebase Storage Excel upload bypassed/failed (usually CORS, bucket not initialized, or timeout):", err);
      excelUrl = "pending-storage-activation";
    }
  }

  const timestampString = new Date().toISOString();

  // Helper sanitizer to completely avoid writing NaN or Infinity values to Firestore
  const safeNum = (val: any, fallback = 0): number => {
    if (val === undefined || val === null) return fallback;
    const parsed = Number(val);
    return isNaN(parsed) || !isFinite(parsed) ? fallback : parsed;
  };

  // 2. Prepare Firestore document with robust Spanish fallbacks to satisfy 'isValidAudit' rules
  const cleanConfiabilidadNivel = (
    ["EXCELLENT", "GOOD", "CRITICAL"].includes(summary?.confiabilidadNivel)
      ? summary.confiabilidadNivel
      : "GOOD"
  ) as "EXCELLENT" | "GOOD" | "CRITICAL";

  const auditHeader: DBReviewAudit = {
    id: auditId,
    auditName: (auditName || "Acta de Conciliación Física").trim().substring(0, 199),
    uploadedBy: (userId || "uid-anonimo").toString().substring(0, 127),
    uploadedByName: (userName || "Auditor Autorizado").toString().substring(0, 127),
    uploadedAt: timestampString,
    pdfUrl: pdfUrl || "",
    excelUrl: excelUrl || "",
    totalItems: safeNum(items.length, 0),
    inventoryAccuracy: safeNum(summary?.exactitudMonto, safeNum(summary?.confiabilidad, 0)),
    differenceValue: safeNum(summary?.diferenciaNeta, 0),
    status: "finalized",
    processingTime: safeNum(processingTimeMs / 1000, 3),
    warehouse: (warehouse || "Almacén Central RD").trim(),
    summary: {
      totalArticulos: safeNum(summary?.totalArticulos, safeNum(items.length, 0)),
      conDiferencia: safeNum(summary?.conDiferencia, safeNum(summary?.totalErrores, 0)),
      sinDiferencia: safeNum(summary?.sinDiferencia, 0),
      diferenciasPositivas: safeNum(summary?.diferenciasPositivas, 0),
      diferenciasNegativas: safeNum(summary?.diferenciasNegativas, 0),
      diferenciaNeta: safeNum(summary?.diferenciaNeta, 0),
      valorTotalTeorico: safeNum(summary?.valorTotalTeorico, 0),
      valorTotalFisico: safeNum(summary?.valorTotalFisico, 0),
      confiabilidad: safeNum(summary?.confiabilidad, 0),
      exactitudMonto: safeNum(summary?.exactitudMonto, safeNum(summary?.confiabilidad, 0)),
      confiabilidadNivel: cleanConfiabilidadNivel,
      totalErrores: safeNum(summary?.totalErrores, safeNum(summary?.conDiferencia, 0)),
    },
    createdAt: timestampString
  };

  const auditDocRef = doc(db, "audits", auditId);

  try {
    // Write Audit Header
    await setDoc(auditDocRef, auditHeader);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `audits/${auditId}`);
  }

  // 3. Sequential batches to write nested items (Firestore limit is 500 writes per batch)
  const itemsCollectionRef = collection(db, "audits", auditId, "inventoryItems");
  const batchLimit = 250; 
  
  for (let i = 0; i < items.length; i += batchLimit) {
    const batch = writeBatch(db);
    const chunk = items.slice(i, i + batchLimit);
    
    chunk.forEach((item, idx) => {
      const globalIdx = i + idx;
      const itemId = `item-${globalIdx + 1}`;
      const itemDocRef = doc(itemsCollectionRef, itemId);
      
      const cleanCode = (item.codigo || `SKU-${1000 + globalIdx}`).toString().trim().substring(0, 99);
      const cleanDescription = (item.descripcion || `Artículo Descriptor ${globalIdx + 1}`).toString().trim().substring(0, 499);
      const cleanClassification = (["A", "B", "C"].includes(item.clasificacion) ? item.clasificacion : "B") as "A" | "B" | "C";
      const cleanPhysical = safeNum(item.fisico, 0);
      const cleanTheoretical = safeNum(item.teorico, 0);
      const cleanDifference = safeNum(item.diferencia, cleanPhysical - cleanTheoretical);
      const cleanCost = safeNum(item.costo, 0);
      const cleanDifferenceRD = safeNum(item.diferenciaRD, cleanDifference * cleanCost);

      // We matches exactly the physical structure mandatory per 'isValidInventoryItem' in rules
      batch.set(itemDocRef, {
        code: cleanCode,
        description: cleanDescription,
        classification: cleanClassification,
        physical: cleanPhysical,
        theoretical: cleanTheoretical,
        difference: cleanDifference,
        cost: cleanCost,
        differenceRD: cleanDifferenceRD,
        createdAt: timestampString
      });
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `audits/${auditId}/inventoryItems`);
    }
  }

  return auditId;
}

/**
 * Saves an accompanying compiled Executive Brief or Report to Firestore.
 */
export async function saveExecutiveReportToCloud(
  auditId: string,
  userId: string,
  report: ExecutiveReport
): Promise<string> {
  const reportId = `rep-${Date.now()}`;
  const timestampString = new Date().toISOString();

  const dbReport: DBExecutiveReport = {
    id: reportId,
    auditId: auditId || "",
    generatedBy: userId || "uid-anonimo",
    generatedAt: timestampString,
    executiveSummary: (report.resumenEjecutivo || "Sin resumen ejecutivo.").toString().substring(0, 9999),
    impactoEconomico: (report.impactoEconomico || "Sin observaciones registradas.").toString().substring(0, 4999),
    recomendaciones: Array.isArray(report.recomendaciones) ? report.recomendaciones : [],
    recommendations: Array.isArray(report.recomendaciones) ? report.recomendaciones : []
  };

  const docRef = doc(db, "reports", reportId);

  try {
    await setDoc(docRef, dbReport);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
  }

  return reportId;
}

/**
 * Subscribes to real-time audits collection changes ordered chronologically.
 */
export function subscribeToAudits(onUpdate: (audits: DBReviewAudit[]) => void, onError?: (err: any) => void) {
  const q = query(collection(db, "audits"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: DBReviewAudit[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...docSnap.data() } as DBReviewAudit);
      });
      onUpdate(list);
    },
    (err) => {
      console.error("Realtime Audits snapshot subscription error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribes to real-time generated executive reviews.
 */
export function subscribeToReports(onUpdate: (reports: DBExecutiveReport[]) => void) {
  const q = query(collection(db, "reports"), orderBy("generatedAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: DBExecutiveReport[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          auditId: data.auditId,
          generatedBy: data.generatedBy,
          generatedAt: data.generatedAt,
          reportUrl: data.reportUrl,
          executiveSummary: data.executiveSummary,
          impactoEconomico: data.impactoEconomico || "",
          recomendaciones: data.recomendaciones || data.recommendations || [],
          recommendations: data.recommendations || data.recomendaciones || []
        } as unknown as DBExecutiveReport);
      });
      onUpdate(list);
    },
    (err) => {
      console.error("Realtime Reports snapshot retrieval failed:", err);
    }
  );
}

/**
 * Loads SKU item data for a selected saved audit from server.
 */
export async function getAuditItemsFromCloud(auditId: string): Promise<InventoryItem[]> {
  const path = `audits/${auditId}/inventoryItems`;
  const itemsCollectionRef = collection(db, "audits", auditId, "inventoryItems");
  
  try {
    const snap = await getDocs(itemsCollectionRef);
    const list: InventoryItem[] = [];
    
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        codigo: data.code,
        descripcion: data.description,
        unidad: "Und",
        fisico: data.physical,
        teorico: data.theoretical,
        diferencia: data.difference,
        costo: data.cost,
        diferenciaRD: data.differenceRD,
        familia: data.family || "General",
        clasificacion: data.classification,
        usuario: "Autogestionado de la nube",
        fecha: data.createdAt ? data.createdAt.split("T")[0] : new Date().toISOString().split("T")[0]
      });
    });
    
    return list;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Deletes an entire audit and its sub-collection of inventory items.
 * (Administrators exclusive action)
 */
export async function deleteAuditFromCloud(auditId: string): Promise<void> {
  const auditDocRef = doc(db, "audits", auditId);
  
  // 1. Delete nested items first
  const itemsRef = collection(db, "audits", auditId, "inventoryItems");
  const itemsSnap = await getDocs(itemsRef);
  
  const batch = writeBatch(db);
  itemsSnap.forEach((itemDoc) => {
    batch.delete(doc(itemsRef, itemDoc.id));
  });
  
  // 2. Delete main audit document
  batch.delete(auditDocRef);
  
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `audits/${auditId}`);
  }
}
