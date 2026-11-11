// Password rules for host and admin accounts. Supabase also checks leaked passwords
// when "Leaked password protection" is on (Authentication > Policies).
const COMMON = ["password", "123456", "12345678", "qwerty", "karibu", "kenya", "nairobi", "airbnb", "letmein", "welcome", "iloveyou", "admin"];

export function passwordProblem(pw: string, email = ""): string {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Mix letters and numbers.";
  const low = pw.toLowerCase();
  if (COMMON.some((w) => low.includes(w))) return "Avoid common words like “password” or “karibu”.";
  const user = email.split("@")[0]?.toLowerCase();
  if (user && user.length >= 4 && low.includes(user)) return "Don't use your email name in your password.";
  if (/^(.)\1+$/.test(pw)) return "Avoid repeating one character.";
  return "";
}

/** 0-4 for the strength bar. */
export function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
}
