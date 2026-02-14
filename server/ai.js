/**
 * 🤖 AI Code Generation Module
 * Calls DeepSeek API to transform user prompts into Strudel code
 */

import { SYSTEM_PROMPT } from './prompts.js';

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

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
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
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 0.9,
        stream: false
      }),
    });

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

    return code;
  } catch (error) {
    console.error('🔴 AI generation error:', error.message);
    return null;
  }
}

/**
 * Strip markdown code fences from AI output
 */
function stripCodeFences(code) {
  // Remove ```javascript ... ``` or ``` ... ```
  const fenceRegex = /^```(?:javascript|js|strudel)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = code.match(fenceRegex);
  if (match) return match[1].trim();

  // Also handle case where there are multiple code blocks — take the first
  const blockRegex = /```(?:javascript|js|strudel)?\s*\n?([\s\S]*?)\n?\s*```/;
  const blockMatch = code.match(blockRegex);
  if (blockMatch) return blockMatch[1].trim();

  return code;
}

/**
 * Mock code generation for testing without API
 */
function mockGenerate(currentCode, userPrompt) {
  console.log(`🧪 Mock generating for: "${userPrompt}"`);
  // Simple mock: just return the current code with a comment
  return `// 🎵 Modified: ${userPrompt}\n${currentCode}`;
}
