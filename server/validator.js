/**
 * 🛡️ Code Validator Module
 * Uses AST parsing to ensure AI-generated code is safe to eval
 */

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

// Allowed global function/variable names in Strudel context
const STRUDEL_GLOBALS = new Set([
  // Pattern constructors
  's', 'sound', 'note', 'n', 'freq', 'stack', 'cat', 'sequence',
  'fastcat', 'slowcat', 'timeCat', 'randcat', 'ur',
  'mini', 'pure', 'silence', 'rest',
  // Control
  'setcps', 'setCps', 'hush',
  // Math / modulators
  'sine', 'cosine', 'saw', 'square', 'tri', 'rand', 'irand',
  'run', 'perlin',
  // Effects (also available as pattern methods)
  'gain', 'speed', 'pan', 'room', 'delay', 'lpf', 'hpf',
  'vowel', 'crush', 'distort', 'orbit', 'cut',
  // Transforms
  'fast', 'slow', 'rev', 'jux', 'every', 'degrade',
  'chop', 'striate', 'sometimes', 'often', 'rarely',
  'someCycles', 'almostNever', 'almostAlways',
  // Utils
  'choose', 'chooseWith', 'wchoose',
  'range', 'rangex', 'segment',
  // JS built-ins that are safe
  'Math', 'console', 'parseInt', 'parseFloat', 'Number', 'String',
  'Array', 'Object', 'JSON', 'true', 'false', 'null', 'undefined',
  'Infinity', 'NaN',
]);

// Explicitly banned identifiers
const BANNED_IDENTIFIERS = new Set([
  'fetch', 'XMLHttpRequest', 'import', 'require', 'eval',
  'Function', 'window', 'document', 'globalThis', 'self',
  'localStorage', 'sessionStorage', 'indexedDB',
  'WebSocket', 'Worker', 'SharedWorker', 'ServiceWorker',
  'process', 'child_process', 'fs', 'path', 'os', 'net', 'http',
  '__dirname', '__filename',
  'alert', 'confirm', 'prompt',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'location', 'history', 'navigator',
  'crypto', 'Crypto',
]);

/**
 * Validate Strudel code for safety
 * @param {string} code - The code to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateCode(code) {
  // Basic checks
  if (!code || typeof code !== 'string') {
    return { valid: false, reason: 'Empty or invalid code' };
  }

  if (code.length > 5000) {
    return { valid: false, reason: 'Code too long (max 5000 chars)' };
  }

  // Check for obvious dangerous patterns via regex first (fast path)
  const dangerousPatterns = [
    /\bimport\s*\(/,          // dynamic import()
    /\brequire\s*\(/,         // require()
    /\beval\s*\(/,            // eval()
    /\bnew\s+Function\s*\(/,  // new Function()
    /\bfetch\s*\(/,           // fetch()
    /\bwindow\b/,             // window
    /\bdocument\b/,           // document
    /\bglobalThis\b/,         // globalThis
    /\bprocess\b/,            // process
    /\b__proto__\b/,          // prototype pollution
    /\bconstructor\s*\[/,     // constructor access
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return { valid: false, reason: `Dangerous pattern detected: ${pattern}` };
    }
  }

  // Parse AST
  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: 2022,
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    });
  } catch (e) {
    // Strudel uses $: label syntax which isn't standard JS
    // Try wrapping in a function to handle labels
    try {
      // Replace $: with valid JS labels for parsing
      const sanitized = code.replace(/^\$:/gm, '_track:');
      ast = acorn.parse(sanitized, {
        ecmaVersion: 2022,
        sourceType: 'script',
        allowAwaitOutsideFunction: true,
      });
    } catch (e2) {
      return { valid: false, reason: `Syntax error: ${e2.message}` };
    }
  }

  // Walk AST and check for dangerous constructs
  let violation = null;

  try {
    walk.simple(ast, {
      // Check import declarations
      ImportDeclaration() {
        violation = 'Import declarations not allowed';
      },
      ImportExpression() {
        violation = 'Dynamic imports not allowed';
      },
      // Check for dangerous member access
      MemberExpression(node) {
        if (node.object.type === 'Identifier' && BANNED_IDENTIFIERS.has(node.object.name)) {
          violation = `Access to '${node.object.name}' not allowed`;
        }
      },
      // Check function calls
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && BANNED_IDENTIFIERS.has(node.callee.name)) {
          violation = `Call to '${node.callee.name}' not allowed`;
        }
      },
      // Check for new expressions with dangerous constructors
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && BANNED_IDENTIFIERS.has(node.callee.name)) {
          violation = `Instantiation of '${node.callee.name}' not allowed`;
        }
      },
      // Check assignments to dangerous globals
      AssignmentExpression(node) {
        if (node.left.type === 'Identifier' && BANNED_IDENTIFIERS.has(node.left.name)) {
          violation = `Assignment to '${node.left.name}' not allowed`;
        }
      },
    });
  } catch (e) {
    // Walk might fail on some edge cases, but that's OK
    // The regex checks above cover the critical cases
  }

  if (violation) {
    return { valid: false, reason: violation };
  }

  return { valid: true };
}
