"""Java şemalarını (.schematic / .schem / .nbt) Mimar yapısına çevirir: Bedrock 26.x blok adları ve durumları.

Zincir: eski sayı:veri → Java 1.13+ durumu (java_legacy.json) → Bedrock 1.19.1 (java_bedrock_1.19.1.json)
→ Bedrock 26.x (upgrade/*.json, pmmp yükseltme şemaları). Sonuç mojang-blocks.json ile denetlenir;
bilinmeyen blok atlanır ve sayılır. Kaynaklar ve lisanslar: ref/yapi_cevir/KAYNAKLAR.md.
"""
import gzip
import io
import json
import os

import nbtlib

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.environ.get('AQUALIT_REF', os.path.join(HERE, '..', '..', 'ref'))
CV = os.path.join(REF, 'yapi_cevir')

# Bedrock'ta çalışmayan ya da robotun koymaması gereken bloklar
YASAK = {'air', 'structure_void', 'structure_block', 'command_block', 'chain_command_block', 'repeating_command_block',
         'barrier', 'bedrock', 'jigsaw', 'light_block', 'border_block', 'allow', 'deny', 'moving_block', 'piston_arm_collision',
         'sticky_piston_arm_collision', 'portal', 'end_portal', 'end_gateway', 'mob_spawner', 'fire', 'soul_fire',
         'unknown', 'info_update', 'info_update2', 'reserved6', 'netherreactor', 'invisible_bedrock'}

KOSU = ('toggle_bit', 'powered_bit', 'triggered_bit', 'output_lit_bit', 'button_pressed_bit', 'redstone_signal',
        'occupied_bit', 'update_bit', 'rail_data_bit')


def _norm(v):
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, str):
        lv = v.lower()
        if lv in ('true', 'false'):
            return int(lv == 'true')
        try:
            return int(v)
        except ValueError:
            return v
    return int(v) if isinstance(v, (int, float)) else v


# ------------------------------------------------------------------ veri
_D = {}


def _data():
    if _D:
        return _D
    _D['legacy'] = json.load(open(os.path.join(CV, 'java_legacy.json')))['blocks']
    exact, byname = {}, {}
    for m in json.load(open(os.path.join(CV, 'java_bedrock_1.19.1.json'))):
        pc, pe = m['pc'], m['pe']
        st = {k: _norm(v) for k, v in pc['states'].items()}
        key = (pc['name'], tuple(sorted(st.items())))
        if key in exact:          # dosyada ters yön (Bedrock → Java) kopyaları da var; ilki doğru olan
            continue
        exact[key] = pe
        byname.setdefault(pc['name'], []).append((st, pe))
    _D['exact'], _D['byname'] = exact, byname
    sch = []
    for fn in sorted(os.listdir(os.path.join(CV, 'upgrade'))):
        sch.append(json.load(open(os.path.join(CV, 'upgrade', fn))))
    _D['schemas'] = sch
    d = json.load(open(os.path.join(REF, 'vanilladata_modules', 'mojang-blocks.json')))
    props = {p['name']: [v['value'] for v in p.get('values', [])] for p in d['block_properties']}
    _D['blocks'] = {b['name']: {p['name']: props.get(p['name'], []) for p in b.get('properties', [])}
                    for b in d['data_items']}
    return _D


# ------------------------------------------------------------------ Java → Bedrock 1.19.1
def parse_java(s):
    """'minecraft:oak_stairs[facing=east,half=bottom]' → ('oak_stairs', {facing: 'east', ...})"""
    s = s.strip()
    name, st = s, {}
    if '[' in s:
        name, rest = s.split('[', 1)
        for kv in rest.rstrip(']').split(','):
            if '=' in kv:
                k, v = kv.split('=', 1)
                st[k.strip()] = _norm(v.strip())
    if ':' in name:
        ns, name = name.split(':', 1)
        if ns != 'minecraft':
            return None, {}
    return name, st


def java_to_pe(name, st):
    D = _data()
    pe = D['exact'].get((name, tuple(sorted(st.items()))))
    if pe:
        return pe
    cands = D['byname'].get(name)
    if not cands:
        return None
    # en çok uyuşan durum
    best, score = cands[0][1], -1
    for cst, cpe in cands:
        sc = sum(1 for k, v in st.items() if cst.get(k) == v) - sum(1 for k, v in cst.items() if k in st and st[k] != v)
        if sc > score:
            best, score = cpe, sc
    return best


# ------------------------------------------------------------------ Bedrock 1.19 → 26.x
def _flat(rule, val):
    v = str(val).lower() if isinstance(val, str) else str(val)
    v = rule.get('flattenedValueRemaps', {}).get(v, v)
    return rule['prefix'] + v + rule['suffix']


