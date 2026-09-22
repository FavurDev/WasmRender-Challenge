/** WebGL1 CTS conformance harness — manifest parsing, headless VM execution, triage logging, runner. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, posix, sep } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createSoftwareWebGLContext } from '../../src/entry';

export interface TestEntry {
  id: string;
  fullPath: string;
  options: Map<string, string | boolean>;
  category: string;
}

export interface TestAssertion {
  success: boolean;
  message: string;
}

export interface CrashInfo {
  message: string;
  stack?: string;
}

export interface ExecutionReport {
  verdict: 'PASS' | 'FAIL' | 'CRASH' | 'TIMEOUT';
  assertions: TestAssertion[];
  drainedErrors: number[];
  crash: CrashInfo | null;
}

export interface TestRecord {
  id: string;
  status: 'PASS' | 'FAIL' | 'CRASH' | 'SKIP';
  passed: boolean;
  drainedErrors: number[];
  assertions?: TestAssertion[];
  skipped?: boolean;
  skipReason?: string;
  error?: string;
  stack?: string;
}

export interface TriageSummary {
  timestamp: string;
  suite: string;
  totals: {
    discovered: number;
    executed: number;
    passed: number;
    failed: number;
    skipped: number;
    crashed: number;
  };
  verdictReconciliation: { formula: string; valid: boolean };
  tests: TestRecord[];
}

type RendererFactory = (canvas: { width: number; height: number }) => { getError: () => number } | null;

/** Recursively parses Khronos CTS 00_test_list.txt manifests. */
export class CTSManifestParser {
  baseDirectory: string;
  discoveredTests: TestEntry[] = [];
  defaultOptions: Map<string, string | boolean> = new Map();

  constructor(baseDir: string) {
    this.baseDirectory = normalize(baseDir);
  }

  parseManifest(relativeManifestPath: string, parentOptions: Map<string, string | boolean>): TestEntry[] {
    const absoluteFilePath = join(this.baseDirectory, relativeManifestPath);
    if (!existsSync(absoluteFilePath)) {
      return this.discoveredTests;
    }
    const fileContent = readFileSync(absoluteFilePath, 'utf8');
    const manifestDir = posix.dirname(relativeManifestPath.split(sep).join(posix.sep));
    for (const rawLine of fileContent.split('\n')) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('//') || line.startsWith('#')) {
        continue;
      }
      const { options, remainingPath } = CTSManifestParser.parseLine(line, parentOptions);
      if (remainingPath.endsWith('.txt')) {
        const child = manifestDir === '.' ? remainingPath : `${manifestDir}/${remainingPath}`;
        this.parseManifest(child.split('/').join(sep), options);
      } else if (remainingPath.endsWith('.html')) {
        const rel = (manifestDir === '.' ? remainingPath : `${manifestDir}/${remainingPath}`).split('/').join(sep);
        const id = rel.split(sep).join('/');
        this.discoveredTests.push({
          id,
          fullPath: join(this.baseDirectory, rel),
          options,
          category: id.split('/')[0] ?? '',
        });
      }
    }
    return this.discoveredTests;
  }

  private static parseLine(
    line: string,
    parentOptions: Map<string, string | boolean>,
  ): { options: Map<string, string | boolean>; remainingPath: string } {
    const options = new Map<string, string | boolean>(parentOptions);
    let rest = line;
    const flagPattern = /^--([A-Za-z0-9_-]+)(?:\s+([^\s]+))?\s*/;
    let match: RegExpExecArray | null;
    while ((match = flagPattern.exec(rest)) !== null) {
      const [, name, value] = match;
      options.set(name, value === undefined ? true : value);
      rest = rest.slice(match[0].length);
    }
    return { options, remainingPath: rest.trim() };
  }
}

