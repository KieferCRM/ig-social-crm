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
  "Within 30 days",
  "1-3 months",
  "3-6 months",
  "No rush",
];

const PROPERTY_TYPE_OPTIONS = [
  "Single Family Home",
  "Condo / Townhome",
  "Multi-Family",
  "Land Only",
  "Commercial",
  "Other",
];

export const FORM_TEMPLATES: Record<string, FormTemplate> = {
  // ── Traditional agent forms ──────────────────────────────────────────────

  generic_seller: {
    form_type: "generic_seller",
    title: "Seller Inquiry",
    description: "Tell us about your property and we'll follow up with the right next step.",
    intent: "Sell",
    fields: [
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
        required: true,
        options: PROPERTY_TYPE_OPTIONS,
        crm_field: "property_type",
      },
      {
        id: "estimated_condition",
        label: "Estimated Condition",
        type: "select",
        required: true,
        options: ["Move-in Ready", "Needs Work", "Major Repairs", "Tear Down"],
        crm_field: "seller_readiness",
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
        id: "first_name",
        label: "First Name",
        type: "text",
        required: true,
        placeholder: "Your first name",
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
    ],
  },

  generic_buyer: {
    form_type: "generic_buyer",
    title: "Buyer Inquiry",
    description: "Share a few details and we'll match you with the right properties and next steps.",
    intent: "Buy",
    fields: [
      {
        id: "location_area",
        label: "Areas or ZIP Codes You're Interested In",
        type: "text",
        required: true,
        placeholder: "East Nashville, 37206, Green Hills...",
        crm_field: "location_area",
      },
      {
        id: "property_type",
        label: "Property Type",
        type: "select",
        required: true,
        options: PROPERTY_TYPE_OPTIONS,
        crm_field: "property_type",
      },
      {
        id: "budget_range",
        label: "Budget Range",
        type: "select",
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
        id: "financing_status",
        label: "Pre-Approved?",
        type: "radio",
        required: true,
        options: ["Yes", "No", "Not yet"],
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
      {
        id: "first_name",
        label: "First Name",
        type: "text",
        required: true,
        placeholder: "Your first name",
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
    ],
  },

  contact: {
    form_type: "contact",
    title: "Get in Touch",
    description: "Leave your details and I'll follow up.",
    fields: [
      {
        id: "first_name",
        label: "First Name",
        type: "text",
        required: true,
        placeholder: "Your first name",
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
        id: "notes",
        label: "What's on your mind?",
        type: "textarea",
        required: false,
        placeholder: "Buying, selling, questions about a listing — anything works.",
        crm_field: "notes",
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
  { label: "I want to buy a home", form_type: "generic_buyer" },
  { label: "I want to sell my home", form_type: "generic_seller" },
  { label: "Just getting in touch", form_type: "contact" },
] as const;

// Form types available for intake_links (traditional agent side)
export const INTAKE_LINK_FORM_TYPES = [
  { value: "buyer", label: "Buyer form", formKey: "generic_buyer" },
  { value: "seller", label: "Seller form", formKey: "generic_seller" },
  { value: "contact", label: "Contact form", formKey: "contact" },
] as const;

export type IntakeLinkFormType = "buyer" | "seller" | "contact";

export function formKeyForLinkType(formType: IntakeLinkFormType): string {
  const map: Record<IntakeLinkFormType, string> = {
    buyer: "generic_buyer",
    seller: "generic_seller",
    contact: "contact",
  };
  return map[formType];
}
