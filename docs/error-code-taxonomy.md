# Error-Code Taxonomy Specification
**Version**: 1.0
**Date**: 2026-09-23
**Status**: Active
**Sprint**: 9 Task 1 (M5 Conformance and Determinism, Wave 1)

## Decisions

### Error Code Values
**Value**: NO_ERROR=0x0000, INVALID_ENUM=0x0500, INVALID_VALUE=0x0501, INVALID_OPERATION=0x0502, OUT_OF_MEMORY=0x0505, INVALID_FRAMEBUFFER_OPERATION=0x0506, CONTEXT_LOST_WEBGL=0x9242
**Type**: hex
**Usage**: Exact codes recorded by ErrorSink and returned by getError per src/gl/constants.ts

### Sticky Queue Discipline
**Value**: FIRST_RECORDED_RETAINED_ONE_CODE_PER_GETERROR
**Type**: enum
**Usage**: ErrorSink retains first recorded code until getError drains it; later errors discarded while slot occupied

### Atomicity Rule
**Value**: VALIDATE_BEFORE_MUTATE
**Type**: enum
**Usage**: Every method validates all error conditions before mutating any GL state

### Context-Loss Override
**Value**: CONTEXT_LOST_SUPERSEDES_ALL_NON_LOST_CODES
**Type**: enum
**Usage**: When context lost, getError returns CONTEXT_LOST_WEBGL and pending non-lost codes are cleared

### Non-Error Diagnostic Classes
**Value**: SHADER_DIAGNOSTIC_LOG_ONLY, INCOMPLETE_TEXTURE_SILENT_RGBA_0_0_0_1, UNKNOWN_EXTENSION_SILENT_NULL
**Type**: enum
**Usage**: Shader compile/link failures surface via getShaderInfoLog only; incomplete textures sample [0,0,0,1] with no error; unknown extension names return null with no error

## Method-Family Classification Tables

Check order is first-failure-wins within each family.

### F1 State Setters (enable, disable, blendFunc, blendEquation, depthFunc, cullFace, frontFace, lineWidth, hint, pixelStorei)
**Value**: unknown-enum=INVALID_ENUM; lineWidth-nonpositive-or-NaN=INVALID_VALUE; pixelStorei-invalid-param-or-value=INVALID_ENUM_OR_INVALID_VALUE_PER_PARAM; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify state-setter invalid inputs; finish/flush/lineWidth/getShaderPrecisionFormat are required entry points

### F2 Buffer (bindBuffer, bufferData, bufferSubData, deleteBuffer, isBuffer)
**Value**: invalid-target=INVALID_ENUM; negative-size-or-offset=INVALID_VALUE; null-data-with-nonzero-size=INVALID_VALUE; deleted-or-unbound-source=INVALID_OPERATION; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify buffer binding and upload errors

### F3 Texture (bindTexture, texImage2D, texSubImage2D, texParameteri, generateMipmap, activeTexture, compressedTexImage2D)
**Value**: invalid-target-or-pname=INVALID_ENUM; negative-or-oversize-dimensions=INVALID_VALUE; format-type-mismatch=INVALID_OPERATION; incomplete-mipmap-chain-sampling=silent-[0,0,0,1]; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify texture errors; incomplete textures never raise

### F4 Framebuffer/Renderbuffer (bindFramebuffer, framebufferTexture2D, framebufferRenderbuffer, checkFramebufferStatus, bindRenderbuffer, renderbufferStorage, clear with incomplete FBO)
**Value**: invalid-target-or-attachment=INVALID_ENUM; zero-dimension-storage=INVALID_VALUE; draw-to-incomplete-FBO=INVALID_FRAMEBUFFER_OPERATION; checkFramebufferStatus-returns-status-enum-never-records-error; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify FBO errors; completeness checked at draw time

### F5 Shader/Program/Uniform (createShader, shaderSource, compileShader, createProgram, attachShader, linkProgram, useProgram, getAttribLocation, getUniformLocation, uniform setters, vertexAttribPointer setup)
**Value**: invalid-shader-type=INVALID_ENUM; negative-location-or-count=INVALID_VALUE; useProgram-with-unlinked-or-deleted=INVALID_OPERATION; uniform-setter-type-or-location-mismatch=silent-ignore-or-INVALID_OPERATION_PER_SIGNATURE; compile-link-failure=log-only-NO_ERROR; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify shader pipeline errors; compile failures never set error flag

