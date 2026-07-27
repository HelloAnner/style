#!/usr/bin/env python3
"""Generate exact runtime CSS-variable modes from public production computed styles."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
inputs={
 'light':('sources/computed-styles/login__light__1440x900__default__01.json','SRC-042'),
 'dark':('sources/computed-styles/login__dark__1440x900__default__01.json','SRC-040'),
}
modes={}
for mode,(rel,evidence) in inputs.items():
 d=json.loads((ROOT/rel).read_text())
 modes[mode]=dict(sorted(d['customProperties'].items()))
 out={
  '$metadata':{'profile':'wufan','mode':mode,'precision':'exact-source/runtime-computed','evidence':[evidence,'SRC-012'],'capturedFrom':'https://www.wufanai.com/login','note':'Complete runtime custom-property set for this mode; includes product subsystems beyond the sampled login page.'},
  'cssVariables':modes[mode],
 }
 p=ROOT/f'system/themes/{mode}.tokens.json';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
 selector=f'[data-theme="{mode}"]'
 css=['/* Generated from production runtime computed styles. Do not hand-edit. */',f'{selector} {{']
 css += [f'  {k}: {v};' for k,v in modes[mode].items()]
 css += ['}','']
 (ROOT/f'system/themes/{mode}.css').write_text('\n'.join(css))
common={k:v for k,v in modes['light'].items() if modes['dark'].get(k)==v}
light_only={k:v for k,v in modes['light'].items() if modes['dark'].get(k)!=v}
dark_only={k:v for k,v in modes['dark'].items() if modes['light'].get(k)!=v}
aggregate={
 '$metadata':{
  'profile':'wufan','version':'0.2.0','referenceMode':'strict','themes':['light','dark'],
  'precision':'exact-source/runtime-computed','evidence':['SRC-012','SRC-040','SRC-042'],
  'warning':'Marketing pages use a separate fixed-dark visual language. These modes are the production application design system.'
 },
 'shared':common,
 'modes':{'light':modes['light'],'dark':modes['dark']},
 'statistics':{'shared':len(common),'lightTotal':len(modes['light']),'darkTotal':len(modes['dark']),'lightDifferentOrExclusive':len(light_only),'darkDifferentOrExclusive':len(dark_only)}
}
(ROOT/'system/tokens.json').write_text(json.dumps(aggregate,ensure_ascii=False,indent=2)+'\n')
css=['/* Wufan application runtime tokens; generated from SRC-040/SRC-042. Dark is the source default. */',':root {']
css += [f'  {k}: {v};' for k,v in common.items()]
css += ['}','','/* Source behavior: dark is active before an explicit theme attribute exists. */',':root, [data-theme="dark"] {']
css += [f'  {k}: {v};' for k,v in dark_only.items()]
css += ['}','','/* Keep light last so it overrides the :root dark default. */','[data-theme="light"] {']
css += [f'  {k}: {v};' for k,v in light_only.items()]
css += ['}','']
(ROOT/'system/tokens.css').write_text('\n'.join(css))
print(aggregate['statistics'])
