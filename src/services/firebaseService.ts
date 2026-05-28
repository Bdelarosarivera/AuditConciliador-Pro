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
      pdfUrl = await uploadToStorage(pdfFileOrBlob, "uploads/pdfs", `${auditId}_acta.pdf`);
    } catch (err) {
      console.warn("Firebase Storage PDF upload bypassed/failed (usually CORS or bucket not initialized):", err);
      pdfUrl = "pending-storage-activation";
    }
  }
  if (excelFileOrBlob) {
    try {
      excelUrl = await uploadToStorage(excelFileOrBlob, "exports/excel", `${auditId}_reconciliacion.xlsx`);
    } catch (err) {
      console.warn("Firebase Storage Excel upload bypassed/failed (usually CORS or bucket not initialized):", err);
      excelUrl = "pending-storage-activation";
    }
  }

  const timestampString = new Date().toISOString();

  // 2. Prepare Firestore document
  const auditHeader: DBReviewAudit = {
    id: auditId,
    auditName,
    uploadedBy: userId,
    uploadedByName: userName,
    uploadedAt: timestampString,
    pdfUrl,
    excelUrl,
    totalItems: items.length,
    inventoryAccuracy: summary.exactitudMonto || 0,
    differenceValue: summary.diferenciaNeta || 0,
    status: "finalized",
    processingTime: processingTimeMs / 1000,
    warehouse: warehouse || "Almacén Central RD",
    summary: summary,
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
      
      batch.set(itemDocRef, {
        code: item.codigo,
        description: item.descripcion,
        classification: ["A", "B", "C"].includes(item.clasificacion) ? item.clasificacion : "B",
        physical: item.fisico,
        theoretical: item.teorico,
        difference: item.diferencia,
        cost: item.costo,
        differenceRD: item.diferenciaRD,
        status: item.diferencia === 0 ? "Correcto" : "Discrepancia",
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
    auditId,
    generatedBy: userId,
    generatedAt: timestampString,
    executiveSummary: report.resumenEjecutivo,
    impactoEconomico: report.impactoEconomico,
    recomendaciones: report.recomendaciones,
    recommendations: report.recomendaciones
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