### F6 Vertex Attrib (enableVertexAttribArray, disableVertexAttribArray, vertexAttribPointer, vertexAttrib[1234]f)
**Value**: index-out-of-range=INVALID_VALUE; stride-or-size-out-of-range=INVALID_VALUE; pointer-with-no-bound-buffer=INVALID_OPERATION; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify attrib setup errors

### F7 Draw Orchestrator (drawArrays, drawElements, validateProgram path)
**Value**: invalid-mode=INVALID_ENUM; negative-first-or-count=INVALID_VALUE; no-current-program-or-unlinked=INVALID_OPERATION; incomplete-FBO-bound=INVALID_FRAMEBUFFER_OPERATION; enabled-attrib-with-no-buffer=INVALID_OPERATION; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify draw-call errors in check order mode, count, program, FBO, attribs

### F8 ReadPixels/Clear (readPixels, clear, clearColor, clearDepth, clearStencil, colorMask, depthMask, scissor, viewport, stencil ops)
**Value**: invalid-format-or-type=INVALID_ENUM; negative-dimension-or-out-of-bounds=INVALID_VALUE; incomplete-FBO=INVALID_FRAMEBUFFER_OPERATION; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify readback and clear errors

### F9 Query State (getParameter, getError, getExtension, getSupportedExtensions, getShaderPrecisionFormat, isEnabled, getVertexAttrib, getBufferParameter, getTexParameter, getRenderbufferParameter, getFramebufferAttachmentParameter, getProgramParameter, getShaderParameter)
**Value**: unknown-pname=INVALID_ENUM; getError-itself-never-records; unknown-extension-name=silent-null; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify query errors; getters never raise except INVALID_ENUM

### F10 Extension/Lose-Context (getExtension, loseContext, restoreContext, isContextLost)
**Value**: unknown-extension=silent-null-NO_ERROR; methods-after-loseContext-record-CONTEXT_LOST_WEBGL; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify context-loss behavior

### F11 WebGL2 VAO (createVertexArray, bindVertexArray, deleteVertexArray, isVertexArray)
**Value**: invalid-target=INVALID_ENUM; deleted-VAO-bind=INVALID_OPERATION; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify VAO errors

### F12 WebGL2 Transform Feedback/Sampler/Sync/Query (beginTransformFeedback, endTransformFeedback, pauseTransformFeedback, resumeTransformFeedback, createSampler, bindSampler, samplerParameteri, fenceSync, clientWaitSync, waitSync, deleteSync, createQuery, beginQuery, endQuery, getQueryParameter)
**Value**: invalid-enum-arg=INVALID_ENUM; invalid-value-arg=INVALID_VALUE; begin-twice-or-end-without-begin=INVALID_OPERATION; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify TF/sampler/sync/query errors

### F13 WebGL2 UBO/MRT/Instanced/3D-Texture (bindBufferBase, bindBufferRange, getUniformBlockIndex, uniformBlockBinding, drawBuffers, drawArraysInstanced, drawElementsInstanced, vertexAttribDivisor, texImage3D, texSubImage3D, copyTexSubImage3D, blitFramebuffer, invalidateFramebuffer, readBuffer)
**Value**: invalid-enum=INVALID_ENUM; offset-not-aligned-or-range-overflow=INVALID_VALUE; drawBuffers-with-unlisted-attachment=INVALID_OPERATION; feedback-varying-before-link=INVALID_OPERATION; else=NO_ERROR
**Type**: enum
**Usage**: T2/T3 classify WebGL2-only entry errors

### F14 Triage Reconciliation and Root-Cause Groups
**Value**: FORMULA_discovered_eq_executed_plus_skipped; G1_SHADER_COMPILE_CASCADE; G2_MISSING_ENTRY_POINTS_finish_flush_lineWidth_getShaderPrecisionFormat; G3_FLOAT_EDGE_ALLOWANCE; G4_HARNESS_LIMITATION_SKIP; FIX_ORDER_G2_THEN_G1_THEN_G3
**Type**: enum
**Usage**: T3 applies reconciliation formula and G1-G4 group ids; fix priority G2 then G1 then float-edge audit
