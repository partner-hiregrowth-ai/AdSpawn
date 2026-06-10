import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { WideCreationService, WideCreationTemplate } from './draft/WideCreationService';

// ─── Provider config ──────────────────────────────────────────────────────────

type Provider = 'claude' | 'openai' | 'gemini' | 'groq';

const DEFAULT_MODELS: Record<Provider, string> = {
  claude:  'claude-haiku-4-5-20251001',
  openai:  'gpt-4o-mini',
  gemini:  'gemini-2.5-flash',
  groq:    'meta-llama/llama-4-scout-17b-16e-instruct',
};

function getProvider(): Provider {
  const p = (process.env.AI_PROVIDER || 'claude').toLowerCase() as Provider;
  if (!['claude', 'openai', 'gemini', 'groq'].includes(p)) {
    throw new Error(`Unknown AI_PROVIDER "${p}". Valid values: claude, openai, gemini, groq`);
  }
  return p;
}

function getModel(provider: Provider): string {
  return process.env.AI_MODEL || DEFAULT_MODELS[provider];
}

// ─── Lazy clients ─────────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

let _groq: OpenAI | null = null;
function getGroq(): OpenAI {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _groq;
}

let _genAI: GoogleGenerativeAI | null = null;
function getNativeGemini(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) throw new Error('GOOGLE_API_KEY is not configured');
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
}

// ─── System prompt (shared across all providers) ──────────────────────────────

const SYSTEM_PROMPT = `You are AdSpawn AI, a specialized assistant for creating Meta Ads.

== HANDLING UPLOADED ASSETS ==
The user will provide markers like "(Uploaded Image Hash: xyz)" or "(Uploaded Video ID: 123)".
1. THESE ARE THE REAL ASSETS. Do not ask for "local access" or "URLs".
2. YOU MUST USE THE HASH/ID in your tool call immediately.
3. If the user says "this image" or "this video", refer to the provided hash.

== HOW TO CALL TOOL ==
- For (Uploaded Image Hash: abc), set ad.fields.creative.image_hash = "abc".
- For (Uploaded Video ID: 123), set ad.fields.creative.video_id = "123".

== OBJECTIVES & AD SET DEFAULTS ==
OUTCOME_AWARENESS:     optimization_goal=REACH,               billing_event=IMPRESSIONS, destination_type=UNDEFINED
OUTCOME_TRAFFIC:       optimization_goal=LINK_CLICKS,         billing_event=IMPRESSIONS, destination_type=WEBSITE
OUTCOME_ENGAGEMENT:    optimization_goal=POST_ENGAGEMENT,     billing_event=IMPRESSIONS, destination_type=WEBSITE
OUTCOME_LEADS:         optimization_goal=LEAD_GENERATION,     billing_event=IMPRESSIONS, destination_type=WEBSITE
OUTCOME_SALES:         optimization_goal=OFFSITE_CONVERSIONS, billing_event=IMPRESSIONS, destination_type=WEBSITE
OUTCOME_APP_PROMOTION: optimization_goal=APP_INSTALLS,        billing_event=IMPRESSIONS, destination_type=APP

== ONE-SHOT GENERATION ==
- If an asset is present, CALL THE TOOL IMMEDIATELY.
- Default to OUTCOME_TRAFFIC if no objective is stated.
- Default budget: CBO ON, 30000 (300 THB).

== RULES ==
- DO NOT CHAT. DO NOT ASK FOR PERMISSION. CALL THE TOOL NOW.`;

// ─── Tool / function schema (provider-agnostic JSON Schema) ──────────────────

