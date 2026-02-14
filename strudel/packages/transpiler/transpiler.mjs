import { getLeafLocations } from '@strudel/mini';
import { parse } from 'acorn';
import escodegen from 'escodegen';
import { walk } from 'estree-walker';

let widgetMethods = [];
export function registerWidgetType(type) {
  widgetMethods.push(type);
}

let languages = new Map();
// config = { getLocations: (code: string, offset?: number) => number[][] }
// see mondough.mjs for example use
// the language will kick in when the code contains a template literal of type
// example: mondo`...` will use language of type "mondo"
// TODO: refactor tidal.mjs to use this
export function registerLanguage(type, config) {
  languages.set(type, config);
}

export function transpiler(input, options = {}) {
  const {
    wrapAsync = false,
    addReturn = true,
    emitMiniLocations = true,
    emitWidgets = true,
    blockBased = false,
    range = [],
  } = options;

  const comments = [];
  let ast = parse(input, {
    ecmaVersion: 2022,
    allowAwaitOutsideFunction: true,
    locations: true,
    onComment: comments,
  });

  const miniDisableRanges = findMiniDisableRanges(comments, input.length);
  let miniLocations = [];

  // Position offset for block-based evaluation
  let nodeOffset = range && range.length > 0 ? range[0] : 0;

  // Track declarations to add to strudelScope for block-based eval
  let scopeDeclarations = [];

  const collectMiniLocations = (value, node) => {
    const minilang = languages.get('minilang');
    if (minilang) {
      const code = `[${value}]`;
      const locs = minilang.getLocations(code, node.start);
      miniLocations = miniLocations.concat(locs);
    } else {
      const leafLocs = getLeafLocations(`"${value}"`, node.start, input);
      miniLocations = miniLocations.concat(leafLocs);
    }
  };
  let widgets = [];
  let sliders = [];
  let labels = [];

  walk(ast, {
    enter(node, parent /* , prop, index */) {
      // Apply position offset for block-based evaluation
      if (blockBased && node.start !== undefined) {
        node.start = node.start + nodeOffset;
        node.end = node.end + nodeOffset;
      }
      // Collect variable and function declarations for strudelScope (block-based eval)
      if (blockBased && parent?.type === 'Program') {
        if (node.type === 'VariableDeclaration') {
          for (const declarator of node.declarations) {
            if (declarator.id?.name) {
              scopeDeclarations.push(declarator.id.name);
            }
          }
        } else if (node.type === 'FunctionDeclaration' && node.id?.name) {
          scopeDeclarations.push(node.id.name);
        }
      }
      if (isLanguageLiteral(node)) {
        const { name } = node.tag;
        const language = languages.get(name);
        const code = node.quasi.quasis[0].value.raw;
        const offset = node.quasi.start + 1;
        if (emitMiniLocations) {
          const locs = language.getLocations(code, offset);
          miniLocations = miniLocations.concat(locs);
        }
        this.skip();
        return this.replace(languageWithLocation(name, code, offset));
      }
      if (isTemplateLiteral(node, 'tidal')) {
        const raw = node.quasi.quasis[0].value.raw;
        const offset = node.quasi.start + 1;
        if (emitMiniLocations) {
          const stringLocs = collectHaskellMiniLocations(raw, offset);
          miniLocations = miniLocations.concat(stringLocs);
        }
        this.skip();
        return this.replace(tidalWithLocation(raw, offset));
      }
      if (isBackTickString(node, parent)) {
        if (isMiniDisabled(node.start, miniDisableRanges)) {
          return;
        }
        const { quasis } = node;
        const { raw } = quasis[0].value;
        this.skip();
        emitMiniLocations && collectMiniLocations(raw, node);
        return this.replace(miniWithLocation(raw, node));
      }
      if (isStringWithDoubleQuotes(node)) {
        if (isMiniDisabled(node.start, miniDisableRanges)) {
          return;
        }
        const { value } = node;
        this.skip();
        emitMiniLocations && collectMiniLocations(value, node);
        return this.replace(miniWithLocation(value, node));
      }
      if (isSliderFunction(node)) {
        const from = node.arguments[0].start + nodeOffset;
        const to = node.arguments[0].end + nodeOffset;
        const id = `${from}:${to}`; // Range-based ID for stability

        const sliderConfig = {
          from,
          to,
          id,
          value: node.arguments[0].raw, // don't use value!
          min: node.arguments[1]?.value ?? 0,
          max: node.arguments[2]?.value ?? 1,
          step: node.arguments[3]?.value,
          type: 'slider',
        };
        emitWidgets && widgets.push(sliderConfig);
        sliders.push(sliderConfig);
        return this.replace(sliderWithLocation(node, nodeOffset));
      }
      if (isWidgetMethod(node)) {
        const type = node.callee.property.name;
        const index = widgets.filter((w) => w.type === type).length;
        const widgetConfig = {
          from: node.start,
          to: node.end,
          index,
          type,
          id: options.id,
        };
        emitWidgets && widgets.push(widgetConfig);
        return this.replace(widgetWithLocation(node, widgetConfig));
      }
      if (isBareSamplesCall(node, parent)) {
        return this.replace(withAwait(node));
      }
      if (isLabelStatement(node)) {
        // Collect label info for block-based evaluation
        // Store positions WITHOUT offset so repl can slice the transpiler output correctly
        if (blockBased) {
          labels.push({
            name: node.label.name,
            index: node.start - nodeOffset,
            end: node.label.end - nodeOffset,
            fullMatch: input.slice(node.start - nodeOffset, node.label.end - nodeOffset),
            activeVisualizer: findVisualizerInSubtree(node.body),
          });
        }
        return this.replace(labelToP(node));
      }
      // Detect all() calls as special labels for block management
      // Store positions WITHOUT offset so repl can slice the transpiler output correctly
      if (blockBased && isAllCall(node)) {
        labels.push({
          name: 'all',
          index: node.start - nodeOffset,
          end: node.end - nodeOffset,
          fullMatch: input.slice(node.start - nodeOffset, node.end - nodeOffset),
          activeVisualizer: node.arguments[0] ? findVisualizerInSubtree(node.arguments[0]) : null,
        });
      }
    },

    leave(node, parent, prop, index) {
      if (!isKabelCall(node)) return;

      let [expr, ...rest] = node.arguments;
      if (!expr) throw new Error('K(...) requires an expression');

      if (shouldCallKabelExpression(expr)) {
        expr = {
          type: 'CallExpression',
          callee: expr,
          arguments: [],
          optional: false,
        };
      }

      const { template, patternExprs } = extractPatternPlaceholders(expr);
      if (patternExprs.length) {
        const workletArgs = [{ type: 'Literal', value: template }, ...patternExprs, ...rest];

        let callee = node.callee;
        if (callee.type === 'ChainExpression') callee = callee.expression;
        if (callee.type === 'MemberExpression') {
          return this.replace({
            type: 'CallExpression',
            callee: workletMemberAst(callee.object),
            arguments: workletArgs,
            optional: false,
          });
        }
        return this.replace({
          type: 'CallExpression',
          callee: { type: 'Identifier', name: 'worklet' },
          arguments: workletArgs,
          optional: false,
        });
      }

      const kabelSrc = genExprSource(expr);
      const workletArgs = [{ type: 'Literal', value: kabelSrc }, ...rest];

      let callee = node.callee;
      if (callee.type === 'ChainExpression') callee = callee.expression;
      if (callee.type === 'MemberExpression') {
        return this.replace({
          type: 'CallExpression',
          callee: workletMemberAst(callee.object),
          arguments: workletArgs,
          optional: false,
        });
      }
      return this.replace({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'worklet' },
        arguments: workletArgs,
        optional: false,
      });
    },
  });

  let { body } = ast;

  const silenceExpression = {
    type: 'ExpressionStatement',
    expression: {
      type: 'Identifier',
      name: 'silence',
    },
  };

  if (!body.length) {
    console.warn('empty body -> fallback to silence');
    body.push(silenceExpression);
  } else if (!body?.[body.length - 1]?.expression) {
    // Last statement is not an expression (e.g., VariableDeclaration, FunctionDeclaration)
    if (blockBased) {
      // For block-based eval, add silence as the return value when block ends with declaration
      body.push(silenceExpression);
    } else {
      throw new Error('unexpected ast format without body expression');
    }
  }

  // For block-based eval, add scope assignments before the return statement
  // This allows variables/functions defined in one block to be used in other blocks
  if (blockBased && scopeDeclarations.length > 0) {
    const scopeAssignments = scopeDeclarations.flatMap((name) => createScopeAssignment(name));
    // Insert scope assignments before the last statement (which will become the return)
    body.splice(body.length - 1, 0, ...scopeAssignments);
  }

  // add return to last statement
  if (addReturn) {
    const { expression } = body[body.length - 1];
    body[body.length - 1] = {
      type: 'ReturnStatement',
      argument: expression,
    };
  }
  let output = escodegen.generate(ast);
  if (wrapAsync) {
    output = `(async ()=>{${output}})()`;
  }
  if (!emitMiniLocations) {
    return { output };
  }
  return { output, miniLocations, widgets, sliders, labels };
}

