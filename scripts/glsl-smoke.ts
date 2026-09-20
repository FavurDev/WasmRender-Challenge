/** GLSL ES front-end smoke runner (Sprint 3 Task 6) — tokenize -> preprocess -> parse -> check. */
import { tokenize } from '../src/glsl/tokenizer';
import { runPreprocessor } from '../src/glsl/preprocessor';
import { parse } from '../src/glsl/parser';
import { check } from '../src/glsl/checker';
import type { CheckedShader, GlslVersion, ShaderStage } from '../src/glsl/checker';

export type SmokeResult =
  | { ok: true; shader: CheckedShader; log: '' }
  | { ok: false; stage: string; log: string };

export interface SmokeFixture {
  name: string;
  stage: ShaderStage;
  dialectVersion: GlslVersion;
  source: string;
}

export function runFrontEndPipeline(
  sourceText: string,
  shaderStage: ShaderStage,
  dialectVersion: GlslVersion,
): SmokeResult {
  const v: GlslVersion = dialectVersion === 300 ? 300 : 100;
  const tokResult = tokenize(sourceText, v);
  if (!tokResult.ok) return { ok: false, stage: 'tokenizer', log: tokResult.log };
  const prepResult = runPreprocessor(tokResult.tokens, v);
  if (!prepResult.ok) return { ok: false, stage: 'preprocessor', log: prepResult.log };
  const parseResult = parse(prepResult.tokens, v);
  if (!parseResult.ok) return { ok: false, stage: 'parser', log: parseResult.log };
  const checkResult = check(parseResult.tokens, shaderStage, v);
  if (!checkResult.ok) return { ok: false, stage: 'checker', log: checkResult.log };
  return { ok: true, shader: checkResult.tokens, log: '' };
}

export const SMOKE_FIXTURES: SmokeFixture[] = [
  {
    name: 'GLSL ES 1.00 Vertex (attribute, uniform mat4, function, gl_Position)',
    stage: 'vertex',
    dialectVersion: 100,
    source:
      'attribute vec4 aPosition;\nuniform mat4 uModelViewMatrix;\nvec4 transform(vec4 pos) { return uModelViewMatrix * pos; }\nvoid main() {\n gl_Position = transform(aPosition);\n}\n',
  },
  {
    name: 'GLSL ES 1.00 Fragment (precision, varying, gl_FragColor)',
    stage: 'fragment',
    dialectVersion: 100,
    source:
      'precision mediump float;\nvarying vec4 vColor;\nvoid main() {\n gl_FragColor = vColor;\n}\n',
  },
  {
    name: 'GLSL ES 3.00 Vertex (#version 300 es, layout(location), in, out)',
    stage: 'vertex',
    dialectVersion: 300,
    source:
      '#version 300 es\nlayout(location = 0) in vec4 aPosition;\nout vec4 vColor;\nvoid main() {\n vColor = aPosition;\n gl_Position = aPosition;\n}\n',
  },
  {
    name: 'GLSL ES 3.00 Fragment (#version 300 es, precision, in, out, custom fragColor)',
    stage: 'fragment',
    dialectVersion: 300,
    source:
      '#version 300 es\nprecision mediump float;\nin vec4 vColor;\nout vec4 fragColor;\nvoid main() {\n fragColor = vColor;\n}\n',
  },
];

function main(): void {
  let suitePassed = true;
  for (const fixture of SMOKE_FIXTURES) {
    const result = runFrontEndPipeline(fixture.source, fixture.stage, fixture.dialectVersion);
    if (result.ok && result.log === '') {
      console.log('[SMOKE OK] ' + fixture.name);
    } else {
      suitePassed = false;
      const detail = result.ok ? 'empty log expected' : result.stage + ': ' + result.log;
      console.error('[SMOKE FAIL] ' + fixture.name + ' failed in ' + detail);
    }
  }
  if (suitePassed) {
    console.log('GLSL front-end compiler smoke passed: all representative shaders compiled cleanly.');
    process.exit(0);
  } else {
    console.error('GLSL front-end compiler smoke failed.');
    process.exit(1);
  }
}

const invoked = process.argv[1] ?? '';
if (invoked.endsWith('glsl-smoke.ts')) {
  main();
}