const TOOL_PARAMS: any = {
  type: 'object',
  properties: {
    template: {
      type: 'object',
      description: 'WideCreationTemplate to generate',
      properties: {
        name: { type: 'string', description: 'Template name, e.g. "AI Campaign 2025-06-02"' },
        adAccountId: { type: 'string', description: 'Ad account ID' },
        campaigns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fields: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  objective: {
                    type: 'string',
                    enum: [
                      'OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT',
                      'OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_APP_PROMOTION',
                    ],
                  },
                  special_ad_categories: { type: 'array', items: { type: 'string' } },
                  status: { type: 'string', enum: ['PAUSED'] },
                  daily_budget: { type: 'number', description: 'In smallest unit (e.g. 1 THB = 100). Default 30000.' },
                  is_adset_budget_sharing_enabled: { type: 'boolean', description: 'Default true (CBO).' },
                },
                required: ['name', 'objective', 'special_ad_categories', 'status'],
              },
              adSets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    fields: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        optimization_goal: { type: 'string' },
                        billing_event: { type: 'string' },
                        destination_type: { type: 'string' },
                        targeting: { type: 'object' },
                      },
                      required: ['name', 'optimization_goal', 'billing_event', 'destination_type', 'targeting'],
                    },
                    ads: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          fields: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              creative: {
                                type: 'object',
                                properties: {
                                  image_hash: { type: 'string', description: 'USE THE (Uploaded Image Hash: ...) VALUE FROM THE MESSAGE.' },
                                  video_id: { type: 'string', description: 'USE THE (Uploaded Video ID: ...) VALUE FROM THE MESSAGE.' },
                                  primary_text: { type: 'string', description: 'Ad caption' },
                                  headline: { type: 'string' },
                                  link_url: { type: 'string', default: 'https://example.com' },
                                },
                              },
                            },
                            required: ['name'],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      required: ['name', 'campaigns'],
    },
  },
  required: ['template'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Transforms simplified AI creative fields into Meta's object_story_spec format.
 */
function transformAiCreative(aiCreative: any, objective: string, pageId?: string): any {
  if (!aiCreative || Object.keys(aiCreative).length === 0) return undefined;
  if (aiCreative.creative_id) return { creative_id: aiCreative.creative_id };

  const oss: any = {};
  if (pageId) oss.page_id = pageId;
  
  const link = aiCreative.link_url || 'https://example.com';

  if (aiCreative.video_id) {
    oss.video_data = {
      video_id: aiCreative.video_id,
      message: aiCreative.primary_text,
    };
  } else if (aiCreative.image_url || aiCreative.image_hash) {
    // Determine if it's a Link ad or Photo ad based on objective
    // Most objectives use link_data for better tracking and CTA
    if (objective === 'OUTCOME_AWARENESS' && !aiCreative.link_url) {
      oss.photo_data = {
        image_hash: aiCreative.image_hash,
        picture: aiCreative.image_url,
        caption: aiCreative.primary_text,
      };
    } else {
      oss.link_data = {
        message: aiCreative.primary_text,
        link: link,
        name: aiCreative.headline,
        description: aiCreative.description,
        picture: aiCreative.image_url,
        image_hash: aiCreative.image_hash,
      };
      if (aiCreative.call_to_action_type) {
        oss.link_data.call_to_action = { type: aiCreative.call_to_action_type };
      }
    }
  } else if (aiCreative.primary_text || aiCreative.headline) {
    // Text-only link ad
    oss.link_data = {
      message: aiCreative.primary_text,
      link: link,
      name: aiCreative.headline,
      description: aiCreative.description,
    };
    if (aiCreative.call_to_action_type) {
      oss.link_data.call_to_action = { type: aiCreative.call_to_action_type };
    }
  }

  return Object.keys(oss).length > 0 ? { object_story_spec: oss } : undefined;
}


// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  adAccountId: string;
  profileId?: string;
}

export interface ChatResponse {
  reply: string;
  generationResult?: {
    totalCreated: { campaigns: number; adSets: number; ads: number };
    warnings: string[];
    campaignIds?: string[];
  };
  adAccountId?: string;
  error?: string;
}

interface ProviderResult {
  text?: string;
  toolInput?: Record<string, any>;
  // Kept for building the fix-loop conversation
  rawAnthropicContent?: Anthropic.ContentBlock[];
  rawOpenAIMsg?: OpenAI.Chat.ChatCompletionMessage;
  toolCallId?: string;
  // Gemini native parts for feedback loop
  geminiParts?: Part[];
}

// ─── Provider call: Anthropic ─────────────────────────────────────────────────

