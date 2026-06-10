import {
  CAMPAIGN_FIELDS,
  ADSET_FIELDS,
  AD_FIELDS,
  FieldConfig,
  VALID_OPTIMIZATION_GOALS,
  VALID_DESTINATION_TYPES,
  VALID_BUYING_TYPES,
  PROMOTED_OBJECT_REQUIREMENTS,
  ATTRIBUTION_SPEC_OBJECTIVES,
  BID_CAP_STRATEGIES,
  OBJECTIVE_DEFAULTS,
  OPTIMIZATION_GOAL_LABELS,
  DESTINATION_TYPE_LABELS,
} from './MetaFieldRegistry';

const CTA_OPTIONS: { value: string; label: string }[] = [
  { value: 'ADD_TO_CART', label: 'Add to Cart' },
  { value: 'APPLY_NOW', label: 'Apply Now' },
  { value: 'BOOK_TRAVEL', label: 'Book Now' },
  { value: 'BUY_NOW', label: 'Buy Now' },
  { value: 'CALL_NOW', label: 'Call Now' },
  { value: 'CONTACT_US', label: 'Contact Us' },
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'FOLLOW_PAGE', label: 'Follow Page' },
  { value: 'GET_DIRECTIONS', label: 'Get Directions' },
  { value: 'GET_OFFER', label: 'Get Offer' },
  { value: 'GET_QUOTE', label: 'Get Quote' },
  { value: 'INSTALL_APP', label: 'Install App' },
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'LIKE_PAGE', label: 'Like Page' },
  { value: 'LISTEN_NOW', label: 'Listen Now' },
  { value: 'MAKE_AN_APPOINTMENT', label: 'Make Appointment' },
  { value: 'OPEN_LINK', label: 'Open Link' },
  { value: 'ORDER_NOW', label: 'Order Now' },
  { value: 'PLAY_GAME', label: 'Play Game' },
  { value: 'SEE_MORE', label: 'See More' },
  { value: 'MESSAGE_PAGE', label: 'Send Message' },
  { value: 'SEND_MESSAGE', label: 'Send Message (Generic)' },
  { value: 'SHOP_NOW', label: 'Shop Now' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'SUBSCRIBE', label: 'Subscribe' },
  { value: 'USE_APP', label: 'Use App' },
  { value: 'WATCH_MORE', label: 'Watch More' },
  { value: 'WATCH_VIDEO', label: 'Watch Video' },
  { value: 'WHATSAPP_MESSAGE', label: 'WhatsApp Message' },
];

// ─── Recursive Schema Types ───

export type SchemaFieldType =
  | 'string'
  | 'textarea'
  | 'number'
  | 'enum'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'currency'
  | 'object'
  | 'array'
  | 'multiEnum'
  | 'tags'
  | 'time'
  | 'upload';

export interface EnumOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface SchemaField {
  key: string;
  label: string;
  type: SchemaFieldType;
  required: boolean;
  editable: boolean;
  hidden?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;

  // Enum
  options?: EnumOption[];

  // Number/currency
  min?: number;
  max?: number;
  step?: number;
  currencyCode?: string;
  currencyMultiplier?: number; // Meta uses cents (100 = $1)

  // Object — recursive sub-schema
  objectSchema?: SchemaField[];

  // Array — schema for each item
  arrayItemSchema?: SchemaField;
  minItems?: number;
  maxItems?: number;

  // Dependency
  dependsOn?: DependencyRule[];
  invalidates?: string[];

  // Conflict
  incompatibleWith?: string[];

  // Validation
  validation?: ValidationRule[];

  // Conditional visibility
  visibleWhen?: { field: string; notEquals?: any; equals?: any };

  // UX enhancements
  searchable?: boolean;
  maxSelect?: number;
  rows?: number;
  tagSuggestions?: string[];

  // Upload fields
  meta?: { uploadType?: 'image' | 'video' };
}

export interface DependencyRule {
  field: string;
  condition: 'equals' | 'notEquals' | 'in' | 'notIn' | 'exists' | 'notExists';
  value?: any;
  values?: any[];
  effect: 'show' | 'hide' | 'require' | 'disable' | 'updateOptions';
  optionsMap?: Record<string, EnumOption[]>;
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

export interface FormSchema {
  entityType: 'campaign' | 'adSet' | 'ad';
  sections: FormSection[];
  context: FormContext;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  fields: SchemaField[];
}

export interface FormContext {
  objective?: string;
  buyingType?: string;
  isCBO?: boolean;
  destinationType?: string;
  hasMetaId?: boolean;
}

// ─── Schema Generators ───

export class MetaFormSchemaEngine {

