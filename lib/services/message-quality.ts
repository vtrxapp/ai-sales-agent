// Deterministic message quality checks for outreach drafts - personalization
// scoring and validation. Neither is ever AI self-graded: both are pure
// functions of the draft text and the context it was generated from, so a
// draft can never simply declare itself "95% personalized" or "valid."
//
// This is rule-based/heuristic, not semantic understanding - it catches
// what's mechanically checkable (unfilled placeholders, banned generic
// phrases, length, suspicious URLs, a numeric claim untraceable to
// evidence, whether the business/contact/opportunity/service are even
// mentioned). It cannot verify deep semantic accuracy, which is exactly
// why human approval (spec section 17) remains mandatory regardless of
// whether validation passes.

export type MessageQualityContext = {
  channel: "WHATSAPP" | "EMAIL"
  businessName: string
  contactName: string | null
  opportunityTitle: string
  opportunityType: string
  recommendedService: string
  evidenceText: string
  industry: string | null
  city: string | null
  country: string | null
  subject: string | null
  body: string
  // Defaults to INITIAL_OUTREACH behavior when omitted, so every existing
  // call site (cold first-touch drafts) is unaffected. A RESPONSE is a
  // reply within an already-established conversation - it's reasonable
  // for it not to restate the business name or re-cite the original
  // audit evidence the way a cold-outreach message must, and a natural
  // reply can legitimately be shorter than a first-touch message.
  messageType?: "INITIAL_OUTREACH" | "RESPONSE"
}

export type ValidationIssue = {
  code: string
  message: string
}

export type ValidationResult = {
  status: "PASSED" | "FAILED"
  issues: ValidationIssue[]
}

const GENERIC_PHRASES = [
  "i hope this email finds you well",
  "i hope this message finds you well",
  "innovative digital solutions",
  "cutting-edge",
  "cutting edge",
  "state-of-the-art",
  "state of the art",
  "world-class",
  "world class",
  "synergy",
  "revolutionize",
  "game-changer",
  "game changer",
  "unlock your potential",
  "take your business to the next level",
  "we are excited to",
  "dear sir/madam",
  "dear sir or madam",
  "to whom it may concern",
]

const PLACEHOLDER_PATTERN = /\{\{.*?\}\}|\[(name|business|industry|location|contact|company|owner|city|country)\]/i
const URL_PATTERN = /https?:\/\/[^\s)]+/gi
const SUSPICIOUS_NUMBER_PATTERN = /\d{1,3}(?:,\d{3})*(?:\.\d+)?%|\$\s?\d[\d,.]*/g
const CTA_PATTERN = /(open to|interested in|worth a (quick )?chat|worth exploring|mind if|would you be|could we|happy to share)/i

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "have", "this", "that", "recorded", "unknown", "about", "into", "your",
])

function extractSignificantWords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 5 && !STOP_WORDS.has(w))
    )
  )
}

function hasEvidenceOverlap(context: MessageQualityContext): boolean {
  const bodyLower = context.body.toLowerCase()
  return extractSignificantWords(context.evidenceText).some((word) => bodyLower.includes(word))
}

function hasOpportunityTypeOverlap(bodyLower: string, opportunityType: string): boolean {
  return opportunityType
    .toLowerCase()
    .split("_")
    .some((word) => word.length >= 4 && bodyLower.includes(word))
}

export function validateMessage(context: MessageQualityContext): ValidationResult {
  const issues: ValidationIssue[] = []
  const bodyLower = context.body.toLowerCase()
  const fullText = `${context.subject ?? ""} ${context.body}`
  const isResponse = context.messageType === "RESPONSE"

  // A reply within an established conversation isn't cold outreach - it
  // doesn't need to restate the business/contact name or re-cite the
  // original audit evidence every time (spec section 8: avoid
  // "unnecessary paragraphs"/"irrelevant company information" - forcing
  // these in would actively push toward exactly that).
  if (!isResponse && !bodyLower.includes(context.businessName.toLowerCase())) {
    issues.push({ code: "MISSING_BUSINESS_NAME", message: "The message never mentions the business by name." })
  }

  if (!isResponse && context.contactName) {
    const firstName = context.contactName.toLowerCase().split(" ")[0]
    if (!bodyLower.includes(firstName)) {
      issues.push({
        code: "CONTACT_NAME_MISMATCH",
        message: `The message does not address ${context.contactName} by name.`,
      })
    }
  }

  if (PLACEHOLDER_PATTERN.test(fullText)) {
    issues.push({
      code: "UNFILLED_PLACEHOLDER",
      message: "The message contains an unfilled template placeholder (e.g. [Business], {{name}}).",
    })
  }

  const maxLength = context.channel === "WHATSAPP" ? 700 : 1400
  // A genuine reply ("Sure, Tuesday 2pm works!") can be much shorter than
  // a first-touch message still needs to be to plausibly reference real
  // evidence - the response minimum only guards against an empty/broken
  // generation, not against natural brevity.
  const minLength = isResponse ? 8 : context.channel === "WHATSAPP" ? 40 : 80
  if (context.body.length > maxLength) {
    issues.push({
      code: "EXCESSIVE_LENGTH",
      message: `The message is ${context.body.length} characters, longer than the ${maxLength}-character guideline for a first-touch ${context.channel === "WHATSAPP" ? "WhatsApp message" : "email"}.`,
    })
  }
  if (context.body.length < minLength) {
    issues.push({
      code: "TOO_SHORT",
      message: isResponse
        ? "The message looks too short to be a real reply - it may be empty or truncated."
        : "The message is too short to plausibly reference real evidence about this business.",
    })
  }

  const foundGeneric = GENERIC_PHRASES.filter((phrase) => bodyLower.includes(phrase))
  if (foundGeneric.length > 0) {
    issues.push({ code: "GENERIC_LANGUAGE", message: `Contains generic sales language: ${foundGeneric.join(", ")}.` })
  }

  const urls = context.body.match(URL_PATTERN) ?? []
  for (const url of urls) {
    issues.push({
      code: "SUSPICIOUS_URL",
      message: `The message contains a URL (${url}) - first-touch outreach should not include links.`,
    })
  }

  const numberMatches = context.body.match(SUSPICIOUS_NUMBER_PATTERN) ?? []
  for (const match of numberMatches) {
    if (!context.evidenceText.includes(match)) {
      issues.push({
        code: "UNSUPPORTED_STATISTIC",
        message: `The message states a figure ("${match.trim()}") that doesn't appear anywhere in the recorded evidence.`,
      })
    }
  }

  if (!isResponse && !hasEvidenceOverlap(context)) {
    issues.push({
      code: "MISSING_EVIDENCE_ANCHOR",
      message: "The message doesn't appear to reference anything specific from the recorded opportunity evidence.",
    })
  }

  if (context.channel === "EMAIL" && (!context.subject || context.subject.trim().length === 0)) {
    issues.push({ code: "MISSING_SUBJECT", message: "An email draft must have a subject line." })
  }

  return { status: issues.length === 0 ? "PASSED" : "FAILED", issues }
}

