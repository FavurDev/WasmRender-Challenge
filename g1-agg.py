import json,collections
log=json.load(open('test-results/conformance/webgl2-triage.json'))
sigs=collections.Counter()
ex={}
for t in log['tests']:
  if t.get('rootCauseGroup')!='G1': continue
  for a in (t.get('assertions') or []):
    if not a.get('success'):
      m=a.get('message','')
      # normalize: strip numbers/paths
      import re
      key=m.strip()
      # bucket
      if 'compiled successfully' in key.lower() or 'successfullyparsed' in key.lower().replace(' ',''):
        b='SIG-A shader-compile-assertion'
      elif 'should be >=' in key or 'should be >' in key or 'was null' in key.lower():
        b='SIG-B getParameter/limit null'
      elif 'should be ' in key and ('got' in key.lower() or 'was ' in key.lower()):
        b='SIG-C value-mismatch'
      elif 'script error' in key.lower():
        b='SIG-D script-error'
      elif 'timeout' in key.lower() or 'harness' in key.lower():
        b='SIG-E harness/timeout'
      else:
        b='SIG-F other: '+key[:80]
      sigs[b]+=1
      ex.setdefault(b,[]).append((t['id'],m))
      break
print(sigs)
for k,v in sigs.items():
  print('==',k,v)
  for tid,m in ex[k][:3]:
    print('  ',tid,'|',m[:160])
