/**
 * 🤖 AI Code Generation Module
 * Calls DeepSeek API to transform user prompts into Strudel code
 */

import { buildSystemPrompt } from './prompts.js';

const API_URL = 'https://api.deepseek.com/chat/completions';

// Read env vars lazily (after dotenv has loaded)
function getApiKey() { return process.env.DEEPSEEK_API_KEY; }
function getModel() { return process.env.AI_MODEL || 'deepseek-chat'; }

// Startup check (deferred so dotenv has time to load)
setTimeout(() => {
  const key = getApiKey();
  if (!key) {
    console.error('❌ DEEPSEEK_API_KEY is missing from environment variables!');
  } else {
    console.log(`✅ DeepSeek AI Ready (Key: ${key.substring(0, 8)}..., Model: ${getModel()})`);
  }
}, 0);

/**
 * Generate new Strudel code based on current code and user prompt
 * @param {string} currentCode - The currently running Strudel code
 * @param {string} userPrompt - The user's natural language request
 * @returns {string|null} - New Strudel code, or null on failure
 */
export async function generateCode(currentCode, userPrompt) {
  const apiKey = getApiKey();
  const model = getModel();

  if (!apiKey) {
    console.warn('⚠️  DEEPSEEK_API_KEY not configured, using mock generation');
    return mockGenerate(currentCode, userPrompt);
  }

  console.log(`📤 Sending to DeepSeek (model: ${model}, code length: ${currentCode.length})`);

  const systemPrompt = buildSystemPrompt();

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Here is the current Strudel code:

\`\`\`javascript
${currentCode}
\`\`\`

User Request: ${userPrompt}

Please modify the code to satisfy the user's request. Output ONLY the valid executable Strudel code. Do not include markdown fences or explanation.`,
    },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
        top_p: 0.85,
        stream: false
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let code = data.choices?.[0]?.message?.content?.trim();

    if (!code) {
      throw new Error('Empty response from AI');
    }

    // Strip markdown code fences if present (DeepSeek often adds them despite instructions)
    code = stripCodeFences(code);

    // Ensure register() calls are at the top (AI sometimes puts them at the bottom)
    code = hoistRegistrations(code);

    // Ensure all needed helper registrations are present
    code = ensureHelpers(code);

    return code;
  } catch (error) {
    console.error('🔴 AI generation error:', error.message);
    if (error.cause) {
      console.error('   ↳ Cause:', error.cause);
    }
    return null;
  }
}

/**
 * Strip markdown code fences from AI output
 */
function stripCodeFences(code) {
  if (!code) return '';
  
  // 1. Try to match standard markdown code blocks
  // Matches ```javascript ... ``` or ``` ... ``` (multiline)
  const fenceRegex = /```(?:javascript|js|strudel)?\s*\n?([\s\S]*?)\n?\s*```/;
  const match = code.match(fenceRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // 2. If no fences, but code starts with "javascript" or similar (sometimes AI forgets the backticks but writes the language name)
  if (code.startsWith('javascript\n')) {
    return code.replace(/^javascript\n/, '').trim();
  }

  // 3. Fallback: return raw code
  return code.trim();
}

/**
 * Ensure helper register() calls are present when their functions are used.
 * AI sometimes uses .rlpf() or .trancegate() without registering them.
 */
function ensureHelpers(code) {
  const helpers = {
    rlpf: "register('rlpf', (x, pat) => pat.lpf(pure(x).mul(12).pow(4)))",
    rhpf: "register('rhpf', (x, pat) => pat.hpf(pure(x).mul(12).pow(4)))",
    trancegate: "register('trancegate', (density, seed, length, x) =>\n  x.struct(rand.mul(density).round().seg(16).rib(seed, length)).fill(0.8).clip(0.8)\n)",
  };

  const missing = [];
  for (const [name, registration] of Object.entries(helpers)) {
    // Check if function is used (as .name( or as a standalone call)
    const usagePattern = new RegExp(`\\.${name}\\(|\\b${name}\\(`);
    const registerPattern = new RegExp(`register\\s*\\(\\s*['"]${name}['"]`);
    if (usagePattern.test(code) && !registerPattern.test(code)) {
      missing.push(registration);
    }
  }

  if (missing.length === 0) return code;

  // Insert after setcpm line
  const lines = code.split('\n');
  const setcpmIdx = lines.findIndex(l => /^setcpm\(|^setCpm\(|^setcps\(/.test(l));
  if (setcpmIdx >= 0) {
    lines.splice(setcpmIdx + 1, 0, '', ...missing);
    return lines.join('\n');
  }

  // No setcpm — prepend
  return [...missing, '', code].join('\n');
}

/**
 * Ensure register() calls appear before any $: tracks that use them.
 * AI sometimes places them at the bottom.
 */
function hoistRegistrations(code) {
  const lines = code.split('\n');
  const registerLines = [];
  const otherLines = [];

  // Collect contiguous register blocks (may span multiple lines)
  let inRegister = false;
  for (const line of lines) {
    if (line.startsWith('register(') || line.startsWith("register('")) {
      inRegister = true;
      registerLines.push(line);
    } else if (inRegister && (line.startsWith('  ') || line.startsWith(')') || line.trim() === '')) {
      // Continuation of a multi-line register or blank line between registers
      if (line.trim() === '' && registerLines.length > 0) {
        registerLines.push(line);
      } else if (line.startsWith(')') || line.startsWith('  ')) {
        registerLines.push(line);
      } else {
        inRegister = false;
        otherLines.push(line);
      }
    } else {
      inRegister = false;
      otherLines.push(line);
    }
  }

  if (registerLines.length === 0) return code;

  // Remove trailing blank lines from register block
  while (registerLines.length > 0 && registerLines[registerLines.length - 1].trim() === '') {
    registerLines.pop();
  }
  // Remove leading blank lines from other block
  while (otherLines.length > 0 && otherLines[0].trim() === '') {
    otherLines.shift();
  }

  // Find the setcpm line and insert registers right after it
  const setcpmIdx = otherLines.findIndex(l => l.startsWith('setcpm(') || l.startsWith('setCpm(') || l.startsWith('setcps('));
  if (setcpmIdx >= 0) {
    otherLines.splice(setcpmIdx + 1, 0, '', ...registerLines, '');
    return otherLines.join('\n');
  }

  // No setcpm found — just prepend
  return [...registerLines, '', ...otherLines].join('\n');
}

/**
 * Mock code generation for testing without API
 */
function mockGenerate(currentCode, userPrompt) {
  console.log(`🧪 Mock generating for: "${userPrompt}"`);
  // Simple mock: just return the current code with a comment
  return `// 🎵 Modified: ${userPrompt}\n${currentCode}`;
}
