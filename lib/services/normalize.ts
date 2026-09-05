// Pure normalization helpers used for deduplication. Kept dependency-free
// and side-effect-free so they're directly unit-testable.

export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,'"()]/g, "")
    .replace(/\s+/g, " ")
}

export function normalizeWebsite(website: string): string | null {
  const trimmed = website.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  const path = url.pathname.replace(/\/+$/, "")
  return path && path !== "" ? `${host}${path}` : host
}

export function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim()
  if (!trimmed) return null

  const hasLeadingPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return null

  return hasLeadingPlus ? `+${digits}` : digits
}
