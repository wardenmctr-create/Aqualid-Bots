#!/usr/bin/env python3
"""Üretilen BP/RP dosyalarını resmi JSON şemalarına göre doğrular + basit tutarlılık kontrolleri."""
import json, os, sys, glob
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT7
import jsonschema

REF = os.environ.get('AQUALIT_REF', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ref'))
SCHEMAS = os.path.join(REF, 'json_schemas')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'out')
BP = os.path.join(OUT, 'Aqualit_BP')
RP = os.path.join(OUT, 'Aqualit_RP')

resources = []
for f in glob.glob(SCHEMAS + '/**/*.json', recursive=True):
    try:
        d = json.load(open(f))
    except Exception:
        continue
    sid = d.get('$id')
    if not sid:
        continue
    resources.append((sid, Resource(contents=d, specification=DRAFT7)))
registry = Registry().with_resources(resources)


def validator(sid):
    schema = registry.contents(sid)
    return jsonschema.Draft7Validator(schema, registry=registry)


errors = 0


def real(err):
    """Şemadaki oneOf belirsizliğinden (aynı dal iki kez) doğan sahte hataları ayıkla."""
    if 'is valid under each of' in err.message:
        return False
    if err.validator == 'oneOf' and err.context:
        # dallardan biri yalnızca belirsizlik yüzünden başarısızsa geçerli say
        by_branch = {}
        for c in err.context:
            by_branch.setdefault(c.schema_path[0], []).append(c)
        for branch, cs in by_branch.items():
            if all(not real(c) for c in cs):
                return False
        return True
    return True


def check(path, sid, inner=None):
    global errors
    data = json.load(open(path))
    doc = data[inner] if inner else data
    v = validator(sid)
    errs = sorted([e for e in v.iter_errors(doc) if real(e)], key=lambda e: list(e.path))
    for e in errs[:8]:
        errors += 1
        print(f'  HATA {os.path.relpath(path, OUT)} @ {"/".join(map(str, e.path))}: {e.message[:200]}')
    return not errs


n = 0
for f in sorted(glob.glob(BP + '/items/*.json')):
    n += check(f, '/server/item/1.26.30/ItemDocument.json', 'minecraft:item')
print('esyalar:', n)
n = 0
for f in sorted(glob.glob(BP + '/blocks/*.json')):
    n += check(f, '/server/block/1.26.20/Blocks.json', 'minecraft:block')
print('bloklar:', n)
n = 0
for f in sorted(glob.glob(BP + '/entities/*.json')):
    n += check(f, '/server/entity/1.26.50/ActorDocument.json', 'minecraft:entity')
print('varliklar:', n)
for f in sorted(glob.glob(BP + '/feature_rules/*.json')):
    check(f, '/client_server/world/1.21.20/Feature%20Rule.json', 'minecraft:feature_rules')
print('ozellik kurallari tamam')

# ---- tutarlılık: dokular, geometri, dil
it = json.load(open(RP + '/textures/item_texture.json'))['texture_data']
tt = json.load(open(RP + '/textures/terrain_texture.json'))['texture_data']
for k, v in list(it.items()) + list(tt.items()):
    p = os.path.join(RP, v['textures'] + '.png')
    if not os.path.exists(p):
        errors += 1
        print('  HATA eksik doku', p)
lang = open(RP + '/texts/tr_TR.lang', encoding='utf-8').read()
for f in glob.glob(BP + '/items/*.json'):
    d = json.load(open(f))['minecraft:item']
    icon = d['components'].get('minecraft:icon')
    if icon and icon not in it:
        errors += 1
        print('  HATA ikon tanımsız', icon)
    dn = d['components'].get('minecraft:display_name', {}).get('value')
    if dn and dn + '=' not in lang:
        errors += 1
        print('  HATA dil anahtarı yok', dn)
for f in glob.glob(BP + '/blocks/*.json'):
    d = json.load(open(f))['minecraft:block']
    tex = d['components']['minecraft:material_instances']['*']['texture']
    if tex not in tt:
        errors += 1
        print('  HATA blok dokusu tanımsız', tex)
# varlık dokuları
ce = json.load(open(RP + '/entity/aqualit_robot.entity.json'))['minecraft:client_entity']['description']
for k, v in ce['textures'].items():
    if not os.path.exists(os.path.join(RP, v + '.png')):
        errors += 1
        print('  HATA robot dokusu yok', v)
# animasyon referansları
anims = json.load(open(RP + '/animations/aqualit_robot.animation.json'))['animations']
ctrls = json.load(open(RP + '/animation_controllers/aqualit_robot.animation_controllers.json'))['animation_controllers']
for short, full in ce['animations'].items():
    if full.startswith('animation.aqualit') and full not in anims:
        errors += 1
        print('  HATA animasyon yok', full)
    if full.startswith('controller.') and full not in ctrls:
        errors += 1
        print('  HATA denetleyici yok', full)