function isKabelCall(node) {
  if (node.type !== 'CallExpression') return false;
  let callee = node.callee;
  if (callee.type === 'ChainExpression') callee = callee.expression;
  if (callee.type === 'MemberExpression') return !callee.computed && callee.property?.name === 'K';
  return callee.type === 'Identifier' && callee.name === 'K';
}

function shouldCallKabelExpression(expr) {
  if (expr.type !== 'ArrowFunctionExpression' && expr.type !== 'FunctionExpression') {
    return false;
  }
  if (expr.params.length) {
    return false;
  }
  return expr.body?.type === 'BlockStatement';
}

function genExprSource(expr) {
  return escodegen.generate(expr, { format: { semicolons: false } });
}

function extractPatternPlaceholders(expr) {
  const templateExpr = cloneNode(expr);
  const parents = new Map();
  const targets = [];

  walk(templateExpr, {
    enter(node, parent, prop, index) {
      parents.set(node, { parent, prop, index });
      const patternExpr = getStrudelPatternExpr(node);
      if (patternExpr) {
        targets.push({ node, patternExpr });
        this.skip();
      }
    },
  });

  if (!targets.length) {
    return { template: genExprSource(templateExpr), patternExprs: [] };
  }

  targets.sort((a, b) => getPatternNodeOrder(a.node) - getPatternNodeOrder(b.node));

  const patternExprs = targets.map(({ patternExpr }) => cloneNode(patternExpr));

  let currentExpr = templateExpr;
  targets.forEach(({ node }, index) => {
    currentExpr = replaceNode(node, placeholderAst(index), parents, currentExpr);
  });

  const template = genExprSource(currentExpr);
  return { template, patternExprs };
}