export type PersonalizationBreakdown = {
  business_name_reference: number
  evidence_specific_reference: number
  opportunity_specificity: number
  relevant_service_reference: number
  contact_personalization: number
  location_industry_relevance: number
  cta_quality: number
  generic_language_penalty: number
}

// Documented weights, summing to 100 before the generic-language penalty
// (which subtracts, clamped so the score never goes below 0). The server
// always computes this - the AI never states a personalization score.
export const PERSONALIZATION_WEIGHTS = {
  business_name_reference: 15,
  evidence_specific_reference: 20,
  opportunity_specificity: 15,
  relevant_service_reference: 15,
  contact_personalization: 10,
  location_industry_relevance: 10,
  cta_quality: 15,
} as const

const MAX_GENERIC_PENALTY = 20
const NO_CONTACT_PARTIAL_CREDIT = 0.5

export function computePersonalizationScore(context: MessageQualityContext): {
  score: number
  breakdown: PersonalizationBreakdown
} {
  const bodyLower = context.body.toLowerCase()

  const businessNameReference = bodyLower.includes(context.businessName.toLowerCase())
    ? PERSONALIZATION_WEIGHTS.business_name_reference
    : 0

  const evidenceSpecificReference = hasEvidenceOverlap(context) ? PERSONALIZATION_WEIGHTS.evidence_specific_reference : 0

  const opportunitySpecificity =
    bodyLower.includes(context.opportunityTitle.toLowerCase()) || hasOpportunityTypeOverlap(bodyLower, context.opportunityType)
      ? PERSONALIZATION_WEIGHTS.opportunity_specificity
      : 0

  const relevantServiceReference = bodyLower.includes(context.recommendedService.toLowerCase())
    ? PERSONALIZATION_WEIGHTS.relevant_service_reference
    : 0

  const contactPersonalization = context.contactName
    ? bodyLower.includes(context.contactName.toLowerCase().split(" ")[0])
      ? PERSONALIZATION_WEIGHTS.contact_personalization
      : 0
    : Math.round(PERSONALIZATION_WEIGHTS.contact_personalization * NO_CONTACT_PARTIAL_CREDIT)

  const locationIndustryRelevance = [context.city, context.country, context.industry]
    .filter((v): v is string => !!v)
    .some((v) => bodyLower.includes(v.toLowerCase()))
    ? PERSONALIZATION_WEIGHTS.location_industry_relevance
    : 0

  const ctaQuality = CTA_PATTERN.test(context.body) ? PERSONALIZATION_WEIGHTS.cta_quality : 0

  const genericHits = GENERIC_PHRASES.filter((phrase) => bodyLower.includes(phrase)).length
  const genericLanguagePenalty = Math.min(MAX_GENERIC_PENALTY, genericHits * 10)

  const rawTotal =
    businessNameReference +
    evidenceSpecificReference +
    opportunitySpecificity +
    relevantServiceReference +
    contactPersonalization +
    locationIndustryRelevance +
    ctaQuality

  const score = Math.max(0, Math.min(100, Math.round(rawTotal - genericLanguagePenalty)))

  return {
    score,
    breakdown: {
      business_name_reference: businessNameReference,
      evidence_specific_reference: evidenceSpecificReference,
      opportunity_specificity: opportunitySpecificity,
      relevant_service_reference: relevantServiceReference,
      contact_personalization: contactPersonalization,
      location_industry_relevance: locationIndustryRelevance,
      cta_quality: ctaQuality,
      generic_language_penalty: genericLanguagePenalty,
    },
  }
}