for cname, c in ctrls.items():
    for sname, s in c['states'].items():
        for a in s.get('animations', []):
            key = a if isinstance(a, str) else list(a)[0]
            if key not in ce['animations']:
                errors += 1
                print('  HATA denetleyicide tanımsız animasyon', cname, sname, key)
        for tr in s.get('transitions', []):
            for tgt in tr:
                if tgt not in c['states']:
                    errors += 1
                    print('  HATA geçiş hedefi yok', cname, sname, tgt)
# geometri kemik adları ↔ animasyonlar
geo = json.load(open(RP + '/models/entity/aqualit_robot.geo.json'))['minecraft:geometry'][0]
bones = {b['name'] for b in geo['bones']}
for an, a in anims.items():
    for bn in a.get('bones', {}):
        if bn not in bones:
            errors += 1
            print('  HATA animasyonda olmayan kemik', an, bn)
rc = json.load(open(RP + '/render_controllers/aqualit_robot.render_controllers.json'))['render_controllers']
for name, r in rc.items():
    for pv in r.get('part_visibility', []):
        for bn in pv:
            if bn != '*' and bn not in bones:
                errors += 1
                print('  HATA görünürlükte olmayan kemik', bn)
# tarifler: eşya kimlikleri tanımlı mı
ids = {json.load(open(f))['minecraft:item']['description']['identifier'] for f in glob.glob(BP + '/items/*.json')}
ids |= {json.load(open(f))['minecraft:block']['description']['identifier'] for f in glob.glob(BP + '/blocks/*.json')}
for f in glob.glob(BP + '/recipes/*.json'):
    s = open(f).read()
    import re
    for m in re.findall(r'"(aqualit:[a-z0-9_]+)"', s):
        if m not in ids and not m.startswith('aqualit:smelt') and m.split(':')[1] not in os.path.basename(f) + 'x':
            if m not in ids:
                errors += 1
                print('  HATA tarifte bilinmeyen eşya', os.path.basename(f), m)

# ---- vanilla kimlikleri: tarif malzemeleri, etkiler, kütük blokları, giyilebilir dosyaları
VD = os.path.join(REF, 'vanilladata_modules') + '/'
van_items = {x['name'] for x in json.load(open(VD + 'mojang-items.json'))['data_items']}
van_blocks = {x['name'] for x in json.load(open(VD + 'mojang-blocks.json'))['data_items']}
van_fx = {x['name'].split(':')[1] for x in json.load(open(VD + 'mojang-effects.json'))['data_items']}
for f in glob.glob(BP + '/recipes/*.json'):
    for m in re.findall(r'"(minecraft:[a-z0-9_]+)"', open(f).read()):
        if m in ('minecraft:recipe_shaped', 'minecraft:recipe_shapeless', 'minecraft:recipe_furnace'):
            continue
        if m not in van_items and m not in van_blocks:
            errors += 1
            print('  HATA tarifte bilinmeyen vanilla eşyası', os.path.basename(f), m)
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'scripts')
for f in glob.glob(SRC + '/**/*.js', recursive=True):
    s = open(f, encoding='utf-8').read()
    for m in re.findall(r'(?:addEffect|removeEffect|getEffect)\(\s*"([a-z_]+)"', s):
        if m not in van_fx:
            errors += 1
            print('  HATA bilinmeyen etki', os.path.basename(f), m)
zd = open(SRC + '/zirh_data.js', encoding='utf-8').read()
for m in re.findall(r'"(minecraft:[a-z_]+)"', zd):
    if m not in van_blocks:
        errors += 1
        print('  HATA bilinmeyen kütük bloğu', m)
geos = set()
for f in glob.glob(RP + '/models/entity/*.json'):
    for g in json.load(open(f))['minecraft:geometry']:
        geos.add(g['description']['identifier'])
VANILLA_GEO = {'geometry.humanoid.armor.helmet', 'geometry.humanoid.armor.chestplate', 'geometry.humanoid.armor.leggings',
               'geometry.humanoid.armor.boots', 'geometry.player.armor.helmet', 'geometry.player.armor.chestplate',
               'geometry.player.armor.leggings', 'geometry.player.armor.boots'}
for f in glob.glob(RP + '/attachables/*.json'):
    d = json.load(open(f))['minecraft:attachable']['description']
    base = d['identifier'].split('.player')[0]
    if base not in ids:
        errors += 1
        print('  HATA giyilebilir için eşya yok', base)
    for k, v in d['textures'].items():
        if v.startswith('textures/misc/'):
            continue
        if not os.path.exists(os.path.join(RP, v + '.png')):
            errors += 1
            print('  HATA giyilebilir dokusu yok', v)
    g = d['geometry']['default']
    if g not in geos and g not in VANILLA_GEO:
        errors += 1
        print('  HATA giyilebilir geometrisi yok', g)
wearables = [json.load(open(f))['minecraft:item'] for f in glob.glob(BP + '/items/*.json')]
for w in wearables:
    if 'minecraft:wearable' in w['components']:
        iid = w['description']['identifier']
        if not os.path.exists(os.path.join(RP, 'attachables', iid.split(':')[1] + '.json')):
            errors += 1
            print('  HATA giyilebilir dosyası eksik', iid)
