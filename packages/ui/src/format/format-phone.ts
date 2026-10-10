const LOCAL_MOBILE_PATTERN = /^01\d{9}$/;
const COUNTRY_PREFIX = "+88";
const AREA_DIGITS = 5;

/** "+8801712345678" or "01712345678" becomes "01712-345678". Anything else is returned unchanged. */
export function formatPhoneForDisplay(phone: string): string {
  const local = phone.startsWith(COUNTRY_PREFIX) ? phone.slice(COUNTRY_PREFIX.length) : phone;
  if (!LOCAL_MOBILE_PATTERN.test(local)) return phone;
  return `${local.slice(0, AREA_DIGITS)}-${local.slice(AREA_DIGITS)}`;
}
