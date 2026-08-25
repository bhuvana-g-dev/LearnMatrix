// Catches the most common "fat-fingered" email domains at signup time —
// things like gmial.com, gmal.com, gnail.com, yahho.com — and suggests
// the likely intended domain. This is a lightweight nudge, not a
// guarantee the mailbox exists (that's still enforced by the real
// verification-link flow in VerifyEmailScreen).

const KNOWN_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "rediffmail.com",
  "icloud.com",
  "protonmail.com",
  "live.com",
];

// A short hand-picked list of the typos we actually see, mapped straight
// to the intended domain — cheaper and more predictable than computing
// edit-distance against every known domain for every keystroke.
const KNOWN_TYPOS = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmailcom": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.comm": "gmail.com",
  "yahoo.con": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "hotmial.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
};

// Classic Levenshtein edit distance — used as a fallback so a typo we
// haven't hand-listed (e.g. "gmaul.com") can still be caught if it's
// one or two edits away from a known domain.
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Given a full email address, returns a corrected email string if the
 * domain looks like a likely typo of a well-known provider, or null if
 * the domain looks fine (or isn't close enough to guess confidently).
 */
export function suggestEmailCorrection(email) {
  const trimmed = (email || "").trim();
  const at = trimmed.lastIndexOf("@");
  if (at === -1) return null;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!local || !domain) return null;

  // Already a known-good domain — nothing to suggest.
  if (KNOWN_DOMAINS.includes(domain)) return null;

  if (KNOWN_TYPOS[domain]) {
    return `${local}@${KNOWN_TYPOS[domain]}`;
  }

  // Fallback: is this domain within 2 edits of a known domain?
  let best = null;
  let bestDist = Infinity;
  for (const known of KNOWN_DOMAINS) {
    const dist = editDistance(domain, known);
    if (dist < bestDist) {
      bestDist = dist;
      best = known;
    }
  }
  if (best && bestDist > 0 && bestDist <= 2) {
    return `${local}@${best}`;
  }

  return null;
}