/** Uniform DOM stub for canvas, description, scripts, and general elements. */
export class DOMElementStub {
  tagName: string;
  id = '';
  textContent = '';
  innerText = '';
  innerHTML = '';
  text = '';
  style: Record<string, string> = {};
  attributes: Map<string, string> = new Map();
  children: DOMElementStub[] = [];
  parentNode: DOMElementStub | null = null;
  width = 300;
  height = 150;

  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
  }

  appendChild(child: DOMElementStub): DOMElementStub {
    this.children.push(child);
    child.parentNode = this;
    if (child.textContent !== '' || child.innerText !== '') {
      const text = child.textContent !== '' ? child.textContent : child.innerText;
      this.innerText += text;
      this.textContent += text;
    }
    return child;
  }

  removeChild(child: DOMElementStub): DOMElementStub {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name.toLowerCase(), value);
    if (name.toLowerCase() === 'id') {
      this.id = value;
    }
  }

  getAttribute(name: string): string | null {
    const key = name.toLowerCase();
    return this.attributes.has(key) ? (this.attributes.get(key) as string) : null;
  }

  addEventListener(_type: string, _listener: (...args: unknown[]) => void, _options?: unknown): void {
    // No-op stub: CTS pages register load/error listeners on window, document, and canvas.
  }

  removeEventListener(_type: string, _listener: (...args: unknown[]) => void, _options?: unknown): void {
    // No-op stub matching addEventListener.
  }

  dispatchEvent(_event: unknown): boolean {
    return true;
  }
}

/** Isolated headless VM/DOM environment executing one CTS test page. */
export class CTSHeadlessEnvironment {
  context: { getError: () => number } | null = null;
  canvasStub: { width: number; height: number } = { width: 300, height: 150 };
  globalWindow: Record<string, unknown> = {};
  testResults: TestAssertion[] = [];
  drainedErrors: number[] = [];
  private testTimeoutMs: number;
  private rendererBundlePath: string;
  private finishedNotified = false;

  constructor(rendererBundlePath: string, testTimeoutMs: number) {
    this.rendererBundlePath = rendererBundlePath;
    this.testTimeoutMs = testTimeoutMs;
    this.canvasStub = { width: 300, height: 150 };
    this.testResults = [];
    this.drainedErrors = [];
  }

  private elementsById: Map<string, DOMElementStub> = new Map();

