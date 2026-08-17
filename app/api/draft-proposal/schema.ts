import { z } from "zod";

/** Structured-output schemas for the v2 Writer. Replaces the old ```json```/
 *  ```brand```/```instruction```/```format```/```addClient```/```userDefault```
 *  fenced-block + regex parsing (see AI-ARCHITECTURE-V2.md §7) — the model now
 *  emits these as real Anthropic tool calls ("pseudo-tools", no side effect of
 *  their own besides being validated and turned into an SSE event), so a
 *  truncated/streamed response can never leak a half-closed fence into the
 *  visible chat text, and a malformed payload fails loudly (Zod) instead of
 *  silently parsing into `null`.
 *
 *  Field-for-field parity with the legacy ```json``` block in the old
 *  app/api/draft-proposal/route.ts — see ARCHITECTURE.md §1 (proposals table)
 *  for where each field ultimately lands. */

const I18nText = z.object({ tr: z.string(), en: z.string() });

const ClientContactSchema = z.object({
  company: z.string().optional(),
  contactName: z.string().optional(),
  title: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
});

const ConditionSchema = z
  .object({
    lineItem: z.string().optional(),
    billingKey: z.string().optional(),
  })
  .optional();

const SectionSchema = z.object({
  title: z.string(),
  body: z.string(),
  /** Custom plan only — see KOŞULLU İÇERİK rule in the legacy prompt. */
  condition: ConditionSchema,
});

const LineItemSchema = z.object({
  name: z.string(),
  qty: z.number(),
  unit: z.number(),
  optional: z.boolean().optional(),
  included: z.boolean().optional(),
});

const BillingOptionSchema = z.object({
  key: z.string(),
  label: I18nText,
  price: z.number(),
});

const NextStepSchema = z.object({
  title: z.string(),
  body: z.string(),
});

export const ProposalDraftSchema = z.object({
  title: z.string(),
  client: z.string(),
  value: z.number(),
  introText: z.string(),
  aboutText: z.string(),
  clientContact: ClientContactSchema,
  sections: z.array(SectionSchema),
  lineItems: z.array(LineItemSchema),
  billingOptions: z.array(BillingOptionSchema).default([]),
  nextSteps: z.array(NextStepSchema),
  validDays: z.number().default(15),
  contractText: z.string().optional(),
  /** false on every intermediate turn (live preview only); true only on the
   *  turn the user actually confirms — see SON ONAY rule. Writer sets this,
   *  route.ts never infers it from chat text. */
  confirmed: z.boolean().default(false),
});
export type ProposalDraft = z.infer<typeof ProposalDraftSchema>;

export const BrandSchema = z.object({
  setLogo: z.boolean().optional(),
  primaryColor: z.string().nullable().optional(),
  name: z.string().optional(),
  tagline: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  servicesSummary: z.string().optional(),
  defaultTemplateContent: z.string().optional(),
  defaultSections: z.record(z.string(), z.boolean()).optional(),
});
export type Brand = z.infer<typeof BrandSchema>;

export const InstructionSchema = z.object({
  /** Short, reusable, imperative-mood standing rule — see TALİMAT KAYDI rule. */
  text: z.string().min(1),
});
export type Instruction = z.infer<typeof InstructionSchema>;

export const FormatSchema = z.object({
  value: z.enum(["pdf", "html"]),
});
export type Format = z.infer<typeof FormatSchema>;

export const AddClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  website: z.string().optional(),
});
export type AddClient = z.infer<typeof AddClientSchema>;

export const UserDefaultSchema = z.object({
  label: z.string(),
  templateId: z.string().optional(),
  preferredFormat: z.enum(["pdf", "html"]).optional(),
});
export type UserDefaultOut = z.infer<typeof UserDefaultSchema>;

/** Hand-written JSON Schema counterparts (Anthropic tool `input_schema` wants
 *  plain JSON Schema, not a Zod instance) — kept next to their Zod schema so
 *  the two can't drift silently; a mismatch only shows up as a Zod parse
 *  error on a real model response, so keep these in lockstep by hand. */
