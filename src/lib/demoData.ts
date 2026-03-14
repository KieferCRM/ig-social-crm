export const DEMO_WORKSPACE_ID = "demo_workspace";
export const DEMO_STORAGE_KEY = "merlyn_demo_workspace_v2";
export const DEMO_ONBOARDING_KEY = "merlyn_demo_onboarding_seen";
export const DEMO_RESET_MS = 60 * 60 * 1000;
export const DEMO_STATE_VERSION = 2;

export type DemoLeadStage = "New" | "Qualified" | "Active Deal" | "Closed";
export type DemoLeadTemp = "Cold" | "Warm" | "Hot";

export type DemoLead = {
  id: string;
  fullName: string;
  intent: string;
  source: string;
  stage: DemoLeadStage;
  temp: DemoLeadTemp;
  area: string;
  budget: string;
  timeline: string;
  email: string;
  phone: string;
  notes: string;
  nextStep: string;
  lastActivity: string;
};

export type DemoDealStage = "Prep" | "Showing" | "Inspection";

export type DemoDeal = {
  id: string;
  leadId: string;
  title: string;
  clientName: string;
  address: string;
  stage: DemoDealStage;
  nextStep: string;
  timeline: string;
  priceLabel: string;
};

export type DemoFollowUp = {
  id: string;
  leadId: string;
  title: string;
  dueLabel: string;
  channel: "Call" | "Review" | "Update" | "Text";
  status: "Open" | "Done";
};

export type DemoWorkspaceState = {
  tenantId: string;
  version: number;
  updatedAt: string;
  simulatedFirstInquiry: boolean;
  generatorCount: number;
  leads: DemoLead[];
  deals: DemoDeal[];
  followUps: DemoFollowUp[];
};

type DemoLeadInput = Omit<DemoLead, "id">;

type DemoInquiryInput = {
  fullName: string;
  intent: string;
  area: string;
  budget: string;
  timeline: string;
  source: string;
  email: string;
  phone: string;
  notes: string;
  nextStep: string;
  temp?: DemoLeadTemp;
};

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function demoLead(input: DemoLeadInput): DemoLead {
  return {
    id: createId("demo-lead"),
    ...input,
  };
}

export function createSeedDemoWorkspace(): DemoWorkspaceState {
  const leads: DemoLead[] = [
    demoLead({
      fullName: "Emily Carter",
      intent: "Buying",
      source: "Website questionnaire",
      stage: "New",
      temp: "Hot",
      area: "12 South",
      budget: "$600k",
      timeline: "2 months",
      email: "emily.carter@example.com",
      phone: "(615) 555-0144",
      notes: "Wants a walkable neighborhood and quick weekend tours.",
      nextStep: "Call about Saturday showings",
      lastActivity: "9 minutes ago",
    }),
    demoLead({
      fullName: "John Mitchell",
      intent: "Selling",
      source: "Open house QR",
      stage: "Qualified",
      temp: "Warm",
      area: "Green Hills",
      budget: "$1.2M target",
      timeline: "Listing soon",
      email: "john.mitchell@example.com",
      phone: "(615) 555-0118",
      notes: "Needs pricing guidance and prep checklist before listing.",
      nextStep: "Review seller intake",
      lastActivity: "Today at 10:20 AM",
    }),
    demoLead({
      fullName: "Rachel Kim",
      intent: "Buying",
      source: "Bio link form",
      stage: "Qualified",
      temp: "Warm",
      area: "Franklin",
      budget: "$850k",
      timeline: "Relocating in 60 days",
      email: "rachel.kim@example.com",
      phone: "(615) 555-0191",
      notes: "Relocating for work and wants school-zone guidance.",
      nextStep: "Send relocation shortlist",
      lastActivity: "Yesterday",
    }),
    demoLead({
      fullName: "Matt Rodriguez",
      intent: "Buying",
      source: "Past questionnaire",
      stage: "Active Deal",
      temp: "Hot",
      area: "The Gulch",
      budget: "$550k",
      timeline: "Offer submitted",
      email: "matt.rodriguez@example.com",
      phone: "(615) 555-0172",
      notes: "Condo search is active and inspection timing needs review.",
      nextStep: "Update inspection timeline",
      lastActivity: "Today at 8:05 AM",
    }),
  ];

  const deals: DemoDeal[] = [
    {
      id: createId("demo-deal"),
      leadId: leads[3].id,
      title: "Condo purchase",
      clientName: "Matt Rodriguez",
      address: "1212 Laurel St #908",
      stage: "Inspection",
      nextStep: "Review inspection response",
      timeline: "Closing Apr 6",
      priceLabel: "$545,000",
    },
    {
      id: createId("demo-deal"),
      leadId: leads[1].id,
      title: "Listing prep",
      clientName: "John Mitchell",
      address: "1809 Abbott Martin Rd",
      stage: "Prep",
      nextStep: "Finalize pricing recommendation",
      timeline: "Go live in 10 days",
      priceLabel: "$1.2M target",
    },
    {
      id: createId("demo-deal"),
      leadId: leads[0].id,
      title: "Buyer showing scheduled",
      clientName: "Emily Carter",
      address: "1012 Wedgewood Ave",
      stage: "Showing",
      nextStep: "Confirm Saturday route",
      timeline: "Showing Sat 11:00 AM",
      priceLabel: "$600,000 budget",
    },
  ];

  const followUps: DemoFollowUp[] = [
    {
      id: createId("demo-followup"),
      leadId: leads[0].id,
      title: "Call buyer about showing",
      dueLabel: "Today, 10:30 AM",
      channel: "Call",
      status: "Open",
    },
    {
      id: createId("demo-followup"),
      leadId: leads[1].id,
      title: "Review seller intake",
      dueLabel: "Today, 1:00 PM",
      channel: "Review",
      status: "Open",
    },
    {
      id: createId("demo-followup"),
      leadId: leads[3].id,
      title: "Update inspection timeline",
      dueLabel: "Today, 3:30 PM",
      channel: "Update",
      status: "Open",
    },
  ];

  return {
    tenantId: DEMO_WORKSPACE_ID,
    version: DEMO_STATE_VERSION,
    updatedAt: new Date().toISOString(),
    simulatedFirstInquiry: false,
    generatorCount: 0,
    leads,
    deals,
    followUps,
  };
}