  static getCampaignFormSchema(context?: Partial<FormContext>): FormSchema {
    const objective = context?.objective || 'OUTCOME_TRAFFIC';
    const hasMetaId = !!context?.hasMetaId;

    return {
      entityType: 'campaign',
      sections: [
        {
          id: 'identity',
          title: 'Campaign Identity',
          fields: [
            {
              key: 'name',
              label: 'Campaign Name',
              type: 'string',
              required: true,
              editable: true,
              placeholder: 'Enter campaign name',
            },
            {
              key: 'objective',
              label: 'Objective',
              type: 'enum',
              required: true,
              editable: !hasMetaId,
              options: CAMPAIGN_FIELDS.objective.enumValues!.map(v => ({
                value: v,
                label: CAMPAIGN_FIELDS.objective.enumLabels![v] || v,
                description: this.getObjectiveDescription(v),
              })),
              invalidates: ['optimization_goal', 'destination_type', 'promoted_object', 'billing_event'],
            },
            ...((VALID_BUYING_TYPES[objective] || []).length > 1 ? [{
              key: 'buying_type',
              label: 'Buying Type',
              type: 'enum' as const,
              required: false,
              editable: true,
              options: VALID_BUYING_TYPES[objective].map(v => ({
                value: v,
                label: CAMPAIGN_FIELDS.buying_type.enumLabels![v] || v,
              })),
            }] : []),
            {
              key: 'status',
              label: 'Status',
              type: 'enum' as const,
              required: true,
              editable: false,
              defaultValue: 'PAUSED',
              helpText: 'New campaigns are always created as PAUSED',
              options: [
                { value: 'PAUSED', label: 'Paused' },
                { value: 'ACTIVE', label: 'Active' },
              ],
            },
          ],
        },
        {
          id: 'budget',
          title: 'Budget & Bidding',
          fields: [
            {
              key: 'is_adset_budget_sharing_enabled',
              label: 'Campaign Budget Optimization (CBO)',
              type: 'boolean',
              required: false,
              editable: true,
              helpText: 'When enabled, Meta distributes budget across ad sets automatically',
              invalidates: ['daily_budget', 'lifetime_budget'],
            },
            {
              key: 'daily_budget',
              label: 'Daily Budget',
              type: 'currency',
              required: false,
              editable: true,
              min: 100,
              step: 100,
              currencyMultiplier: 100,
              placeholder: 'Amount in smallest currency unit',
              incompatibleWith: ['lifetime_budget'],
              dependsOn: [{
                field: 'is_adset_budget_sharing_enabled',
                condition: 'equals',
                value: true,
                effect: 'show',
              }],
            },
            {
              key: 'lifetime_budget',
              label: 'Lifetime Budget',
              type: 'currency',
              required: false,
              editable: true,
              min: 100,
              step: 100,
              currencyMultiplier: 100,
              placeholder: 'Amount in smallest currency unit',
              incompatibleWith: ['daily_budget'],
              dependsOn: [{
                field: 'is_adset_budget_sharing_enabled',
                condition: 'equals',
                value: true,
                effect: 'show',
              }],
            },
            {
              key: 'bid_strategy',
              label: 'Bid Strategy',
              type: 'enum',
              required: false,
              editable: true,
              options: CAMPAIGN_FIELDS.bid_strategy.enumValues!.map(v => ({
                value: v,
                label: CAMPAIGN_FIELDS.bid_strategy.enumLabels![v] || v,
              })),
            },
            {
              key: 'spend_cap',
              label: 'Campaign Spend Cap',
              type: 'currency',
              required: false,
              editable: true,
              min: 0,
              step: 100,
              currencyMultiplier: 100,
              helpText: 'Maximum total spend for this campaign',
            },
          ],
        },
        {
          id: 'schedule',
          title: 'Schedule',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'start_time',
              label: 'Start Time',
              type: 'datetime',
              required: false,
              editable: true,
              helpText: 'When the campaign starts delivering. Leave empty to start immediately.',
            },
            {
              key: 'stop_time',
              label: 'Stop Time',
              type: 'datetime',
              required: false,
              editable: true,
              helpText: 'When the campaign stops delivering.',
            },
          ],
        },
        {
          id: 'special',
          title: 'Special Categories',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'special_ad_categories',
              label: 'Special Ad Categories',
              type: 'multiEnum',
              required: true,
              editable: true,
              defaultValue: ['NONE'],
              options: CAMPAIGN_FIELDS.special_ad_categories.enumValues!.map(v => ({
                value: v,
                label: this.formatEnumLabel(v),
              })),
              helpText: 'Required by Meta for ads about credit, employment, housing, etc.',
              invalidates: ['special_ad_category_country'],
            },
            {
              key: 'special_ad_category_country',
              label: 'Special Ad Category Countries',
              type: 'tags',
              required: false,
              editable: true,
              defaultValue: [],
              helpText: 'Required when special categories are set and targeting specific countries.',
              placeholder: 'Type country code (e.g. US, TH)...',
              tagSuggestions: [
                'AU', 'BR', 'CA', 'DE', 'ES', 'FR', 'GB', 'ID', 'IN', 'IT',
                'JP', 'KR', 'MX', 'MY', 'NL', 'PH', 'SG', 'TH', 'US', 'VN',
              ],
              visibleWhen: { field: 'special_ad_categories', notEquals: ['NONE'] },
            },
          ],
        },
        {
          id: 'advanced',
          title: 'Advanced',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'budget_rebalance_flag',
              label: 'Auto-Rebalance Budget',
              type: 'boolean',
              required: false,
              editable: true,
              helpText: 'Automatically redistribute budget across ad sets based on performance',
              dependsOn: [{
                field: 'is_adset_budget_sharing_enabled',
                condition: 'equals',
                value: true,
                effect: 'show',
              }],
            },
            {
              key: 'pacing_type',
              label: 'Pacing Type',
              type: 'enum',
              required: false,
              editable: true,
              options: [
                { value: 'standard', label: 'Standard' },
                { value: 'no_pacing', label: 'No Pacing (Accelerated)' },
              ],
              helpText: 'Standard spreads spend evenly; No Pacing spends as fast as possible',
            },
            {
              key: 'adlabels',
              label: 'Ad Labels',
              type: 'array',
              required: false,
              editable: true,
              helpText: 'Organizational labels for filtering and reporting',
              arrayItemSchema: {
                key: 'label',
                label: 'Label',
                type: 'object',
                required: true,
                editable: true,
                objectSchema: [
                  { key: 'name', label: 'Label Name', type: 'string', required: true, editable: true, placeholder: 'e.g. Q2_2025, Brand' },
                ],
              },
            },
          ],
        },
      ],
      context: { objective, buyingType: context?.buyingType, isCBO: context?.isCBO },
    };
  }

  static getAdSetFormSchema(context: FormContext): FormSchema {
    const { objective = 'OUTCOME_TRAFFIC', isCBO = false, hasMetaId = false } = context;

    const validGoals = VALID_OPTIMIZATION_GOALS[objective] || [];
    const validDests = VALID_DESTINATION_TYPES[objective] || [];
    const promotedReqs = PROMOTED_OBJECT_REQUIREMENTS[objective] || [];
    const supportsAttribution = ATTRIBUTION_SPEC_OBJECTIVES.has(objective);

    return {
      entityType: 'adSet',
      sections: [
        {
          id: 'identity',
          title: 'Ad Set Identity',
          fields: [
            {
              key: 'name',
              label: 'Ad Set Name',
              type: 'string',
              required: true,
              editable: true,
              placeholder: 'Enter ad set name',
            },
            {
              key: 'status',
              label: 'Status',
              type: 'enum',
              required: true,
              editable: true,
              defaultValue: 'PAUSED',
              helpText: 'New ad sets are created as PAUSED',
              options: [
                { value: 'PAUSED', label: 'Paused' },
                { value: 'ACTIVE', label: 'Active' },
              ],
            },
          ],
        },
        {
          id: 'delivery',
          title: 'Delivery & Optimization',
          fields: [
            {
              key: 'optimization_goal',
              label: 'Optimization Goal',
              type: 'enum',
              required: true,
              editable: true,
              options: validGoals.map(v => ({
                value: v,
                label: OPTIMIZATION_GOAL_LABELS[v] || v,
              })),
              invalidates: ['billing_event'],
              dependsOn: [{
                field: 'objective',
                condition: 'exists',
                effect: 'updateOptions',
                optionsMap: this.buildOptimizationGoalOptionsMap(),
              }],
            },
            {
              key: 'billing_event',
              label: 'Billing Event',
              type: 'enum',
              required: true,
              editable: true,
              options: ADSET_FIELDS.billing_event.enumValues!.map(v => ({
                value: v,
                label: ADSET_FIELDS.billing_event.enumLabels![v] || v,
              })),
              helpText: 'How you get charged. IMPRESSIONS is most common.',
            },
            {
              key: 'destination_type',
              label: 'Conversion Location',
              type: 'enum',
              // AWARENESS only supports UNDEFINED (omitted at publish time) — not required
              required: objective !== 'OUTCOME_AWARENESS',
              editable: true,
              options: validDests.map(v => ({
                value: v,
                label: DESTINATION_TYPE_LABELS[v] || v,
              })),
              dependsOn: [{
                field: 'objective',
                condition: 'exists',
                effect: 'updateOptions',
                optionsMap: this.buildDestinationTypeOptionsMap(),
              }],
            },
            {
              key: 'is_dynamic_creative',
              label: 'Dynamic Creative',
              type: 'boolean',
              required: false,
              editable: !hasMetaId,
              helpText: 'Enable Dynamic Creative Optimization to auto-test creative combinations. Cannot be changed after creation.',
            },
          ],
        },
        {
          id: 'budget',
          title: 'Budget & Bidding',
          description: isCBO ? 'Budget is managed at campaign level (CBO enabled)' : undefined,
          fields: isCBO ? [] : [
            {
              key: 'daily_budget',
              label: 'Daily Budget',
              type: 'currency',
              required: false,
              editable: true,
              min: 100,
              step: 100,
              currencyMultiplier: 100,
              incompatibleWith: ['lifetime_budget'],
            },
            {
              key: 'lifetime_budget',
              label: 'Lifetime Budget',
              type: 'currency',
              required: false,
              editable: true,
              min: 100,
              step: 100,
              currencyMultiplier: 100,
              incompatibleWith: ['daily_budget'],
            },
            {
              key: 'bid_strategy',
              label: 'Bid Strategy',
              type: 'enum',
              required: false,
              editable: true,
              options: ADSET_FIELDS.bid_strategy.enumValues!.map(v => ({
                value: v,
                label: ADSET_FIELDS.bid_strategy.enumLabels![v] || v,
              })),
              invalidates: ['bid_amount'],
            },
            {
              key: 'bid_amount',
              label: 'Bid Amount',
              type: 'currency',
              required: false,
              editable: true,
              min: 1,
              step: 1,
              currencyMultiplier: 100,
              helpText: 'Required for Bid Cap and Cost Cap strategies',
              dependsOn: [{
                field: 'bid_strategy',
                condition: 'in',
                values: [...BID_CAP_STRATEGIES],
                effect: 'require',
              }],
            },
            {
              key: 'daily_spend_cap',
              label: 'Daily Spend Cap',
              type: 'currency',
              required: false,
              editable: true,
              min: 0,
              step: 100,
              currencyMultiplier: 100,
              helpText: 'Hard daily spend limit for this ad set',
            },
            {
              key: 'lifetime_spend_cap',
              label: 'Lifetime Spend Cap',
              type: 'currency',
              required: false,
              editable: true,
              min: 0,
              step: 100,
              currencyMultiplier: 100,
              helpText: 'Hard total spend limit for this ad set',
            },
          ],
        },
        {
          id: 'targeting',
          title: 'Targeting',
          fields: [
            {
              key: 'targeting',
              label: 'Targeting',
              type: 'object',
              required: true,
              editable: true,
              objectSchema: this.getTargetingSchema(),
            },
          ],
        },
        {
          id: 'promoted_object',
          title: 'Promoted Object',
          description: promotedReqs.length > 0
            ? `Required: ${promotedReqs.join(', ')}`
            : 'Optional for this objective',
          fields: [
            {
              key: 'promoted_object',
              label: 'Promoted Object',
              type: 'object',
              required: promotedReqs.length > 0,
              editable: true,
              objectSchema: this.getPromotedObjectSchema(objective),
            },
          ],
        },
        {
          id: 'schedule',
          title: 'Schedule',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'start_time',
              label: 'Start Time',
              type: 'datetime',
              required: false,
              editable: true,
              helpText: 'ISO 8601 format. Leave empty to start immediately.',
            },
            {
              key: 'end_time',
              label: 'End Time',
              type: 'datetime',
              required: false,
              editable: true,
              helpText: 'Required when using lifetime_budget.',
              dependsOn: [{
                field: 'lifetime_budget',
                condition: 'exists',
                effect: 'require',
              }],
            },
          ],
        },
        ...(supportsAttribution ? [{
          id: 'attribution',
          title: 'Attribution',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'attribution_spec',
              label: 'Attribution Window',
              type: 'object' as SchemaFieldType,
              required: false,
              editable: true,
              objectSchema: this.getAttributionSpecSchema(),
            },
          ],
        }] : []),
        {
          id: 'frequency_pacing',
          title: 'Frequency & Pacing',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'frequency_control_specs',
              label: 'Frequency Cap',
              type: 'array',
              required: false,
              editable: true,
              helpText: 'Limit how often people see your ads',
              arrayItemSchema: {
                key: 'freq_rule',
                label: 'Frequency Rule',
                type: 'object',
                required: true,
                editable: true,
                objectSchema: [
                  {
                    key: 'event',
                    label: 'Event',
                    type: 'enum',
                    required: true,
                    editable: true,
                    options: [
                      { value: 'IMPRESSIONS', label: 'Impressions' },
                    ],
                  },
                  {
                    key: 'interval_days',
                    label: 'Interval (Days)',
                    type: 'number',
                    required: true,
                    editable: true,
                    min: 1,
                    max: 90,
                  },
                  {
                    key: 'max_frequency',
                    label: 'Max Frequency',
                    type: 'number',
                    required: true,
                    editable: true,
                    min: 1,
                    max: 100,
                  },
                ],
              },
            },
            {
              key: 'pacing_type',
              label: 'Pacing Type',
              type: 'enum',
              required: false,
              editable: true,
              options: [
                { value: 'standard', label: 'Standard' },
                { value: 'day_parting', label: 'Day Parting' },
              ],
              helpText: 'Standard spreads spend evenly. Day Parting uses a schedule.',
              invalidates: ['adset_schedule'],
            },
            {
              key: 'adset_schedule',
              label: 'Dayparting Schedule',
              type: 'array',
              required: false,
              editable: true,
              helpText: 'Define time windows for delivery. Requires lifetime budget.',
              dependsOn: [{
                field: 'pacing_type',
                condition: 'equals',
                value: 'day_parting',
                effect: 'show',
              }],
              arrayItemSchema: {
                key: 'schedule_entry',
                label: 'Schedule Entry',
                type: 'object',
                required: true,
                editable: true,
                objectSchema: [
                  {
                    key: 'start_minute',
                    label: 'Start Time',
                    type: 'time',
                    required: true,
                    editable: true,
                    min: 0,
                    max: 1439,
                  },
                  {
                    key: 'end_minute',
                    label: 'End Time',
                    type: 'time',
                    required: true,
                    editable: true,
                    min: 0,
                    max: 1439,
                  },
                  {
                    key: 'days',
                    label: 'Days',
                    type: 'multiEnum',
                    required: true,
                    editable: true,
                    options: [
                      { value: '0', label: 'Sun' },
                      { value: '1', label: 'Mon' },
                      { value: '2', label: 'Tue' },
                      { value: '3', label: 'Wed' },
                      { value: '4', label: 'Thu' },
                      { value: '5', label: 'Fri' },
                      { value: '6', label: 'Sat' },
                    ],
                  },
                  {
                    key: 'timezone_type',
                    label: 'Timezone',
                    type: 'enum',
                    required: false,
                    editable: true,
                    options: [
                      { value: 'USER', label: "User's Timezone" },
                      { value: 'ADVERTISER', label: "Ad Account's Timezone" },
                    ],
                  },
                ],
              },
            },
          ],
        },
        {
          id: 'dsa',
          title: 'EU DSA Compliance',
          description: 'Required when targeting EU/EEA countries (AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE, IS, LI, NO)',
          collapsible: true,
          defaultCollapsed: false,
          fields: [
            {
              key: 'dsa_beneficiary',
              label: 'DSA Beneficiary',
              type: 'string',
              required: false,
              editable: true,
              placeholder: 'e.g. Your Company Name',
              helpText: 'The person or organization being promoted by the ad. Required by Meta for EU-targeted ads.',
            },
            {
              key: 'dsa_payor',
              label: 'DSA Payor',
              type: 'string',
              required: false,
              editable: true,
              placeholder: 'e.g. Your Company Name',
              helpText: 'The entity paying for the ad. Often the same as the beneficiary.',
            },
          ],
        },
      ],
      context: { objective, isCBO, buyingType: context.buyingType, destinationType: context.destinationType },
    };
  }

  static getAdFormSchema(context?: Partial<FormContext>): FormSchema {
    const hasMetaId = !!context?.hasMetaId;
    return {
      entityType: 'ad',
      sections: [
        {
          id: 'identity',
          title: 'Ad Identity',
          fields: [
            {
              key: 'name',
              label: 'Ad Name',
              type: 'string',
              required: true,
              editable: true,
              placeholder: 'Enter ad name',
            },
            {
              key: 'status',
              label: 'Status',
              type: 'enum',
              required: true,
              editable: true,
              defaultValue: 'PAUSED',
              options: [
                { value: 'PAUSED', label: 'Paused' },
                { value: 'ACTIVE', label: 'Active' },
              ],
            },
          ],
        },
        {
          id: 'creative',
          title: 'Ad Creative',
          fields: [
            {
              key: 'creative',
              label: 'Ad Creative',
              type: 'object',
              required: true,
              editable: true,
              helpText: 'Creative ID takes priority on publish. Fill inline fields for new creatives.',
              objectSchema: [
                {
                  key: 'creative_id',
                  label: 'Creative ID',
                  type: 'string',
                  required: false,
                  editable: true,
                  helpText: 'Reference to existing Meta creative (used on publish if present)',
                },
                {
                  key: 'creative_type',
                  label: 'Creative Type',
                  type: 'enum',
                  required: false,
                  editable: true,
                  defaultValue: 'link',
                  helpText: 'Select the type of creative content',
                  options: [
                    { value: 'link', label: 'Link Ad' },
                    { value: 'video', label: 'Video Ad' },
                    { value: 'photo', label: 'Photo Ad' },
                    { value: 'carousel', label: 'Carousel Ad' },
                  ],
                },
                {
                  key: 'object_story_spec.page_id',
                  label: 'Page ID',
                  type: 'string',
                  required: true,
                  editable: true,
                  placeholder: 'Facebook Page ID',
                  helpText: 'Required. The Facebook Page that publishes the ad.',
                },
                // ── Link Ad fields ──
                {
                  key: 'object_story_spec.link_data.message',
                  label: 'Ad Body Text',
                  type: 'textarea',
                  required: false,
                  editable: true,
                  placeholder: 'Write your ad body text here...',
                  rows: 3,
                  helpText: 'The main text of your ad. Keep it concise and compelling.',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'link', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.link_data.name',
                  label: 'Headline',
                  type: 'string',
                  required: false,
                  editable: true,
                  placeholder: 'Enter headline',
                  helpText: 'Max 40 characters recommended for best display',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'link', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.link_data.description',
                  label: 'Description',
                  type: 'textarea',
                  required: false,
                  editable: true,
                  placeholder: 'Enter link description',
                  rows: 2,
                  helpText: 'Appears below the headline in some placements',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'link', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.link_data.link',
                  label: 'Destination URL',
                  type: 'string',
                  required: false,
                  editable: true,
                  placeholder: 'https://example.com',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'link', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.link_data.image_hash',
                  label: 'Image Hash',
                  type: 'upload',
                  meta: { uploadType: 'image' },
                  required: false,
                  editable: true,
                  placeholder: 'Uploaded image hash (from Meta)',
                  helpText: 'Hash of an image uploaded to your ad account via the /adimages endpoint',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'link', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.link_data.call_to_action.type',
                  label: 'Call to Action',
                  type: 'enum',
                  required: false,
                  editable: true,
                  searchable: true,
                  options: CTA_OPTIONS,
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'link', effect: 'show' }],
                },
                // ── Video Ad fields ──
                {
                  key: 'object_story_spec.video_data.video_id',
                  label: 'Video ID',
                  type: 'upload',
                  meta: { uploadType: 'video' },
                  required: true,
                  editable: true,
                  placeholder: 'Enter video ID from Meta',
                  helpText: 'Upload videos via Meta Business Suite or /advideos endpoint, then paste the ID here',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'video', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.video_data.message',
                  label: 'Post Text',
                  type: 'textarea',
                  required: false,
                  editable: true,
                  placeholder: 'Write your post text...',
                  rows: 3,
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'video', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.video_data.title',
                  label: 'Video Title',
                  type: 'string',
                  required: false,
                  editable: true,
                  placeholder: 'Enter video title',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'video', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.video_data.image_hash',
                  label: 'Thumbnail Hash',
                  type: 'upload',
                  meta: { uploadType: 'image' },
                  required: false,
                  editable: true,
                  placeholder: 'Thumbnail image hash (optional)',
                  helpText: 'Custom thumbnail. If omitted, Meta auto-generates one.',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'video', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.video_data.call_to_action.type',
                  label: 'Call to Action',
                  type: 'enum',
                  required: false,
                  editable: true,
                  searchable: true,
                  options: CTA_OPTIONS,
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'video', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.video_data.call_to_action.value.link',
                  label: 'CTA Link',
                  type: 'string',
                  required: false,
                  editable: true,
                  placeholder: 'https://example.com',
                  helpText: 'Destination URL for the call to action button',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'video', effect: 'show' }],
                },
                // ── Photo Ad fields ──
                {
                  key: 'object_story_spec.photo_data.image_hash',
                  label: 'Image Hash',
                  type: 'upload',
                  meta: { uploadType: 'image' },
                  required: true,
                  editable: true,
                  placeholder: 'Image hash from Meta ad account',
                  helpText: 'Upload via Meta Business Suite or /adimages endpoint, then paste the hash',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'photo', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.photo_data.message',
                  label: 'Post Text',
                  type: 'textarea',
                  required: false,
                  editable: true,
                  placeholder: 'Write your post text...',
                  rows: 3,
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'photo', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.photo_data.caption',
                  label: 'Caption',
                  type: 'textarea',
                  required: false,
                  editable: true,
                  placeholder: 'Photo caption',
                  rows: 2,
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'photo', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.photo_data.link',
                  label: 'Destination URL',
                  type: 'string',
                  required: false,
                  editable: true,
                  placeholder: 'https://example.com',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'photo', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.photo_data.call_to_action.type',
                  label: 'Call to Action',
                  type: 'enum',
                  required: false,
                  editable: true,
                  searchable: true,
                  options: CTA_OPTIONS,
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'photo', effect: 'show' }],
                },
                // ── Carousel Ad fields ──
                {
                  key: 'object_story_spec.link_data.carousel_message',
                  label: 'Carousel Message',
                  type: 'textarea',
                  required: false,
                  editable: true,
                  placeholder: 'Post text for the carousel...',
                  rows: 3,
                  helpText: 'Stored as link_data.message on publish',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'carousel', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.link_data.carousel_link',
                  label: 'Default URL',
                  type: 'string',
                  required: false,
                  editable: true,
                  placeholder: 'https://example.com',
                  helpText: 'Default destination URL for the carousel',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'carousel', effect: 'show' }],
                },
                {
                  key: 'object_story_spec.link_data.child_attachments',
                  label: 'Carousel Cards',
                  type: 'array',
                  required: true,
                  editable: true,
                  minItems: 2,
                  maxItems: 10,
                  helpText: 'Min 2, max 10 cards. Each card needs a destination URL.',
                  dependsOn: [{ field: 'creative_type', condition: 'equals', value: 'carousel', effect: 'show' }],
                  arrayItemSchema: {
                    key: 'card',
                    label: 'Card',
                    type: 'object',
                    required: true,
                    editable: true,
                    objectSchema: [
                      { key: 'link', label: 'Card URL', type: 'string', required: true, editable: true, placeholder: 'https://example.com/page' },
                      { key: 'name', label: 'Headline', type: 'string', required: false, editable: true, placeholder: 'Card headline' },
                      { key: 'description', label: 'Description', type: 'string', required: false, editable: true, placeholder: 'Card description' },
                      { key: 'image_hash', label: 'Image Hash', type: 'upload', meta: { uploadType: 'image' }, required: false, editable: true, placeholder: 'Image hash for this card' },
                      { key: 'video_id', label: 'Video ID', type: 'upload', meta: { uploadType: 'video' }, required: false, editable: true, placeholder: 'Video ID (alternative to image)' },
                    ],
                  },
                },
                // ── Common ──
                {
                  key: 'url_tags',
                  label: 'URL Tags',
                  type: 'string',
                  required: false,
                  editable: true,
                  placeholder: 'utm_source=facebook&utm_medium=paid',
                  helpText: 'UTM parameters appended to the creative destination URL',
                },
              ],
            },
          ],
        },
        {
          id: 'advanced_creative',
          title: 'Advanced Creative',
          description: 'Platform customizations and dynamic creative',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'creative.instagram_user_id',
              label: 'Instagram User ID',
              type: 'string',
              required: false,
              editable: true,
              placeholder: 'Instagram Business Account ID',
              helpText: 'Found in Business Settings > Instagram Accounts. Used for Instagram-placed ads.',
            },
            {
              key: 'creative.instagram_actor_id',
              label: 'Instagram Actor ID (Deprecated)',
              type: 'string',
              required: false,
              editable: true,
              placeholder: 'Deprecated — use Instagram User ID above',
              helpText: 'Deprecated since September 2025. Existing value is preserved for reference only; the API now uses Instagram User ID.',
            },
            {
              key: 'creative.platform_customizations',
              label: 'Platform Customizations',
              type: 'object',
              required: false,
              editable: true,
              helpText: 'Override creative elements per platform',
              objectSchema: [
                {
                  key: 'facebook',
                  label: 'Facebook Overrides',
                  type: 'object',
                  required: false,
                  editable: true,
                  objectSchema: [
                    { key: 'title', label: 'Title', type: 'string', required: false, editable: true, placeholder: 'Facebook-specific title' },
                    { key: 'body', label: 'Body', type: 'string', required: false, editable: true, placeholder: 'Facebook-specific body' },
                    { key: 'description', label: 'Description', type: 'string', required: false, editable: true, placeholder: 'Facebook-specific description' },
                  ],
                },
                {
                  key: 'instagram',
                  label: 'Instagram Overrides',
                  type: 'object',
                  required: false,
                  editable: true,
                  objectSchema: [
                    { key: 'title', label: 'Title', type: 'string', required: false, editable: true, placeholder: 'Instagram-specific title' },
                    { key: 'body', label: 'Body', type: 'string', required: false, editable: true, placeholder: 'Instagram-specific body' },
                  ],
                },
              ],
            },
            {
              key: 'creative.asset_feed_spec',
              label: 'Dynamic Creative (Asset Feed)',
              type: 'object',
              required: false,
              editable: true,
              helpText: 'Provide multiple assets for Meta to test combinations. Requires Dynamic Creative on the ad set.',
              objectSchema: [
                {
                  key: 'images',
                  label: 'Images',
                  type: 'array',
                  required: false,
                  editable: true,
                  arrayItemSchema: {
                    key: 'image', label: 'Image', type: 'object', required: true, editable: true,
                    objectSchema: [
                      { key: 'hash', label: 'Image Hash', type: 'upload', meta: { uploadType: 'image' }, required: true, editable: true, placeholder: 'Image hash' },
                    ],
                  },
                },
                {
                  key: 'videos',
                  label: 'Videos',
                  type: 'array',
                  required: false,
                  editable: true,
                  arrayItemSchema: {
                    key: 'video', label: 'Video', type: 'object', required: true, editable: true,
                    objectSchema: [
                      { key: 'video_id', label: 'Video ID', type: 'upload', meta: { uploadType: 'video' }, required: true, editable: true, placeholder: 'Video ID' },
                      { key: 'thumbnail_hash', label: 'Thumbnail Hash', type: 'upload', meta: { uploadType: 'image' }, required: false, editable: true, placeholder: 'Thumbnail hash' },
                    ],
                  },
                },
                {
                  key: 'bodies',
                  label: 'Body Text Variations',
                  type: 'array',
                  required: false,
                  editable: true,
                  arrayItemSchema: {
                    key: 'body', label: 'Body', type: 'object', required: true, editable: true,
                    objectSchema: [
                      { key: 'text', label: 'Text', type: 'string', required: true, editable: true, placeholder: 'Body text variation' },
                    ],
                  },
                },
                {
                  key: 'titles',
                  label: 'Title Variations',
                  type: 'array',
                  required: false,
                  editable: true,
                  arrayItemSchema: {
                    key: 'title', label: 'Title', type: 'object', required: true, editable: true,
                    objectSchema: [
                      { key: 'text', label: 'Text', type: 'string', required: true, editable: true, placeholder: 'Title variation' },
                    ],
                  },
                },
                {
                  key: 'descriptions',
                  label: 'Description Variations',
                  type: 'array',
                  required: false,
                  editable: true,
                  arrayItemSchema: {
                    key: 'desc', label: 'Description', type: 'object', required: true, editable: true,
                    objectSchema: [
                      { key: 'text', label: 'Text', type: 'string', required: true, editable: true, placeholder: 'Description variation' },
                    ],
                  },
                },
                {
                  key: 'link_urls',
                  label: 'Link URL Variations',
                  type: 'array',
                  required: false,
                  editable: true,
                  arrayItemSchema: {
                    key: 'link_url', label: 'URL', type: 'object', required: true, editable: true,
                    objectSchema: [
                      { key: 'website_url', label: 'Website URL', type: 'string', required: true, editable: true, placeholder: 'https://example.com' },
                    ],
                  },
                },
                {
                  key: 'call_to_action_types',
                  label: 'CTA Types',
                  type: 'multiEnum',
                  required: false,
                  editable: true,
                  maxSelect: 5,
                  options: [
                    { value: 'BOOK_TRAVEL', label: 'Book Now' },
                    { value: 'CONTACT_US', label: 'Contact Us' },
                    { value: 'DOWNLOAD', label: 'Download' },
                    { value: 'GET_OFFER', label: 'Get Offer' },
                    { value: 'LEARN_MORE', label: 'Learn More' },
                    { value: 'SHOP_NOW', label: 'Shop Now' },
                    { value: 'SIGN_UP', label: 'Sign Up' },
                    { value: 'SUBSCRIBE', label: 'Subscribe' },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'tracking',
          title: 'Tracking',
          collapsible: true,
          defaultCollapsed: false,
          fields: [
            {
              key: 'tracking_specs',
              label: 'Pixel ID',
              type: 'string',
              required: false,
              editable: true,
              placeholder: 'Your Meta Pixel ID',
              helpText: 'Meta Pixel for tracking website conversion events',
            },
          ],
        },
        {
          id: 'conversion',
          title: 'Conversion Tracking',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'conversion_domain',
              label: 'Conversion Domain',
              type: 'string',
              required: false,
              editable: true,
              placeholder: 'example.com',
              helpText: 'Domain where conversions happen. Required for iOS 14+ optimization.',
            },
            {
              key: 'conversion_specs',
              label: 'Conversion Specs',
              type: 'object',
              required: false,
              editable: true,
              helpText: 'Advanced conversion tracking configuration (JSON)',
            },
          ],
        },
        {
          id: 'url_params',
          title: 'URL Parameters',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'url_parameters',
              label: 'URL Parameters (UTM)',
              type: 'textarea',
              required: false,
              editable: true,
              rows: 2,
              placeholder: 'utm_source=facebook&utm_medium=paid&utm_campaign=brand',
              helpText: 'Appended to destination URLs. Use & to separate params. Common: utm_source, utm_medium, utm_campaign, utm_content',
            },
          ],
        },
        {
          id: 'advanced',
          title: 'Advanced',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'engagement_audience',
              label: 'Build Engagement Audience',
              type: 'boolean',
              required: false,
              editable: true,
              helpText: 'Automatically create an audience from people who engage with this ad',
            },
          ],
        },
      ],
      context: context ? { objective: context.objective, hasMetaId } : { hasMetaId },
    };
  }

  // ─── Sub-schemas ───

  private static getTargetingSchema(): SchemaField[] {
    return [
      {
        key: 'geo_locations',
        label: 'Locations',
        type: 'object',
        required: true,
        editable: true,
        objectSchema: [
          {
            key: 'countries',
            label: 'Countries',
            type: 'tags',
            required: false,
            editable: true,
            helpText: 'Type a country code or select from suggestions. Thailand requires age_min >= 20.',
            placeholder: 'Type country code (e.g. TH, US)...',
            tagSuggestions: [
              'AE', 'AR', 'AT', 'AU', 'BE', 'BR', 'CA', 'CH', 'DE', 'DK',
              'EG', 'ES', 'FI', 'FR', 'GB', 'HK', 'ID', 'IE', 'IN', 'IT',
              'JP', 'KE', 'KR', 'MX', 'MY', 'NG', 'NL', 'NO', 'NZ', 'PH',
              'PL', 'PT', 'SA', 'SE', 'SG', 'TH', 'TW', 'US', 'VN', 'ZA',
            ],
          },
          {
            key: 'regions',
            label: 'Regions',
            type: 'array',
            required: false,
            editable: true,
            helpText: 'Target specific states/provinces. Find region keys in Meta Targeting Search API.',
            arrayItemSchema: {
              key: 'region',
              label: 'Region',
              type: 'object',
              required: true,
              editable: true,
              objectSchema: [
                { key: 'key', label: 'Region Key', type: 'string', required: true, editable: true, placeholder: 'e.g. 3847 (California)' },
                { key: 'name', label: 'Region Name', type: 'string', required: false, editable: false },
              ],
            },
          },
          {
            key: 'cities',
            label: 'Cities',
            type: 'array',
            required: false,
            editable: true,
            helpText: 'Target specific cities. Find city keys in Meta Targeting Search API.',
            arrayItemSchema: {
              key: 'city',
              label: 'City',
              type: 'object',
              required: true,
              editable: true,
              objectSchema: [
                { key: 'key', label: 'City Key', type: 'string', required: true, editable: true, placeholder: 'e.g. 2418779 (Bangkok)' },
                { key: 'name', label: 'City Name', type: 'string', required: false, editable: false },
                { key: 'radius', label: 'Radius', type: 'number', required: false, editable: true, min: 0, max: 80, defaultValue: 25, helpText: 'Default: 25' },
                { key: 'distance_unit', label: 'Unit', type: 'enum', required: false, editable: true, defaultValue: 'kilometer', options: [{ value: 'kilometer', label: 'Kilometers (km)' }, { value: 'mile', label: 'Miles (mi)' }] },
              ],
            },
          },
          {
            key: 'zips',
            label: 'Zip/Postal Codes',
            type: 'array',
            required: false,
            editable: true,
            helpText: 'Format: COUNTRY:ZIPCODE (e.g. US:10001)',
            arrayItemSchema: {
              key: 'zip',
              label: 'Zip Code',
              type: 'object',
              required: true,
              editable: true,
              objectSchema: [
                { key: 'key', label: 'Zip Key', type: 'string', required: true, editable: true, placeholder: 'e.g. US:10001' },
              ],
            },
          },
          // location_types removed — Meta deprecated this field (error subcode 1870199).
          // All location targeting now reaches "people living in or recently in" by default.
        ],
      },
      {
        key: 'age_min',
        label: 'Minimum Age',
        type: 'enum',
        required: false,
        editable: true,
        defaultValue: 18,
        helpText: 'Thailand requires 20+. Default: 18',
        options: Array.from({ length: 53 }, (_, i) => {
          const age = i + 13;
          return { value: String(age), label: `${age} years` };
        }),
      },
      {
        key: 'age_max',
        label: 'Maximum Age',
        type: 'enum',
        required: false,
        editable: true,
        defaultValue: 65,
        helpText: '65 = 65+. Default: 65',
        options: Array.from({ length: 53 }, (_, i) => {
          const age = i + 13;
          return { value: String(age), label: age === 65 ? '65+' : `${age} years` };
        }),
      },
      {
        key: 'genders',
        label: 'Gender',
        type: 'multiEnum',
        required: false,
        editable: true,
        options: [
          { value: '0', label: 'All' },
          { value: '1', label: 'Male' },
          { value: '2', label: 'Female' },
        ],
      },
      {
        key: 'locales',
        label: 'Languages',
        type: 'multiEnum',
        required: false,
        editable: true,
        helpText: 'Leave empty to target all languages',
        searchable: true,
        options: [
          { value: '__all__', label: 'All Languages' },
          { value: '13', label: 'Afrikaans' },
          { value: '81', label: 'Albanian' },
          { value: '82', label: 'Amharic' },
          { value: '20', label: 'Arabic' },
          { value: '83', label: 'Armenian' },
          { value: '97', label: 'Assamese' },
          { value: '78', label: 'Azerbaijani' },
          { value: '84', label: 'Basque' },
          { value: '38', label: 'Bengali' },
          { value: '14', label: 'Bosnian' },
          { value: '37', label: 'Bulgarian' },
          { value: '61', label: 'Burmese' },
          { value: '2', label: 'Catalan' },
          { value: '39', label: 'Cebuano' },
          { value: '3', label: 'Chinese (Simplified)' },
          { value: '44', label: 'Chinese (Traditional)' },
          { value: '40', label: 'Croatian' },
          { value: '16', label: 'Czech' },
          { value: '17', label: 'Danish' },
          { value: '27', label: 'Dutch' },
          { value: '24', label: 'English (UK)' },
          { value: '6', label: 'English (US)' },
          { value: '41', label: 'Estonian' },
          { value: '43', label: 'Filipino' },
          { value: '22', label: 'Finnish' },
          { value: '7', label: 'French' },
          { value: '93', label: 'Frisian' },
          { value: '85', label: 'Galician' },
          { value: '79', label: 'Georgian' },
          { value: '4', label: 'German' },
          { value: '19', label: 'Greek' },
          { value: '45', label: 'Guarani' },
          { value: '46', label: 'Gujarati' },
          { value: '47', label: 'Hausa' },
          { value: '11', label: 'Hebrew' },
          { value: '15', label: 'Hindi' },
          { value: '23', label: 'Hungarian' },
          { value: '48', label: 'Icelandic' },
          { value: '49', label: 'Igbo' },
          { value: '25', label: 'Indonesian' },
          { value: '26', label: 'Irish' },
          { value: '5', label: 'Italian' },
          { value: '9', label: 'Japanese' },
          { value: '50', label: 'Javanese' },
          { value: '52', label: 'Kannada' },
          { value: '86', label: 'Kazakh' },
          { value: '53', label: 'Khmer' },
          { value: '98', label: 'Kinyarwanda' },
          { value: '10', label: 'Korean' },
          { value: '92', label: 'Kurdish (Kurmanji)' },
          { value: '87', label: 'Kyrgyz' },
          { value: '54', label: 'Lao' },
          { value: '55', label: 'Latin' },
          { value: '56', label: 'Latvian' },
          { value: '57', label: 'Lithuanian' },
          { value: '99', label: 'Luxembourgish' },
          { value: '58', label: 'Macedonian' },
          { value: '91', label: 'Malagasy' },
          { value: '33', label: 'Malay' },
          { value: '76', label: 'Malayalam' },
          { value: '94', label: 'Maltese' },
          { value: '59', label: 'Marathi' },
          { value: '60', label: 'Mongolian' },
          { value: '62', label: 'Nepali' },
          { value: '28', label: 'Norwegian (Bokmal)' },
          { value: '63', label: 'Norwegian (Nynorsk)' },
          { value: '95', label: 'Oriya' },
          { value: '64', label: 'Pashto' },
          { value: '65', label: 'Persian' },
          { value: '29', label: 'Polish' },
          { value: '8', label: 'Portuguese (Brazil)' },
          { value: '31', label: 'Portuguese (Portugal)' },
          { value: '66', label: 'Punjabi' },
          { value: '32', label: 'Romanian' },
          { value: '21', label: 'Russian' },
          { value: '96', label: 'Sanskrit' },
          { value: '100', label: 'Scots Gaelic' },
          { value: '67', label: 'Serbian' },
          { value: '88', label: 'Sinhala' },
          { value: '34', label: 'Slovak' },
          { value: '30', label: 'Slovenian' },
          { value: '68', label: 'Somali' },
          { value: '1', label: 'Spanish' },
          { value: '69', label: 'Sundanese' },
          { value: '42', label: 'Swahili' },
          { value: '35', label: 'Swedish' },
          { value: '80', label: 'Tagalog' },
          { value: '89', label: 'Tajik' },
          { value: '70', label: 'Tamil' },
          { value: '71', label: 'Telugu' },
          { value: '51', label: 'Thai' },
          { value: '12', label: 'Turkish' },
          { value: '90', label: 'Turkmen' },
          { value: '77', label: 'Ukrainian' },
          { value: '72', label: 'Urdu' },
          { value: '73', label: 'Uzbek' },
          { value: '36', label: 'Vietnamese' },
          { value: '18', label: 'Welsh' },
          { value: '74', label: 'Yoruba' },
          { value: '75', label: 'Zulu' },
        ],
      },
      {
        key: 'device_platforms',
        label: 'Devices',
        type: 'multiEnum',
        required: false,
        editable: true,
        helpText: 'Leave empty for all devices',
        options: [
          { value: 'mobile', label: 'Mobile' },
          { value: 'desktop', label: 'Desktop' },
        ],
      },
      {
        key: 'publisher_platforms',
        label: 'Platforms',
        type: 'multiEnum',
        required: false,
        editable: true,
        helpText: 'Leave empty for automatic placements (recommended)',
        options: [
          { value: 'facebook', label: 'Facebook' },
          { value: 'instagram', label: 'Instagram' },
          { value: 'audience_network', label: 'Audience Network' },
          { value: 'messenger', label: 'Messenger' },
        ],
      },
      {
        key: 'facebook_positions',
        label: 'Facebook Placements',
        type: 'multiEnum',
        required: false,
        editable: true,
        helpText: 'Leave empty for all Facebook placements',
        options: [
          { value: 'feed', label: 'Feed' },
          { value: 'right_hand_column', label: 'Right Column' },
          { value: 'instant_article', label: 'Instant Articles' },
          { value: 'marketplace', label: 'Marketplace' },
          { value: 'story', label: 'Stories' },
          { value: 'search', label: 'Search Results', description: 'Requires Feed to also be selected' },
        ],
        dependsOn: [{
          field: 'publisher_platforms',
          condition: 'in',
          values: ['facebook'],
          effect: 'show',
        }],
      },
      {
        key: 'instagram_positions',
        label: 'Instagram Placements',
        type: 'multiEnum',
        required: false,
        editable: true,
        helpText: 'Leave empty for all Instagram placements',
        options: [
          { value: 'stream', label: 'Feed' },
          { value: 'story', label: 'Stories' },
          { value: 'explore', label: 'Explore' },
          { value: 'reels', label: 'Reels' },
        ],
        dependsOn: [{
          field: 'publisher_platforms',
          condition: 'in',
          values: ['instagram'],
          effect: 'show',
        }],
      },
      {
        key: 'flexible_spec',
        label: 'Detailed Targeting (Include)',
        type: 'array',
        required: false,
        editable: true,
        helpText: 'Interest, behavior, and demographic targeting. Find IDs via Meta Targeting Search API or Ads Manager.',
        arrayItemSchema: {
          key: 'targeting_group',
          label: 'Targeting Group',
          type: 'object',
          required: false,
          editable: true,
          objectSchema: [
            {
              key: 'interests',
              label: 'Interests',
              type: 'array',
              required: false,
              editable: true,
              helpText: 'Add interests by ID. Find IDs: graph.facebook.com/search?type=adinterest&q=YOUR_KEYWORD',
              arrayItemSchema: {
                key: 'interest',
                label: 'Interest',
                type: 'object',
                required: true,
                editable: true,
                objectSchema: [
                  { key: 'id', label: 'Interest ID', type: 'string', required: true, editable: true, placeholder: 'e.g. 6003139266461' },
                  { key: 'name', label: 'Display Name', type: 'string', required: false, editable: true, placeholder: 'e.g. Online shopping' },
                ],
              },
            },
            {
              key: 'behaviors',
              label: 'Behaviors',
              type: 'array',
              required: false,
              editable: true,
              helpText: 'Add behaviors by ID. Find IDs: graph.facebook.com/search?type=adTargetingCategory&class=behaviors',
              arrayItemSchema: {
                key: 'behavior',
                label: 'Behavior',
                type: 'object',
                required: true,
                editable: true,
                objectSchema: [
                  { key: 'id', label: 'Behavior ID', type: 'string', required: true, editable: true, placeholder: 'e.g. 6002714895372' },
                  { key: 'name', label: 'Display Name', type: 'string', required: false, editable: true, placeholder: 'e.g. Frequent travelers' },
                ],
              },
            },
            {
              key: 'demographics',
              label: 'Demographics',
              type: 'array',
              required: false,
              editable: true,
              helpText: 'Add demographics by ID. Find IDs: graph.facebook.com/search?type=adTargetingCategory&class=demographics',
              arrayItemSchema: {
                key: 'demographic',
                label: 'Demographic',
                type: 'object',
                required: true,
                editable: true,
                objectSchema: [
                  { key: 'id', label: 'Demographic ID', type: 'string', required: true, editable: true, placeholder: 'e.g. 6012684376237' },
                  { key: 'name', label: 'Display Name', type: 'string', required: false, editable: true, placeholder: 'e.g. Parents' },
                ],
              },
            },
          ],
        },
      },
      {
        key: 'exclusions',
        label: 'Detailed Targeting (Exclude)',
        type: 'object',
        required: false,
        editable: true,
        helpText: 'Exclude people matching these criteria',
        objectSchema: [
          {
            key: 'interests',
            label: 'Excluded Interests',
            type: 'array',
            required: false,
            editable: true,
            arrayItemSchema: {
              key: 'interest',
              label: 'Interest',
              type: 'object',
              required: true,
              editable: true,
              objectSchema: [
                { key: 'id', label: 'Interest ID', type: 'string', required: true, editable: true, placeholder: 'e.g. 6003139266461' },
                { key: 'name', label: 'Display Name', type: 'string', required: false, editable: true, placeholder: 'e.g. Online shopping' },
              ],
            },
          },
        ],
      },
      {
        key: 'custom_audiences',
        label: 'Custom Audiences (Include)',
        type: 'array',
        required: false,
        editable: true,
        helpText: 'Target people in specific audiences. Find IDs in Audiences section of Ads Manager.',
        arrayItemSchema: {
          key: 'audience',
          label: 'Custom Audience',
          type: 'object',
          required: true,
          editable: true,
          objectSchema: [
            { key: 'id', label: 'Audience ID', type: 'string', required: true, editable: true, placeholder: 'e.g. 23851234567890' },
            { key: 'name', label: 'Display Name', type: 'string', required: false, editable: false },
          ],
        },
      },
      {
        key: 'excluded_custom_audiences',
        label: 'Custom Audiences (Exclude)',
        type: 'array',
        required: false,
        editable: true,
        helpText: 'Exclude people in specific audiences',
        arrayItemSchema: {
          key: 'audience',
          label: 'Excluded Audience',
          type: 'object',
          required: true,
          editable: true,
          objectSchema: [
            { key: 'id', label: 'Audience ID', type: 'string', required: true, editable: true, placeholder: 'e.g. 23851234567890' },
            { key: 'name', label: 'Display Name', type: 'string', required: false, editable: false },
          ],
        },
      },
    ];
  }

  private static getPromotedObjectSchema(objective: string): SchemaField[] {
    const fields: SchemaField[] = [];
    const required = PROMOTED_OBJECT_REQUIREMENTS[objective] || [];

    if (required.includes('pixel_id') || objective === 'OUTCOME_SALES' || objective === 'OUTCOME_TRAFFIC') {
      fields.push({
        key: 'pixel_id',
        label: 'Pixel ID',
        type: 'string',
        required: required.includes('pixel_id'),
        editable: true,
        placeholder: 'Meta Pixel ID',
      });
      fields.push({
        key: 'custom_event_type',
        label: 'Custom Event Type',
        type: 'enum',
        required: false,
        editable: true,
        options: [
          { value: 'PURCHASE', label: 'Purchase' },
          { value: 'ADD_TO_CART', label: 'Add to Cart' },
          { value: 'INITIATED_CHECKOUT', label: 'Checkout' },
          { value: 'LEAD', label: 'Lead' },
          { value: 'COMPLETE_REGISTRATION', label: 'Complete Registration' },
          { value: 'CONTACT', label: 'Contact' },
          { value: 'SUBSCRIBE', label: 'Subscribe' },
          { value: 'START_TRIAL', label: 'Start Trial' },
          { value: 'SEARCH', label: 'Search' },
          { value: 'VIEW_CONTENT', label: 'View Content' },
          { value: 'OTHER', label: 'Other' },
        ],
        dependsOn: [{
          field: 'pixel_id',
          condition: 'exists',
          effect: 'show',
        }],
      });
    }

    if (required.includes('page_id') || objective === 'OUTCOME_LEADS' || objective === 'OUTCOME_ENGAGEMENT' || objective === 'OUTCOME_TRAFFIC') {
      fields.push({
        key: 'page_id',
        label: 'Page ID',
        type: 'string',
        required: required.includes('page_id'),
        editable: true,
        placeholder: 'Facebook Page ID',
      });
    }

    if (required.includes('application_id') || objective === 'OUTCOME_APP_PROMOTION') {
      fields.push({
        key: 'application_id',
        label: 'Application ID',
        type: 'string',
        required: required.includes('application_id'),
        editable: true,
        placeholder: 'Meta App ID',
      });
      fields.push({
        key: 'object_store_url',
        label: 'App Store URL',
        type: 'string',
        required: objective === 'OUTCOME_APP_PROMOTION',
        editable: true,
        placeholder: 'https://play.google.com/store/apps/...',
        helpText: objective === 'OUTCOME_APP_PROMOTION' ? 'Required for App Promotion campaigns' : undefined,
        dependsOn: [{
          field: 'application_id',
          condition: 'exists',
          effect: 'show',
        }],
      });
    }

    if (objective === 'OUTCOME_SALES') {
      fields.push({
        key: 'product_catalog_id',
        label: 'Product Catalog ID',
        type: 'string',
        required: false,
        editable: true,
        placeholder: 'Catalog ID for DPA/Advantage+ catalog ads',
        helpText: 'Required for catalog/DPA ads',
      });
    }

    return fields;
  }

  private static getAttributionSpecSchema(): SchemaField[] {
    return [
      {
        key: 'event_type',
        label: 'Event Type',
        type: 'enum',
        required: false,
        editable: true,
        defaultValue: 'CLICK_THROUGH',
        options: [
          { value: 'CLICK_THROUGH', label: 'Click Through' },
          { value: 'VIEW_THROUGH', label: 'View Through' },
        ],
      },
      {
        key: 'window_days',
        label: 'Attribution Window (Days)',
        type: 'enum',
        required: false,
        editable: true,
        defaultValue: '7',
        options: [
          { value: '1', label: '1 Day' },
          { value: '7', label: '7 Days' },
          { value: '28', label: '28 Days' },
        ],
      },
    ];
  }

  // ─── Dependency Resolution ───

  static resolveFieldVisibility(
    schema: FormSchema,
    values: Record<string, any>,
  ): Map<string, { visible: boolean; required: boolean; disabled: boolean }> {
    const result = new Map<string, { visible: boolean; required: boolean; disabled: boolean }>();

    for (const section of schema.sections) {
      for (const field of section.fields) {
        this.resolveFieldState(field, values, result);
      }
    }

    return result;
  }

  private static resolveFieldState(
    field: SchemaField,
    values: Record<string, any>,
    result: Map<string, { visible: boolean; required: boolean; disabled: boolean }>,
  ): void {
    let visible = !field.hidden;
    let required = field.required;
    let disabled = !field.editable;

    if (field.dependsOn) {
      for (const dep of field.dependsOn) {
        const depValue = this.getNestedValue(values, dep.field);
        const conditionMet = this.evaluateCondition(depValue, dep);

        switch (dep.effect) {
          case 'show':
            if (!conditionMet) visible = false;
            break;
          case 'hide':
            if (conditionMet) visible = false;
            break;
          case 'require':
            if (conditionMet) required = true;
            break;
          case 'disable':
            if (conditionMet) disabled = true;
            break;
        }
      }
    }

    if (field.incompatibleWith) {
      for (const incompField of field.incompatibleWith) {
        const incompValue = this.getNestedValue(values, incompField);
        if (incompValue !== undefined && incompValue !== null && incompValue !== '' && incompValue !== 0) {
          disabled = true;
          break;
        }
      }
    }

    result.set(field.key, { visible, required, disabled });

    if (field.objectSchema) {
      const objectValue = values[field.key] || {};
      for (const subField of field.objectSchema) {
        this.resolveFieldState(subField, objectValue, result);
      }
    }
  }

  private static evaluateCondition(
    value: any,
    dep: DependencyRule,
  ): boolean {
    switch (dep.condition) {
      case 'equals':
        return value === dep.value;
      case 'notEquals':
        return value !== dep.value;
      case 'in':
        if (Array.isArray(value)) {
          return dep.values?.some(v => value.includes(v)) || false;
        }
        return dep.values?.includes(value) || false;
      case 'notIn':
        return !dep.values?.includes(value);
      case 'exists':
        return value !== undefined && value !== null && value !== '';
      case 'notExists':
        return value === undefined || value === null || value === '';
      default:
        return true;
    }
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  // ─── Cascade Invalidation ───

  static getInvalidatedFields(
    schema: FormSchema,
    changedField: string,
  ): string[] {
    const invalidated: string[] = [];
    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (field.invalidates?.includes(changedField)) {
          invalidated.push(field.key);
        }
        if (field.key === changedField && field.invalidates) {
          invalidated.push(...field.invalidates);
        }
      }
    }
    return [...new Set(invalidated)];
  }

  static getDefaultsForObjective(objective: string): Record<string, any> {
    const defaults = OBJECTIVE_DEFAULTS[objective];
    if (!defaults) return {};
    return { ...defaults };
  }

  // ─── Option Maps ───

  private static buildOptimizationGoalOptionsMap(): Record<string, EnumOption[]> {
    const map: Record<string, EnumOption[]> = {};
    for (const [obj, goals] of Object.entries(VALID_OPTIMIZATION_GOALS)) {
      map[obj] = goals.map(g => ({
        value: g,
        label: OPTIMIZATION_GOAL_LABELS[g] || g,
      }));
    }
    return map;
  }

  private static buildDestinationTypeOptionsMap(): Record<string, EnumOption[]> {
    const map: Record<string, EnumOption[]> = {};
    for (const [obj, types] of Object.entries(VALID_DESTINATION_TYPES)) {
      map[obj] = types.map(t => ({
        value: t,
        label: DESTINATION_TYPE_LABELS[t] || t,
      }));
    }
    return map;
  }

  // ─── Helpers ───

  private static getObjectiveDescription(objective: string): string {
    const descs: Record<string, string> = {
      OUTCOME_AWARENESS: 'Maximize reach and ad recall',
      OUTCOME_TRAFFIC: 'Send people to a destination',
      OUTCOME_ENGAGEMENT: 'Get messages, video views, or post engagement',
      OUTCOME_LEADS: 'Collect leads for your business',
      OUTCOME_SALES: 'Find people likely to purchase',
      OUTCOME_APP_PROMOTION: 'Get people to install your app',
    };
    return descs[objective] || '';
  }

  private static formatEnumLabel(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