function getStrudelPatternExpr(node) {
  if (isStrudelPatternWrap(node)) {
    const arg = node.arguments?.[0];
    if (!arg) {
      throw new Error('S(...) requires an argument');
    }
    return arg;
  }
  if (isMiniCall(node)) {
    return node;
  }
  return null;
}

function isStrudelPatternWrap(node) {
  if (node.type !== 'CallExpression') {
    return false;
  }
  const callee = node.callee;
  if (callee.type === 'Identifier') {
    return callee.name === 'S';
  }
  if (callee.type === 'MemberExpression' && !callee.computed) {
    return callee.property?.name === 'S';
  }
  return false;
}

function getMinilangName() {
  const minilang = languages.get('minilang');
  return minilang?.name || 'm';
}

// Used to identify transpiled `m(...)` calls for proper conversion
// to, say, kabelsalat placeholders
function isMiniCall(node) {
  if (node.type !== 'CallExpression') {
    return false;
  }
  const callee = node.callee;
  if (callee.type !== 'Identifier') {
    return false;
  }
  if (callee.name !== getMinilangName()) {
    return false;
  }
  const firstArg = node.arguments?.[0];
  return firstArg?.type === 'Literal' && typeof firstArg.value === 'string';
}

// If `start` is available, we use it. If it's already been transpiled
// to `m(...)`, use the provided offset
function getPatternNodeOrder(node) {
  if (typeof node.start === 'number') {
    return node.start;
  }
  if (isMiniCall(node)) {
    const offsetArg = node.arguments?.[1];
    if (offsetArg?.type === 'Literal' && typeof offsetArg.value === 'number') {
      return offsetArg.value;
    }
  }
  return 0;
}

function placeholderAst(index) {
  return {
    type: 'MemberExpression',
    object: { type: 'Identifier', name: 'pat' },
    property: { type: 'Literal', value: index },
    computed: true,
    optional: false,
  };
}

function replaceNode(node, replacement, parents, currentRoot) {
  const info = parents.get(node);
  if (!info || !info.parent) {
    return replacement;
  }

  const { parent, prop, index } = info;
  if (Array.isArray(parent[prop])) {
    parent[prop][index] = replacement;
  } else {
    parent[prop] = replacement;
  }
  parents.set(replacement, { parent, prop, index });
  return currentRoot;
}

function cloneNode(node) {
  return JSON.parse(JSON.stringify(node));
}

