/** GLSL ES preprocessor macro engine (Sprint 3 Task 2) — hand-written C-style macro expansion, no-throw, L3.
 *
 * Security caps (implementer-chosen, conservative):
 * - MAX_EXPANSION_DEPTH = 64: maximum nested macro-expansion depth. Rationale: legit
 *   GLSL uses only a few nesting levels; 64 stops adversarial chains (e.g. M65 -> ... -> M0)
 *   from overflowing the call stack while never triggering on real shaders.
 * - MAX_TOTAL_TOKENS = 65536: maximum total tokens emitted during preprocessing. Rationale:
 *   real shaders emit far fewer tokens; the cap stops exponential-bomb macros
 *   (e.g. D16 doubling to 131072 tokens) from exhausting memory, failing fast with a
 *   line-accurate diagnostic instead of hanging.
 *
 * Diagnostics-as-data: never throws, never touches ErrorSink; all failures return
 * { ok: false, log: formatDiagnostic(line, message) }.
 * Layering (L3): imports only from ../glsl/tokenizer.js sibling (Token, CompileResult,
 * formatDiagnostic, tokenize). No runtime imports from src/gl/*.
 */
import { formatDiagnostic, tokenize } from './tokenizer';
import type { CompileResult, Token } from './tokenizer';

export const MAX_EXPANSION_DEPTH = 64;
export const MAX_TOTAL_TOKENS = 65536;

export type MacroDefinition =
  | { kind: 'object'; name: string; replacement: Token[] }
  | { kind: 'function'; name: string; params: string[]; replacement: Token[] };

export type MacroTable = Map<string, MacroDefinition>;

interface PreprocessorState {
  macroTable: MacroTable;
  expansionDepth: number;
  totalTokensEmitted: number;
  activeVersion: number;
  definedEver: Set<string>;
  undefSet: Set<string>;
}

type DirectiveResult = { ok: true } | { ok: false; errorMessage: string };

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentChar(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

function isValidIdent(name: string): boolean {
  if (name.length === 0 || !isIdentStart(name[0] as string)) return false;
  for (const c of name) if (!isIdentChar(c)) return false;
  return true;
}

function firstWord(s: string): string {
  const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s);
  return m ? (m[0] as string) : '';
}