async function callAnthropic(
  messages: Anthropic.MessageParam[],
  model: string,
  maxTokens: number,
): Promise<ProviderResult> {
  const client = getAnthropic();
  const tool: Anthropic.Tool = {
    name: 'generate_draft_template',
    description:
      'Generates Meta ad campaign drafts. Call this once you have all required fields.',
    input_schema: TOOL_PARAMS as Anthropic.Tool['input_schema'],
  };

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    tools: [tool],
    messages,
  });

  if (response.stop_reason === 'tool_use') {
    const toolUse = response.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;
    return {
      toolInput: toolUse?.input as Record<string, any> | undefined,
      rawAnthropicContent: response.content,
    };
  }
  const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined;
  return { text: textBlock?.text };
}

async function callAnthropicWithValidationError(
  originalMessages: Anthropic.MessageParam[],
  rawContent: Anthropic.ContentBlock[],
  errorJson: string,
  model: string,
): Promise<string> {
  const client = getAnthropic();
  const tool: Anthropic.Tool = {
    name: 'generate_draft_template',
    description: 'Generates Meta ad campaign drafts.',
    input_schema: TOOL_PARAMS as Anthropic.Tool['input_schema'],
  };

  const toolUse = rawContent.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;

  const fixMessages: Anthropic.MessageParam[] = [
    ...originalMessages,
    { role: 'assistant', content: rawContent },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUse?.id ?? 'unknown',
          content: `VALIDATION_ERRORS: ${errorJson}`,
          is_error: true,
        },
        {
          type: 'text',
          text: 'The template you generated failed validation. Please explain what is wrong to the user and ask for corrections.',
        },
      ],
    },
  ];

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: [tool],
    messages: fixMessages,
  });
  const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined;
  return textBlock?.text ?? 'There were validation issues with the template. Please correct the details.';
}

// ─── Provider call: OpenAI / Groq ─────────────────────────────────────────────

async function callOpenAICompat(
  client: OpenAI,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model: string,
  maxTokens: number,
): Promise<ProviderResult> {
  const tool: OpenAI.Chat.ChatCompletionTool = {
    type: 'function',
    function: {
      name: 'generate_draft_template',
      description:
        'Generates Meta ad campaign drafts. Call this once you have all required fields.',
      parameters: TOOL_PARAMS,
    },
  };

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages,
    tools: [tool],
    tool_choice: 'auto',
  });

  const msg = response.choices[0].message;

  if (msg.tool_calls?.length) {
    const tc = msg.tool_calls[0] as OpenAI.Chat.ChatCompletionMessageToolCall & { function: { arguments: string } };
    const toolInput = JSON.parse(tc.function.arguments) as Record<string, any>;
    return { toolInput, rawOpenAIMsg: msg, toolCallId: tc.id };
  }
  return { text: msg.content ?? undefined };
}

async function callOpenAICompatWithValidationError(
  client: OpenAI,
  originalMessages: OpenAI.Chat.ChatCompletionMessageParam[],
  rawMsg: OpenAI.Chat.ChatCompletionMessage,
  toolCallId: string,
  errorJson: string,
  model: string,
): Promise<string> {
  const tool: OpenAI.Chat.ChatCompletionTool = {
    type: 'function',
    function: {
      name: 'generate_draft_template',
      description: 'Generates Meta ad campaign drafts.',
      parameters: TOOL_PARAMS,
    },
  };

  const fixMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...originalMessages,
    rawMsg as OpenAI.Chat.ChatCompletionMessageParam,
    {
      role: 'tool',
      tool_call_id: toolCallId,
      content: JSON.stringify({ status: 'validation_failed', errors: JSON.parse(errorJson) }),
    },
    {
      role: 'user',
      content: 'The template failed validation. Please explain what needs to be fixed and ask the user to provide correct values.',
    },
  ];

  const response = await client.chat.completions.create({
    model,
    max_tokens: 512,
    messages: fixMessages,
    tools: [tool],
    tool_choice: 'none',
  });
  return response.choices[0].message.content ?? 'There were validation issues. Please correct the details.';
}

// ─── Provider call: Gemini (Native) ───────────────────────────────────────────

