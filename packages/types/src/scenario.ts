import { z } from "zod";

export const scenarioLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);

export const scenarioObjectiveSchema = z.object({
  id: z.string(),
  description: z.string(),
  points: z.number().int().nonnegative(),
});

export const scenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  level: scenarioLevelSchema,
  description: z.string(),
  objectives: z.array(scenarioObjectiveSchema).min(1),
  hints: z.array(z.string()).default([]),
  topology: z.string().optional(),
});
export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenarioObjective = z.infer<typeof scenarioObjectiveSchema>;
