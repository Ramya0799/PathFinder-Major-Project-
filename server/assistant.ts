import { campusNodes, destinations } from "../shared/pathfinder";
import { getTranslation, languageOptions, supportedLanguageCodes } from "../shared/i18n";
import { conversationIntents, continueRouteConversation, createConversationState, type AssistantConversationState } from "../shared/assistant-conversation";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1000),
});

const conversationStateSchema = z.object({
  conversationId: z.string().trim().min(8).max(128),
  intent: z.enum(conversationIntents),
  destinationId: z.string().max(64).optional(),
  sourceNodeId: z.string().max(64).optional(),
  accessibilityRequired: z.boolean().default(false),
  language: z.enum(supportedLanguageCodes),
  navigationStatus: z.enum(["idle", "ready", "active"]),
  route: z.object({
    sourceNodeId: z.string().max(64),
    destinationId: z.string().max(64),
    totalDistance: z.number().nonnegative(),
    estimatedTime: z.number().nonnegative(),
    instructions: z.array(z.string().min(1).max(1000)).min(1).max(40),
  }).optional(),
});

export const assistantChatInputSchema = z.object({
  message: z.string().trim().min(1, "Please enter a question.").max(1000),
  language: z.enum(supportedLanguageCodes),
  history: z.array(messageSchema).max(6).default([]),
  conversation: conversationStateSchema.optional(),
}).strict();

export const assistantChatRequestSchema = z.object({
  message: z.string().trim().min(1, "Please enter a question.").max(1000),
  language: z.string().trim().min(1).max(16),
  history: z.array(messageSchema).max(6).default([]),
  conversation: conversationStateSchema.optional(),
}).strict();

export type AssistantChatInput = z.infer<typeof assistantChatInputSchema>;

export function validateAssistantChatRequest(input: unknown): { success: true; data: AssistantChatInput } | { success: false; errorCode: "BAD_REQUEST" | "PRECONDITION_FAILED" } {
  const request = assistantChatRequestSchema.safeParse(input);
  if (!request.success) return { success: false, errorCode: "BAD_REQUEST" };
  const parsed = assistantChatInputSchema.safeParse(request.data);
  if (!parsed.success) return { success: false, errorCode: "PRECONDITION_FAILED" };
  return { success: true, data: parsed.data };
}

let modelSelection: string | undefined;
let modelSelectionResolved = false;

async function getAssistantModel() {
  if (modelSelectionResolved) return modelSelection;
  modelSelectionResolved = true;
  try {
    const catalog = await listLLMModels();
    modelSelection = catalog.data.some((model) => model.id === "gpt-5-mini") ? "gpt-5-mini" : undefined;
  } catch {
    modelSelection = undefined;
  }
  return modelSelection;
}

export function buildCampusContext() {
  const configuredDestinations = destinations.filter((destination) => destination.isActive).map((destination) => ({
    name: destination.name,
    category: destination.category,
    building: destination.buildingName,
    floor: destination.floorName,
    description: destination.description,
    access: destination.accessibilityInfo,
  }));
  const configuredNodes = campusNodes.filter((node) => node.isActive).map((node) => node.name);
  return JSON.stringify({ configuredDestinations, configuredNodes });
}

export async function answerCampusQuestion(input: AssistantChatInput) {
  const language = languageOptions[input.language];
  const model = await getAssistantModel();
  const result = await invokeLLM({
    ...(model ? { model } : {}),
    maxTokens: 500,
    messages: [
      {
        role: "system",
        content: `You are PathFinder, AIET's campus navigation assistant. Respond only in ${language.label} (${language.nativeLabel}) unless the user explicitly asks to switch language. Use only this configured PathFinder campus data: ${buildCampusContext()}. Never invent official AIET facts, room locations, operating hours, departments, or locations absent from that data. If the requested detail is not in the configured data, say "Location information to be verified" in the selected language, then suggest using the campus directory or contacting the relevant office. Be concise, practical, and clear. You may describe configured accessibility notes. Do not claim live positioning, real-time availability, or a route has started.`,
      },
      ...input.history.map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: input.message },
    ],
  });
  const content = result.choices[0]?.message.content;
  const reply = typeof content === "string" ? content.trim() : "";
  if (!reply) throw new Error("The assistant returned an empty response.");
  return { reply, language: input.language };
}

export async function answerAssistantTurn(input: AssistantChatInput) {
  const state: AssistantConversationState = input.conversation ? { ...input.conversation, language: input.language } : createConversationState(input.language);
  const scripted = continueRouteConversation(input.message, state);
  const requestId = crypto.randomUUID();
  console.info("[Campus assistant]", { requestId, conversationId: state.conversationId, message: input.message, intent: state.intent, destinationId: state.destinationId, sourceNodeId: state.sourceNodeId, handledByRouteFlow: scripted.handled });
  if (scripted.handled) return { reply: scripted.reply ?? "", language: input.language, conversation: scripted.state, route: scripted.route, action: scripted.action };
  try {
    const answer = await answerCampusQuestion(input);
    return { ...answer, conversation: scripted.state };
  } catch (error) {
    console.error("[Campus assistant] AI fallback unavailable", { requestId, conversationId: state.conversationId, error: error instanceof Error ? error.message : "unknown" });
    return { reply: getTranslation(input.language, "assistantError"), language: input.language, conversation: scripted.state };
  }
}