def _tv(t):  # {"int": 3} → 3
    return _norm(next(iter(t.values())))


def _apply(schema, name, st):
    rs = schema.get('remappedStates', {}).get(name)
    if rs:
        for r in rs:
            old = r.get('oldState') or {}
            if all(k in st and st[k] == _tv(v) for k, v in old.items()):
                if 'newName' in r:
                    nn = r['newName']
                else:
                    fr = r['newFlattenedName']
                    nn = _flat(fr, st.get(fr['flattenedProperty'], ''))
                ns = {k: _tv(v) for k, v in (r.get('newState') or {}).items()}
                for k in r.get('copiedState', []):
                    if k in st:
                        ns[k] = st[k]
                return nn, ns
    nn, ns = name, dict(st)
    for k, v in schema.get('addedProperties', {}).get(name, {}).items():
        ns.setdefault(k, _tv(v))
    for k in schema.get('removedProperties', {}).get(name, []):
        ns.pop(k, None)
    for prop, idx in schema.get('remappedPropertyValues', {}).get(name, {}).items():
        if prop in st:
            for pair in schema.get('remappedPropertyValuesIndex', {}).get(idx, []):
                if _tv(pair['old']) == st[prop]:
                    ns[prop] = _tv(pair['new'])
                    break
    for old, new in schema.get('renamedProperties', {}).get(name, {}).items():
        if old in ns:
            ns[new] = ns.pop(old)
    fr = schema.get('flattenedProperties', {}).get(name)
    if fr and fr['flattenedProperty'] in st:
        nn = _flat(fr, st[fr['flattenedProperty']])
        ns.pop(fr['flattenedProperty'], None)
    elif name in schema.get('renamedIds', {}):
        nn = schema['renamedIds'][name]
    return nn, ns


def upgrade(pe):
    name = pe['name'] if ':' in pe['name'] else 'minecraft:' + pe['name']
    st = {k: _norm(v) for k, v in pe['states'].items()}
    for sc in _data()['schemas']:
        name, st = _apply(sc, name, st)
    return name, st


def to_bedrock(java_state):
    """Java durum yazısı → (ad, durumlar) Bedrock 26.x; olmazsa None."""
    name, st = parse_java(java_state)
    if not name:
        return None
    pe = java_to_pe(name, st)
    if not pe:
        return None
    full, st = upgrade(pe)
    blocks = _data()['blocks']
    if full not in blocks:
        return None
    allowed = blocks[full]
    out = {}
    for k, v in st.items():
        vals = allowed.get(k)
        if vals is None:
            continue
        if vals and isinstance(vals[0], bool):
            v = bool(v)
        if vals and v not in vals:
            continue
        out[k] = v
    short = full.split(':', 1)[1]
    for k in KOSU:            # güç ve tetik durumları oyunda kendiliğinden kurulur
        if k in out:
            out[k] = False if isinstance(out[k], bool) else 0
    return None if short in YASAK else (short, out)


# ------------------------------------------------------------------ dosya okuyucular
def _load_nbt(raw):
    try:
        raw = gzip.decompress(raw)
    except OSError:
        pass
    return nbtlib.File.parse(io.BytesIO(raw))


def _varints(b):
    out, i, n = [], 0, len(b)
    while i < n:
        v, sh = 0, 0
        while True:
            c = b[i] & 0xFF
            i += 1
            v |= (c & 0x7F) << sh
            sh += 7
            if c < 0x80:
                break
        out.append(v)
    return out


