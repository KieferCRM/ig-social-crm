import { z } from "zod";

const optionalShortString = z.union([z.string().min(1).max(255), z.null()]).optional();
const optionalLongString = z.union([z.string().min(1).max(4000), z.null()]).optional();

const leadSchema = z.object({
  first_name: z.union([z.string().min(1).max(120), z.null()]).optional(),
  last_name: z.union([z.string().min(1).max(120), z.null()]).optional(),
  full_name: z.union([z.string().min(1).max(240), z.null()]).optional(),
  email: z.union([z.string().email().max(320), z.null()]).optional(),
  phone: z.union([z.string().min(5).max(40), z.null()]).optional(),
  ig_username: z.union([z.string().min(1).max(80), z.null()]).optional(),
  source_ref_id: optionalShortString,
  stage: z.union([z.string().min(1).max(60), z.null()]).optional(),
  source: optionalShortString,
  notes: optionalLongString,
  tags: z
    .union([z.array(z.string().min(1).max(64)).max(40), z.string().max(800), z.null()])
    .optional(),
  custom_fields: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
  consent_to_email: z.union([z.boolean(), z.string(), z.null()]).optional(),
  consent_to_sms: z.union([z.boolean(), z.string(), z.null()]).optional(),
  consent_source: z.union([z.string().min(1).max(512), z.null()]).optional(),
  consent_timestamp: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
  consent_text_snapshot: optionalLongString,
});

export const ingestEnvelopeSchema = z.object({
  external_event_id: optionalShortString,
  event_type: z.union([z.string().min(1).max(80), z.null()]).optional(),
  occurred_at: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
  source_ref_id: optionalShortString,
  lead: leadSchema,
  raw_payload: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
});

export type IngestEnvelope = z.infer<typeof ingestEnvelopeSchema>;