/** Tokenize a macro body, keeping '#' and '##' as OPERATOR tokens. */
function tokenizeBody(bodyText: string, version: number, line: number): Token[] | null {
  if (bodyText.trim() === '') return [];
  if (!bodyText.includes('#')) {
    const r = tokenize(bodyText, version);
    if (!r.ok) return null;
    return r.tokens.filter((t) => t.kind !== 'EOF').map((t) => ({ ...t, line }));
  }
  const parts = bodyText.split(/(##|#)/g);
  const out: Token[] = [];
  for (const part of parts) {
    if (part === '#' || part === '##') {
      out.push({ kind: 'OPERATOR', text: part, line, column: 1 });
    } else if (part.trim() === '') {
      continue;
    } else {
      const r = tokenize(part, version);
      if (!r.ok) return null;
      for (const t of r.tokens) {
        if (t.kind === 'EOF') continue;
        out.push({ ...t, line });
      }
    }
  }
  return out;
}

function parseDirective(lineText: string, line: number, state: PreprocessorState): DirectiveResult {
  const trimmed = lineText.trim();
  if (!trimmed.startsWith('#')) {
    return { ok: false, errorMessage: formatDiagnostic(line, 'Invalid preprocessor directive', 0) };
  }
  const rest = trimmed.slice(1).trimStart();
  const directiveName = firstWord(rest);
  const directiveArgs = rest.slice(directiveName.length).trimStart();
  if (directiveName === 'define') {
    if (directiveArgs === '') {
      return { ok: false, errorMessage: formatDiagnostic(line, 'Missing macro name in #define', 0) };
    }
    const fnMatch = /^([A-Za-z_][A-Za-z0-9_]*)\(/.exec(directiveArgs);
    if (fnMatch) {
      const name = fnMatch[1] as string;
      const openIdx = directiveArgs.indexOf('(');
      const closeIdx = directiveArgs.indexOf(')', openIdx);
      if (closeIdx < 0) {
        return { ok: false, errorMessage: formatDiagnostic(line, 'Unterminated parameter list in #define', 0) };
      }
      const paramText = directiveArgs.slice(openIdx + 1, closeIdx).trim();
      let params: string[] = [];
      if (paramText !== '') {
        params = paramText.split(',').map((p) => p.trim());
        for (const p of params) {
          if (!isValidIdent(p)) {
            return { ok: false, errorMessage: formatDiagnostic(line, 'Invalid macro parameter name', 0) };
          }
        }
      }
      const bodyText = directiveArgs.slice(closeIdx + 1).trim();
      const body = tokenizeBody(bodyText, state.activeVersion, line);
      if (body === null) {
        return { ok: false, errorMessage: formatDiagnostic(line, 'Invalid macro body in #define', 0) };
      }
      state.macroTable.set(name, { kind: 'function', name, params, replacement: body });
      state.definedEver.add(name);
      return { ok: true };
    }
    const name = firstWord(directiveArgs);
    if (name === '' || !isValidIdent(name)) {
      return { ok: false, errorMessage: formatDiagnostic(line, 'Missing macro name in #define', 0) };
    }
    const bodyText = directiveArgs.slice(name.length).trim();
    const body = tokenizeBody(bodyText, state.activeVersion, line);
    if (body === null) {
      return { ok: false, errorMessage: formatDiagnostic(line, 'Invalid macro body in #define', 0) };
    }
    state.macroTable.set(name, { kind: 'object', name, replacement: body });
    state.definedEver.add(name);
    return { ok: true };
  }
  if (directiveName === 'undef') {
    const name = firstWord(directiveArgs);
    if (name === '') {
      return { ok: false, errorMessage: formatDiagnostic(line, 'Missing identifier in #undef', 0) };
    }
    state.macroTable.delete(name);
    if (state.definedEver.has(name)) state.undefSet.add(name);
    return { ok: true };
  }
  // Task 3 directives (#if/#version/#error/...) pass through harmlessly.
  return { ok: true };
}

function substituteArguments(replacement: Token[], params: string[], args: Token[][], callLine: number): Token[] {
  const resultTokens: Token[] = [];
  let i = 0;
  while (i < replacement.length) {
    const tok = replacement[i] as Token;
    if (tok.text === '#' && i + 1 < replacement.length) {
      const nextTok = replacement[i + 1] as Token;
      const paramIdx = params.indexOf(nextTok.text);
      if (paramIdx >= 0) {
        const argTokens = args[paramIdx] as unknown as Token[];
        const flat = argTokens.map((t) => t.text).join(' ');
        resultTokens.push({ kind: 'IDENTIFIER', text: '"' + flat + '"', line: callLine, column: tok.column });
        i += 2;
        continue;
      }
    }
    if (tok.text === '##' && resultTokens.length > 0 && i + 1 < replacement.length) {
      const prevTok = resultTokens.pop() as Token;
      const nextTok = replacement[i + 1] as Token;
      const pIdx = params.indexOf(nextTok.text);
      const nextRep: Token[] = pIdx >= 0 ? ((args[pIdx] as unknown as Token[]).map((t) => ({ ...t }))) : [{ ...nextTok }];
      if (nextRep.length === 0) {
        resultTokens.push(prevTok);
      } else {
        const first = nextRep[0] as Token;
        const mergedText = prevTok.text + first.text;
        resultTokens.push({ kind: prevTok.kind, text: mergedText, line: callLine, column: prevTok.column });
        for (let k = 1; k < nextRep.length; k++) {
          resultTokens.push({ ...(nextRep[k] as Token), line: callLine });
        }
      }
      i += 2;
      continue;
    }
    const paramIdx = params.indexOf(tok.text);
    if (paramIdx >= 0 && tok.kind === 'IDENTIFIER') {
      const argTokens = args[paramIdx] as unknown as Token[];
      for (const a of argTokens) resultTokens.push({ ...a, line: callLine });
    } else {
      resultTokens.push({ ...tok, line: callLine });
    }
    i += 1;
  }
  return resultTokens;
}

type ExpandOk = { ok: true; tokens: Token[] };
type ExpandFail = { ok: false; errorMessage: string };
type ExpandOutcome = ExpandOk | ExpandFail;

function emitCounted(
  tokens: Token[],
  state: PreprocessorState,
  callLine: number,
): ExpandOutcome {
  const out: Token[] = [];
  for (const t of tokens) {
    out.push(t);
    state.totalTokensEmitted += 1;
    if (state.totalTokensEmitted > MAX_TOTAL_TOKENS) {
      return {
        ok: false,
        errorMessage: formatDiagnostic(callLine, 'Maximum token cap exceeded (65536 tokens)', 0),
      };
    }
  }
  return { ok: true, tokens: out };
}

/** Recursively expand a token list with painted-blue guard. */
function expandList(input: Token[], state: PreprocessorState, disabled: Set<string>, callLine: number): ExpandOutcome {
  const out: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const tok = input[i] as Token;
    if (tok.kind === 'IDENTIFIER' && !disabled.has(tok.text)) {
      if (tok.text === '__LINE__') {
        const lineTok: Token = { kind: 'INT_CONSTANT', text: String(tok.line), line: callLine, column: tok.column };
        const r = emitCounted([lineTok], state, callLine);
        if (!r.ok) return r;
        out.push(...r.tokens);
        i += 1;
        continue;
      }
      const def = state.macroTable.get(tok.text);
      if (def !== undefined) {
        if (state.expansionDepth >= MAX_EXPANSION_DEPTH) {
          return {
            ok: false,
            errorMessage: formatDiagnostic(tok.line, 'Macro expansion depth limit exceeded (64)', 0),
          };
        }
        if (def.kind === 'object') {
          const nextDisabled = new Set(disabled);
          nextDisabled.add(def.name);
          state.expansionDepth += 1;
          const relined = def.replacement.map((t) => ({ ...t, line: tok.line }));
          const r = expandList(relined, state, nextDisabled, tok.line);
          state.expansionDepth -= 1;
          if (!r.ok) return r;
          const c = emitCounted(r.tokens, state, tok.line);
          if (!c.ok) return c;
          out.push(...c.tokens);
          i += 1;
          continue;
        }
        // function macro: require '(' immediately after
        const next = input[i + 1] as Token | undefined;
        if (next === undefined || next.text !== '(') {
          const r = emitCounted([{ ...tok, line: callLine }], state, callLine);
          if (!r.ok) return r;
          out.push(...r.tokens);
          i += 1;
          continue;
        }
        // collect args with paren nesting
        const args: Token[][] = [];
        let current: Token[] = [];
        let depth = 0;
        let j = i + 1;
        let closed = false;
        for (; j < input.length; j++) {
          const t = input[j] as Token;
          if (t.text === '(') {
            depth += 1;
            if (depth > 1) current.push(t);
          } else if (t.text === ')') {
            depth -= 1;
            if (depth === 0) {
              closed = true;
              break;
            }
            current.push(t);
          } else if (t.text === ',' && depth === 1) {
            args.push(current);
            current = [];
          } else {
            current.push(t);
          }
        }
        if (!closed) {
          return {
            ok: false,
            errorMessage: formatDiagnostic(tok.line, 'Unterminated macro argument list for ' + def.name, 0),
          };
        }
        args.push(current);
        // zero-arg call 'F()' yields one empty arg; normalize to zero when no params
        const normArgs: Token[][] =
          def.params.length === 0 && args.length === 1 && (args[0] as Token[]).length === 0 ? [] : args;
        if (normArgs.length !== def.params.length) {
          return {
            ok: false,
            errorMessage: formatDiagnostic(tok.line, 'Macro argument count mismatch for ' + def.name, 0),
          };
        }
        const substituted = substituteArguments(def.replacement, def.params, normArgs, tok.line);
        const nextDisabled = new Set(disabled);
        nextDisabled.add(def.name);
        state.expansionDepth += 1;
        const r = expandList(substituted, state, nextDisabled, tok.line);
        state.expansionDepth -= 1;
        if (!r.ok) return r;
        const c = emitCounted(r.tokens, state, tok.line);
        if (!c.ok) return c;
        out.push(...c.tokens);
        i = j + 1;
        continue;
      }
    }
    const r = emitCounted([{ ...tok, line: tok.line }], state, tok.line);
    if (!r.ok) return r;
    out.push(...r.tokens);
    i += 1;
  }
  return { ok: true, tokens: out };
}

export function runPreprocessor(tokens: Token[], version?: number): CompileResult<Token[]> {
  const state: PreprocessorState = {
    macroTable: new Map(),
    expansionDepth: 0,
    totalTokensEmitted: 0,
    activeVersion: version === 300 ? 300 : 100,
    definedEver: new Set(),
    undefSet: new Set(),
  };
  const verText = state.activeVersion === 300 ? '300' : '100';
  const seed = (text: string): Token[] => {
    const r = tokenize(text, state.activeVersion);
    if (!r.ok) return [];
    return r.tokens.filter((t) => t.kind !== 'EOF');
  };
  state.macroTable.set('GL_ES', { kind: 'object', name: 'GL_ES', replacement: seed('1') });
  state.macroTable.set('__VERSION__', { kind: 'object', name: '__VERSION__', replacement: seed(verText) });
  state.macroTable.set('__FILE__', { kind: 'object', name: '__FILE__', replacement: seed('0') });

  // Strip directives; collect body tokens.
  const body: Token[] = [];
  for (const tok of tokens) {
    if (tok.kind === 'preprocessor') {
      const pr = parseDirective(tok.text, tok.line, state);
      if (!pr.ok) return { ok: false, log: (pr as ExpandFail).errorMessage };
      continue;
    }
    body.push(tok);
  }
  const expanded = expandList(body, state, new Set(), 1);
  if (!expanded.ok) return { ok: false, log: (expanded as ExpandFail).errorMessage };
  const out = (expanded as ExpandOk).tokens;
  // Sprint AC (TEST 2): a use of a name that was defined then undef'd is an
  // undeclared-identifier error naming the use line.
  for (const t of out) {
    if (t.kind === 'IDENTIFIER' && state.undefSet.has(t.text)) {
      return { ok: false, log: formatDiagnostic(t.line, "Undeclared identifier '" + t.text + "'", 0) };
    }
  }
  return { ok: true, tokens: out };
}