function createLeadFromInquiry(input: DemoInquiryInput): DemoLead {
  return demoLead({
    fullName: input.fullName,
    intent: input.intent,
    source: input.source,
    stage: "New",
    temp: input.temp || "Hot",
    area: input.area,
    budget: input.budget,
    timeline: input.timeline,
    email: input.email,
    phone: input.phone,
    notes: input.notes,
    nextStep: input.nextStep,
    lastActivity: "Just now",
  });
}

export function createAutomaticInquiryLead(): DemoLead {
  return createLeadFromInquiry({
    fullName: "Sarah Thompson",
    intent: "Buying",
    area: "East Nashville",
    budget: "$750k",
    timeline: "3 months",
    source: "Inquiry Form",
    email: "sarah.thompson@example.com",
    phone: "(615) 555-0107",
    notes: "Filled out the questionnaire and wants a neighborhood shortlist.",
    nextStep: "Call about East Nashville options",
    temp: "Hot",
  });
}

export function createGeneratedInquiryLead(count: number): DemoLead {
  const suffix = count > 1 ? ` ${count}` : "";
  return createLeadFromInquiry({
    fullName: `Demo Inquiry${suffix}`,
    intent: "Buying",
    area: "West End",
    budget: "$550k",
    timeline: "4 months",
    source: "Demo Form",
    email: `demo.inquiry${count}@example.com`,
    phone: "(615) 555-0162",
    notes: "Generated inside the demo workspace to show automatic lead capture.",
    nextStep: "Review inquiry and send next-step options",
    temp: "Warm",
  });
}

export function createLeadFromDemoForm(input: {
  fullName: string;
  email: string;
  phone: string;
  intent: string;
  timeline: string;
  budget: string;
  area: string;
  contactPreference: string;
  notes: string;
  referralSource: string;
}): DemoLead {
  const referralNote = input.referralSource.trim()
    ? `${input.notes.trim() ? `${input.notes.trim()}\n\n` : ""}How they found us: ${input.referralSource.trim()}`
    : input.notes.trim();

  return createLeadFromInquiry({
    fullName: input.fullName.trim() || "Demo Inquiry",
    intent: input.intent.trim() || "Buying",
    area: input.area.trim() || "Nashville",
    budget: input.budget.trim() || "$500k-$750k",
    timeline: input.timeline.trim() || "1-3 months",
    source: "Inquiry Form",
    email: input.email.trim() || "new.inquiry@example.com",
    phone: input.phone.trim() || "(615) 555-0100",
    notes: referralNote || "Captured through the Merlyn inquiry form demo.",
    nextStep: input.contactPreference.trim()
      ? `Follow up by ${input.contactPreference.trim().toLowerCase()}`
      : "Review inquiry and set first follow-up",
    temp: "Hot",
  });
}

export function createFollowUpForLead(lead: DemoLead): DemoFollowUp {
  return {
    id: createId("demo-followup"),
    leadId: lead.id,
    title: lead.nextStep,
    dueLabel: "Today, next available slot",
    channel: lead.nextStep.toLowerCase().includes("call")
      ? "Call"
      : lead.nextStep.toLowerCase().includes("review")
        ? "Review"
        : "Text",
    status: "Open",
  };
}

export function shouldResetDemoWorkspace(state: DemoWorkspaceState | null): boolean {
  if (!state) return true;
  if (state.tenantId !== DEMO_WORKSPACE_ID) return true;
  if (state.version !== DEMO_STATE_VERSION) return true;
  const updatedAt = new Date(state.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) return true;
  return Date.now() - updatedAt > DEMO_RESET_MS;
}
