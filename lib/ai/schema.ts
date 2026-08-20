import { z } from "zod";

export const lineItemSchema = z.object({
  item_id: z.string(),
  category: z.enum(["Core Component", "Consumable", "Hardware"]),
  item_name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(["meters", "units", "packs", "rolls", "liters"]),
});

export const analysisResultSchema = z.object({
  site_summary: z.object({
    trade: z.enum([
      "Plumbing",
      "Electrical",
      "Carpentry",
      "General Contracting",
    ]),
    job_title: z.string().min(1),
    scope_of_work: z.string().min(1),
    detected_hazards_or_notes: z.array(z.string()),
  }),
  line_items: z.array(lineItemSchema).min(1),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