async function callNativeGemini(
  history: ChatMessage[],
  contextContent: string,
  modelName: string,
): Promise<ProviderResult> {
  const client = getNativeGemini();
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    tools: [{
      functionDeclarations: [{
        name: 'generate_draft_template',
        description: 'Generates Meta ad campaign drafts. Call this once you have all required fields.',
        parameters: TOOL_PARAMS,
      }],
    }],
  });

  // Gemini requires alternating roles. 
  // We merge contextContent into the first message if it's from the user.
  const processedHistory = [...history];
  if (processedHistory.length > 0 && processedHistory[0].role === 'user') {
    processedHistory[0] = { 
      ...processedHistory[0], 
      content: `${contextContent}\n\n${processedHistory[0].content}` 
    };
  } else {
    processedHistory.unshift({ role: 'user', content: contextContent });
  }

  const chat = model.startChat({
    history: processedHistory.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
  });

  const lastMsg = processedHistory[processedHistory.length - 1]?.content || 'Hello';
  const result = await chat.sendMessage(lastMsg);
  const response = result.response;
  
  // Robust response check
  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) {
    let text = "I received an unexpected response from Gemini. Please try again.";
    try {
      text = response.text();
    } catch (e) {
      console.warn("[AiCreate] Gemini response.text() failed:", e);
    }
    return { text };
  }

  const parts = candidate.content.parts;
  const call = parts.find(p => p.functionCall);
  if (call?.functionCall) {
    return {
      toolInput: call.functionCall.args as Record<string, any>,
      geminiParts: parts,
    };
  }

  return { text: response.text() };
}