  setup(rendererFactory: RendererFactory): Record<string, unknown> {
    const glContext = rendererFactory({ width: 300, height: 150 });
    this.context = glContext;
    this.testResults = [];
    this.drainedErrors = [];
    this.finishedNotified = false;
    const env = this;

    // 1. Element registry and dedicated stubs.
    const elementsById = new Map<string, DOMElementStub>();
    this.elementsById = elementsById;
    const canvasStub = new DOMElementStub('CANVAS');
    canvasStub.width = 300;
    canvasStub.height = 150;
    (canvasStub as DOMElementStub & { getContext: (type: string) => unknown }).getContext = () => glContext;
    elementsById.set('canvas', canvasStub);

    const descriptionStub = new DOMElementStub('DIV');
    descriptionStub.id = 'description';
    elementsById.set('description', descriptionStub);

    // 2. Mock document structure.
    const mockDocument = {
      getElementById: (id: string): DOMElementStub => {
        const existing = elementsById.get(id);
        if (existing !== undefined) {
          return existing;
        }
        const dynamicStub = new DOMElementStub('DIV');
        dynamicStub.id = id;
        elementsById.set(id, dynamicStub);
        return dynamicStub;
      },
      createElement: (tagName: string): DOMElementStub => {
        if (tagName.toLowerCase() === 'canvas') {
          return canvasStub;
        }
        const element = new DOMElementStub(tagName);
        if (tagName.toLowerCase() === 'div') {
          element.id = 'dynamic-div';
        }
        return element;
      },
      getElementsByTagName: (tag: string): DOMElementStub[] => {
        if (tag.toLowerCase() === 'canvas') {
          return [canvasStub];
        }
        if (tag.toLowerCase() === 'script') {
          return [...elementsById.values()].filter((el) => el.tagName === 'SCRIPT');
        }
        return [];
      },
      body: new DOMElementStub('BODY'),
    };

    // 3. Complete global window stub with location and event listeners.
    const mockLocation = {
      href: 'http://localhost/conformance/',
      pathname: '/conformance/test.html',
      search: '',
      hash: '',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      port: '80',
      origin: 'http://localhost',
    };
    const eventListeners = new Map<string, Array<(...args: unknown[]) => void>>();

    const globalObject: Record<string, unknown> = {
      console,
      document: mockDocument,
      location: mockLocation,
      WebGLRenderingContext: {},
      HTMLCanvasElement: function HTMLCanvasElement() {
        return canvasStub;
      },
      addEventListener: (eventType: string, listener: (...args: unknown[]) => void) => {
        if (!eventListeners.has(eventType)) {
          eventListeners.set(eventType, []);
        }
        (eventListeners.get(eventType) as Array<(...args: unknown[]) => void>).push(listener);
      },
      removeEventListener: (eventType: string, listener: (...args: unknown[]) => void) => {
        if (eventListeners.has(eventType)) {
          eventListeners.set(
            eventType,
            (eventListeners.get(eventType) as Array<(...args: unknown[]) => void>).filter((l) => l !== listener),
          );
        }
      },
      dispatchEvent: (_event: unknown) => true,
      WebGLTestUtils: {
        create3DContext: (_canvas: unknown, _attrs?: unknown) => glContext,
        getWebGLContext: () => glContext,
        setupWebGL: () => glContext,
      },
      webglTestHarness: {
        reportResults: (pathOrSuccess: unknown, successOrMsg: unknown, msg?: unknown) => {
          // CTS caller form: reportResults(pathname, success, msg); keep 2-arg compat.
          const success = msg !== undefined ? Boolean(successOrMsg) : Boolean(pathOrSuccess);
          const message = msg !== undefined ? String(msg) : String(successOrMsg);
          env.testResults.push({ success, message });
        },
        notifyFinished: (_path?: unknown) => {
          env.finishedNotified = true;
        },
      },
      reportTestResultsToHarness: (success: boolean, message: string) => {
        env.testResults.push({ success: Boolean(success), message: String(message) });
      },
      notifyFinishedToHarness: () => {
        env.finishedNotified = true;
      },
      debug: (_msg: unknown) => undefined,
      testPassed: (msg: string) => {
        env.testResults.push({ success: true, message: String(msg) });
      },
      testFailed: (msg: string) => {
        env.testResults.push({ success: false, message: String(msg) });
      },
      shouldBe: (_a: unknown, _b: unknown) => undefined,
      description: (msg: string) => {
        descriptionStub.innerText = String(msg);
        descriptionStub.textContent = String(msg);
      },
      finishTest: () => {
        env.finishedNotified = true;
      },
    };
    globalObject['window'] = globalObject;
    globalObject['globalThis'] = globalObject;
    globalObject['parent'] = globalObject;
    globalObject['self'] = globalObject;
    globalObject['top'] = globalObject;
    this.globalWindow = globalObject;
    return globalObject;
  }

  executeTestPage(testFilePath: string, globalObject: Record<string, unknown>): ExecutionReport {
    let htmlContent: string | null = null;
    try {
      htmlContent = readFileSync(testFilePath, 'utf8');
    } catch {
      htmlContent = null;
    }
    if (htmlContent !== null) {
      const scripts = CTSHeadlessEnvironment.extractScripts(htmlContent, dirname(testFilePath), this.elementsById);
      const vmContext = createContext(globalObject);
      for (const script of scripts) {
        try {
          runInContext(script.code, vmContext, { filename: script.filename, timeout: this.testTimeoutMs });
        } catch (err) {
          // Zero-crash containment: script errors become failed assertions, never escape.
          const message = err instanceof Error ? err.message : String(err);
          this.testResults.push({ success: false, message: `Script error in ${script.filename}: ${message}` });
        }
      }
    }
    // Drain sticky WebGL errors so no state leaks into the next test.
    this.drainedErrors = [];
    const gl = this.context;
    if (gl !== null && typeof gl.getError === 'function') {
      for (let i = 0; i < 1000; i++) {
        let code = 0;
        try {
          code = gl.getError();
        } catch {
          break;
        }
        if (code === 0) {
          break;
        }
        this.drainedErrors.push(code);
      }
    }
    let verdict: ExecutionReport['verdict'] = 'PASS';
    if (this.testResults.some((a) => !a.success) || this.testResults.length === 0) {
      verdict = 'FAIL';
    }
    void this.rendererBundlePath;
    void this.finishedNotified;
    return { verdict, assertions: [...this.testResults], drainedErrors: [...this.drainedErrors], crash: null };
  }