print('zırh/kimlik denetimi tamam')
# --- Bedrock sınırları: enum özellikleri ve blok durumları en fazla 16 değer, ad kuralları
import re as _re
_NAME = _re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,31}$')
for _f in glob.glob(os.path.join(BP, 'entities', '*.json')):
    _d = json.load(open(_f, encoding='utf-8'))
    _props = _d.get('minecraft:entity', {}).get('description', {}).get('properties', {})
    if len(_props) > 32:
        print('HATA', _f, 'özellik sayısı 32\'yi aşıyor:', len(_props)); errors += 1
    for _k, _v in _props.items():
        if _v.get('type') == 'enum':
            _vals = _v.get('values', [])
            if len(_vals) > 16:
                print('HATA', os.path.basename(_f), _k, 'enum değeri 16\'yı aşıyor:', len(_vals)); errors += 1
            for _x in _vals:
                if not _NAME.match(_x):
                    print('HATA', os.path.basename(_f), _k, 'geçersiz enum değeri:', _x); errors += 1
for _f in glob.glob(os.path.join(BP, 'blocks', '*.json')):
    _d = json.load(open(_f, encoding='utf-8'))
    for _k, _v in _d.get('minecraft:block', {}).get('description', {}).get('states', {}).items():
        if isinstance(_v, list) and len(_v) > 16:
            print('HATA', os.path.basename(_f), _k, 'blok durumu 16 değeri aşıyor:', len(_v)); errors += 1
print('enum/durum sınırları denetlendi')
# --- istemci varlıkları vanilla biçimiyle karşılaştır (görünmez robot hatasını bir daha önlemek için)
_VAN = os.path.join(REF, 'vanilla_rp', 'entity')
_allowed = set()
for _f in glob.glob(_VAN + '/*.json'):
    try:
        _d = json.load(open(_f, encoding='utf-8'))
    except Exception:
        continue
    _allowed |= set(_d.get('minecraft:client_entity', {}).get('description', {}).keys())
for _f in glob.glob(os.path.join(RP, 'entity', '*.json')):
    _d = json.load(open(_f, encoding='utf-8'))['minecraft:client_entity']['description']
    for _k in _d:
        if _allowed and _k not in _allowed:
            print('HATA', os.path.basename(_f), 'vanilla istemci varlıklarında olmayan alan:', _k); errors += 1
    for _k, _v in _d.get('sound_effects', {}).items():
        if not isinstance(_v, str):
            print('HATA', os.path.basename(_f), 'sound_effects değeri düz metin olmalı:', _k, _v); errors += 1
for _f in glob.glob(os.path.join(RP, 'animations', '*.json')):
    for _n, _a in json.load(open(_f, encoding='utf-8')).get('animations', {}).items():
        for _t, _e in _a.get('sound_effects', {}).items():
            if not isinstance(_e, dict) or 'effect' not in _e:
                print('HATA', _n, 'animasyon sound_effects {"effect": ...} olmalı'); errors += 1
        if _a.get('loop') not in (None, True, False, 'hold_on_last_frame'):
            print('HATA', _n, 'geçersiz loop', _a.get('loop')); errors += 1
print('istemci varlığı biçimi denetlendi')
# --- Mimar yapı dosyaları: her blok ve durum oyunun 26.x listesinde olmalı
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'gen'))
import yapi_paket as _YP  # noqa: E402
_mb = json.load(open(os.path.join(REF, 'vanilladata_modules', 'mojang-blocks.json')))
_props = {p['name']: [v['value'] for v in p.get('values', [])] for p in _mb['block_properties']}
_blk = {b['name']: {p['name'] for p in b.get('properties', [])} for b in _mb['data_items']}
_sfiles = sorted(glob.glob(os.path.join(BP, 'structures', 'aqualit', '*.mcstructure')))
_bad = 0
for _f in _sfiles:
    _W, _H, _D, _cells = _YP.oku(_f)
    for _name, _st in {(n, json.dumps(s, sort_keys=True)): None for n, s in _cells.values()}:
        _st = json.loads(_st)
        _full = 'minecraft:' + _name
        if _full not in _blk:
            print('HATA', os.path.basename(_f), 'bilinmeyen blok', _name); errors += 1; _bad += 1; continue
        for _k, _v in _st.items():
            if _k not in _blk[_full]:
                print('HATA', os.path.basename(_f), _name, 'durum yok:', _k); errors += 1; _bad += 1
            elif _props.get(_k) and _v not in _props[_k]:
                print('HATA', os.path.basename(_f), f'{_name}.{_k}={_v} geçersiz'); errors += 1; _bad += 1
print(f'yapı dosyaları denetlendi: {len(_sfiles)} yapı, {_bad} sorun')
print('TOPLAM HATA:', errors)
sys.exit(1 if errors else 0)
