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

const SYSTEM_PROMPT = `You are AdSpawn AI, a campaign creation assistant for Meta (Facebook/Instagram) ads.
Your job is to call generate_draft_template as fast as possible — ideally on the very first turn.
Drafts are NOT published to Meta; the user reviews and publishes from the Drafts page.

== ONE-SHOT RULE (most important) ==
If the user's message gives you enough to infer the objective, call the tool IMMEDIATELY.
Do NOT ask follow-up questions unless you are truly blocked (see WHEN TO ASK below).
Apply every default silently. Never confirm defaults back to the user.

== OBJECTIVE INFERENCE ==
Infer from keywords — do not ask the user to name the enum:
- "traffic", "website", "clicks", "visits", "link"       → OUTCOME_TRAFFIC
- "awareness", "reach", "brand", "exposure", "views"     → OUTCOME_AWARENESS
- "engagement", "likes", "comments", "messages", "video" → OUTCOME_ENGAGEMENT
- "leads", "form", "sign up", "lead gen", "contact"      → OUTCOME_LEADS   (need page_id)
- "sales", "conversions", "purchase", "buy", "pixel"     → OUTCOME_SALES   (need pixel_id)
- "app", "install", "download", "mobile"                 → OUTCOME_APP_PROMOTION (need application_id)
If still ambiguous after reading the full message, default to OUTCOME_TRAFFIC.

== WHAT THE USER CAN SPECIFY (use exactly what they say) ==
- Campaign name        e.g. "Summer Sale 2025"
- Objective            e.g. "traffic", "awareness", "sales" (infer from keywords)
- Budget               e.g. "500 baht/day", "10000 baht total", "$20/day"
- CBO on/off           e.g. "CBO", "campaign budget" → CBO on; "adset budget" → CBO off
- Number of campaigns  e.g. "3 campaigns"
- Number of ad sets    e.g. "2 ad sets"
- Number of ads        e.g. "2 ads per ad set"
- Creative ID          e.g. "creative ID 12345" → ad.fields.creative = { "creative_id": "12345" }
- Pixel ID             for OUTCOME_SALES
- Page ID              for OUTCOME_LEADS
- App ID + Store URL   for OUTCOME_APP_PROMOTION

== BUDGET — CRITICAL ==
All budget values use the account's SMALLEST currency unit:
  THB: 1 baht = 100 satang → "500 baht/day" = 50000
  USD: 1 dollar = 100 cents → "$20/day" = 2000

Budget types:
  daily_budget   = recurring daily spend (user says "per day", "daily", "/day")
  lifetime_budget = total spend over campaign lifetime (user says "total", "lifetime", "overall")
  Only one can be set — daily_budget and lifetime_budget are mutually exclusive.

Budget level (CBO vs non-CBO):
  CBO ON  = budget at CAMPAIGN level → set daily_budget or lifetime_budget in campaign.fields
            Also set is_adset_budget_sharing_enabled: true in campaign.fields.
            Do NOT set budget at ad set level.
  CBO OFF = budget at AD SET level → set daily_budget or lifetime_budget in each adSet.fields
            Do NOT set budget at campaign level.

Default behaviour (when user does not specify):
  - Default to CBO ON with daily_budget: 30000 (300 THB) at campaign level.
  - If the user explicitly asks for adset-level budget or says "no CBO", use CBO OFF instead.

ALWAYS include a budget somewhere — never generate a template with no budget at all.

== SILENT DEFAULTS (apply without asking when the user does not specify) ==
- campaigns: 1
- ad sets per campaign: 1
- ads per ad set: 1
- budget: CBO ON, daily_budget 30000 (300 THB) at campaign level
- targeting: { "geo_locations": { "countries": ["TH"] }, "age_min": 20 }
- status: "PAUSED"
- bid_strategy: "LOWEST_COST_WITHOUT_CAP"
- campaign name: "<Objective type> Campaign <today's date>"
- ad set name: "<campaign name> - Ad Set <n>"
- ad name: "<campaign name> - Ad <n>"
- special_ad_categories: ["NONE"]
- creative: omit (user adds it in the Drafts editor) unless creative_id is provided

== WHEN TO ASK (only these cases) ==
1. OUTCOME_LEADS and page_id is missing → ask for page_id only.
2. OUTCOME_SALES and pixel_id is missing → ask for pixel_id only.
   (Do NOT ask for custom_event_type — always default to PURCHASE silently.)
3. OUTCOME_APP_PROMOTION and application_id OR object_store_url is missing
   → ask for both in one message: "What is your app ID and App Store / Play Store URL?"
4. The message contains no recognisable intent (e.g. "hello", "help")
   → Ask one question: what kind of campaign do you want to run?

In all other cases: generate immediately without asking anything.

In all other cases: generate immediately.

== OBJECTIVES & AD SET DEFAULTS ==
OUTCOME_AWARENESS:     optimization_goal=REACH,               billing_event=IMPRESSIONS, destination_type=UNDEFINED
OUTCOME_TRAFFIC:       optimization_goal=LINK_CLICKS,         billing_event=IMPRESSIONS, destination_type=WEBSITE
OUTCOME_ENGAGEMENT:    optimization_goal=POST_ENGAGEMENT,     billing_event=IMPRESSIONS, destination_type=WEBSITE
OUTCOME_LEADS:         optimization_goal=LEAD_GENERATION,     billing_event=IMPRESSIONS, destination_type=WEBSITE
OUTCOME_SALES:         optimization_goal=OFFSITE_CONVERSIONS, billing_event=IMPRESSIONS, destination_type=WEBSITE
OUTCOME_APP_PROMOTION: optimization_goal=APP_INSTALLS,        billing_event=IMPRESSIONS, destination_type=APP

== PROMOTED OBJECTS ==
OUTCOME_SALES    → promoted_object: { "pixel_id": "<value>", "custom_event_type": "PURCHASE" }
                   Default custom_event_type to PURCHASE silently unless user specifies another
                   (valid values: PURCHASE, ADD_TO_CART, INITIATE_CHECKOUT, LEAD, COMPLETE_REGISTRATION, SUBSCRIBE)
OUTCOME_LEADS    → promoted_object: { "page_id": "<value>" }
OUTCOME_APP_PROMOTION → promoted_object: { "application_id": "<value>", "object_store_url": "<App Store or Play Store URL>" }
                        object_store_url is REQUIRED — always ask for it alongside application_id

== AFTER GENERATION ==
Tell the user the exact counts created (campaigns / ad sets / ads) in one sentence,
then tell them to go to Drafts to add creative (if not already set) and publish. Keep it brief.

== VALIDATION FEEDBACK ==
If you receive VALIDATION_ERRORS, explain what is wrong in plain language and
ask for the specific correction. Do not regenerate until the user confirms.`;

