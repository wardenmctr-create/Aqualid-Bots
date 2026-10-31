#!/usr/bin/env python3
"""Aqualit Robotlari eklentisini uretir: BP + RP klasorleri ve .mcaddon paketi."""
import json, os, shutil, sys, uuid, zipfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'gen'))
sys.path.insert(0, ART)

import content as C          # noqa: E402
import entities as E         # noqa: E402
import robotgeo              # noqa: E402
import statue                # noqa: E402
import zirh as Z             # noqa: E402
import aqualit_set as A      # noqa: E402
import sesler_def as S       # noqa: E402
import kafa_ikon as KI       # noqa: E402
import efekt as FX           # noqa: E402
import efekt_doku as ED      # noqa: E402
import kesif_oyun as KO      # noqa: E402
import sandik_gen as SG      # noqa: E402
import yapi_kutuphane as YK  # noqa: E402
import dron as DR            # noqa: E402
import esya3d as E3          # noqa: E402
import kesif_dron as KD       # noqa: E402

OUT = os.path.join(HERE, 'out')
GEN = os.path.join(HERE, 'build_gen')
BP = os.path.join(OUT, 'Aqualit_BP')
RP = os.path.join(OUT, 'Aqualit_RP')
DOK = os.path.join(ART, 'dokular')
SES = os.path.join(ART, 'sesler')
NSU = uuid.UUID('6f1c2a7e-0d4b-4c39-9a8e-61a0c4b2d7f5')


def U(name):
    return str(uuid.uuid5(NSU, name))


