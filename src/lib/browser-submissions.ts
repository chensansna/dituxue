const DATABASE_NAME = "cartography-teaching-demo";
const STORE_NAME = "submission-files";
export const LATEST_MAP_FILE_KEY = "latest-map-file";
const CURRENT_SUBMISSION_KEY = "submission:2024010215";

export type LocalSubmission = {
  studentNo: string;
  studentName: string;
  className: string;
  assignmentTitle: string;
  file: File;
  uploadedAt: string;
  review?: unknown;
  reviewedAt?: string;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSubmissionFile(file: File) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(file, LATEST_MAP_FILE_KEY);
    transaction.objectStore(STORE_NAME).put({
      studentNo: "2024010215",
      studentName: "林晓雨",
      className: "地图学 2024-1班",
      assignmentTitle: "专题地图设计：标杆社区和待优化社区分布图",
      file,
      uploadedAt: new Date().toISOString(),
    } satisfies LocalSubmission, CURRENT_SUBMISSION_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function getPendingSubmissions() {
  const database = await openDatabase();
  const values = await new Promise<unknown[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  const submissions = values.filter((value): value is LocalSubmission => {
    return Boolean(value && typeof value === "object" && "studentNo" in value && "file" in value && !("review" in value));
  });
  if (!submissions.length) {
    const legacyFile = values.find((value): value is File => value instanceof File);
    if (legacyFile) {
      const migrated: LocalSubmission = {
        studentNo: "2024010215",
        studentName: "林晓雨",
        className: "地图学 2024-1班",
        assignmentTitle: "专题地图设计：标杆社区和待优化社区分布图",
        file: legacyFile,
        uploadedAt: new Date().toISOString(),
      };
      const migrationDatabase = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = migrationDatabase.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(migrated, CURRENT_SUBMISSION_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      migrationDatabase.close();
      return [migrated];
    }
  }
  return submissions;
}

export async function saveSubmissionReview(studentNo: string, review: unknown) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(`submission:${studentNo}`);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, review, reviewedAt: new Date().toISOString() }, `submission:${studentNo}`);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function getLatestSubmissionFile() {
  const database = await openDatabase();
  const file = await new Promise<File | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(LATEST_MAP_FILE_KEY);
    request.onsuccess = () => resolve(request.result as File | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return file;
}