async function callNativeGeminiWithValidationError(
  history: ChatMessage[],
  contextContent: string,
  modelName: string,
  rawParts: Part[],
  errorJson: string,
): Promise<string> {
  const client = getNativeGemini();
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
  });

  const call = rawParts.find(p => p.functionCall);

  const processedHistory = [...history];
  if (processedHistory.length > 0 && processedHistory[0].role === 'user') {
    processedHistory[0] = { 
      ...processedHistory[0], 
      content: `${contextContent}\n\n${processedHistory[0].content}` 
    };
  } else {
    processedHistory.unshift({ role: 'user', content: contextContent });
  }

  const chat = model.startChat({
    history: [
      ...processedHistory.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      { role: 'model', parts: rawParts },
    ],
  });

  const feedback = [
    {
      functionResponse: {
        name: call?.functionCall?.name || 'generate_draft_template',
        response: {
          status: 'validation_failed',
          errors: JSON.parse(errorJson),
          instruction: 'The template failed validation. Explain the errors in plain language and ask the user for corrections.',
        },
      },
    },
  ];

  const result = await chat.sendMessage(feedback);
  return result.response.text();
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AiCampaignService {
  static async chat(req: ChatRequest): Promise<ChatResponse> {
    try {
      const provider = getProvider();
      const model = getModel(provider);
      const today = new Date().toISOString().split('T')[0];
      const history = req.messages.slice(-20);

      // --- LOGGING FOR DEBUGGING ---
      const lastMsg = history[history.length - 1];
      console.log(`[AiCreate] Provider: ${provider}, Model: ${model}`);
      console.log(`[AiCreate] Incoming Content: "${lastMsg?.content}"`);
      // -----------------------------

      const contextContent = `[SYSTEM CONTEXT] Ad account ID: ${req.adAccountId}. Today: ${today}. Generate all draft names with today's date.`;

      let result: ProviderResult;

      if (provider === 'claude') {
        const historyMsgs: Anthropic.MessageParam[] = history.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        if (historyMsgs.length > 0 && historyMsgs[0].role === 'user') {
          historyMsgs[0].content = `${contextContent}\n\n${historyMsgs[0].content}`;
        } else {
          historyMsgs.unshift({ role: 'user', content: contextContent });
        }
        result = await callAnthropic(historyMsgs, model, 1024);
      } else if (provider === 'gemini') {
        result = await callNativeGemini(history, contextContent, model);
      } else {
        const client = provider === 'groq' ? getGroq() : getOpenAI();
        const openaiMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: contextContent },
          ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ];
        result = await callOpenAICompat(client, openaiMsgs, model, 1024);
      }

      // ── Tool call: validate then generate ──
      if (result.toolInput) {
        const template = result.toolInput.template as WideCreationTemplate;
        template.adAccountId = req.adAccountId;

        // Apply creative transformations across the template tree
        for (const campaign of template.campaigns) {
          const objective = campaign.fields?.objective || 'OUTCOME_TRAFFIC';
          if (campaign.adSets) {
            for (const adSet of campaign.adSets) {
              // Heuristic for page_id: check adset promoted_object or adset fields
              const pageId = adSet.fields?.promoted_object?.page_id || adSet.fields?.page_id;
              if (adSet.ads) {
                for (const ad of adSet.ads) {
                  if (ad.fields?.creative) {
                    ad.fields.creative = transformAiCreative(ad.fields.creative, objective, pageId);
                  }
                }
              }
            }
          }
        }

        const validation = await WideCreationService.validateTemplate(template);

        if (!validation.valid && validation.errors.length > 0) {
          const errorJson = JSON.stringify(validation.errors.slice(0, 10));
          let explanation: string;

          if (provider === 'claude') {
            const historyMsgs: Anthropic.MessageParam[] = history.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));
            if (historyMsgs.length > 0 && historyMsgs[0].role === 'user') {
              historyMsgs[0].content = `${contextContent}\n\n${historyMsgs[0].content}`;
            } else {
              historyMsgs.unshift({ role: 'user', content: contextContent });
            }
            explanation = await callAnthropicWithValidationError(
              historyMsgs, result.rawAnthropicContent!, errorJson, model,
            );
          } else if (provider === 'gemini') {
            explanation = await callNativeGeminiWithValidationError(
              history, contextContent, model, result.geminiParts!, errorJson,
            );
          } else {
            const client = provider === 'groq' ? getGroq() : getOpenAI();
            const openaiMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: contextContent },
              ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            ];
            explanation = await callOpenAICompatWithValidationError(
              client, openaiMsgs, result.rawOpenAIMsg!, result.toolCallId!, errorJson, model,
            );
          }
          return { reply: explanation };
        }

        if (!req.profileId) {
          throw new Error('No profile selected. Please select a profile before generating campaigns.');
        }

        const genResult = await WideCreationService.generateFromTemplate(template, req.profileId);
        const { totalCreated, warnings, campaignIds } = genResult;

        const reply =
          `Done! Created ${totalCreated.campaigns} campaign${totalCreated.campaigns !== 1 ? 's' : ''}, ` +
          `${totalCreated.adSets} ad set${totalCreated.adSets !== 1 ? 's' : ''}, and ` +
          `${totalCreated.ads} ad${totalCreated.ads !== 1 ? 's' : ''} as PAUSED drafts. ` +
          `Go to Drafts to add creative and publish when ready.`;

        return { reply, generationResult: { totalCreated, warnings, campaignIds }, adAccountId: req.adAccountId };
      }

      return { reply: result.text ?? 'I had trouble generating a response. Please try again.' };

    } catch (err: any) {
      const provider = getProvider();
      const model = getModel(provider);
      console.error(`[AiCampaignService] ${provider.toUpperCase()} (${model}) Error:`, err.message);
      if (err.status) console.error('[AiCampaignService] Status:', err.status);
      if (err.error) console.error('[AiCampaignService] Error details:', JSON.stringify(err.error, null, 2));
      
      const isConfig = /api_key|not configured/i.test(err.message ?? '');
      const isRateLimit = /429|quota/i.test(err.message ?? '');
      const isHighDemand = /503|high demand/i.test(err.message ?? '');
      
      return {
        reply: isHighDemand
          ? 'Gemini is currently experiencing very high demand. Please wait 10-30 seconds and try sending your message again.'
          : isRateLimit
          ? 'Gemini API quota exceeded (429). This often happens on the Free Tier. Please wait a minute or try again later.'
          : isConfig
          ? 'AI service is not configured. Please check the API key for your selected provider.'
          : 'Something went wrong. Please try again in a moment.',
        error: err.message,
      };
    }
  }
}
