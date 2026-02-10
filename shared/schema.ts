import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// We don't necessarily need to store the transcriptions in DB for this simple app,
// but it's good practice to have a history or session.
// Let's create a simple 'transcription_logs' table.

export const transcriptionLogs = pgTable("transcription_logs", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTranscriptionLogSchema = createInsertSchema(transcriptionLogs).omit({ 
  id: true, 
  createdAt: true 
});

export type TranscriptionLog = typeof transcriptionLogs.$inferSelect;
export type InsertTranscriptionLog = z.infer<typeof insertTranscriptionLogSchema>;

// API Types
export type TranscribeResponse = {
  text: string;
};
