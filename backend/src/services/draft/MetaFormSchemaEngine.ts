import {
  CAMPAIGN_FIELDS,
  ADSET_FIELDS,
  AD_FIELDS,
  FieldConfig,
  VALID_OPTIMIZATION_GOALS,
  VALID_DESTINATION_TYPES,
  PROMOTED_OBJECT_REQUIREMENTS,
  ATTRIBUTION_SPEC_OBJECTIVES,
  BID_CAP_STRATEGIES,
  OBJECTIVE_DEFAULTS,
  OPTIMIZATION_GOAL_LABELS,
  DESTINATION_TYPE_LABELS,
} from './MetaFieldRegistry';

// ─── Recursive Schema Types ───

export type SchemaFieldType =
  | 'string'
  | 'number'
  | 'enum'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'currency'
  | 'object'
  | 'array'
  | 'multiEnum';

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
}

// ─── Schema Generators ───

export class MetaFormSchemaEngine {

  static getCampaignFormSchema(context?: Partial<FormContext>): FormSchema {
    const objective = context?.objective || 'OUTCOME_TRAFFIC';

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
              editable: false,
              options: CAMPAIGN_FIELDS.objective.enumValues!.map(v => ({
                value: v,
                label: CAMPAIGN_FIELDS.objective.enumLabels![v] || v,
                description: this.getObjectiveDescription(v),
              })),
              invalidates: ['optimization_goal', 'destination_type', 'promoted_object', 'billing_event'],
            },
            {
              key: 'buying_type',
              label: 'Buying Type',
              type: 'enum',
              required: false,
              editable: false,
              options: CAMPAIGN_FIELDS.buying_type.enumValues!.map(v => ({
                value: v,
                label: CAMPAIGN_FIELDS.buying_type.enumLabels![v] || v,
              })),
            },
            {
              key: 'status',
              label: 'Status',
              type: 'enum',
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
            },
          ],
        },
      ],
      context: { objective, buyingType: context?.buyingType, isCBO: context?.isCBO },
    };
  }

  static getAdSetFormSchema(context: FormContext): FormSchema {
    const { objective = 'OUTCOME_TRAFFIC', isCBO = false } = context;

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
              required: true,
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
      ],
      context: { objective, isCBO, buyingType: context.buyingType, destinationType: context.destinationType },
    };
  }

  static getAdFormSchema(context?: Partial<FormContext>): FormSchema {
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
                  key: 'object_story_spec.link_data.message',
                  label: 'Ad Body Text',
                  type: 'string',
                  required: false,
                  editable: true,
                  placeholder: 'Write your ad body text here...',
                },
                {
                  key: 'object_story_spec.link_data.name',
                  label: 'Headline',
                  type: 'string',
                  required: false,
                  editable: true,
                  placeholder: 'Enter headline',
                },
                {
                  key: 'object_story_spec.link_data.link',
                  label: 'Destination URL',
                  type: 'string',
                  required: false,
                  editable: true,
                  placeholder: 'https://example.com',
                },
                {
                  key: 'object_story_spec.link_data.call_to_action.type',
                  label: 'Call to Action',
                  type: 'enum',
                  required: false,
                  editable: true,
                  options: [
                    { value: 'LEARN_MORE', label: 'Learn More' },
                    { value: 'SHOP_NOW', label: 'Shop Now' },
                    { value: 'SIGN_UP', label: 'Sign Up' },
                    { value: 'BOOK_TRAVEL', label: 'Book Now' },
                    { value: 'CONTACT_US', label: 'Contact Us' },
                    { value: 'DOWNLOAD', label: 'Download' },
                    { value: 'GET_OFFER', label: 'Get Offer' },
                    { value: 'GET_QUOTE', label: 'Get Quote' },
                    { value: 'SUBSCRIBE', label: 'Subscribe' },
                    { value: 'WATCH_MORE', label: 'Watch More' },
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
          id: 'url_params',
          title: 'URL Parameters',
          collapsible: true,
          defaultCollapsed: true,
          fields: [
            {
              key: 'url_parameters',
              label: 'URL Parameters',
              type: 'string',
              required: false,
              editable: true,
              placeholder: 'utm_source=facebook&utm_medium=paid&utm_campaign=brand',
              helpText: 'Appended to destination URLs for tracking. Key=value pairs separated by &',
            },
          ],
        },
      ],
      context: context ? { objective: context.objective } : {},
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
            type: 'array',
            required: false,
            editable: true,
            arrayItemSchema: {
              key: 'country',
              label: 'Country Code',
              type: 'string',
              required: true,
              editable: true,
              placeholder: 'e.g. TH, US, GB',
              validation: [{ type: 'pattern', value: '^[A-Z]{2}$', message: 'Must be a 2-letter country code' }],
            },
            helpText: 'ISO 3166-1 alpha-2 codes',
          },
          {
            key: 'regions',
            label: 'Regions',
            type: 'array',
            required: false,
            editable: true,
            arrayItemSchema: {
              key: 'region',
              label: 'Region',
              type: 'object',
              required: true,
              editable: true,
              objectSchema: [
                { key: 'key', label: 'Region Key', type: 'string', required: true, editable: true },
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
            arrayItemSchema: {
              key: 'city',
              label: 'City',
              type: 'object',
              required: true,
              editable: true,
              objectSchema: [
                { key: 'key', label: 'City Key', type: 'string', required: true, editable: true },
                { key: 'name', label: 'City Name', type: 'string', required: false, editable: false },
                { key: 'radius', label: 'Radius (km)', type: 'number', required: false, editable: true, min: 0, max: 80 },
                { key: 'distance_unit', label: 'Unit', type: 'enum', required: false, editable: true, options: [{ value: 'kilometer', label: 'km' }, { value: 'mile', label: 'mi' }] },
              ],
            },
          },
          {
            key: 'location_types',
            label: 'Location Types',
            type: 'multiEnum',
            required: false,
            editable: true,
            options: [
              { value: 'home', label: 'People living in' },
              { value: 'recent', label: 'People recently in' },
              { value: 'travel_in', label: 'People traveling in' },
            ],
          },
        ],
      },
      {
        key: 'age_min',
        label: 'Minimum Age',
        type: 'number',
        required: false,
        editable: true,
        min: 13,
        max: 65,
        defaultValue: 18,
      },
      {
        key: 'age_max',
        label: 'Maximum Age',
        type: 'number',
        required: false,
        editable: true,
        min: 13,
        max: 65,
        defaultValue: 65,
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
        key: 'publisher_platforms',
        label: 'Platforms',
        type: 'multiEnum',
        required: false,
        editable: true,
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
        options: [
          { value: 'feed', label: 'Feed' },
          { value: 'right_hand_column', label: 'Right Column' },
          { value: 'instant_article', label: 'Instant Articles' },
          { value: 'marketplace', label: 'Marketplace' },
          { value: 'video_feeds', label: 'Video Feeds' },
          { value: 'story', label: 'Stories' },
          { value: 'search', label: 'Search Results' },
          { value: 'reels', label: 'Reels' },
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
        options: [
          { value: 'stream', label: 'Feed' },
          { value: 'story', label: 'Stories' },
          { value: 'explore', label: 'Explore' },
          { value: 'reels', label: 'Reels' },
          { value: 'shop', label: 'Shop' },
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
        helpText: 'Interest, behavior, and demographic targeting',
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
              arrayItemSchema: {
                key: 'interest',
                label: 'Interest',
                type: 'object',
                required: true,
                editable: true,
                objectSchema: [
                  { key: 'id', label: 'ID', type: 'string', required: true, editable: true },
                  { key: 'name', label: 'Name', type: 'string', required: false, editable: true },
                ],
              },
            },
            {
              key: 'behaviors',
              label: 'Behaviors',
              type: 'array',
              required: false,
              editable: true,
              arrayItemSchema: {
                key: 'behavior',
                label: 'Behavior',
                type: 'object',
                required: true,
                editable: true,
                objectSchema: [
                  { key: 'id', label: 'ID', type: 'string', required: true, editable: true },
                  { key: 'name', label: 'Name', type: 'string', required: false, editable: true },
                ],
              },
            },
            {
              key: 'demographics',
              label: 'Demographics',
              type: 'array',
              required: false,
              editable: true,
              arrayItemSchema: {
                key: 'demographic',
                label: 'Demographic',
                type: 'object',
                required: true,
                editable: true,
                objectSchema: [
                  { key: 'id', label: 'ID', type: 'string', required: true, editable: true },
                  { key: 'name', label: 'Name', type: 'string', required: false, editable: true },
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
                { key: 'id', label: 'ID', type: 'string', required: true, editable: true },
                { key: 'name', label: 'Name', type: 'string', required: false, editable: true },
              ],
            },
          },
        ],
      },
      {
        key: 'custom_audiences',
        label: 'Custom Audiences',
        type: 'array',
        required: false,
        editable: true,
        arrayItemSchema: {
          key: 'audience',
          label: 'Custom Audience',
          type: 'object',
          required: true,
          editable: true,
          objectSchema: [
            { key: 'id', label: 'Audience ID', type: 'string', required: true, editable: true },
            { key: 'name', label: 'Name', type: 'string', required: false, editable: false },
          ],
        },
      },
      {
        key: 'excluded_custom_audiences',
        label: 'Excluded Custom Audiences',
        type: 'array',
        required: false,
        editable: true,
        arrayItemSchema: {
          key: 'audience',
          label: 'Excluded Audience',
          type: 'object',
          required: true,
          editable: true,
          objectSchema: [
            { key: 'id', label: 'Audience ID', type: 'string', required: true, editable: true },
            { key: 'name', label: 'Name', type: 'string', required: false, editable: false },
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

    if (required.includes('page_id') || objective === 'OUTCOME_LEADS' || objective === 'OUTCOME_ENGAGEMENT') {
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
        required: false,
        editable: true,
        placeholder: 'https://play.google.com/store/apps/...',
        dependsOn: [{
          field: 'application_id',
          condition: 'exists',
          effect: 'show',
        }],
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
