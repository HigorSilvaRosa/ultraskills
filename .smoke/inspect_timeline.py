import json
import sys
from pathlib import Path

run = Path(sys.argv[1])
cin = json.loads((run / 'cinematic.json').read_text(encoding='utf-8'))
tl = cin['timeline']
print('scenes:', [(s['id'], s['start'], round(s['span']), s['clicks'], s['naturalMs']) for s in tl['scenes']])
raw = json.loads((run / 'raw.json').read_text(encoding='utf-8'))
marks = [e for e in raw if e.get('type') == 5]
t0 = marks[0]['timestamp']
print('markers:', [(m['data']['payload']['id'], round(m['timestamp'] - t0)) for m in marks])
names = {0: 'up', 1: 'down', 2: 'CLICK', 3: 'ctx', 4: 'dbl', 5: 'focus', 6: 'blur'}
print('--- raw interactions (ms from first marker) ---')
for e in [e for e in raw if e.get('type') == 3 and e['data'].get('source') == 2]:
    d = e['data']
    print(f"{e['timestamp'] - t0:7.0f} {names.get(d.get('type'), d.get('type')):6} id={d.get('id')} x={d.get('x')} y={d.get('y')}")
print('--- cinematic interactions (ms) ---')
for e in [e for e in cin['events'] if e.get('type') == 3 and e['data'].get('source') == 2]:
    d = e['data']
    print(f"{e['timestamp']:7.0f} {names.get(d.get('type'), d.get('type')):6} x={d.get('x')} y={d.get('y')}")
print('--- cinematic move clusters ---')
clusters = []
for e in [e for e in cin['events'] if e.get('type') == 3 and e['data'].get('source') == 1]:
    p = e['data']['positions'][0]
    if clusters and e['timestamp'] - clusters[-1][-1][0] < 60:
        clusters[-1].append((e['timestamp'], p['x'], p['y']))
    else:
        clusters.append([(e['timestamp'], p['x'], p['y'])])
for c in clusters:
    print(f"  {c[0][0]:7.0f} -> {c[-1][0]:7.0f}  ({c[0][1]},{c[0][2]}) -> ({c[-1][1]},{c[-1][2]})  frames={len(c)}")

print('--- scroll events (raw) ---')
for e in [e for e in raw if e.get('type') == 3 and e['data'].get('source') == 3]:
    d = e['data']
    print(f"  raw {e['timestamp'] - t0:7.0f} id={d.get('id')} x={d.get('x')} y={d.get('y')}")
print('--- scroll events (cinematic) ---')
for e in [e for e in cin['events'] if e.get('type') == 3 and e['data'].get('source') == 3]:
    d = e['data']
    print(f"  cin {e['timestamp']:7.0f} id={d.get('id')} x={d.get('x')} y={d.get('y')}")