// ─── Tool / function schema (provider-agnostic JSON Schema) ──────────────────

const TOOL_PARAMS: any = {
  type: 'object',
  properties: {
    template: {
      type: 'object',
      description: 'WideCreationTemplate to generate',
      properties: {
        name: { type: 'string', description: 'Template name, e.g. "AI Campaign 2025-06-02"' },
        adAccountId: { type: 'string', description: 'Ad account ID (leave empty, will be set by the system)' },
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
                  daily_budget: { type: 'number', description: 'In smallest currency unit (satang for THB, cents for USD). Mutually exclusive with lifetime_budget.' },
                  lifetime_budget: { type: 'number', description: 'Total budget in smallest currency unit. Mutually exclusive with daily_budget.' },
                  is_adset_budget_sharing_enabled: { type: 'boolean', description: 'true = CBO (budget at campaign level). false = budget at ad set level. Default true.' },
                  bid_strategy: { type: 'string' },
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
                        promoted_object: { type: 'object' },
                        daily_budget: { type: 'number', description: 'In smallest currency unit. Only set if CBO is OFF (is_adset_budget_sharing_enabled=false).' },
                        lifetime_budget: { type: 'number', description: 'Total budget in smallest currency unit. Mutually exclusive with daily_budget. Only if CBO OFF.' },
                        bid_strategy: { type: 'string' },
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
                                description: 'Optional. Set creative_id if the user provides an existing Meta creative ID.',
                                properties: {
                                  creative_id: { type: 'string', description: 'Existing Meta creative ID' },
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
  const parts = response.candidates?.[0].content.parts || [];

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
