#!/usr/bin/env python3
"""Build deterministic source and capture metadata for the current Wufan intake."""
from pathlib import Path
from PIL import Image
from datetime import datetime, timezone
import hashlib, json, re

ROOT = Path(__file__).resolve().parents[2]
NOW = "2026-07-26T23:36:35Z"

def sha(path):
    if not path or not (ROOT / path).is_file(): return None
    h=hashlib.sha256()
    with (ROOT/path).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()

def item(i, typ, origin, path=None, theme='shared', route=None, viewport=None, dpr=None, state=None, authorized='public', notes=None):
    x={"id":f"SRC-{i:03d}","type":typ,"origin":origin,"localPath":path,"sha256":sha(path),"theme":theme,"route":route,"viewport":viewport,"dpr":dpr,"state":state,"collectedAt":NOW,"authorized":authorized}
    if notes: x['notes']=notes
    return x

sources=[]
sources += [
 item(1,'url','https://www.wufanai.com/',None,'shared','/',authorized='explicit',notes='User-designated Wufan reference site.'),
 item(2,'screenshot','User-provided clipboard screenshot','sources/screenshots/original/dark/app__dark__3188x1936__new-task-default__01.png','dark','/ (authenticated app, new task)',{'width':1594,'height':968,'physicalWidth':3188,'physicalHeight':1936},2,'default','provided','DPR inferred from 240px source sidebar rendering as ~480 physical pixels; contains user display name.'),
 item(3,'screenshot','User-provided clipboard screenshot','sources/screenshots/original/light/app__light__3188x1948__chat-default__01.png','light','/s/:sessionId (authenticated app, chat)',{'width':1594,'height':974,'physicalWidth':3188,'physicalHeight':1948},2,'default','provided','DPR inferred; contains user display name and conversation content.'),
 item(4,'source','/Users/anner/fine/ai/corevo at commit 14394dc7ca16aa13c62e8a089c6ffff4953424f3','sources/source-code/private/corevo-web-14394dc/SOURCE-MANIFEST.json','shared',authorized='explicit',notes='Sanitized frontend snapshot, private-publication pending; source commit predates current deployed assets and differs in WhatsNew.'),
 item(5,'webpage','https://www.wufanai.com/','sources/webpages/homepage__20260727.html','dark','/'),
 item(6,'asset','https://www.wufanai.com/css/index.css?v=7ec727d4','sources/webpages/assets/css/index__7ec727d4.css','dark','/'),
 item(7,'asset','https://www.wufanai.com/img/wf-logo.svg','sources/webpages/assets/img/wf-logo.svg','shared','/'),
 item(8,'asset','https://www.wufanai.com/fonts/SmileySans-Oblique.woff2','sources/webpages/assets/fonts/SmileySans-Oblique.woff2','shared','/'),
 item(9,'webpage','https://www.wufanai.com/learn','sources/webpages/learn__20260727.html','dark','/learn'),
 item(10,'webpage','https://www.wufanai.com/pricing','sources/webpages/pricing__20260727.html','dark','/pricing'),
 item(11,'webpage','https://www.wufanai.com/login','sources/webpages/login__20260727.html','shared','/login'),
 item(12,'asset','https://www.wufanai.com/assets/index-CjeRCaxU.css','sources/webpages/assets/app/index-CjeRCaxU.css','shared','/login'),
 item(13,'asset','https://www.wufanai.com/assets/index-ChXKQFVA.js','sources/webpages/assets/app/index-ChXKQFVA.js','shared','/login'),
 item(14,'screenshot','User-provided clipboard screenshot','sources/screenshots/original/light/app__light__860x1292__whats-new-default__01.png','light','authenticated app / What’s New',{'physicalWidth':860,'physicalHeight':1292},2,'default','provided','Likely DPR 2 component crop; no viewport context. Matches current deployed JS, not provided source commit WhatsNew implementation.'),
 item(15,'asset','Public web font dependencies','sources/assets/fonts/public/FONT-MANIFEST.json','shared',authorized='public',notes='12 public web font files plus CSS; redistribution license verification remains open.'),
]
# Successful browser captures; add each file as a source.
auto=[]
for p in sorted((ROOT/'sources/screenshots/original').rglob('*.png')):
    rel=p.relative_to(ROOT).as_posix()
    if '/unknown/' in rel or rel in {sources[1]['localPath'],sources[2]['localPath'],sources[13]['localPath']}: continue
    name=p.name
    m=re.match(r'(homepage|learn|pricing|login)__(light|dark)__(\d+)x(\d+)__default__01__(viewport|full-page)\.png',name)
    if not m: continue
    target,theme,w,h,kind=m.groups()
    route={'homepage':'/','learn':'/learn','pricing':'/pricing','login':'/login'}[target]
    auto.append((p,rel,target,theme,int(w),int(h),kind,route))
