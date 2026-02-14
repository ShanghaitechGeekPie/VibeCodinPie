/**
 * 🛡️ Content Moderation Module
 * Simple keyword-based content filtering for audience prompts
 */

// Blocked keywords (case insensitive)
const BLOCKED_KEYWORDS = [
  // Inappropriate content
  '色情', '暴力', '赌博', '毒品',
  'porn', 'xxx', 'nsfw', 'kill', 'die', 'murder',
  'hack', 'exploit', 'inject', 'xss', 'sql',
  // Code injection attempts
  'eval(', 'require(', 'import(', 'fetch(',
  'window.', 'document.', 'process.',
  '<script', 'javascript:',
  '__proto__', 'constructor',
];

// Blocked regex patterns
const BLOCKED_PATTERNS = [
  /https?:\/\//i,          // URLs
  /\b\d{11}\b/,            // Phone numbers
  /<\/?[a-z][\s\S]*>/i,   // HTML tags
];

/**
 * Check if a prompt is appropriate
 * @param {string} prompt - The user's prompt
 * @returns {boolean} true if the prompt is OK, false if it should be blocked
 */
export function moderatePrompt(prompt) {
  const lower = prompt.toLowerCase();

  // Check blocked keywords
  for (const keyword of BLOCKED_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return false;
    }
  }

  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(prompt)) {
      return false;
    }
  }

  return true;
}