def wj(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def copy_tex(src_name, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(os.path.join(DOK, src_name + '.png'), dst)


def manifests():
    v = C.VERSION
    wj(f'{BP}/manifest.json', {
        'format_version': 2,
        'header': {'name': 'Aqualit Robotları (Davranış)', 'description': 'Aqualit cevheri ve sevimli iş robotları',
                   'uuid': U('bp'), 'version': v, 'min_engine_version': [1, 26, 50]},
        'modules': [
            {'type': 'data', 'uuid': U('bp-data'), 'version': v},
            {'type': 'script', 'language': 'javascript', 'entry': 'scripts/main.js', 'uuid': U('bp-script'), 'version': v},
        ],
        'dependencies': [
            {'uuid': U('rp'), 'version': v},
            {'module_name': '@minecraft/server', 'version': '2.10.0'},
            {'module_name': '@minecraft/server-ui', 'version': '2.2.0'},
        ],
        'metadata': {'authors': ['Aqualit Robotları']},
    })
    wj(f'{RP}/manifest.json', {
        'format_version': 2,
        'header': {'name': 'Aqualit Robotları (Kaynak)', 'description': 'Aqualit robotlarının dokuları ve modelleri',
                   'uuid': U('rp'), 'version': v, 'min_engine_version': [1, 26, 50]},
        'modules': [{'type': 'resources', 'uuid': U('rp-res'), 'version': v}],
        'metadata': {'authors': ['Aqualit Robotları']},
    })
    # paket ikonu
    icon = Image.open(os.path.join(DOK, 'robot_madenci.png')).convert('RGBA').resize((112, 112), Image.NEAREST)
    bg = Image.new('RGBA', (128, 128), (13, 60, 54, 255))
    bg.alpha_composite(icon, (8, 8))
    bg.save(f'{BP}/pack_icon.png'); bg.save(f'{RP}/pack_icon.png')


def items():
    tex = {}

    def item(iid, comps, cat='items', group=None, icon=None):
        desc = {'identifier': f'aqualit:{iid}', 'menu_category': {'category': cat}}
        if group:
            desc['menu_category']['group'] = group
        base = {'minecraft:display_name': {'value': f'item.aqualit.{iid}.name'}}
        if icon:
            base['minecraft:icon'] = icon
            tex[icon] = icon
        base.update(comps)
        wj(f'{BP}/items/{iid}.json', {'format_version': '1.26.30', 'minecraft:item': {'description': desc, 'components': base}})

    for iid, name, icon in C.MATERIALS:
        item(iid, {'minecraft:max_stack_size': 64}, 'items', None, icon)
    for iid, name, icon, kind, dmg, group in C.TOOLS:
        comps = {
            'minecraft:max_stack_size': 1,
            'minecraft:hand_equipped': True,
            'minecraft:durability': {'max_durability': C.TOOL_DURABILITY},
            'minecraft:damage': dmg,
            'minecraft:enchantable': {'slot': kind, 'value': 12},
            'minecraft:repairable': {'repair_items': [
                {'items': ['aqualit:aqualit_ingot'], 'repair_amount': C.TOOL_DURABILITY // 4},
                {'items': [f'aqualit:{iid}'],
                 'repair_amount': 'context.other->q.remaining_durability + 0.12 * context.other->q.max_durability'}]},
            'minecraft:tags': {'tags': [f'minecraft:is_{kind}', 'minecraft:is_tool', 'minecraft:diamond_tier',
                                        'aqualit:tool']},
            'aqualit:tool': {'kind': kind},
        }
        if kind == 'sword':
            comps['minecraft:can_destroy_in_creative'] = False
            comps['minecraft:digger'] = {'use_efficiency': False, 'destroy_speeds': [
                {'block': 'minecraft:web', 'speed': 15}, {'block': 'minecraft:bamboo', 'speed': 10}]}
        else:
            comps['minecraft:digger'] = {'use_efficiency': True, 'destroy_speeds': [
                {'block': {'tags': C.DIG_TAGS[kind]}, 'speed': C.TOOL_SPEED}]}
        item(iid, comps, 'equipment', group, icon)
    # Aqualit sandıkları: oyunun tuzaklı sandığını koyar (dokusu Aqualit); türü betik kaydeder (sandik.js)
    SG.kilicli_icon(GEN)
    SG.nav_icons(GEN)
    for iid, name, icon, kind in C.CHESTS:
        # v0.3.2: eşya = aynı kimlikli 3B sandık bloğu (envanterde/elde oyunun sandığı gibi); konunca sandik.js
        # tuzaklı sandığa çevirir. Simge yalnız menülerde kullanılır.
        tex[icon] = icon
        item(iid, {'minecraft:max_stack_size': 16,
                   'minecraft:block_placer': {'block': f'aqualit:{iid}', 'replace_block_item': True},
                   'minecraft:tags': {'tags': ['aqualit:sandik', f'aqualit:sandik_{kind}']}}, 'items', None, None)
    for iid, name, icon in C.SANDIK_MARKERS:
        item(iid, {'minecraft:max_stack_size': 1, 'minecraft:tags': {'tags': ['aqualit:sandik_isaret']}},
             'none', None, icon)
    for iid, name, icon, kind, model, creative_only in C.ROBOTS:
        item(iid, {'minecraft:max_stack_size': 1, 'minecraft:rarity': 'epic' if model >= 4 else 'rare',
                   'aqualit:robot_item': {'type': kind, 'model': model}}, 'items', None, icon)
    for iid, name, icon, kind, text in C.DEVICES:
        comps = {'minecraft:max_stack_size': 1, 'aqualit:device': {'kind': kind},
                 'minecraft:rarity': 'epic' if kind == 'gear' else 'uncommon'}
        if kind == 'gear':
            comps['minecraft:glint'] = True
        item(iid, comps, 'equipment', None, icon)
    for iid, name, icon, kind in C.KESIF_ESYA:
        item(iid, {'minecraft:max_stack_size': 1, 'aqualit:device': {'kind': kind}, 'minecraft:rarity': 'rare',
                   'minecraft:glint': iid in ('kesif_radar', 'kesif_otopilot_acik')}, 'none', None, icon)
    # kapalı robot eşyaları (heykel) ve tamir kiti
    for iid, name, icon, variant in C.STATUE_ITEMS:
        src = Image.open(os.path.join(DOK, f'robot_{variant}.png'))
        statue.off_icon(src).save(os.path.join(GEN, f'{icon}.png'))
        item(iid, {'minecraft:max_stack_size': 1, 'aqualit:statue_item': {'variant': variant}}, 'items', None, icon)
    kid, kname, kicon = C.REPAIR_KIT
    statue.tamir_kiti().save(os.path.join(GEN, f'{kicon}.png'))
    item(kid, {'minecraft:max_stack_size': 1, 'minecraft:durability': {'max_durability': 5},
               'aqualit:repair_kit': {}, 'minecraft:rarity': 'uncommon'}, 'equipment', None, kicon)
    # ---------------- V2: Minecraft biçiminde alet simgeleri, zırhlar, kabuklar, büyü kitapları
    for t in A.TOOL_ICONS:
        A.tool_icon(t).save(os.path.join(GEN, f'{t}.png'))
    for a in A.ARMOR:
        A.armor_icon(a[0], a[2]).save(os.path.join(GEN, f'{a[0]}.png'))
    Z.build_icons(GEN)
    for iid, name, icon, tree in C.BARKS:
        item(iid, {'minecraft:max_stack_size': 64, 'minecraft:tags': {'tags': ['aqualit:kabuk']}}, 'items', None, icon)
    groups = {'slot.armor.head': 'minecraft:itemGroup.name.helmet', 'slot.armor.chest': 'minecraft:itemGroup.name.chestplate',
              'slot.armor.legs': 'minecraft:itemGroup.name.leggings', 'slot.armor.feet': 'minecraft:itemGroup.name.boots'}
    for iid, name, icon, tree, piece, slot, prot in C.BARK_ARMORS:
        dur = Z.BARK_MAX[piece]
        tags = ['aqualit:kabuk_zirhi', 'minecraft:is_armor'] + (['aqualit:nether_kabuk'] if tree in Z.NETHER else [])
        item(iid, {'minecraft:max_stack_size': 1,
                   'minecraft:wearable': {'slot': slot, 'protection': prot},
                   'minecraft:durability': {'max_durability': dur},
                   'minecraft:enchantable': {'slot': A.ENCH_SLOT[slot], 'value': 12},
                   'minecraft:repairable': {'repair_items': [
                       {'items': [f'aqualit:kabuk_{tree}'], 'repair_amount': dur // 4},
                       {'items': [f'aqualit:{iid}'],
                        'repair_amount': 'context.other->q.remaining_durability + 0.12 * context.other->q.max_durability'}]},
                   'minecraft:tags': {'tags': tags}},
             'equipment', groups[slot], icon)
    for iid, name, icon, st, piece, slot in C.STONE_ARMORS:
        cfg = Z.STONE_STATS[st]
        dur = Z.ARMOR_BASE[piece] * cfg['mult']
        item(iid, {'minecraft:max_stack_size': 1,
                   'minecraft:wearable': {'slot': slot, 'protection': cfg['prot'][piece]},
                   'minecraft:durability': {'max_durability': dur},
                   'minecraft:enchantable': {'slot': A.ENCH_SLOT[slot], 'value': cfg['ench']},
                   'minecraft:repairable': {'repair_items': [
                       {'items': [cfg['repair']], 'repair_amount': dur // 4},
                       {'items': [f'aqualit:{iid}'],
                        'repair_amount': 'context.other->q.remaining_durability + 0.12 * context.other->q.max_durability'}]},
                   'minecraft:tags': {'tags': ['aqualit:tas_zirh', 'minecraft:is_armor']}},
             'equipment', groups[slot], icon)
    groups = {'slot.armor.head': 'minecraft:itemGroup.name.helmet', 'slot.armor.chest': 'minecraft:itemGroup.name.chestplate',
              'slot.armor.legs': 'minecraft:itemGroup.name.leggings', 'slot.armor.feet': 'minecraft:itemGroup.name.boots'}
    for iid, name, icon, slot, prot, dur, _ in C.AQ_ARMORS:
        item(iid, {
            'minecraft:max_stack_size': 1,
            'minecraft:wearable': {'slot': slot, 'protection': prot},
            'minecraft:durability': {'max_durability': dur},
            'minecraft:enchantable': {'slot': A.ENCH_SLOT[slot], 'value': 10},
            'minecraft:repairable': {'repair_items': [
                {'items': ['aqualit:aqualit_ingot'], 'repair_amount': dur // 4},
                {'items': [f'aqualit:{iid}'],
                 'repair_amount': 'context.other->q.remaining_durability + 0.12 * context.other->q.max_durability'}]},
            'minecraft:tags': {'tags': ['minecraft:is_armor', 'aqualit:aqualit_zirh']},
        }, 'equipment', groups[slot], icon)
    for iid, name, icon, key in C.BOOKS:
        item(iid, {'minecraft:max_stack_size': 16, 'minecraft:glint': True, 'minecraft:rarity': 'uncommon',
                   'aqualit:buyu': {'key': key}}, 'items', None, icon)
    # RP: esya dokulari (+ arayuzde kullanilan ek dokular)
    tex['locked_slot'] = 'locked_slot'
    td = {}
    for name in tex:
        dst = f'{RP}/textures/items/{name}.png'
        gen = os.path.join(GEN, name + '.png')
        if os.path.exists(gen):
            shutil.copyfile(gen, dst)
        else:
            copy_tex(name, dst)
        td[name] = {'textures': f'textures/items/{name}'}
    wj(f'{RP}/textures/item_texture.json', {'resource_pack_name': 'aqualit', 'texture_name': 'atlas.items',
                                           'texture_data': td})


def el_modelleri():
    """v0.3.2: cihazların elde 3B modelleri (envanterde düz simge kalır)."""
    anims, _ = E3.cihaz_modelleri(RP, wj)
    wj(f'{RP}/animations/aqualit_el.animation.json', {'format_version': '1.10.0', 'animations': anims})


def blocks():
    td, sounds = {}, {'format_version': '1.21.40'}
    for bid, name, tex, hard, sound, color, tags in C.BLOCKS:
        comps = {
            'minecraft:display_name': f'tile.aqualit.{bid}.name',
            'minecraft:destructible_by_mining': {'seconds_to_destroy': hard},
            'minecraft:destructible_by_explosion': {'explosion_resistance': 6 if bid == 'aqualit_block' else 3},
            'minecraft:geometry': 'minecraft:geometry.full_block',
            'minecraft:material_instances': {'*': {'texture': tex, 'render_method': 'opaque'}},
            'minecraft:map_color': color,
            'minecraft:tags': tags,
        }
        if bid != 'aqualit_block':
            comps['minecraft:loot'] = 'loot_tables/empty.json'
        cat = {'category': 'nature', 'group': 'minecraft:itemGroup.name.ore'} if bid != 'aqualit_block' else \
              {'category': 'construction', 'group': 'minecraft:itemGroup.name.mineralBlocks'}
        wj(f'{BP}/blocks/{bid}.json', {'format_version': '1.26.20', 'minecraft:block': {
            'description': {'identifier': f'aqualit:{bid}', 'menu_category': cat}, 'components': comps}})
        copy_tex(tex, f'{RP}/textures/blocks/{tex}.png')
        td[tex] = {'textures': f'textures/blocks/{tex}'}
        sounds[f'aqualit:{bid}'] = {'sound': sound}
    statue_block(td, sounds)
    E3.sandik_bloklari(BP, RP, wj, C.CHESTS, td, sounds, None)
    wj(f'{RP}/textures/terrain_texture.json', {'resource_pack_name': 'aqualit', 'texture_name': 'atlas.terrain',
                                              'padding': 8, 'num_mip_levels': 4, 'texture_data': td})
    wj(f'{RP}/blocks.json', sounds)
    wj(f'{BP}/loot_tables/empty.json', {'pools': []})


def statue_block(td, sounds):
    os.makedirs(f'{RP}/textures/blocks', exist_ok=True)
    os.makedirs(f'{RP}/models/blocks', exist_ok=True)
    names, cubes, uv = statue.build_textures(f'{RP}/textures/blocks')
    for n in names:
        td[n] = {'textures': f'textures/blocks/{n}'}
    ids, _ = statue.build_pose_geometries(f'{RP}/models/blocks/kapali_robot.geo.json', cubes, uv)
    vis = statue.bone_visibility()
    T = "q.block_state('aqualit:tur')"
    P = "q.block_state('aqualit:poz')"
    D = "q.block_state('minecraft:cardinal_direction')"
    mat = lambda v: {'*': {'texture': f'kapali_{v}', 'render_method': 'alpha_test'}}
    perms = []
    for v in C.STATUE_VARIANTS[1:]:
        perms.append({'condition': f"{T} == '{v}'", 'components': {'minecraft:material_instances': mat(v)}})
    for pose in statue.POSE_KEYS[1:]:
        perms.append({'condition': f"{P} == '{pose}'", 'components': {
            'minecraft:geometry': {'identifier': ids[pose], 'bone_visibility': vis}}})
    for d, r in [('north', 0), ('west', 90), ('south', 180), ('east', -90)]:
        perms.append({'condition': f"{D} == '{d}'", 'components': {'minecraft:transformation': {'rotation': [0, r, 0]}}})
    doc = {'format_version': '1.26.20', 'minecraft:block': {
        'description': {
            'identifier': 'aqualit:kapali_robot',
            'menu_category': {'category': 'none', 'is_hidden_in_commands': False},
            'states': {'aqualit:tur': C.STATUE_VARIANTS, 'aqualit:poz': statue.POSE_KEYS},
            'traits': {'minecraft:placement_direction': {'enabled_states': ['minecraft:cardinal_direction'],
                                                          'y_rotation_offset': 180}},
        },
        'components': {
            'minecraft:display_name': 'tile.aqualit.kapali_robot.name',
            'minecraft:geometry': {'identifier': ids['ayakta'], 'bone_visibility': vis},
            'minecraft:material_instances': mat('madenci'),
            'minecraft:collision_box': {'origin': [-5, 0, -5], 'size': [10, 16, 10]},
            'minecraft:selection_box': {'origin': [-6, 0, -6], 'size': [12, 16, 12]},
            'minecraft:destructible_by_mining': {'seconds_to_destroy': 2.0},
            'minecraft:destructible_by_explosion': False,
            'minecraft:movable': {'movement_type': 'immovable'},
            'minecraft:tags': ['minecraft:is_pickaxe_item_destructible', 'aqualit:statue'],
            'minecraft:light_dampening': 0,
            'minecraft:loot': 'loot_tables/empty.json',
            'minecraft:map_color': '#2e5a52',
            'minecraft:block_entity': {'dynamic_properties': True},
            'aqualit:statue': {},
        },
        'permutations': perms,
    }}
    wj(f'{BP}/blocks/kapali_robot.json', doc)
    sounds['aqualit:kapali_robot'] = {'sound': 'metal'}


def worldgen():
    wj(f'{BP}/features/aqualit_ore_feature.json', {'format_version': '1.13.0', 'minecraft:ore_feature': {
        'description': {'identifier': 'aqualit:aqualit_ore_feature'},
        'count': 5,
        'replace_rules': [
            {'places_block': 'aqualit:aqualit_ore',
             'may_replace': ['minecraft:stone', 'minecraft:granite', 'minecraft:diorite', 'minecraft:andesite']},
            {'places_block': 'aqualit:deepslate_aqualit_ore', 'may_replace': ['minecraft:deepslate', 'minecraft:tuff']},
        ]}})
    wj(f'{BP}/feature_rules/aqualit_ore_feature_rule.json', {'format_version': '1.13.0', 'minecraft:feature_rules': {
        'description': {'identifier': 'aqualit:aqualit_ore_feature_rule', 'places_feature': 'aqualit:aqualit_ore_feature'},
        'conditions': {'placement_pass': 'underground_pass',
                       'minecraft:biome_filter': [{'test': 'has_biome_tag', 'operator': '==', 'value': 'overworld'}]},
        'distribution': {
            'iterations': 7,
            'coordinate_eval_order': 'zyx',
            'x': {'distribution': 'uniform', 'extent': [0, 16]},
            'y': {'distribution': 'triangle', 'extent': [-48, 16]},
            'z': {'distribution': 'uniform', 'extent': [0, 16]},
        }}})


def recipes():
    for kind, rid, body in C.RECIPES:
        ident = {'identifier': f'aqualit:{rid}'}
        if kind == 'shaped':
            doc = {'format_version': '1.20.10', 'minecraft:recipe_shaped': {
                'description': ident, 'tags': ['crafting_table'], 'pattern': body['pattern'], 'key': body['key'],
                'unlock': body['unlock'], 'result': body['result']}}
        elif kind == 'shapeless':
            doc = {'format_version': '1.20.10', 'minecraft:recipe_shapeless': {
                'description': ident, 'tags': ['crafting_table'], 'ingredients': body['ingredients'],
                'unlock': body['unlock'], 'result': body['result']}}
        else:
            doc = {'format_version': '1.20.10', 'minecraft:recipe_furnace': {
                'description': ident, 'unlock': [{'item': body['input']}], 'tags': body['tags'],
                'input': body['input'], 'output': body['output']}}
        wj(f'{BP}/recipes/{rid}.json', doc)


def entities():
    wj(f'{BP}/entities/robot.json', E.robot_bp())
    wj(f'{BP}/entities/robot_chest.json', E.chest_bp())
    os.makedirs(f'{RP}/textures/entity/aqualit_robot', exist_ok=True)
    os.makedirs(f'{RP}/textures/entity/aqualit_chest', exist_ok=True)
    os.makedirs(f'{RP}/models/entity', exist_ok=True)
    skins, _ = robotgeo.build(f'{RP}/textures/entity/aqualit_robot', f'{RP}/models/entity/aqualit_robot.geo.json')
    KI.build(None, f'{RP}/textures/ui/aqualit_bas')   # konum çubuğu: robot kafa simgeleri
    robotgeo.build_chest(f'{RP}/textures/entity/aqualit_chest', f'{RP}/models/entity/aqualit_chest.geo.json')
    wj(f'{RP}/entity/aqualit_robot.entity.json', E.robot_rp(skins))
    wj(f'{RP}/render_controllers/aqualit_robot.render_controllers.json', E.robot_render(skins))
    wj(f'{RP}/animations/aqualit_robot.animation.json', E.robot_animations())
    wj(f'{RP}/animation_controllers/aqualit_robot.animation_controllers.json', E.robot_controllers())
    wj(f'{RP}/entity/aqualit_chest.entity.json', E.chest_rp())
    wj(f'{RP}/animations/aqualit_chest.animation.json', E.chest_anims())
    wj(f'{RP}/animation_controllers/aqualit_chest.animation_controllers.json', E.chest_controller())
    wj(f'{RP}/render_controllers/aqualit_chest.render_controllers.json', E.chest_render())
    # Aqualit sandığı (v0.2.9): amblem plakalı depo varlığı + tuzaklı sandık dokusu
    wj(f'{BP}/entities/sandik_depo.json', SG.depo_bp())
    wj(f'{BP}/entities/sandik_ek.json', SG.depo_bp(extra=True))
    wj(f'{RP}/entity/aqualit_sandik_ek.entity.json', SG.ek_rp())
    wj(f'{RP}/entity/aqualit_sandik_depo.entity.json', SG.depo_rp())
    wj(f'{RP}/render_controllers/aqualit_sandik_depo.render_controllers.json', SG.depo_render())
    wj(f'{RP}/models/entity/aqualit_sandik_amblem.geo.json', SG.depo_geo())
    SG.build_textures(f'{RP}/textures/entity/aqualit_sandik', f'{RP}/textures/entity/chest')
    for n, doc in SG.texture_sets().items():
        wj(f'{RP}/textures/entity/chest/{n}.texture_set.json', doc)


def efektler():
    """Kılıçlı güç efektleri: parçacık atlası + parçacıklar, efekt varlığı (enerji kubbesi, gölge hayaleti)."""
    ED.build(f'{RP}/textures/particle', f'{RP}/textures/entity/aqualit_fx', f'{RP}/textures/entity/aqualit_robot')
    wj(f'{BP}/entities/fx.json', FX.fx_bp())
    wj(f'{RP}/entity/aqualit_fx.entity.json', FX.fx_rp())
    wj(f'{RP}/models/entity/aqualit_fx_kubbe.geo.json', FX.kubbe_geo())
    wj(f'{RP}/render_controllers/aqualit_fx.render_controllers.json', FX.fx_render())
    wj(f'{RP}/animations/aqualit_fx.animation.json', FX.fx_animations())
    for k, doc in FX.particles().items():
        wj(f'{RP}/particles/aqualit_{k}.json', doc)


def sounds():
    os.makedirs(f'{RP}/sounds/aqualit', exist_ok=True)
    for f in S.FILES:
        src = os.path.join(SES, f + '.ogg')
        if not os.path.exists(src):
            raise SystemExit(f'ses dosyası yok: {src} (önce python3 sesler.py)')
        shutil.copyfile(src, f'{RP}/sounds/aqualit/{f}.ogg')
    wj(f'{RP}/sounds/sound_definitions.json', S.sound_definitions())
    wj(f'{RP}/sounds.json', S.sounds_json())


def particles():
    """Çiftçinin su numarası: yükselen/düşen su topu ve sıçrama parçacıkları."""
    copy_tex('aqualit_su', f'{RP}/textures/particle/aqualit_su.png')
    def billboard(size):
        return {'size': [size, size], 'facing_camera_mode': 'rotate_xyz',
                'uv': {'texture_width': 16, 'texture_height': 16, 'uv': [0, 0], 'uv_size': [16, 16]}}
    base = {'material': 'particles_alpha', 'texture': 'textures/particle/aqualit_su'}
    wj(f'{RP}/particles/aqualit_su_topu.json', {'format_version': '1.10.0', 'particle_effect': {
        'description': {'identifier': 'aqualit:su_topu', 'basic_render_parameters': base},
        'components': {
            'minecraft:emitter_rate_instant': {'num_particles': 7},
            'minecraft:emitter_lifetime_once': {'active_time': 0.05},
            'minecraft:emitter_shape_sphere': {'radius': 0.22, 'surface_only': False, 'direction': 'outwards'},
            'minecraft:particle_initial_speed': 0.15,
            'minecraft:particle_lifetime_expression': {'max_lifetime': 0.16},
            'minecraft:particle_appearance_billboard': billboard('0.16 + variable.particle_random_1 * 0.12'),
            'minecraft:particle_appearance_lighting': {},
        }}})
    wj(f'{RP}/particles/aqualit_su_sicrama.json', {'format_version': '1.10.0', 'particle_effect': {
        'description': {'identifier': 'aqualit:su_sicrama', 'basic_render_parameters': base},
        'components': {
            'minecraft:emitter_rate_instant': {'num_particles': 18},
            'minecraft:emitter_lifetime_once': {'active_time': 0.05},
            'minecraft:emitter_shape_sphere': {'radius': 0.25, 'surface_only': True, 'direction': 'outwards'},
            'minecraft:particle_initial_speed': '2.0 + variable.particle_random_2 * 1.5',
            'minecraft:particle_motion_dynamic': {'linear_acceleration': [0, -14, 0], 'linear_drag_coefficient': 0.6},
            'minecraft:particle_lifetime_expression': {'max_lifetime': '0.35 + variable.particle_random_3 * 0.25'},
            'minecraft:particle_appearance_billboard': billboard('0.09 + variable.particle_random_1 * 0.07'),
            'minecraft:particle_appearance_lighting': {},
        }}})


def armor_rp():
    Z.build_rp(RP)
    l1, l2 = A.armor_layers()
    l1.save(f'{RP}/textures/models/armor/aqualit_1.png')
    l2.save(f'{RP}/textures/models/armor/aqualit_2.png')
    player_geo = {'slot.armor.head': ('geometry.player.armor.helmet', 'animation.armor.helmet.offset'),
                  'slot.armor.chest': ('geometry.player.armor.chestplate', 'animation.armor.chestplate.offset'),
                  'slot.armor.legs': ('geometry.player.armor.leggings', 'animation.armor.leggings.offset'),
                  'slot.armor.feet': ('geometry.player.armor.boots', 'animation.armor.boots.offset')}
    for a in A.ARMOR:
        aid, slot = a[0], a[3]
        wj(f'{RP}/attachables/{aid}.json', A.attachable(aid, slot))
        doc = A.attachable(aid, slot)
        d = doc['minecraft:attachable']['description']
        d['identifier'] = f'aqualit:{aid}.player'
        d['item'] = {f'aqualit:{aid}': "query.owner_identifier == 'minecraft:player'"}
        d['geometry'] = {'default': player_geo[slot][0]}
        d['scripts']['animate'] = ['offset']
        d['animations'] = {'offset': player_geo[slot][1]}
        wj(f'{RP}/attachables/{aid}.player.json', doc)


def zirh_data():
    """Script için zırh verisi (tek kaynak: gen/zirh.py)."""
    trees = {}
    for t in Z.TREES:
        for blk in t[4]:
            trees[f'minecraft:{blk}'] = t[0]
    bark = {}
    for t in Z.TREES:
        for p in Z.PIECES:
            bark[f'aqualit:{Z.bark_id(t[0], p[0])}'] = p[0]
    stone = {}
    for st in Z.STONES:
        for p in Z.PIECES:
            stone[f'aqualit:{Z.stone_id(st[0], p[0])}'] = {'tur': st[0], 'parca': p[0]}
    data = {
        'TREES': trees,
        'TREE_NAME': {t[0]: t[1] for t in Z.TREES},
        'ENCH': {e[0]: {'ad': e[1], 'tur': e[2], 'max': e[3]} for e in Z.ENCHANTS},
        'INCOMPAT': [list(p) for p in Z.INCOMPATIBLE],
        'BARK': bark,
        'STONE': stone,
        'AQ_SET': [f'aqualit:{a[0]}' for a in A.ARMOR],
        'NETHER': Z.NETHER,
        'BARK_MAX': Z.BARK_MAX,
        'BARK_SHARE': Z.BARK_SHARE,
    }
    lines = ['// Bu dosya build.py tarafından üretilir (gen/zirh.py). Elle düzenleme.']
    for k, v in data.items():
        lines.append(f'export const {k} = {json.dumps(v, ensure_ascii=False)};')
    with open(os.path.join(HERE, 'src', 'scripts', 'zirh_data.js'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')


def lang():
    lines = C.lang_lines()
    txt = '\n'.join(f'{k}={v}' for k, v in lines.items()) + '\n'
    for code in ('en_US', 'tr_TR'):
        os.makedirs(f'{RP}/texts', exist_ok=True)
        with open(f'{RP}/texts/{code}.lang', 'w', encoding='utf-8') as f:
            f.write(txt)
    wj(f'{RP}/texts/languages.json', ['en_US', 'tr_TR'])
    # paket adlari (manifestte duz metin kullaniliyor)


def mimar():
    """Mimar: yapı kütüphanesi (yapı dosyaları, menü resimleri, yapi_data.js) ve mini dron varlığı."""
    YK.build(BP, RP, os.path.join(HERE, 'src', 'scripts', 'yapi_data.js'))
    wj(f'{BP}/entities/dron.json', DR.bp())
    DR.build(f'{RP}/textures/entity/aqualit_dron', f'{RP}/models/entity/aqualit_dron.geo.json')
    wj(f'{RP}/entity/aqualit_dron.entity.json', DR.rp())
    wj(f'{RP}/animations/aqualit_dron.animation.json', DR.animations())
    wj(f'{RP}/animation_controllers/aqualit_dron.animation_controllers.json', DR.controller())
    wj(f'{RP}/render_controllers/aqualit_dron.render_controllers.json', DR.render_ctrl())


def scripts():
    src = os.path.join(HERE, 'src', 'scripts')
    dst = f'{BP}/scripts'
    shutil.copytree(src, dst)


def package():
    def zipdir(folder, zpath):
        with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
            for root, _, files in os.walk(folder):
                for fn in sorted(files):
                    full = os.path.join(root, fn)
                    z.write(full, os.path.relpath(full, folder))
    v = '.'.join(map(str, C.VERSION))
    bp_pack = os.path.join(OUT, 'Aqualit_BP.mcpack')
    rp_pack = os.path.join(OUT, 'Aqualit_RP.mcpack')
    zipdir(BP, bp_pack); zipdir(RP, rp_pack)
    addon = os.path.join(OUT, f'Aqualit_Robotlari_v{v}.mcaddon')
    with zipfile.ZipFile(addon, 'w', zipfile.ZIP_DEFLATED) as z:
        for folder, arc in ((BP, 'Aqualit_BP'), (RP, 'Aqualit_RP')):
            for root, _, files in os.walk(folder):
                for fn in sorted(files):
                    full = os.path.join(root, fn)
                    z.write(full, os.path.join(arc, os.path.relpath(full, folder)))
    return addon


def main():
    for d in (OUT, GEN):
        if os.path.exists(d):
            shutil.rmtree(d)
    os.makedirs(BP); os.makedirs(RP); os.makedirs(GEN)
    manifests(); items(); blocks(); el_modelleri(); worldgen(); recipes(); entities(); efektler(); KO.build(RP, BP, wj); KD.build(RP, BP, wj); sounds(); particles(); armor_rp(); lang(); zirh_data(); mimar(); scripts()
    addon = package()
    print('paket:', addon)


if __name__ == '__main__':
    main()