def read(raw):
    """Ham dosya → (W, H, D, {(x,y,z): java_durum_yazısı}). x doğu, y yukarı, z güney."""
    root = _load_nbt(raw)
    r = root.get('Schematic', root)
    cells = {}
    if 'Blocks' in r and 'Data' in r and not isinstance(r['Blocks'], dict) and 'Palette' not in r:   # MCEdit
        W, H, D = int(r['Width']), int(r['Height']), int(r['Length'])
        blk = bytes(b & 0xFF for b in r['Blocks'])
        dat = bytes(b & 0xFF for b in r['Data'])
        add = bytes(b & 0xFF for b in r['AddBlocks']) if 'AddBlocks' in r else None
        leg = _data()['legacy']
        for i, bid in enumerate(blk):
            if add:
                a = add[i >> 1]
                bid |= ((a & 0x0F) if i & 1 else (a >> 4)) << 8
            if bid == 0:
                continue
            m = dat[i] & 0x0F
            s = leg.get(f'{bid}:{m}') or leg.get(f'{bid}:0')
            if s:
                x = i % W
                z = (i // W) % D
                y = i // (W * D)
                cells[(x, y, z)] = s
        return W, H, D, cells
    if 'Palette' in r or ('Blocks' in r and isinstance(r['Blocks'], dict)):   # Sponge v1/v2/v3
        W, H, D = int(r['Width']), int(r['Height']), int(r['Length'])
        if 'Palette' in r:
            pal, data = r['Palette'], r['BlockData']
        else:
            pal, data = r['Blocks']['Palette'], r['Blocks']['Data']
        inv = {int(v): str(k) for k, v in pal.items()}
        ids = _varints(bytes(b & 0xFF for b in data))
        for i, pid in enumerate(ids[:W * H * D]):
            s = inv.get(pid, 'minecraft:air')
            if s.endswith(':air') or 'air' == s:
                continue
            x = i % W
            z = (i // W) % D
            y = i // (W * D)
            cells[(x, y, z)] = s
        return W, H, D, cells
    if 'size' in r and 'blocks' in r:   # Java yapı bloğu .nbt
        W, H, D = (int(v) for v in r['size'])
        pal = r['palette'] if 'palette' in r else r['palettes'][0]
        names = []
        for p in pal:
            props = p.get('Properties', {})
            s = str(p['Name'])
            if props:
                s += '[' + ','.join(f'{k}={v}' for k, v in props.items()) + ']'
            names.append(s)
        for b in r['blocks']:
            s = names[int(b['state'])]
            if s.endswith(':air'):
                continue
            x, y, z = (int(v) for v in b['pos'])
            cells[(x, y, z)] = s
        return W, H, D, cells
    raise ValueError('bilinmeyen şema biçimi')


def convert(raw):
    """Ham dosya → (W, H, D, {(x,y,z): (ad, durumlar)}, istatistik)."""
    W, H, D, cells = read(raw)
    out, miss = {}, {}
    cache = {}
    for pos, s in cells.items():
        if s not in cache:
            cache[s] = to_bedrock(s)
        b = cache[s]
        if b is None:
            n = parse_java(s)[0] or s
            if n not in ('air', 'cave_air', 'void_air', 'structure_void'):
                miss[n] = miss.get(n, 0) + 1
            continue
        out[pos] = b
    return W, H, D, out, {'blok': len(out), 'eksik': miss}


def trim(W, H, D, cells):
    """Boş kenarları kırp, en alt dolu katı y=0'a indir."""
    if not cells:
        return 0, 0, 0, {}
    xs = [p[0] for p in cells]
    ys = [p[1] for p in cells]
    zs = [p[2] for p in cells]
    x0, y0, z0 = min(xs), min(ys), min(zs)
    out = {(x - x0, y - y0, z - z0): v for (x, y, z), v in cells.items()}
    return max(xs) - x0 + 1, max(ys) - y0 + 1, max(zs) - z0 + 1, out


def temizle(cells, kirinti=8):
    """Ana gövdeden kopuk küçük parçaları (≤ kirinti blok) at, sonra kırp."""
    seen, comps = set(), []
    for p in cells:
        if p in seen:
            continue
        st, comp = [p], []
        seen.add(p)
        while st:
            q = st.pop()
            comp.append(q)
            x, y, z = q
            for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
                n = (x + d[0], y + d[1], z + d[2])
                if n in cells and n not in seen:
                    seen.add(n)
                    st.append(n)
        comps.append(comp)
    big = max((len(c) for c in comps), default=0)
    keep = {}
    for c in comps:
        if len(c) > kirinti or len(c) > big * 0.5:
            for p in c:
                keep[p] = cells[p]
    return trim(0, 0, 0, keep)


if __name__ == '__main__':
    for t in ['minecraft:oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]', 'minecraft:granite',
              'minecraft:oak_log[axis=x]', 'minecraft:oak_planks', 'minecraft:spruce_door[facing=north,half=upper,hinge=left,open=false,powered=false]',
              'minecraft:white_wool', 'minecraft:stone_brick_slab[type=top,waterlogged=false]', 'minecraft:glass_pane[east=true,north=false,south=false,west=true,waterlogged=false]',
              'minecraft:wall_torch[facing=north]', 'minecraft:red_bed[facing=south,occupied=false,part=head]',
              'minecraft:cobblestone_wall[east=low,north=none,south=none,up=true,waterlogged=false,west=low]',
              'minecraft:oak_leaves[distance=1,persistent=true,waterlogged=false]', 'minecraft:grass_block[snowy=false]',
              'minecraft:chest[facing=west,type=single,waterlogged=false]', 'minecraft:hopper[enabled=true,facing=down]',
              'minecraft:redstone_wire[east=side,north=none,power=0,south=side,west=none]', 'minecraft:smooth_stone_slab[type=double,waterlogged=false]']:
        print(t, '→', to_bedrock(t))
