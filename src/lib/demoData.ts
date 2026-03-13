export type DemoLeadStage = "New" | "Qualified" | "Active Deal" | "Closed";
export type DemoLeadTemp = "Cold" | "Warm" | "Hot";

export type DemoLead = {
  id: string;
  title: string;
  fullName: string;
  source: string;
  stage: DemoLeadStage;
  temp: DemoLeadTemp;
  intent: string;
  timeline: string;
  area: string;
  nextStep: string;
  email: string;
  phone: string;
  notes: string;
  lastActivity: string;
};

export type DemoDealStage = "Prep" | "Showing" | "Inspection";

export type DemoDeal = {
  id: string;
  title: string;
  leadId: string;
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
  channel: "Call" | "Review" | "Update";
  status: "Open" | "Done";
};

export const demoLeads: DemoLead[] = [
  {
    id: "demo-lead-1",
    title: "Buyer inquiry from website form",
    fullName: "Jordan Mitchell",
    source: "Website form",
    stage: "New",
    temp: "Hot",
    intent: "Buying a condo",
    timeline: "30-60 days",
    area: "The Gulch",
    nextStep: "Call buyer about showing",
    email: "jordan@example.com",
    phone: "(615) 555-0182",
    notes: "Asked for a fast tour this weekend and wants walkability.",
    lastActivity: "12 minutes ago",
  },
  {
    id: "demo-lead-2",
    title: "Seller intake from open house QR",
    fullName: "Avery Collins",
    source: "Open house QR",
    stage: "Qualified",
    temp: "Warm",
    intent: "Listing consultation",
    timeline: "This month",
    area: "Green Hills",
    nextStep: "Review seller intake",
    email: "avery@example.com",
    phone: "(615) 555-0110",
    notes: "Needs pricing guidance before deciding whether to list now or wait.",
    lastActivity: "Today at 9:10 AM",
  },
  {
    id: "demo-lead-3",
    title: "Buyer from Instagram bio link",
    fullName: "Riley Harper",
    source: "Instagram bio link",
    stage: "New",
    temp: "Warm",
    intent: "First-time buyer",
    timeline: "90 days",
    area: "Charlotte Park",
    nextStep: "Send lender intro and neighborhood shortlist",
    email: "riley@example.com",
    phone: "(615) 555-0133",
    notes: "Found Merlyn intake through Instagram and wants a simple starting plan.",
    lastActivity: "Yesterday",
  },
  {
    id: "demo-lead-4",
    title: "Seller thinking about listing in spring",
    fullName: "Morgan Blake",
    source: "Referral follow-up",
    stage: "Closed",
    temp: "Cold",
    intent: "Future listing",
    timeline: "Spring",
    area: "Brentwood",
    nextStep: "Re-engage closer to listing window",
    email: "morgan@example.com",
    phone: "(615) 555-0174",
    notes: "Conversation is parked for now after an initial planning call.",
    lastActivity: "2 weeks ago",
  },
  {
    id: "demo-lead-5",
    title: "Active buyer looking in East Nashville",
    fullName: "Taylor Brooks",
    source: "Past website inquiry",
    stage: "Active Deal",
    temp: "Hot",
    intent: "Buyer under contract",
    timeline: "Closing in 3 weeks",
    area: "East Nashville",
    nextStep: "Update inspection timeline",
    email: "taylor@example.com",
    phone: "(615) 555-0166",
    notes: "Offer accepted. Inspection is booked and lender is moving quickly.",
    lastActivity: "Today at 7:45 AM",
  },
];

export const demoDeals: DemoDeal[] = [
  {
    id: "demo-deal-1",
    title: "Condo purchase",
    leadId: "demo-lead-5",
    clientName: "Taylor Brooks",
    address: "1045 Fatherland St #312",
    stage: "Inspection",
    nextStep: "Review inspection response",
    timeline: "Closing Apr 4",
    priceLabel: "$615,000",
  },
  {
    id: "demo-deal-2",
    title: "Listing prep",
    leadId: "demo-lead-2",
    clientName: "Avery Collins",
    address: "1608 Woodmont Blvd",
    stage: "Prep",
    nextStep: "Finalize pricing recommendation",
    timeline: "Target go-live in 10 days",
    priceLabel: "$1.08M target",
  },
  {
    id: "demo-deal-3",
    title: "Buyer showing scheduled",
    leadId: "demo-lead-1",
    clientName: "Jordan Mitchell",
    address: "1212 Laurel St",
    stage: "Showing",
    nextStep: "Confirm Saturday route",
    timeline: "Showing Sat 11:00 AM",
    priceLabel: "$540,000 budget",
  },
];

export const demoFollowUps: DemoFollowUp[] = [
  {
    id: "demo-followup-1",
    leadId: "demo-lead-1",
    title: "Call buyer about showing",
    dueLabel: "Today, 10:30 AM",
    channel: "Call",
    status: "Open",
  },
  {
    id: "demo-followup-2",
    leadId: "demo-lead-2",
    title: "Review seller intake",
    dueLabel: "Today, 1:00 PM",
    channel: "Review",
    status: "Open",
  },
  {
    id: "demo-followup-3",
    leadId: "demo-lead-5",
    title: "Update inspection timeline",
    dueLabel: "Today, 3:30 PM",
    channel: "Update",
    status: "Open",
  },
];
