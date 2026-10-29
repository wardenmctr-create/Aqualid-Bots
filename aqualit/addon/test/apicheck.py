"""Aqualit Robotları — script API denetimi.

Gerçek @minecraft/server 2.10.0 ve @minecraft/server-ui 2.2.0 tanımlarına göre
scriptlerde kullanılan dışa aktarımları, olayları, bileşen kimliklerini ve
metod adlarını kontrol eder. Sahte dünyanın (mock) kabul ettiği ama gerçek
oyunda olmayan bir şey kullanılırsa burada yakalanır.
"""
import json
import os
import re
import sys

# Resmî API tanımları (Mojang bedrock-samples, metadata/script_modules): proje kökündeki ref/ klasöründe
REF = os.environ.get('AQUALIT_REF', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ref'))
META = os.path.join(REF, 'script_modules', '@minecraft') + '/'
SRC = os.path.join(os.path.dirname(__file__), '..', 'src', 'scripts')


def load(fname):
    d = json.load(open(META + fname))
    return d


server = load('server-bindings_2.10.0.json')
ui = load('server-ui-bindings_2.2.0.json')
mods = {'@minecraft/server': server, '@minecraft/server-ui': ui}
common = {}
for f in sorted(os.listdir(META)):
    if f.startswith('common_1.2.0'):
        common = load(f)

# ---------------------------------------------------------------- tanımları topla
exports = {k: set() for k in mods}
members = set()
classes = {}
for mname, d in mods.items():
    for kind in ('classes', 'enums', 'objects', 'functions', 'constants', 'errors'):
        for c in d.get(kind, []):
            exports[mname].add(c['name'])
    for kind in ('classes', 'interfaces'):
        for c in d.get(kind, []):
            classes[c['name']] = c
            for p in c.get('properties', []):
                members.add(p['name'])
            for f in c.get('functions', []):
                members.add(f['name'])
            for k in c.get('constants', []):
                members.add(k['name'])
    for c in d.get('enums', []):
        for k in c.get('constants', []):
            members.add(k['name'])
for kind in ('classes', 'interfaces'):
    for c in common.get(kind, []):
        for p in c.get('properties', []):
            members.add(p['name'])

events = {}
for cname in ('WorldBeforeEvents', 'WorldAfterEvents', 'SystemBeforeEvents', 'SystemAfterEvents'):
    events[cname] = {p['name'] for p in classes[cname].get('properties', [])}

comp_ids = set()
for c in server['classes']:
    for k in c.get('constants', []):
        if k['name'] == 'componentId':
            comp_ids.add(k['value'])

enum_values = {}
for c in server.get('enums', []):
    enum_values[c['name']] = {k.get('value') for k in c.get('constants', [])}

JS_BUILTIN = set('''
push pop shift unshift slice splice concat join reverse sort indexOf lastIndexOf includes find findIndex findLast
filter map forEach reduce some every flat flatMap fill keys values entries at from of isArray
get set has delete clear add size
toString toFixed toUpperCase toLowerCase trim trimStart trimEnd split replace replaceAll startsWith endsWith padStart
padEnd repeat charAt charCodeAt codePointAt fromCharCode substring substr match matchAll test exec localeCompare normalize
floor ceil round abs min max sqrt sin cos atan2 atan asin acos random sign hypot pow log trunc PI
parse stringify assign freeze create defineProperty getOwnPropertyNames isFinite isNaN parseInt parseFloat fromEntries
then catch finally resolve reject all race allSettled
next return throw call apply bind
now getTime toISOString
log warn error info
'''.split())

# ---------------------------------------------------------------- kaynakları tara
files = []
for root, _, fs in os.walk(SRC):
    for f in fs:
        if f.endswith('.js'):
            files.append(os.path.join(root, f))

own = set()
code_all = {}
for f in files:
    s = open(f, encoding='utf-8').read()
    # yorumları ve dizgeleri kabaca at (metod adı taramasında yanlış alarm olmasın)
    code_all[f] = s
    for m in re.finditer(r'(?:function\*?\s+|^\s*(?:static\s+)?(?:async\s+)?\*?\s*)([A-Za-z_]\w*)\s*\(', s, re.M):
        own.add(m.group(1))
    for m in re.finditer(r'([A-Za-z_]\w*)\s*[:=]\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_]\w*\s*=>)', s):
        own.add(m.group(1))
    for m in re.finditer(r'(?:get|set)\s+([A-Za-z_]\w*)\s*\(', s):
        own.add(m.group(1))

errors = []


def err(f, msg):
    errors.append(f'{os.path.relpath(f, SRC)}: {msg}')


def strip_strings(s):
    s = re.sub(r'//[^\n]*', '', s)
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    s = re.sub(r'`(?:\\.|[^`\\])*`', '""', s, flags=re.S)
    s = re.sub(r'"(?:\\.|[^"\\\n])*"', '""', s)
    s = re.sub(r"'(?:\\.|[^'\\\n])*'", "''", s)
    return s


for f, s in code_all.items():
    # içe aktarımlar
    for m in re.finditer(r'import\s*\{([^}]*)\}\s*from\s*"(@minecraft/[\w-]+)"', s):
        mod = m.group(2)
        for name in [x.strip().split(' as ')[0].strip() for x in m.group(1).split(',') if x.strip()]:
            if mod not in exports:
                err(f, f'bilinmeyen modül {mod}')
            elif name not in exports[mod]:
                err(f, f'{mod} içinde "{name}" yok')
    # olaylar
    for m in re.finditer(r'\b(world|system)\.(beforeEvents|afterEvents)\.(\w+)', s):
        cname = ('World' if m.group(1) == 'world' else 'System') + ('BeforeEvents' if m.group(2) == 'beforeEvents' else 'AfterEvents')
        if m.group(3) not in events.get(cname, set()):
            err(f, f'{m.group(1)}.{m.group(2)}.{m.group(3)} 2.10.0 sürümünde yok')
    # bileşenler
    for m in re.finditer(r'getComponent\(\s*"([\w:]+)"', s):
        cid = m.group(1)
        if not cid.startswith('minecraft:'):
            cid = 'minecraft:' + cid
        if cid not in comp_ids:
            err(f, f'bileşen kimliği {m.group(1)} tanımlarda yok')
    # metod çağrıları
    body = strip_strings(s)
    for m in re.finditer(r'\.\s*([A-Za-z_]\w*)\s*\(', body):
        name = m.group(1)
        if name in members or name in JS_BUILTIN or name in own:
            continue
        line = body[:m.start()].count('\n') + 1
        err(f, f'satır ~{line}: .{name}() gerçek API\'de / kodda bulunamadı')


# ---------------------------------------------------------------- özellik mi metod mu?
funcs, props = set(), set()
for c in classes.values():
    for p in c.get('properties', []):
        props.add(p['name'])
    for fn in c.get('functions', []):
        funcs.add(fn['name'])
for f, s in code_all.items():
    body = strip_strings(s)
    for m in re.finditer(r'\.\s*([A-Za-z_]\w*)\s*\(', body):
        n = m.group(1)
        if n in props and n not in funcs and n not in own and n not in JS_BUILTIN:
            line = body[:m.start()].count('\n') + 1
            err(f, f'satır ~{line}: .{n} bir özellik, metod gibi çağrılmış')


# ---------------------------------------------------------------- olay alanları
def all_props(cname, seen=None):
    seen = seen or set()
    c = classes.get(cname)
    if not c or cname in seen:
        return set()
    seen.add(cname)
    out = {p['name'] for p in c.get('properties', [])} | {fn['name'] for fn in c.get('functions', [])}
    for b in c.get('base_types', []):
        out |= all_props(b.get('name'), seen)
    return out


def event_class(holder, ev):
    h = classes[holder]
    for p in h.get('properties', []):
        if p['name'] == ev:
            sig = classes.get(p['type']['name'])
            if not sig:
                return None
            for fn in sig.get('functions', []):
                if fn['name'] == 'subscribe':
                    cb = fn['arguments'][0]['type']
                    if cb.get('name') == 'closure':
                        return cb['closure_type']['argument_types'][0]['name']
    return None


for f, s in code_all.items():
    for m in re.finditer(r'\b(world|system)\.(beforeEvents|afterEvents)\.(\w+)(?:\?)?\.subscribe\(\s*\(?\s*(?:async\s*)?\(?(\w+)\)?\s*=>', s):
        holder = ('World' if m.group(1) == 'world' else 'System') + ('BeforeEvents' if m.group(2) == 'beforeEvents' else 'AfterEvents')
        ecls = event_class(holder, m.group(3))
        if not ecls:
            continue
        ok = all_props(ecls)
        var = m.group(4)
        # geri çağrının gövdesi: parantez dengesine göre
        i = m.end()
        depth = 1
        j = s.index('(', m.start() + len(m.group(0)) - len(m.group(0).split('subscribe(')[1]) - 1)
        depth, k = 0, j
        while k < len(s):
            ch = s[k]
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    break
            k += 1
        body = s[m.end():k]
        for mm in re.finditer(r'\b' + re.escape(var) + r'\.(\w+)', body):
            if mm.group(1) not in ok and mm.group(1) != 'cancel' or (mm.group(1) == 'cancel' and 'cancel' not in ok):
                line = s[:m.end() + mm.start()].count('\n') + 1
                err(f, f'satır {line}: {ecls} olayında "{mm.group(1)}" alanı yok')

# kullanılan ekipman yuvaları
for f, s in code_all.items():
    for m in re.finditer(r'(?:getEquipment|setEquipment|getEquipmentSlot)\(\s*"(\w+)"', s):
        if m.group(1) not in enum_values.get('EquipmentSlot', set()):
            err(f, f'EquipmentSlot "{m.group(1)}" geçersiz')

uniq = sorted(set(errors))
for e in uniq:
    print('  ✘', e)
print(f'API denetimi: {len(files)} dosya, {len(uniq)} sorun')
sys.exit(1 if uniq else 0)