for n,(_,rel,target,theme,w,h,kind,route) in enumerate(auto,16):
    sources.append(item(n,'screenshot',f'https://www.wufanai.com{route}',rel,theme,route,{'width':w,'height':h},1,'default','public',f'Automated Chromium capture; {kind}. Marketing routes have a fixed dark design; login theme set via corevo-theme.'))
# Computed style snapshots.
computed=sorted((ROOT/'sources/computed-styles').glob('*.json'))
for n,p in enumerate(computed,16+len(auto)):
    m=re.match(r'(homepage|learn|pricing|login)__(light|dark)__(\d+)x(\d+)__default__01\.json',p.name)
    target,theme,w,h=m.groups(); route={'homepage':'/','learn':'/learn','pricing':'/pricing','login':'/login'}[target]
    sources.append(item(n,'computed-style',f'https://www.wufanai.com{route}',p.relative_to(ROOT).as_posix(),theme,route,{'width':int(w),'height':int(h)},1,'default','public'))
# Preliminary captures retained as superseded evidence.
prelim=sorted((ROOT/'sources/screenshots/original/unknown').glob('*.png'))
start=16+len(auto)+len(computed)
for n,p in enumerate(prelim,start):
    sources.append(item(n,'screenshot','https://www.wufanai.com/',p.relative_to(ROOT).as_posix(),'unknown','/',state='loading/animation-unstable',authorized='public',notes='Preliminary emulated-color-scheme capture; superseded by stable SRC-016+ capture and not valid as a product theme reference.'))

# Capture manifest derives from screenshot sources.
captures=[]
for x in sources:
    if x['type']!='screenshot': continue
    p=ROOT/x['localPath']
    with Image.open(p) as im: physical={'width':im.width,'height':im.height}
    captures.append({
      'evidenceId':x['id'],'url':x['origin'] if str(x['origin']).startswith('http') else None,'route':x['route'],'theme':x['theme'],
      'viewport':x['viewport'],'physicalPixels':physical,'dpr':x['dpr'],'state':x['state'],
      'captureType':'full-page' if 'full-page' in p.name else ('component-crop' if x['id']=='SRC-014' else 'viewport'),
      'selector':None,'waitCondition':'fonts-ready + timed stabilization + animations paused' if x['authorized']=='public' else 'user-provided',
      'path':x['localPath'],'sha256':x['sha256'],'capturedAt':x['collectedAt'],'notes':x.get('notes')
    })
manifest={
 'environment':{'browser':'Chromium 141.0.7390.37 (Playwright 1.56.1)','os':'darwin','locale':'zh-CN','timezone':'Asia/Shanghai','deviceScaleFactor':1},
 'captures':captures
}
(ROOT/'sources/capture-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'sources/source-records.json').write_text(json.dumps({'sources':sources},ensure_ascii=False,indent=2)+'\n')
print(f'sources={len(sources)} captures={len(captures)} auto={len(auto)} computed={len(computed)} preliminary={len(prelim)}')
