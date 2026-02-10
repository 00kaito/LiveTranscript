import { db } from "./db";
import { transcriptionLogs, type InsertTranscriptionLog, type TranscriptionLog } from "@shared/schema";

export interface IStorage {
  logTranscription(log: InsertTranscriptionLog): Promise<TranscriptionLog>;
}

export class DatabaseStorage implements IStorage {
  async logTranscription(log: InsertTranscriptionLog): Promise<TranscriptionLog> {
    const [entry] = await db.insert(transcriptionLogs).values(log).returning();
    return entry;
  }
}

export const storage = new DatabaseStorage();
