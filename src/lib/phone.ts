/** O'zbekiston raqamini +998XXXXXXXXX ko'rinishiga keltiradi. Noto'g'ri bo'lsa null. */
export function normalizeUzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return null;
}

export function formatUzPhone(normalized: string): string {
  const d = normalized.replace(/\D/g, "");
  if (d.length !== 12) return normalized;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}