function workletMemberAst(objectExpr) {
  return {
    type: 'MemberExpression',
    object: objectExpr,
    property: { type: 'Identifier', name: 'worklet' },
    computed: false,
    optional: false,
  };
}

function isStringWithDoubleQuotes(node, locations, code) {
  if (node.type !== 'Literal') {
    return false;
  }
  return node.raw[0] === '"';
}

function isBackTickString(node, parent) {
  return node.type === 'TemplateLiteral' && parent.type !== 'TaggedTemplateExpression';
}

function miniWithLocation(value, node) {
  const { start: fromOffset } = node;

  const minilang = languages.get('minilang');
  let name = 'm';
  if (minilang && minilang.name) {
    name = minilang.name; // name is expected to be exported from the package of the minilang
  }

  return {
    type: 'CallExpression',
    callee: {
      type: 'Identifier',
      name,
    },
    arguments: [
      { type: 'Literal', value },
      { type: 'Literal', value: fromOffset },
    ],
    optional: false,
  };
}

// these functions are connected to @strudel/codemirror -> slider.mjs
// maybe someday there will be pluggable transpiler functions, then move this there
function isSliderFunction(node) {
  return node.type === 'CallExpression' && node.callee.name === 'slider';
}

function isWidgetMethod(node) {
  return node.type === 'CallExpression' && widgetMethods.includes(node.callee.property?.name);
}

function sliderWithLocation(node, nodeOffset = 0) {
  // Apply nodeOffset for block-based evaluation to generate correct range
  const from = node.arguments[0].start + nodeOffset;
  const to = node.arguments[0].end + nodeOffset;

  // Use range-based ID for stability during block evaluation
  const id = `${from}:${to}`;

  // add loc as identifier to first argument
  // the sliderWithID function is assumed to be sliderWithID(id, value, min?, max?)
  node.arguments.unshift({
    type: 'Literal',
    value: id,
    raw: id,
  });
  node.callee.name = 'sliderWithID';
  return node;
}

export function getWidgetID(widgetConfig) {
  // the widget id is used as id for the dom element + as key for eventual resources
  // for example, for each scope widget, a new analyser + buffer (large) is created
  // Update: use range-based ID generation for better stability during block evaluation
  // When we have both from and to, use them together for stability
  // Otherwise fall back to position-based ID for backward compatibility
  let uniqueIdentifier;
  if (widgetConfig.from !== undefined && widgetConfig.to !== undefined) {
    // Use range for more stable identification
    uniqueIdentifier = `${widgetConfig.from}-${widgetConfig.to}`;
  } else {
    // Fallback to single position (for backward compatibility)
    uniqueIdentifier = widgetConfig.to || widgetConfig.from || 0;
  }
  const baseId = `${widgetConfig.id || ''}_widget_${widgetConfig.type}`;
  return `${baseId}_${widgetConfig.index}_${uniqueIdentifier}`;
}

function widgetWithLocation(node, widgetConfig) {
  const id = getWidgetID(widgetConfig);
  // Store the unique ID back into the config so it's available for widget management
  // This is critical for block-based evaluation to match existing widgets with new ones
  widgetConfig.id = id;
  // add loc as identifier to first argument
  // the sliderWithID function is assumed to be sliderWithID(id, value, min?, max?)
  node.arguments.unshift({
    type: 'Literal',
    value: id,
    raw: id,
  });
  return node;
}

function isBareSamplesCall(node, parent) {
  return node.type === 'CallExpression' && node.callee.name === 'samples' && parent.type !== 'AwaitExpression';
}

function isAllCall(node) {
  return node.type === 'CallExpression' && node.callee.name === 'all';
}

function withAwait(node) {
  return {
    type: 'AwaitExpression',
    argument: node,
  };
}

function isLabelStatement(node) {
  return node.type === 'LabeledStatement';
}

// converts label expressions to p calls: "x: y" to "y.p('x')"
// see https://codeberg.org/uzu/strudel/issues/990
function labelToP(node) {
  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: node.body.expression,
        property: {
          type: 'Identifier',
          name: 'p',
        },
      },
      arguments: [
        {
          type: 'Literal',
          value: node.label.name,
          raw: `'${node.label.name}'`,
        },
      ],
    },
  };
}

function isLanguageLiteral(node) {
  return node.type === 'TaggedTemplateExpression' && languages.has(node.tag.name);
}

// tidal highlighting
// this feels kind of stupid, when we also know the location inside the string op (tidal.mjs)
// but maybe it's the only way

