import json,collections
log=json.load(open('test-results/conformance/webgl2-triage.json'))
c=collections.Counter()
for t in log['tests']:
  if t.get('rootCauseGroup')!='G1': continue
  for a in (t.get('assertions') or []):
    if not a.get('success'):
      m=a.get('message','')
      if 'Script error' in m:
        if 'XMLHttpRequest' in m: c['script-xhr']+=1
        elif "reading 'length'" in m: c['script-length']+=1
        else: c['script-other:'+m[:100]]+=1
      break
print(dict(c))
# sample length errors
n=0
for t in log['tests']:
  if t.get('rootCauseGroup')!='G1': continue
  for a in (t.get('assertions') or []):
    if not a.get('success') and 'Script error' in a.get('message','') and "reading 'length'" in a.get('message',''):
      print(t['id'],'|',a['message'][:200]); n+=1
      if n>=5: break
  if n>=5: break
