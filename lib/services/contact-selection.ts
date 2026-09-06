import type { Tables } from "@/lib/types/database.types"

export type ContactPriorityTier =
  | "VERIFIED_DECISION_MAKER"
  | "BUSINESS_MANAGER"
  | "GENERAL_CONTACT"
  | "BUSINESS_WHATSAPP"
  | "BUSINESS_EMAIL"
  | "NONE"

export type ContactSelection = {
  contact: Tables<"contacts"> | null
  tier: ContactPriorityTier
  reason: string
  confidence: number
}

const DECISION_MAKER_KEYWORDS = [
  "owner",
  "founder",
  "co-founder",
  "proprietor",
  "principal",
  "director",
  "ceo",
  "cfo",
  "coo",
  "managing director",
]

const MANAGER_KEYWORDS = [
  "manager",
  "head of",
  "general manager",
  "operations",
  "marketing",
  "it manager",
  "digital",
]

function classifyJobTitle(jobTitle: string | null): "decision_maker" | "manager" | "unknown" {
  if (!jobTitle) return "unknown"
  const needle = jobTitle.toLowerCase()
  if (DECISION_MAKER_KEYWORDS.some((k) => needle.includes(k))) return "decision_maker"
  if (MANAGER_KEYWORDS.some((k) => needle.includes(k))) return "manager"
  return "unknown"
}

type BusinessContactFields = Pick<Tables<"businesses">, "whatsapp_number" | "whatsapp_status" | "email">

// Pure, deterministic contact priority ladder (spec section 7):
//   1. a verified decision-maker
//   2. a relevant business manager
//   3. any other named contact on file
//   4. the business's own WhatsApp number
//   5. the business's own email
//   6. nothing usable
// Never fabricates a person: tiers 4/5/6 return contact: null rather
// than inventing a name, and the caller is expected to address the
// business itself in that case.
export function selectBestContact(
  contacts: Tables<"contacts">[],
  business: BusinessContactFields
): ContactSelection {
  const verifiedDecisionMaker = contacts.find(
    (c) => classifyJobTitle(c.job_title) === "decision_maker" && c.verification_status === "VERIFIED"
  )
  if (verifiedDecisionMaker) {
    return {
      contact: verifiedDecisionMaker,
      tier: "VERIFIED_DECISION_MAKER",
      reason: `${verifiedDecisionMaker.name} (${verifiedDecisionMaker.job_title}) is a verified decision-maker.`,
      confidence: 0.9,
    }
  }

  const manager = contacts.find((c) => classifyJobTitle(c.job_title) === "manager")
  if (manager) {
    return {
      contact: manager,
      tier: "BUSINESS_MANAGER",
      reason: `${manager.name} (${manager.job_title}) is a relevant business manager.`,
      confidence: manager.verification_status === "VERIFIED" ? 0.8 : 0.6,
    }
  }

  if (contacts.length > 0) {
    const best = contacts.find((c) => c.verification_status === "VERIFIED") ?? contacts[0]
    return {
      contact: best,
      tier: "GENERAL_CONTACT",
      reason: `${best.name}${best.job_title ? ` (${best.job_title})` : ""} is the best contact on file, though not a confirmed decision-maker or manager.`,
      confidence: best.verification_status === "VERIFIED" ? 0.55 : 0.35,
    }
  }

  if (business.whatsapp_status === "AVAILABLE" && business.whatsapp_number) {
    return {
      contact: null,
      tier: "BUSINESS_WHATSAPP",
      reason: "No named contact is on file - falling back to the business's own WhatsApp number.",
      confidence: 0.5,
    }
  }

  if (business.email) {
    return {
      contact: null,
      tier: "BUSINESS_EMAIL",
      reason: "No named contact is on file - falling back to the business's own email address.",
      confidence: 0.4,
    }
  }

  return {
    contact: null,
    tier: "NONE",
    reason: "No usable contact information is on file for this business.",
    confidence: 0,
  }
}
