export type FormFieldType = "text" | "tel" | "email" | "select" | "radio" | "textarea";

export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  tooltip?: string;
  crm_field?: string;
  showIf?: { field: string; values: string[] };
};

export type FormTemplate = {
  form_type: string;
  title: string;
  headline?: string;
  description?: string;
  intent?: string;
  fields: FormField[];
};

const TIMELINE_OPTIONS = [
  "ASAP",
  "Within 30 days",
  "1-3 months",
  "3-6 months",
  "6-12 months",
  "No rush / Just exploring",
];

const PROPERTY_TYPE_OPTIONS = [
  "Single Family Home",
  "Condo / Townhome",
  "Multi-Family",
  "Land Only",
  "Commercial",
  "Other",
];

const BUDGET_OPTIONS = [
  "Under $200k",
  "$200k–$350k",
  "$350k–$500k",
  "$500k–$750k",
  "$750k–$1M",
  "$1M+",
];

export const FORM_TEMPLATES: Record<string, FormTemplate> = {
  // ── Traditional agent forms ──────────────────────────────────────────────

  contact: {
    form_type: "contact",
    title: "Get in Touch",
    description: "Leave your info and I'll reach out — no pressure.",
    fields: [
      {
        id: "full_name",
        label: "Full Name",
        type: "text",
        required: true,
        placeholder: "Jane Smith",
        crm_field: "full_name",
      },
      {
        id: "phone",
        label: "Phone Number",
        type: "tel",
        required: true,
        placeholder: "(615) 555-0100",
        crm_field: "phone",
      },
      {
        id: "email",
        label: "Email Address",
        type: "email",
        required: false,
        placeholder: "you@email.com",
        crm_field: "email",
      },
      {
        id: "intent",
        label: "Are you buying, selling, or both?",
        type: "radio",
        required: false,
        options: ["Buying", "Selling", "Both"],
        crm_field: "intent",
      },
      {
        id: "timeline",
        label: "What's your timeline?",
        type: "select",
        required: false,
        options: TIMELINE_OPTIONS,
        crm_field: "timeline",
      },
      {
        id: "notes",
        label: "Anything else you'd like to share?",
        type: "textarea",
        required: false,
        placeholder: "Questions about a listing, the market, anything — go for it.",
        crm_field: "notes",
      },
    ],
  },

  open_house: {
    form_type: "open_house",
    title: "Open House Sign-In",
    description: "Sign in and we'll send you the property details and any updates.",
    intent: "Buy",
    fields: [
      {
        id: "full_name",
        label: "Full Name",
        type: "text",
        required: true,
        placeholder: "Jane Smith",
        crm_field: "full_name",
      },
      {
        id: "phone",
        label: "Phone Number",
        type: "tel",
        required: true,
        placeholder: "(615) 555-0100",
        crm_field: "phone",
      },
      {
        id: "email",
        label: "Email Address",
        type: "email",
        required: false,
        placeholder: "you@email.com",
        crm_field: "email",
      },
      {
        id: "agency_status",
        label: "Are you currently working with a buyer's agent?",
        type: "radio",
        required: false,
        options: ["Yes", "No"],
        crm_field: "agency_status",
      },
      {
        id: "referral_source",
        label: "How did you hear about this open house?",
        type: "select",
        required: false,
        options: [
          "Zillow",
          "Realtor.com",
          "Instagram / Facebook",
          "Yard sign",
          "Friend or referral",
          "Other",
        ],
        crm_field: "custom.referral_source",
      },
    ],
  },

  seller: {
    form_type: "seller",
    title: "Thinking About Selling?",
    description: "Tell us about your property and we'll follow up with next steps — no obligation.",
    intent: "Sell",
    fields: [
      {
        id: "full_name",
        label: "Full Name",
        type: "text",
        required: true,
        placeholder: "Jane Smith",
        crm_field: "full_name",
      },
      {
        id: "phone",
        label: "Phone Number",
        type: "tel",
        required: true,
        placeholder: "(615) 555-0100",
        crm_field: "phone",
      },
      {
        id: "email",
        label: "Email Address",
        type: "email",
        required: false,
        placeholder: "you@email.com",
        crm_field: "email",
      },
      {
        id: "property_address",
        label: "Property Address",
        type: "text",
        required: true,
        placeholder: "123 Main St, Nashville, TN",
        crm_field: "property_context",
      },
      {
        id: "property_type",
        label: "Property Type",
        type: "select",
        required: false,
        options: PROPERTY_TYPE_OPTIONS,
        crm_field: "property_type",
      },
      {
        id: "timeline",
        label: "Timeline to Sell",
        type: "select",
        required: true,
        options: TIMELINE_OPTIONS,
        crm_field: "timeline",
      },
      {
        id: "asking_price",
        label: "Rough Asking Price in Mind?",
        type: "text",
        required: false,
        placeholder: "e.g. $450,000 — okay to estimate",
        crm_field: "custom.asking_price",
      },
    ],
  },

  buyer: {
    form_type: "buyer",
    title: "Looking for a Home?",
    description: "Share what you're looking for and we'll reach out with the right next step.",
    intent: "Buy",
    fields: [
      {
        id: "full_name",
        label: "Full Name",
        type: "text",
        required: true,
        placeholder: "Jane Smith",
        crm_field: "full_name",
      },
      {
        id: "phone",
        label: "Phone Number",
        type: "tel",
        required: true,
        placeholder: "(615) 555-0100",
        crm_field: "phone",
      },
      {
        id: "email",
        label: "Email Address",
        type: "email",
        required: false,
        placeholder: "you@email.com",
        crm_field: "email",
      },
      {
        id: "location_area",
        label: "Areas or Neighborhoods You're Interested In",
        type: "text",
        required: true,
        placeholder: "East Nashville, 37206, Green Hills...",
        crm_field: "location_area",
      },
      {
        id: "budget_range",
        label: "Budget Range",
        type: "select",
        required: true,
        options: BUDGET_OPTIONS,
        crm_field: "budget_range",
      },
      {
        id: "financing_status",
        label: "Are you pre-approved for a mortgage?",
        type: "radio",
        required: false,
        options: ["Yes", "No", "In progress"],
        crm_field: "financing_status",
      },
      {
        id: "timeline",
        label: "Timeline to Buy",
        type: "select",
        required: true,
        options: TIMELINE_OPTIONS,
        crm_field: "timeline",
      },
    ],
  },

  // ── Off-market agent forms (kept for off-market side) ─────────────────────

  off_market_seller: {
    form_type: "off_market_seller",
    title: "Seller Inquiry",
    description:
      "Tell us about your property and we'll follow up with next steps — no obligation.",
    intent: "Sell",
    fields: [
      {
        id: "full_name",
        label: "Full Name",
        type: "text" as const,
        required: true,
        placeholder: "Jane Smith",
        crm_field: "full_name",
      },
      {
        id: "phone",
        label: "Phone Number",
        type: "tel" as const,
        required: true,
        placeholder: "(615) 555-0100",
        crm_field: "phone",
      },
      {
        id: "email",
        label: "Email Address",
        type: "email" as const,
        required: false,
        placeholder: "you@email.com",
        crm_field: "email",
      },
      {
        id: "property_address",
        label: "Property Address",
        type: "text" as const,
        required: true,
        placeholder: "123 Main St, Nashville, TN",
        crm_field: "property_context",
      },
      {
        id: "acreage",
        label: "Acreage / Lot Size",
        type: "text" as const,
        required: false,
        placeholder: "e.g. 12.5 acres",
        crm_field: "custom.acreage",
      },
      {
        id: "asking_price",
        label: "Asking Price",
        type: "text" as const,
        required: false,
        placeholder: "e.g. $350,000",
        crm_field: "custom.asking_price",
      },
      {
        id: "notes",
        label: "Additional Notes",
        type: "textarea" as const,
        required: false,
        placeholder: "Anything else we should know about the property?",
        crm_field: "notes",
      },
    ],
  },

  off_market_buyer: {
    form_type: "off_market_buyer",
    title: "Buyer Inquiry",
    description:
      "Share what you're looking for and we'll reach out with matching opportunities.",
    intent: "Buy",
    fields: [
      {
        id: "full_name",
        label: "Full Name",
        type: "text" as const,
        required: true,
        placeholder: "Jane Smith",
        crm_field: "full_name",
      },
      {
        id: "phone",
        label: "Phone Number",
        type: "tel" as const,
        required: true,
        placeholder: "(615) 555-0100",
        crm_field: "phone",
      },
      {
        id: "email",
        label: "Email Address",
        type: "email" as const,
        required: false,
        placeholder: "you@email.com",
        crm_field: "email",
      },
      {
        id: "budget_range",
        label: "Price Range",
        type: "select" as const,
        required: true,
        options: [
          "Under $200k",
          "$200k–$350k",
          "$350k–$500k",
          "$500k–$750k",
          "$750k–$1M",
          "$1M+",
        ],
        crm_field: "budget_range",
      },
      {
        id: "location_area",
        label: "Location Preference",
        type: "text" as const,
        required: true,
        placeholder: "Areas, cities, or ZIP codes you're interested in",
        crm_field: "location_area",
      },
      {
        id: "notes",
        label: "Additional Notes",
        type: "textarea" as const,
        required: false,
        placeholder: "Any specifics about what you're looking for?",
        crm_field: "notes",
      },
    ],
  },
};

// Router options shown on the /intake/[agentSlug] landing page
export const FORM_ROUTER_OPTIONS = [
  { label: "I want to buy a home", form_type: "buyer" },
  { label: "I want to sell my home", form_type: "seller" },
  { label: "Just getting in touch", form_type: "contact" },
] as const;

// Form types available for intake_links (traditional agent side)
export const INTAKE_LINK_FORM_TYPES = [
  { value: "buyer", label: "Buyer form", formKey: "buyer" },
  { value: "seller", label: "Seller form", formKey: "seller" },
  { value: "contact", label: "Contact form", formKey: "contact" },
  { value: "open_house", label: "Open House sign-in", formKey: "open_house" },
] as const;

export type IntakeLinkFormType = "buyer" | "seller" | "contact" | "open_house";

export function formKeyForLinkType(formType: IntakeLinkFormType): string {
  const map: Record<IntakeLinkFormType, string> = {
    buyer: "buyer",
    seller: "seller",
    contact: "contact",
    open_house: "open_house",
  };
  return map[formType];
}