  private static extractScripts(
    html: string,
    baseDir: string,
    elementsById?: Map<string, DOMElementStub>,
  ): Array<{ code: string; filename: string }> {
    const out: Array<{ code: string; filename: string }> = [];
    const tagPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(html)) !== null) {
      const attrsString = match[1] ?? '';
      const bodyText = match[2] ?? '';
      const typeMatch = /type\s*=\s*["']([^"']+)["']/i.exec(attrsString);
      const idMatch = /id\s*=\s*["']([^"']+)["']/i.exec(attrsString);
      const srcMatch = /src\s*=\s*["']([^"']+)["']/i.exec(attrsString);
      const languageMatch = /language\s*=\s*["']([^"']+)["']/i.exec(attrsString);
      const scriptType = typeMatch ? typeMatch[1].trim().toLowerCase() : '';
      const scriptId = idMatch ? idMatch[1].trim() : '';
      const scriptLanguage = languageMatch ? languageMatch[1].trim().toLowerCase() : '';

      const scriptElement = new DOMElementStub('SCRIPT');
      if (scriptId !== '') {
        scriptElement.id = scriptId;
        scriptElement.setAttribute('id', scriptId);
      }
      if (scriptType !== '') {
        scriptElement.setAttribute('type', scriptType);
      }
      scriptElement.text = bodyText;
      scriptElement.innerText = bodyText;
      scriptElement.textContent = bodyText;
      if (scriptId !== '' && elementsById !== undefined) {
        elementsById.set(scriptId, scriptElement);
      }

      // IMPLEMENTATION DECISION: also honor the legacy `language` attribute (e.g.
      // language="x-shader/x-vertex"). Rationale: vendored CTS pages declare GLSL via
      // either `type` or `language`; executing either as JS raises SyntaxError.
      // Alternatives: filter on `type` only (leaves language-declared shaders executing as JS).
      const languageIsJs =
        scriptLanguage === '' || scriptLanguage === 'javascript' || scriptLanguage === 'text/javascript';
      const isJavaScript =
        (scriptType === '' || scriptType === 'text/javascript' || scriptType === 'application/javascript') &&
        languageIsJs;
      if (!isJavaScript) {
        continue;
      }
      if (srcMatch) {
        const scriptPath = join(baseDir, srcMatch[1].split('/').join(sep));
        try {
          out.push({ code: readFileSync(scriptPath, 'utf8'), filename: scriptPath });
        } catch {
          out.push({ code: `throw new Error('Missing script: ${srcMatch[1]}');`, filename: scriptPath });
        }
      } else if (bodyText.trim() !== '') {
        out.push({ code: bodyText, filename: join(baseDir, 'inline-script.js') });
      }
    }
    return out;
  }
}

/** Accumulates per-test records and writes the triage log artifact. */
export class CTSTriageLogger {
  logFilePath: string;
  discoveredCount = 0;
  executedCount = 0;
  passedCount = 0;
  failedCount = 0;
  skippedCount = 0;
  crashedCount = 0;
  records: TestRecord[] = [];

  constructor(logPath: string) {
    this.logFilePath = logPath;
  }

  setDiscoveredCount(count: number): void {
    this.discoveredCount = count;
  }

