// Phone normalization for outreach sending - a distinct concern from
// normalizePhone in normalize.ts (which produces a loose dedup-matching
// key). This produces a strict, WhatsApp-API-ready number or a clear
// rejection reason; it never guesses when a number doesn't cleanly match
// a known format, and it never mutates/discards the original stored
// value - callers keep the raw phone field untouched and only use this
// result for the send itself (see recipient_address on
// outreach_send_attempts, which records exactly what was actually sent
// to, separately from the mutable contact/business record).

export type CountryPhoneConfig = {
  name: string
  /** Country calling code, digits only, no leading +. */
  countryCode: string
  /** Trunk prefix used in local/national dialing, e.g. "0". Empty string if none. */
  nationalTrunkPrefix: string
  /** Length of the national significant number, excluding country code and trunk prefix. */
  nationalSignificantNumberLength: number
}

// Zimbabwe: numbers like 077 1234567 (local), +263 77 1234567 (international).
export const ZIMBABWE: CountryPhoneConfig = {
  name: "Zimbabwe",
  countryCode: "263",
  nationalTrunkPrefix: "0",
  nationalSignificantNumberLength: 9,
}

// Extensible per spec section 7 ("the system may eventually contact
// businesses outside Zimbabwe") - add more configs here rather than
// hard-coding a single country's rules into the parsing logic itself.
export const SUPPORTED_COUNTRIES: CountryPhoneConfig[] = [ZIMBABWE]

export type PhoneNormalizationResult =
  | { valid: true; whatsappFormat: string; e164: string; country: string }
  | { valid: false; reason: string }

function matchNationalSignificantNumber(digits: string, country: CountryPhoneConfig): string | null {
  if (digits.startsWith(country.countryCode)) {
    const rest = digits.slice(country.countryCode.length)
    if (rest.length === country.nationalSignificantNumberLength && !rest.startsWith("0")) {
      return rest
    }
  }
  if (country.nationalTrunkPrefix && digits.startsWith(country.nationalTrunkPrefix)) {
    const rest = digits.slice(country.nationalTrunkPrefix.length)
    if (rest.length === country.nationalSignificantNumberLength) {
      return rest
    }
  }
  if (digits.length === country.nationalSignificantNumberLength) {
    return digits
  }
  return null
}

// Pure, deterministic. Accepts formats like "077...", "+26377...",
// "26377...", or a bare national number - never blindly prepends a
// country code without validating the resulting length. Ambiguity across
// multiple configured countries is a known, documented tradeoff of this
// simplified single-pass matcher (see README) - not an issue while only
// Zimbabwe is configured.
export function normalizePhoneForSending(
  raw: string,
  countries: CountryPhoneConfig[] = SUPPORTED_COUNTRIES
): PhoneNormalizationResult {
  if (!raw || !raw.trim()) {
    return { valid: false, reason: "No phone number provided." }
  }

  const cleaned = raw.trim().replace(/[\s().-]/g, "")
  if (!/^\+?\d+$/.test(cleaned)) {
    return { valid: false, reason: `"${raw}" contains characters that aren't part of a valid phone number.` }
  }

  const digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned

  for (const country of countries) {
    const nsn = matchNationalSignificantNumber(digits, country)
    if (nsn) {
      const whatsappFormat = `${country.countryCode}${nsn}`
      return { valid: true, whatsappFormat, e164: `+${whatsappFormat}`, country: country.name }
    }
  }

  return {
    valid: false,
    reason: `"${raw}" doesn't match a recognized phone format for ${countries.map((c) => c.name).join(", ")}.`,
  }
}