export const emitDraftTool = {
  name: "emit_draft",
  description:
    "Şu anki teklif taslağının TAM ve güncel halini yapılandırılmış olarak döndürür. İLK cevabından itibaren HER turda çağır (canlı önizleme) — henüz netleşmemiş alanları placeholder ile doldur, ASLA bilgi uydurma. `confirmed` sadece kullanıcı gerçekten onayladığı turda true olur, aksi halde false.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string" },
      client: { type: "string" },
      value: { type: "number" },
      introText: { type: "string" },
      aboutText: { type: "string" },
      clientContact: {
        type: "object",
        properties: {
          company: { type: "string" },
          contactName: { type: "string" },
          title: { type: "string" },
          address: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          website: { type: "string" },
        },
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            condition: {
              type: "object",
              properties: { lineItem: { type: "string" }, billingKey: { type: "string" } },
              description: "Opsiyonel, sadece biri doldurulur (Custom plan, koşullu içerik).",
            },
          },
          required: ["title", "body"],
        },
      },
      lineItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            qty: { type: "number" },
            unit: { type: "number" },
            optional: { type: "boolean" },
            included: { type: "boolean" },
          },
          required: ["name", "qty", "unit"],
        },
      },
      billingOptions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            label: { type: "object", properties: { tr: { type: "string" }, en: { type: "string" } }, required: ["tr", "en"] },
            price: { type: "number" },
          },
          required: ["key", "label", "price"],
        },
      },
      nextSteps: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, body: { type: "string" } },
          required: ["title", "body"],
        },
      },
      validDays: { type: "number" },
      contractText: { type: "string" },
      confirmed: { type: "boolean" },
    },
    required: ["title", "client", "value", "introText", "aboutText", "clientContact", "sections", "lineItems", "nextSteps"],
  },
};

export const setBrandTool = {
  name: "set_brand",
  description:
    "Kullanıcının verdiği logo/marka rengi/şirket iletişim bilgisi/hizmet özeti gibi somut, yapılandırılmış marka verisini şirket profiline kaydeder (MARKA KAYDI kuralı). Sadece kullanıcı gerçekten bu bilgilerden birini verdiyse çağır.",
  input_schema: {
    type: "object" as const,
    properties: {
      setLogo: { type: "boolean" },
      primaryColor: { type: "string" },
      name: { type: "string" },
      tagline: { type: "string" },
      email: { type: "string" },
      address: { type: "string" },
      phone: { type: "string" },
      servicesSummary: { type: "string" },
      defaultTemplateContent: { type: "string" },
      defaultSections: { type: "object", additionalProperties: { type: "boolean" } },
    },
  },
};

export const setInstructionTool = {
  name: "set_instruction",
  description:
    "Kullanıcının 'bundan sonra hep böyle yap' türünden kalıcı, gelecekteki TÜM tekliflere uygulanacak bir kural bildirdiğinde çağır (TALİMAT KAYDI kuralı). Tek seferlik bir istek için ÇAĞIRMA.",
  input_schema: {
    type: "object" as const,
    properties: { text: { type: "string", description: "Kısa, net, emir kipiyle yazılmış tekrar kullanılabilir talimat." } },
    required: ["text"],
  },
};

export const setFormatTool = {
  name: "set_format",
  description: "Bu teklif için çıktı formatı (PDF ya da link/HTML) netleştiği HER turda çağır.",
  input_schema: {
    type: "object" as const,
    properties: { value: { type: "string", enum: ["pdf", "html"] } },
    required: ["value"],
  },
};

export const addClientTool = {
  name: "add_client",
  description: "Kullanıcı AÇIKÇA 'müşterilerime ekle' dediğinde çağır — kendiliğinden önerme.",
  input_schema: {
    type: "object" as const,
    properties: { name: { type: "string" }, email: { type: "string" }, website: { type: "string" } },
    required: ["name"],
  },
};

export const saveUserDefaultTool = {
  name: "save_user_default",
  description: "Kullanıcı art arda aynı şablon+formatı kullandığı için bunu kişisel varsayılan yapmayı onayladığında çağır.",
  input_schema: {
    type: "object" as const,
    properties: {
      label: { type: "string" },
      templateId: { type: "string" },
      preferredFormat: { type: "string", enum: ["pdf", "html"] },
    },
    required: ["label"],
  },
};

/** Every "pseudo-tool" the Writer can emit, keyed by name so writer.ts can
 *  dispatch a tool_use block straight to its Zod schema without a big
 *  if/else chain. */
export const pseudoTools = {
  emit_draft: { schema: ProposalDraftSchema, tool: emitDraftTool },
  set_brand: { schema: BrandSchema, tool: setBrandTool },
  set_instruction: { schema: InstructionSchema, tool: setInstructionTool },
  set_format: { schema: FormatSchema, tool: setFormatTool },
  add_client: { schema: AddClientSchema, tool: addClientTool },
  save_user_default: { schema: UserDefaultSchema, tool: saveUserDefaultTool },
} as const;

export type PseudoToolName = keyof typeof pseudoTools;