function isTemplateLiteral(node, value) {
  return node.type === 'TaggedTemplateExpression' && node.tag.name === value;
}

function collectHaskellMiniLocations(haskellCode, offset) {
  return haskellCode
    .split('')
    .reduce((acc, char, i) => {
      if (char !== '"') {
        return acc;
      }
      if (!acc.length || acc[acc.length - 1].length > 1) {
        acc.push([i + 1]);
      } else {
        acc[acc.length - 1].push(i);
      }
      return acc;
    }, [])
    .map(([start, end]) => {
      const miniString = haskellCode.slice(start, end);
      return getLeafLocations(`"${miniString}"`, offset + start - 1);
    })
    .flat();
}

function tidalWithLocation(value, offset) {
  return {
    type: 'CallExpression',
    callee: {
      type: 'Identifier',
      name: 'tidal',
    },
    arguments: [
      { type: 'Literal', value },
      { type: 'Literal', value: offset },
    ],
    optional: false,
  };
}

function languageWithLocation(name, value, offset) {
  return {
    type: 'CallExpression',
    callee: {
      type: 'Identifier',
      name: name,
    },
    arguments: [
      { type: 'Literal', value },
      { type: 'Literal', value: offset },
    ],
    optional: false,
  };
}

// List of non-inline widgets that need cleanup
// These are Pattern.prototype methods that create persistent visualizations
// (should be repalced by a function call producing an actual list of registered widgets)
const nonInlineWidgets = ['punchcard', 'spiral', 'scope', 'pitchwheel', 'spectrum', 'pianoroll', 'wordfall'];

function isVisualizerCall(node) {
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    nonInlineWidgets.includes(node.callee.property?.name)
  ) {
    return node.callee.property.name;
  }
  return null;
}

function findVisualizerInSubtree(node) {
  if (!node || typeof node !== 'object') return null;

  // Check if this node is a visualizer call
  const viz = isVisualizerCall(node);
  if (viz) return viz;

  // Recursively search children
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue; // Skip parent references to avoid cycles
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findVisualizerInSubtree(item);
        if (found) return found;
      }
    } else if (child && typeof child === 'object' && child.type) {
      const found = findVisualizerInSubtree(child);
      if (found) return found;
    }
  }
  return null;
}

// Creates AST nodes for: userDefinedKeys.add('name'); strudelScope.name = name; globalThis.name = name;
// Used in block-based evaluation to persist variables/functions across blocks
// We add to both strudelScope (for internal lookups) and globalThis (for direct access)
// We also track the key in userDefinedKeys so clearScope() can remove it later
function createScopeAssignment(name) {
  return [
    // userDefinedKeys.add('name');
    {
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: {
            type: 'Identifier',
            name: 'userDefinedKeys',
          },
          property: {
            type: 'Identifier',
            name: 'add',
          },
          computed: false,
        },
        arguments: [
          {
            type: 'Literal',
            value: name,
          },
        ],
      },
    },
    // strudelScope.name = name;
    {
      type: 'ExpressionStatement',
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: {
          type: 'MemberExpression',
          object: {
            type: 'Identifier',
            name: 'strudelScope',
          },
          property: {
            type: 'Identifier',
            name: name,
          },
          computed: false,
        },
        right: {
          type: 'Identifier',
          name: name,
        },
      },
    },
    // globalThis.name = name;
    {
      type: 'ExpressionStatement',
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: {
          type: 'MemberExpression',
          object: {
            type: 'Identifier',
            name: 'globalThis',
          },
          property: {
            type: 'Identifier',
            name: name,
          },
          computed: false,
        },
        right: {
          type: 'Identifier',
          name: name,
        },
      },
    },
  ];
}

function findMiniDisableRanges(comments, codeEnd) {
  const ranges = [];
  const stack = []; // used to track on/off pairs
  for (const comment of comments) {
    const value = comment.value.trim();
    if (value.startsWith('mini-off')) {
      stack.push(comment.start);
    } else if (value.startsWith('mini-on')) {
      const start = stack.pop();
      ranges.push([start, comment.end]);
    }
  }
  while (stack.length) {
    // If no closing mini-on is found, just turn it off until `codeEnd`
    const start = stack.pop();
    ranges.push([start, codeEnd]);
  }
  return ranges;
}

function isMiniDisabled(offset, miniDisableRanges) {
  for (const [start, end] of miniDisableRanges) {
    if (offset >= start && offset < end) {
      return true;
    }
  }
  return false;
}