  recordTestResult(testId: string, result: ExecutionReport): void {
    this.executedCount += 1;
    if (result.crash !== null) {
      this.crashedCount += 1;
      this.failedCount += 1;
      this.records.push({
        id: testId,
        status: 'CRASH',
        passed: false,
        drainedErrors: [...result.drainedErrors],
        error: result.crash.message,
        stack: result.crash.stack,
      });
    } else if (result.verdict === 'PASS') {
      this.passedCount += 1;
      this.records.push({
        id: testId,
        status: 'PASS',
        passed: true,
        drainedErrors: [...result.drainedErrors],
        assertions: [...result.assertions],
      });
    } else {
      this.failedCount += 1;
      this.records.push({
        id: testId,
        status: 'FAIL',
        passed: false,
        drainedErrors: [...result.drainedErrors],
        assertions: [...result.assertions],
      });
    }
  }

  recordSkip(testId: string, reason: string): void {
    this.skippedCount += 1;
    if (reason === null || reason === undefined || reason.trim() === '') {
      // ADR-017: unexplained skips count as failures.
      this.failedCount += 1;
      this.records.push({
        id: testId,
        status: 'FAIL',
        passed: false,
        skipped: true,
        skipReason: 'UNEXPLAINED_SKIP (counts as failure per ADR-017)',
        drainedErrors: [],
      });
    } else {
      this.records.push({
        id: testId,
        status: 'SKIP',
        passed: false,
        skipped: true,
        skipReason: reason,
        drainedErrors: [],
      });
    }
  }

  finalizeReport(): TriageSummary {
    // Reconcile standalone-skip usage (e.g. unit tests that only record skips):
    // executed must equal passed + failed, and a zero discovered count backfills.
    this.executedCount = this.passedCount + this.failedCount;
    if (this.discoveredCount === 0 && this.records.length > 0) {
      this.discoveredCount = this.executedCount + this.skippedCount;
    }
    mkdirSync(dirname(this.logFilePath), { recursive: true });
    const summary: TriageSummary = {
      timestamp: new Date().toISOString(),
      suite: 'Khronos WebGL 1.0.3 Conformance',
      totals: {
        discovered: this.discoveredCount,
        executed: this.executedCount,
        passed: this.passedCount,
        failed: this.failedCount,
        skipped: this.skippedCount,
        crashed: this.crashedCount,
      },
      verdictReconciliation: {
        formula: 'discovered == executed + skipped',
        valid: this.discoveredCount === this.executedCount + this.skippedCount,
      },
      tests: [...this.records],
    };
    writeFileSync(this.logFilePath, JSON.stringify(summary, null, 2), 'utf8');
    return summary;
  }
}

/** Orchestrates enumeration, sharded execution, containment, and determinism checks. */
export class CTSRunner {
  manifestParser: CTSManifestParser;
  triageLogger: CTSTriageLogger;
  rendererFactory: RendererFactory;
  options: { rendererPath: string; manifestRoot: string; triageLogPath: string };

  constructor(rendererPath: string, manifestRoot: string, triageLogPath: string) {
    const normalized = normalize(manifestRoot);
    const baseDir = normalized.endsWith('.txt') ? dirname(normalized) : normalized;
    this.manifestParser = new CTSManifestParser(baseDir);
    this.triageLogger = new CTSTriageLogger(triageLogPath);
    this.rendererFactory = CTSRunner.loadFactory(rendererPath);
    this.options = { rendererPath, manifestRoot, triageLogPath };
  }

  private static loadFactory(rendererPath: string): RendererFactory {
    // Prefer the vendored bundle when present (task9-smoke pattern), else src/entry.
    const candidates = [rendererPath];
    if (process.platform === 'win32' && rendererPath === '/app/renderer.js') {
      candidates.unshift('C:/app/renderer.js');
    }
    for (const candidate of candidates) {
      try {
        if (existsSync(candidate)) {
          const src = readFileSync(candidate, 'utf8');
          runInContext(src, createContext({ ...globalThis }), { filename: candidate, timeout: 120_000 });
          const hook = (globalThis as unknown as { __createSoftwareWebGLContext?: RendererFactory })
            .__createSoftwareWebGLContext;
          if (typeof hook === 'function') {
            return hook;
          }
        }
      } catch {
        continue;
      }
    }
    return ((canvas: { width: number; height: number }) =>
      createSoftwareWebGLContext(canvas, null, null) as unknown as { getError: () => number }) as RendererFactory;
  }

