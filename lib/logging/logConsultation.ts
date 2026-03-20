import fs from "fs";
import path from "path";

export type ConsultationLogEntry = {
  name: string;
  email: string;
  projectType: string;
  rating: number;
  flatnessDb: number;
  uniformityDb: number;
  roomWidth: number;
  roomHeight: number;
  roomLength: number;
  timestamp: string;
  ip: string;
};

const LOG_DIR  = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "consultations.json");

export function logConsultation(entry: ConsultationLogEntry): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    let existing: ConsultationLogEntry[] = [];

    if (fs.existsSync(LOG_FILE)) {
      const raw = fs.readFileSync(LOG_FILE, "utf-8").trim();
      if (raw) {
        existing = JSON.parse(raw) as ConsultationLogEntry[];
      }
    }

    existing.push(entry);

    fs.writeFileSync(LOG_FILE, JSON.stringify(existing, null, 2), "utf-8");
  } catch (err) {
    console.error("[logConsultation] Failed to write log entry:", err);
  }
}