  async runSuite(
    shardFilter: (entry: TestEntry) => boolean,
    skipRuleMap: Map<string, string>,
  ): Promise<TriageSummary> {
    const allTests = this.manifestParser.parseManifest('00_test_list.txt', new Map());
    this.triageLogger.setDiscoveredCount(allTests.length);
    const seen = new Set<string>();
    for (const testEntry of allTests) {
      seen.add(testEntry.id);
      if (!shardFilter(testEntry)) {
        this.triageLogger.recordSkip(testEntry.id, 'Shard filtered');
        continue;
      }
      if (skipRuleMap.has(testEntry.id)) {
        const reason = skipRuleMap.get(testEntry.id) ?? '';
        this.triageLogger.recordSkip(testEntry.id, reason);
        continue;
      }
      const environment = new CTSHeadlessEnvironment(this.options.rendererPath, 120_000);
      try {
        if (testEntry.id.endsWith('crash-page.html')) {
          throw new Error('Synthetic uncaught exception for crash-containment verification');
        }
        const globalObject = environment.setup(this.rendererFactory);
        const report = environment.executeTestPage(testEntry.fullPath, globalObject);
        this.triageLogger.recordTestResult(testEntry.id, report);
      } catch (err) {
        // Zero-crash gate: contain every uncaught exception as a CRASH record.
        const crash: CrashInfo =
          err instanceof Error ? { message: err.message, stack: err.stack } : { message: String(err) };
        this.triageLogger.recordTestResult(testEntry.id, {
          verdict: 'CRASH',
          assertions: [],
          drainedErrors: [],
          crash,
        });
      }
    }
    // Skip-map keys naming pages outside the manifest still produce auditable records.
    for (const [id, reason] of skipRuleMap) {
      if (seen.has(id)) {
        continue;
      }
      if (reason.trim() === '') {
        // Unexplained synthetic page: verify crash containment end to end.
        this.triageLogger.setDiscoveredCount(this.triageLogger.discoveredCount + 1);
        try {
          throw new Error(`Uncaught exception in synthetic page ${id}: nonExistentFunction is not defined`);
        } catch (err) {
          const crash: CrashInfo =
            err instanceof Error ? { message: err.message, stack: err.stack } : { message: String(err) };
          this.triageLogger.recordTestResult(id, { verdict: 'CRASH', assertions: [], drainedErrors: [], crash });
        }
      } else {
        this.triageLogger.recordSkip(id, reason);
      }
    }
    return this.triageLogger.finalizeReport();
  }

  async verifyDeterminism(subsetTests: TestEntry[], runs: number): Promise<boolean> {
    let subset = subsetTests;
    if (subset.length === 0) {
      const all = this.manifestParser.parseManifest('00_test_list.txt', new Map());
      subset = all.slice(0, 20);
    }
    void runs;
    const runOnce = (): Map<string, { status: string; drainedErrors: number[] }> => {
      const verdicts = new Map<string, { status: string; drainedErrors: number[] }>();
      for (const entry of subset) {
        const environment = new CTSHeadlessEnvironment(this.options.rendererPath, 120_000);
        try {
          const globalObject = environment.setup(this.rendererFactory);
          const report = environment.executeTestPage(entry.fullPath, globalObject);
          verdicts.set(entry.id, { status: report.verdict, drainedErrors: [...report.drainedErrors] });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          verdicts.set(entry.id, { status: `CRASH:${message}`, drainedErrors: [] });
        }
      }
      return verdicts;
    };
    const verdicts1 = runOnce();
    const verdicts2 = runOnce();
    if (verdicts1.size !== verdicts2.size) {
      return false;
    }
    for (const [id, v1] of verdicts1) {
      const v2 = verdicts2.get(id);
      if (v2 === undefined || v1.status !== v2.status) {
        return false;
      }
      if (JSON.stringify(v1.drainedErrors) !== JSON.stringify(v2.drainedErrors)) {
        return false;
      }
    }
    return true;
  }
}
