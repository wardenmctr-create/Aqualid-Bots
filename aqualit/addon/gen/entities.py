"""Robot ve robot sandigi: davranis (BP) + istemci (RP) varlik dosyalari, animasyonlar."""
from sesler_def import ANIM_EFFECTS

TYPES = ['madenci', 'kurekci', 'ciftci', 'oduncu', 'kilicli']
MOVES = ['none', 'walk', 'run', 'climb', 'swim']
ACTS = ['none', 'mine', 'dig', 'chop', 'hoe', 'place', 'carry', 'sit', 'wave', 'celebrate',
        'attack', 'sleep', 'think', 'look', 'boot']
# Bedrock'ta bir enum özelliği en fazla 16 değer alabilir; yeni hareketler ikinci özellikte (aqualit:act2)
ACTS2 = ['none',
         'p_hook', 'p_sword', 'p_dash', 'p_dome', 'p_thunder',   # V3: Kılıçlı güç hareketleri
         'water_throw', 'water_catch', 'water_pour',           # V3: çiftçinin Aqualit kova numarası
         'kit']                                                # V3: tamir kitiyle onarma
assert len(ACTS) <= 16 and len(ACTS2) <= 16
DMG_TIERS = [3, 5, 7, 8, 10, 12, 15, 18, 20, 25, 30, 40, 50, 75, 100]
SPD_TIERS = [0.2, 0.25, 0.3, 0.33, 0.36, 0.4, 0.45, 0.5, 0.55, 0.6]
CHEST_KINDS = ['genel', 'madenci', 'kurekci', 'ciftci', 'oduncu', 'kilicli']
DEVICE_INTERACT = [('aqualit:task_remote', 'remote'), ('aqualit:robot_radio', 'radio'),
                   ('aqualit:robot_tracker', 'tracker'), ('aqualit:command_rod', 'rod'),
                   ('aqualit:tuning_gear', 'gear'), ('aqualit:tamir_kiti', 'kit')]
ENV_SAFE = ['fall', 'suffocation', 'drowning', 'fire', 'fire_tick', 'lava', 'magma', 'freezing', 'contact',
            'falling_block']


# ============================================================ BP: robot
def robot_bp():
    interactions = []
    for item, key in DEVICE_INTERACT:
        interactions.append({
            'on_interact': {
                'filters': {'all_of': [
                    {'test': 'is_family', 'subject': 'other', 'value': 'player'},
                    {'test': 'has_equipment', 'subject': 'other', 'domain': 'hand', 'value': item},
                ]},
                'event': 'aqualit:interacted', 'target': 'self'},
            'interact_text': f'action.interact.aqualit.{key}',
            'swing': True,
        })
    groups = {
        'aqualit:worker': {
            'minecraft:damage_sensor': {'triggers': [
                {'on_damage': {'filters': {'test': 'is_owner', 'subject': 'other'}}, 'deals_damage': 'no'},
                {'on_damage': {'filters': {'test': 'is_family', 'subject': 'other', 'value': 'aqualit_robot'}},
                 'deals_damage': 'no'},
            ] + [{'cause': c, 'deals_damage': 'no'} for c in ENV_SAFE]},
            'minecraft:movement': {'value': 0.25},
        },
        'aqualit:kilicli': {
            'minecraft:health': {'value': 20, 'max': 20},
            'minecraft:damage_sensor': {'triggers': [
                {'on_damage': {'filters': {'test': 'is_owner', 'subject': 'other'}}, 'deals_damage': 'no'},
                {'on_damage': {'filters': {'test': 'is_family', 'subject': 'other', 'value': 'aqualit_robot'}},
                 'deals_damage': 'no'},
            ] + [{'cause': c, 'deals_damage': 'no'} for c in ['fall', 'suffocation', 'drowning', 'falling_block']]},
            'minecraft:behavior.float': {'priority': 0},
            'minecraft:behavior.random_stroll': {'priority': 9, 'speed_multiplier': 0.7, 'xz_dist': 4},
        },
        # savaş davranışları ayrı grupta: canı azalınca kaldırılıp yerine geri çekilme konur
        'aqualit:k_fight': {
            'minecraft:behavior.melee_box_attack': {'priority': 2, 'speed_multiplier': 1.3, 'track_target': True,
                                                     'require_complete_path': False, 'cooldown_time': 0.6},
            'minecraft:behavior.owner_hurt_by_target': {'priority': 1},
            'minecraft:behavior.owner_hurt_target': {'priority': 2},
            'minecraft:behavior.hurt_by_target': {'priority': 2,
                                                  'entity_types': {'filters': {'none_of': [
                                                      {'test': 'is_family', 'subject': 'other', 'value': 'player'},
                                                      {'test': 'is_family', 'subject': 'other', 'value': 'aqualit_robot'}]}}},
            'minecraft:behavior.nearest_attackable_target': {
                'priority': 3, 'must_see': False, 'reselect_targets': True, 'within_radius': 16,
                'entity_types': [{'filters': {'all_of': [
                    {'test': 'is_family', 'subject': 'other', 'value': 'monster'},
                    {'test': 'is_family', 'subject': 'other', 'operator': '!=', 'value': 'creeper'}]},
                    'max_dist': 16}]},
        },
        'aqualit:k_retreat': {
            'minecraft:behavior.avoid_mob_type': {'priority': 1, 'remove_target': True, 'entity_types': [
                {'filters': {'test': 'is_family', 'subject': 'other', 'value': 'monster'},
                 'max_dist': 12, 'walk_speed_multiplier': 1.2, 'sprint_speed_multiplier': 1.45}]},
        },
        'aqualit:k_follow': {
            'minecraft:behavior.follow_owner': {'priority': 4, 'speed_multiplier': 1.2, 'start_distance': 7,
                                                'stop_distance': 3, 'can_teleport': False, 'max_distance': 60},
        },
        'aqualit:k_guard': {
            'minecraft:home': {'restriction_radius': 16},
            'minecraft:behavior.move_towards_home_restriction': {'priority': 5, 'speed_multiplier': 1.1},
        },
        'aqualit:ticking': {
            'minecraft:tick_world': {'radius': 2, 'never_despawn': True},
        },
        'aqualit:tamed': {
            'minecraft:is_tamed': {},
        },
    }
    for d in DMG_TIERS:
        groups[f'aqualit:dmg_{d}'] = {'minecraft:attack': {'damage': d}}
    for i, s in enumerate(SPD_TIERS, start=1):
        groups[f'aqualit:spd_{i}'] = {'minecraft:movement': {'value': s}}

    dmg_all = [f'aqualit:dmg_{d}' for d in DMG_TIERS]
    spd_all = [f'aqualit:spd_{i}' for i in range(1, len(SPD_TIERS) + 1)]
    events = {
        'aqualit:interacted': {},
        'aqualit:tamed': {'add': {'component_groups': ['aqualit:tamed']}},
        'aqualit:as_worker': {'sequence': [
            {'remove': {'component_groups': ['aqualit:kilicli', 'aqualit:k_fight', 'aqualit:k_retreat', 'aqualit:k_follow',
                                             'aqualit:k_guard'] + dmg_all + spd_all}},
            {'add': {'component_groups': ['aqualit:worker']}}]},
        'aqualit:as_kilicli': {'sequence': [
            {'remove': {'component_groups': ['aqualit:worker', 'aqualit:k_guard']}},
            {'add': {'component_groups': ['aqualit:kilicli', 'aqualit:k_fight', 'aqualit:k_follow', 'aqualit:dmg_7',
                                          'aqualit:spd_3']}}]},
        'aqualit:fight_on': {'sequence': [{'remove': {'component_groups': ['aqualit:k_retreat']}},
                                          {'add': {'component_groups': ['aqualit:k_fight']}}]},
        'aqualit:retreat_on': {'sequence': [{'remove': {'component_groups': ['aqualit:k_fight']}},
                                            {'add': {'component_groups': ['aqualit:k_retreat']}}]},
        'aqualit:mode_follow': {'sequence': [
            {'remove': {'component_groups': ['aqualit:k_guard']}},
            {'add': {'component_groups': ['aqualit:k_follow']}}]},
        'aqualit:mode_guard': {'sequence': [
            {'remove': {'component_groups': ['aqualit:k_follow', 'aqualit:k_guard']}},
            {'add': {'component_groups': ['aqualit:k_guard']}}]},
        'aqualit:mode_stay': {'remove': {'component_groups': ['aqualit:k_follow', 'aqualit:k_guard']}},
        'aqualit:tick_on': {'add': {'component_groups': ['aqualit:ticking']}},
        'aqualit:tick_off': {'remove': {'component_groups': ['aqualit:ticking']}},
    }
    for d in DMG_TIERS:
        events[f'aqualit:dmg_{d}'] = {'sequence': [{'remove': {'component_groups': dmg_all}},
                                                   {'add': {'component_groups': [f'aqualit:dmg_{d}']}}]}
    for i in range(1, len(SPD_TIERS) + 1):
        events[f'aqualit:spd_{i}'] = {'sequence': [{'remove': {'component_groups': spd_all}},
                                                   {'add': {'component_groups': [f'aqualit:spd_{i}']}}]}

    return {
        'format_version': '1.26.0',
        'minecraft:entity': {
            'description': {
                'identifier': 'aqualit:robot',
                'is_spawnable': False,
                'is_summonable': True,
                'properties': {
                    'aqualit:type': {'type': 'enum', 'values': TYPES, 'default': 'madenci', 'client_sync': True},
                    'aqualit:model': {'type': 'int', 'range': [1, 5], 'default': 1, 'client_sync': True},
                    'aqualit:move': {'type': 'enum', 'values': MOVES, 'default': 'none', 'client_sync': True},
                    'aqualit:act': {'type': 'enum', 'values': ACTS, 'default': 'none', 'client_sync': True},
                    'aqualit:act2': {'type': 'enum', 'values': ACTS2, 'default': 'none', 'client_sync': True},
                },
            },
            'component_groups': groups,
            'components': {
                'minecraft:type_family': {'family': ['aqualit_robot', 'robot', 'mob']},
                'minecraft:ambient_sound_interval': {'value': 14.0, 'range': 20.0, 'event_name': 'ambient'},
                'minecraft:collision_box': {'width': 0.6, 'height': 0.95},
                'minecraft:health': {'value': 40, 'max': 40},
                'minecraft:physics': {},
                'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': True},
                'minecraft:persistent': {},
                'minecraft:nameable': {'always_show': False, 'allow_name_tag_renaming': False},
                'minecraft:movement': {'value': 0.25},
                'minecraft:movement.basic': {},
                'minecraft:navigation.walk': {'can_path_over_water': True, 'avoid_damage_blocks': True,
                                              'can_open_doors': True, 'can_pass_doors': True, 'avoid_water': False},
                'minecraft:jump.static': {},
                'minecraft:can_climb': {},
                'minecraft:breathable': {'breathes_water': True, 'breathes_air': True, 'suffocate_time': 0,
                                         'total_supply': 15},
                'minecraft:fire_immune': {},
                'minecraft:knockback_resistance': {'value': 0.6},
                'minecraft:inventory': {'inventory_size': 27, 'container_type': 'inventory', 'private': True},
                'minecraft:tameable': {'probability': 0.0, 'tame_items': 'aqualit:robot_radio',
                                       'tame_event': {'event': 'aqualit:tamed', 'target': 'self'}},
                'minecraft:leashable': {'soft_distance': 4, 'hard_distance': 6, 'max_distance': 10},
                'minecraft:follow_range': {'value': 32, 'max': 32},
                'minecraft:is_hidden_when_invisible': {},
                'minecraft:conditional_bandwidth_optimization': {},
                'minecraft:behavior.look_at_player': {'priority': 8, 'look_distance': 6, 'probability': 0.02},
                'minecraft:behavior.random_look_around': {'priority': 9},
                'minecraft:interact': {'interactions': interactions},
                'minecraft:loot': {'table': 'loot_tables/empty.json'},
            },
            'events': events,
        },
    }


# ============================================================ BP: sandik
def chest_bp():
    return {
        'format_version': '1.26.0',
        'minecraft:entity': {
            'description': {
                'identifier': 'aqualit:robot_chest',
                'is_spawnable': False,
                'is_summonable': True,
                'properties': {
                    'aqualit:kind': {'type': 'enum', 'values': CHEST_KINDS, 'default': 'genel', 'client_sync': True},
                    'aqualit:open': {'type': 'bool', 'default': False, 'client_sync': True},
                },
            },
            'components': {
                'minecraft:type_family': {'family': ['aqualit_chest', 'inanimate']},
                'minecraft:collision_box': {'width': 0.875, 'height': 0.875},
                'minecraft:health': {'value': 100, 'max': 100},
                'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
                'minecraft:physics': {'has_gravity': False},
                'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
                'minecraft:knockback_resistance': {'value': 1.0},
                'minecraft:persistent': {},
                'minecraft:inventory': {'inventory_size': 27, 'container_type': 'minecart_chest', 'private': False},
                'minecraft:nameable': {'always_show': False, 'allow_name_tag_renaming': True},
                'minecraft:fire_immune': {},
                'minecraft:is_collidable': {},
                'minecraft:rotation_axis_aligned': {},
                'minecraft:conditional_bandwidth_optimization': {},
                'minecraft:loot': {'table': 'loot_tables/empty.json'},
            },
            'events': {},
        },
    }


# ============================================================ RP: robot animasyonlari
def kf(*pairs):
    return {str(t): v for t, v in pairs}


ANTENNAS = ['antenna_ball19', 'antenna_ball20', 'antenna_leaf19', 'antenna_sprout23']


def ant(rot):
    return {a: {'rotation': rot} for a in ANTENNAS}


def robot_animations():
    A = {}
    A['setup'] = {'loop': True, 'bones': {
        'rightItem': {'rotation': [0, 0, 0], 'position': [0, 0, 0], 'scale': 0.6}}}
    # bekleme: nefes, anten salinimi
    A['idle'] = {'loop': True, 'animation_length': 4.0, 'bones': {
        'body': {'position': [0, 'math.sin(q.anim_time * 90) * 0.15', 0]},
        'head': {'rotation': [0, 0, 'math.sin(q.anim_time * 90 + 30) * 1.5']},
        'right_arm': {'rotation': [0, 0, '2 + math.sin(q.anim_time * 90) * 1.5']},
        'left_arm': {'rotation': [0, 0, '-2 - math.sin(q.anim_time * 90) * 1.5']},
        'cape': {'rotation': ['5 + math.sin(q.anim_time * 90) * 2', 0, 0]},
        **ant([0, 0, 'math.sin(q.anim_time * 180) * 6']),
    }}
    walk_b = {
        'right_leg': {'rotation': ['math.cos(q.anim_time * 600) * 35', 0, 0]},
        'left_leg': {'rotation': ['-math.cos(q.anim_time * 600) * 35', 0, 0]},
        'body': {'position': [0, 'math.abs(math.sin(q.anim_time * 600)) * 0.6', 0],
                 'rotation': [2, 'math.sin(q.anim_time * 600) * 4', 0]},
        'head': {'rotation': [0, 0, 'math.sin(q.anim_time * 600) * 3']},
        'cape': {'rotation': ['15 + math.sin(q.anim_time * 1200) * 5', 0, 0]},
        **ant(['-math.sin(q.anim_time * 1200) * 8', 0, 'math.sin(q.anim_time * 600) * 5']),
    }
    walk_arms = {
        'right_arm': {'rotation': ['-math.cos(q.anim_time * 600) * 28', 0, 2]},
        'left_arm': {'rotation': ['math.cos(q.anim_time * 600) * 28', 0, -2]},
    }
    A['walk'] = {'loop': True, 'animation_length': 0.6, 'bones': {**walk_b, **walk_arms}}
    A['walk_legs'] = {'loop': True, 'animation_length': 0.6, 'bones': dict(walk_b)}
    run_b = {
        'right_leg': {'rotation': ['math.cos(q.anim_time * 900) * 50', 0, 0]},
        'left_leg': {'rotation': ['-math.cos(q.anim_time * 900) * 50', 0, 0]},
        'body': {'position': [0, 'math.abs(math.sin(q.anim_time * 900)) * 1.0', 0],
                 'rotation': [12, 'math.sin(q.anim_time * 900) * 6', 0]},
        'head': {'rotation': [-10, 0, 'math.sin(q.anim_time * 900) * 4']},
        'cape': {'rotation': ['35 + math.sin(q.anim_time * 1800) * 8', 0, 0]},
        **ant(['20 - math.sin(q.anim_time * 1800) * 10', 0, 0]),
    }
    A['run'] = {'loop': True, 'animation_length': 0.4, 'bones': {
        **run_b,
        'right_arm': {'rotation': ['-math.cos(q.anim_time * 900) * 55', 0, 6]},
        'left_arm': {'rotation': ['math.cos(q.anim_time * 900) * 55', 0, -6]},
    }}
    A['run_legs'] = {'loop': True, 'animation_length': 0.4, 'bones': dict(run_b)}
    A['climb'] = {'loop': True, 'animation_length': 0.5, 'bones': {
        'right_arm': {'rotation': ['-100 + math.sin(q.anim_time * 720) * 20', 0, 8]},
        'left_arm': {'rotation': ['-100 - math.sin(q.anim_time * 720) * 20', 0, -8]},
        'right_leg': {'rotation': ['-20 + math.sin(q.anim_time * 720) * 25', 0, 0]},
        'left_leg': {'rotation': ['-20 - math.sin(q.anim_time * 720) * 25', 0, 0]},
        'body': {'rotation': [-5, 0, 0]},
    }}
    A['swim'] = {'loop': True, 'animation_length': 1.0, 'bones': {
        'right_arm': {'rotation': ['-40 + math.sin(q.anim_time * 360) * 40', 0, '20 + math.sin(q.anim_time * 360) * 15']},
        'left_arm': {'rotation': ['-40 + math.sin(q.anim_time * 360) * 40', 0, '-20 - math.sin(q.anim_time * 360) * 15']},
        'right_leg': {'rotation': ['math.sin(q.anim_time * 720) * 20', 0, 0]},
        'left_leg': {'rotation': ['-math.sin(q.anim_time * 720) * 20', 0, 0]},
        'body': {'position': [0, 'math.sin(q.anim_time * 360) * 0.5', 0]},
    }}
    A['air'] = {'loop': True, 'bones': {
        'right_arm': {'rotation': [-30, 0, 25]}, 'left_arm': {'rotation': [-30, 0, -25]},
        'right_leg': {'rotation': [-15, 0, 0]}, 'left_leg': {'rotation': [10, 0, 0]},
        **ant([-25, 0, 0]),
    }}
    # ---- isler
    A['mine'] = {'loop': True, 'animation_length': 0.5, 'bones': {
        'right_arm': {'rotation': kf((0.0, [-115, -10, 10]), (0.2, [-20, 0, 0]), (0.3, [-40, 0, 0]), (0.5, [-115, -10, 10]))},
        'left_arm': {'rotation': kf((0.0, [-20, 0, -5]), (0.2, [-35, 0, -5]), (0.5, [-20, 0, -5]))},
        'body': {'rotation': kf((0.0, [0, 0, 0]), (0.2, [8, -5, 0]), (0.5, [0, 0, 0]))},
        'head': {'rotation': kf((0.0, [0, 0, 0]), (0.2, [6, 0, 0]), (0.5, [0, 0, 0]))},
    }}
    A['dig'] = {'loop': True, 'animation_length': 0.7, 'bones': {
        'right_arm': {'rotation': kf((0.0, [-30, 0, 0]), (0.3, [-85, 0, 0]), (0.5, [-50, 0, 0]), (0.7, [-30, 0, 0]))},
        'left_arm': {'rotation': kf((0.0, [-30, 0, 0]), (0.3, [-85, 0, 0]), (0.5, [-50, 0, 0]), (0.7, [-30, 0, 0]))},
        'body': {'rotation': kf((0.0, [5, 0, 0]), (0.3, [18, 0, 0]), (0.7, [5, 0, 0]))},
    }}
    A['chop'] = {'loop': True, 'animation_length': 0.6, 'bones': {
        'right_arm': {'rotation': kf((0.0, [-90, 60, 0]), (0.25, [-90, -30, 0]), (0.6, [-90, 60, 0]))},
        'left_arm': {'rotation': kf((0.0, [-80, 50, 0]), (0.25, [-80, -20, 0]), (0.6, [-80, 50, 0]))},
        'body': {'rotation': kf((0.0, [0, 20, 0]), (0.25, [0, -15, 0]), (0.6, [0, 20, 0]))},
    }}
    A['hoe'] = {'loop': True, 'animation_length': 0.6, 'bones': {
        'right_arm': {'rotation': kf((0.0, [-70, 0, 0]), (0.25, [-15, 0, 0]), (0.6, [-70, 0, 0]))},
        'left_arm': {'rotation': kf((0.0, [-60, 0, 0]), (0.25, [-15, 0, 0]), (0.6, [-60, 0, 0]))},
        'body': {'rotation': kf((0.0, [5, 0, 0]), (0.25, [20, 0, 0]), (0.6, [5, 0, 0]))},
    }}
    A['place'] = {'loop': True, 'animation_length': 0.5, 'bones': {
        'right_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.2, [-70, 0, 0]), (0.5, [0, 0, 0]))},
        'body': {'rotation': kf((0.0, [0, 0, 0]), (0.2, [10, 0, 0]), (0.5, [0, 0, 0]))},
    }}
    A['carry'] = {'loop': True, 'animation_length': 1.0, 'bones': {
        'right_arm': {'rotation': ['-55 + math.sin(q.anim_time * 360) * 3', -10, 0]},
        'left_arm': {'rotation': ['-55 + math.sin(q.anim_time * 360) * 3', 10, 0]},
    }}
    A['sit'] = {'loop': True, 'animation_length': 2.0, 'bones': {
        'root': {'position': [0, -2.5, 0]},
        'right_leg': {'rotation': [-90, 8, 0]}, 'left_leg': {'rotation': [-90, -8, 0]},
        'right_arm': {'rotation': [-25, 0, 5]}, 'left_arm': {'rotation': [-25, 0, -5]},
        'head': {'rotation': ['math.sin(q.anim_time * 180) * 2', 0, 0]},
    }}
    A['wave'] = {'loop': True, 'animation_length': 1.0, 'bones': {
        'left_arm': {'rotation': [-10, 0, '-130 + math.sin(q.anim_time * 720) * 20']},
        'head': {'rotation': [0, 0, 8]},
        **ant([0, 0, 'math.sin(q.anim_time * 720) * 10']),
    }}
    A['celebrate'] = {'loop': True, 'animation_length': 0.8, 'bones': {
        'root': {'position': [0, 'math.abs(math.sin(q.anim_time * 450)) * 3', 0]},
        'right_arm': {'rotation': [0, 0, '130 + math.sin(q.anim_time * 900) * 15']},
        'left_arm': {'rotation': [0, 0, '-130 - math.sin(q.anim_time * 900) * 15']},
        'head': {'rotation': [0, 0, 'math.sin(q.anim_time * 450) * 10']},
        **{a: {'rotation': [0, 'q.anim_time * 720', 0]} for a in ANTENNAS},
    }}
    A['attack'] = {'loop': True, 'animation_length': 0.4, 'bones': {
        'right_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.1, [-95, 45, 20]), (0.25, [10, -30, 0]), (0.4, [0, 0, 0]))},
        'body': {'rotation': kf((0.0, [0, 0, 0]), (0.1, [0, 15, 0]), (0.25, [10, -20, 0]), (0.4, [0, 0, 0]))},
    }}
    A['sleep'] = {'loop': True, 'animation_length': 3.0, 'bones': {
        'head': {'rotation': ['25 + math.sin(q.anim_time * 120) * 2', 0, 0]},
        'body': {'rotation': [10, 0, 0], 'position': [0, -0.5, 0]},
        'right_arm': {'rotation': [10, 0, 8]}, 'left_arm': {'rotation': [10, 0, -8]},
        **ant([20, 0, 35]),
    }}
    A['think'] = {'loop': True, 'animation_length': 2.0, 'bones': {
        'head': {'rotation': [0, 0, '15 + math.sin(q.anim_time * 180) * 2']},
        'right_arm': {'rotation': [-95, 25, 0]},
        **ant([0, 0, 'math.sin(q.anim_time * 540) * 12']),
    }}
    A['look'] = {'loop': True, 'animation_length': 4.0, 'bones': {
        'head': {'rotation': [0, 'math.sin(q.anim_time * 90) * 40', 0]},
    }}
    A['boot'] = {'loop': False, 'animation_length': 1.4, 'bones': {
        'body': {'position': kf((0.0, [0, -4, 0]), (0.6, [0, 0.4, 0]), (0.8, [0, 0, 0]))},
        'head': {'rotation': kf((0.0, [40, 0, 0]), (0.6, [40, 0, 0]), (0.9, [-8, 0, 0]), (1.1, [0, 0, 0]))},
        'right_arm': {'rotation': kf((0.0, [15, 0, 10]), (0.9, [15, 0, 10]), (1.2, [0, 0, 0]))},
        'left_arm': {'rotation': kf((0.0, [15, 0, -10]), (0.9, [15, 0, -10]), (1.2, [0, 0, 0]))},
        **{a: {'rotation': kf((0.0, [0, 0, 40]), (0.9, [0, 0, 40]), (1.0, [0, 0, -20]), (1.2, [0, 0, 10]),
                              (1.4, [0, 0, 0]))} for a in ANTENNAS},
    }}
    # ---- Kılıçlı güçleri (V3)
    HOLD = 'hold_on_last_frame'
    A['p_hook'] = {'loop': HOLD, 'animation_length': 1.1, 'bones': {   # elektrik kancası: kol uzanır, ip çekilir
        'right_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.15, [-60, 10, 0]), (0.3, [-95, -5, 0]), (0.75, [-95, -5, 0]),
                                     (0.95, [-50, 0, 0]), (1.1, [-70, 0, 0]))},
        'left_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.3, [-30, 0, -15]), (1.1, [-20, 0, -10]))},
        'body': {'rotation': kf((0.0, [0, 0, 0]), (0.3, [5, -15, 0]), (0.95, [-10, 10, 0]), (1.1, [-6, 5, 0]))},
        'right_leg': {'rotation': kf((0.0, [0, 0, 0]), (0.3, [-15, 0, 0]))},
        'left_leg': {'rotation': kf((0.0, [0, 0, 0]), (0.3, [12, 0, 0]))},
        'cape': {'rotation': kf((0.0, [5, 0, 0]), (0.95, [25, 0, 0]), (1.1, [15, 0, 0]))},
    }}
    A['p_sword'] = {'loop': HOLD, 'animation_length': 1.4, 'bones': {  # yıldırım kılıcı: kılıç göğe kalkar
        'right_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.35, [-175, 0, 8]),
                                     (1.2, ['-176 + math.sin(q.anim_time * 2400) * 2', 0, 8]), (1.4, [-100, 10, 0]))},
        'left_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.35, [-10, 0, -25]), (1.4, [-5, 0, -10]))},
        'head': {'rotation': kf((0.0, [0, 0, 0]), (0.35, [-20, 0, 0]), (1.2, [-20, 0, 0]), (1.4, [0, 0, 0]))},
        'body': {'rotation': kf((0.0, [0, 0, 0]), (0.35, [-6, 0, 0]), (1.4, [0, 0, 0]))},
        'root': {'position': kf((0.0, [0, 0, 0]), (0.35, [0, 0.8, 0]), (0.6, [0, 0, 0]))},
        **ant(['math.sin(q.anim_time * 1800) * 12', 0, 'math.cos(q.anim_time * 1500) * 10']),
    }}
    A['p_dash'] = {'loop': HOLD, 'animation_length': 0.35, 'bones': {  # gölge adım: eğilip atılma
        'body': {'rotation': kf((0.0, [0, 0, 0]), (0.1, [30, 0, 0]), (0.35, [20, 0, 0]))},
        'right_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.1, [-60, 0, 30]), (0.35, [-100, -20, 10]))},
        'left_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.1, [40, 0, -20]), (0.35, [30, 0, -15]))},
        'right_leg': {'rotation': kf((0.0, [0, 0, 0]), (0.1, [-40, 0, 0]), (0.35, [-30, 0, 0]))},
        'left_leg': {'rotation': kf((0.0, [0, 0, 0]), (0.1, [35, 0, 0]), (0.35, [25, 0, 0]))},
        'root': {'position': kf((0.0, [0, 0, 0]), (0.1, [0, -1.2, 0]), (0.35, [0, -0.4, 0]))},
        'cape': {'rotation': kf((0.0, [5, 0, 0]), (0.1, [60, 0, 0]), (0.35, [45, 0, 0]))},
    }}
    A['p_dome'] = {'loop': HOLD, 'animation_length': 1.0, 'bones': {   # elektrik kubbe: kollar yukarı, kubbe açılır
        'right_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.4, [-15, 0, 150]), (1.0, [-15, 0, 155]))},
        'left_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.4, [-15, 0, -150]), (1.0, [-15, 0, -155]))},
        'body': {'rotation': kf((0.0, [0, 0, 0]), (0.4, [-8, 0, 0]), (1.0, [-5, 0, 0]))},
        'head': {'rotation': kf((0.0, [0, 0, 0]), (0.4, [-15, 0, 0]), (1.0, [-10, 0, 0]))},
        'root': {'position': kf((0.0, [0, 0, 0]), (0.4, [0, 1.0, 0]), (1.0, [0, 0.6, 0]))},
        'cape': {'rotation': kf((0.0, [5, 0, 0]), (0.4, [35, 0, 0]), (1.0, [25, 0, 0]))},
        **{a: {'rotation': [0, 'q.anim_time * 900', 0]} for a in ANTENNAS},
    }}
    A['p_thunder'] = {'loop': HOLD, 'animation_length': 1.8, 'bones': {  # gök gürültüsü: kılıç yukarı, yere çöküş
        'right_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.4, [-178, 0, 5]), (1.1, [-178, 0, 5]), (1.25, [-40, 0, 0]),
                                     (1.8, [-45, 0, 0]))},
        'left_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.4, [-20, 0, -30]), (1.1, [-20, 0, -30]), (1.25, [-60, 0, -10]))},
        'body': {'rotation': kf((0.0, [0, 0, 0]), (0.4, [-10, 0, 0]), (1.1, [-12, 0, 0]), (1.25, [28, 0, 0]),
                                (1.8, [20, 0, 0]))},
        'head': {'rotation': kf((0.0, [0, 0, 0]), (0.4, [-25, 0, 0]), (1.1, [-25, 0, 0]), (1.25, [10, 0, 0]))},
        'root': {'position': kf((0.0, [0, 0, 0]), (0.4, [0, 1.2, 0]), (1.1, [0, 1.4, 0]), (1.25, [0, -1.5, 0]),
                                (1.8, [0, -1.0, 0]))},
        'right_leg': {'rotation': kf((0.0, [0, 0, 0]), (1.1, [0, 0, 0]), (1.25, [-60, 0, 0]))},
        'left_leg': {'rotation': kf((0.0, [0, 0, 0]), (1.1, [0, 0, 0]), (1.25, [40, 0, 0]))},
        'cape': {'rotation': kf((0.0, [5, 0, 0]), (1.1, [10, 0, 0]), (1.25, [55, 0, 0]))},
        **ant(['math.sin(q.anim_time * 2000) * 15', 0, 0]),
    }}
    # ---- çiftçi: suyu yukarı fırlat, Aqualit kovayla yakala
    A['water_throw'] = {'loop': HOLD, 'animation_length': 0.55, 'bones': {
        'right_arm': {'rotation': kf((0.0, [25, 0, 8]), (0.12, [40, 0, 8]), (0.35, [-170, 0, 12]), (0.55, [-160, 0, 15]))},
        'left_arm': {'rotation': kf((0.0, [25, 0, -8]), (0.12, [40, 0, -8]), (0.35, [-170, 0, -12]), (0.55, [-160, 0, -15]))},
        'body': {'rotation': kf((0.0, [8, 0, 0]), (0.12, [12, 0, 0]), (0.35, [-10, 0, 0]), (0.55, [-6, 0, 0]))},
        'head': {'rotation': kf((0.0, [0, 0, 0]), (0.35, [-30, 0, 0]), (0.55, [-35, 0, 0]))},
        'root': {'position': kf((0.0, [0, -0.8, 0]), (0.12, [0, -1.2, 0]), (0.35, [0, 0.6, 0]), (0.55, [0, 0, 0]))},
    }}
    A['water_catch'] = {'loop': HOLD, 'animation_length': 1.0, 'bones': {
        'right_arm': {'rotation': kf((0.0, [-150, 0, 10]), (0.45, [-165, 0, 6]), (0.6, [-120, 0, 6]), (1.0, [-75, 0, 4]))},
        'left_arm': {'rotation': kf((0.0, [-150, 0, -10]), (0.45, [-160, 0, -20]), (1.0, [-30, 0, -10]))},
        'head': {'rotation': kf((0.0, [-35, 0, 0]), (0.5, [-30, 0, 0]), (1.0, [-5, 0, 0]))},
        'root': {'position': kf((0.0, [0, 0, 0]), (0.5, [0, 0, 0]), (0.6, [0, -0.8, 0]), (0.8, [0, 0, 0]))},
        **ant([0, 0, 'math.sin(q.anim_time * 900) * 10']),
    }}
    A['water_pour'] = {'loop': HOLD, 'animation_length': 0.7, 'bones': {   # kovayı öne eğip dök
        'right_arm': {'rotation': kf((0.0, [-75, 0, 4]), (0.25, [-95, -10, 8]), (0.5, [-120, -15, 10]), (0.7, [-115, -15, 10]))},
        'left_arm': {'rotation': kf((0.0, [-30, 0, -10]), (0.5, [-55, 20, -10]))},
        'body': {'rotation': kf((0.0, [0, 0, 0]), (0.5, [14, 0, 0]))},
        'head': {'rotation': kf((0.0, [-5, 0, 0]), (0.5, [18, 0, 0]))},
    }}
    # ---- tamir kiti: kiti göğsüne bastırır, kıvılcımlar
    A['kit'] = {'loop': True, 'animation_length': 0.8, 'bones': {
        'right_arm': {'rotation': kf((0.0, [-55, -25, 0]), (0.4, [-65, -30, 5]), (0.8, [-55, -25, 0]))},
        'left_arm': {'rotation': kf((0.0, [-45, 25, 0]), (0.4, [-50, 30, -5]), (0.8, [-45, 25, 0]))},
        'head': {'rotation': [16, 0, 0]},
        'body': {'position': [0, 'math.sin(q.anim_time * 900) * 0.2', 0]},
        **ant([0, 0, 'math.sin(q.anim_time * 1200) * 8']),
    }}
    # ---- ses efektleri (metalik robot sesleri)
    SFX = {
        'walk': {'0.0': 'step', '0.3': 'step'}, 'walk_legs': {'0.0': 'step', '0.3': 'step'},
        'run': {'0.0': 'step', '0.2': 'step'}, 'run_legs': {'0.0': 'step', '0.2': 'step'},
        'mine': {'0.0': 'servo'}, 'dig': {'0.0': 'servo'}, 'chop': {'0.0': 'servo'}, 'hoe': {'0.0': 'servo'},
        'place': {'0.0': 'servo'}, 'attack': {'0.08': 'swing'}, 'boot': {'0.0': 'boot'},
        'wave': {'0.0': 'beep'}, 'celebrate': {'0.0': 'beep'}, 'think': {'0.1': 'beep'},
        'p_hook': {'0.25': 'hook'}, 'p_sword': {'0.0': 'charge'}, 'p_dome': {'0.0': 'dome'},
        'p_thunder': {'0.0': 'charge'}, 'p_dash': {'0.0': 'servo'},
        'water_throw': {'0.0': 'servo'}, 'water_catch': {'0.55': 'servo'}, 'kit': {'0.0': 'servo'},
    }
    for k, fx in SFX.items():
        A[k]['sound_effects'] = {t: {'effect': e} for t, e in fx.items()}
    out = {}
    for k, v in A.items():
        out[f'animation.aqualit.robot.{k}'] = v
    return {'format_version': '1.8.0', 'animations': out}


def P(name):
    return f"q.property('aqualit:{name}')"


def robot_controllers():
    mv = P('move')
    act_none = f"({P('act')} == 'none' && {P('act2')} == 'none')"
    moving_native = "(q.modified_move_speed > 0.08)"
    states = {
        'default': {'animations': ['idle'], 'transitions': [
            {'swim': f"{mv} == 'swim'"},
            {'climb': f"{mv} == 'climb'"},
            {'run': f"{mv} == 'run' || ({mv} == 'none' && q.modified_move_speed > 0.6)"},
            {'walk': f"{mv} == 'walk' || ({mv} == 'none' && {moving_native})"},
            {'air': f"{mv} == 'none' && !q.is_on_ground && !q.is_in_water && q.vertical_speed < -0.3"},
        ], 'blend_transition': 0.2},
        'walk': {'animations': [{'walk': act_none}, {'walk_legs': f'!({act_none})'}], 'transitions': [
            {'default': f"!({mv} == 'walk' || ({mv} == 'none' && {moving_native}))"}], 'blend_transition': 0.2},
        'run': {'animations': [{'run': act_none}, {'run_legs': f'!({act_none})'}], 'transitions': [
            {'default': f"!({mv} == 'run' || ({mv} == 'none' && q.modified_move_speed > 0.6))"}],
            'blend_transition': 0.2},
        'climb': {'animations': ['climb'], 'transitions': [{'default': f"{mv} != 'climb'"}], 'blend_transition': 0.2},
        'swim': {'animations': ['swim'], 'transitions': [{'default': f"{mv} != 'swim'"}], 'blend_transition': 0.3},
        'air': {'animations': ['air'], 'transitions': [{'default': 'q.is_on_ground || q.is_in_water'}],
                'blend_transition': 0.25},
    }
    move = {'initial_state': 'default', 'states': states}
    act_states = {'default': {'transitions': [{a: f"{P('act')} == '{a}'"} for a in ACTS if a != 'none'],
                              'blend_transition': 0.15}}
    for a in ACTS:
        if a == 'none':
            continue
        act_states[a] = {'animations': [a], 'transitions': [{'default': f"{P('act')} != '{a}'"}],
                         'blend_transition': 0.15}
    act = {'initial_state': 'default', 'states': act_states}
    act2_states = {'default': {'transitions': [{a: f"{P('act2')} == '{a}'"} for a in ACTS2 if a != 'none'],
                               'blend_transition': 0.12}}
    for a in ACTS2:
        if a == 'none':
            continue
        act2_states[a] = {'animations': [a], 'transitions': [{'default': f"{P('act2')} != '{a}'"}],
                          'blend_transition': 0.12}
    act2 = {'initial_state': 'default', 'states': act2_states}
    return {'format_version': '1.10.0', 'animation_controllers': {
        'controller.animation.aqualit.robot.move': move,
        'controller.animation.aqualit.robot.act': act,
        'controller.animation.aqualit.robot.act2': act2,
    }}


def robot_rp(skins):
    t = P('type')
    pre = [
        f"v.t = ({t} == 'madenci') ? 0 : (({t} == 'kurekci') ? 1 : (({t} == 'ciftci') ? 2 : (({t} == 'oduncu') ? 3 : "
        f"(({t} == 'insaatci') ? 5 : (({t} == 'toplayici') ? 6 : 4)))));",
        f"v.m = math.clamp({P('model')}, 1, 5);",
        "v.skin = (v.t < 4) ? v.t : ((v.t == 4) ? (3 + v.m) : (v.t + 4));",
        f"v.asleep = {P('act')} == 'sleep';",
    ]
    anims = {
        'look_at_target': 'animation.common.look_at_target',
        'move_ctrl': 'controller.animation.aqualit.robot.move',
        'act_ctrl': 'controller.animation.aqualit.robot.act',
        'act2_ctrl': 'controller.animation.aqualit.robot.act2',
    }
    names = ['setup', 'idle', 'walk', 'walk_legs', 'run', 'run_legs', 'climb', 'swim', 'air'] + \
            [a for a in ACTS if a != 'none'] + [a for a in ACTS2 if a != 'none']
    for n in names:
        anims[n] = f'animation.aqualit.robot.{n}'
    textures = {}
    for s in skins:
        textures[s] = f'textures/entity/aqualit_robot/{s}'
        textures[s + '_glow'] = f'textures/entity/aqualit_robot/{s}_glow'
    return {
        'format_version': '1.10.0',
        'minecraft:client_entity': {
            'description': {
                'identifier': 'aqualit:robot',
                'materials': {'default': 'entity_alphatest', 'glow': 'copper_golem_eyes'},
                'textures': textures,
                'geometry': {'default': 'geometry.aqualit.robot'},
                'animations': anims,
                'scripts': {
                    'scale': '0.8',
                    'pre_animation': pre,
                    'animate': ['setup', {'look_at_target': f"{P('act')} == 'none' && {P('act2')} == 'none'"},
                                'move_ctrl', 'act_ctrl', 'act2_ctrl'],
                },
                'render_controllers': ['controller.render.aqualit.robot',
                                       {'controller.render.aqualit.robot_glow': '!v.asleep'}],
                'enable_attachables': True,
                'sound_effects': dict(ANIM_EFFECTS),  # vanilla biçimi: kısa ad -> ses olayı (düz metin)
            }
        }
    }


def robot_render(skins):
    vis = [
        {'*': True},
        {'helmet': 'v.t == 0'}, {'antenna_ball20': 'v.t == 0'},
        {'sand_bag': 'v.t == 1'}, {'antenna_ball19': 'v.t == 1 || v.t == 4'},
        {'hat': 'v.t == 2'}, {'antenna_sprout23': 'v.t == 2'},
        {'scarf': 'v.t == 3'}, {'antenna_leaf19': 'v.t == 3'},
        {'cape': 'v.t == 4'},
        {'right_shoulder': 'v.t == 4 && v.m >= 2'}, {'left_shoulder': 'v.t == 4 && v.m >= 2'},
        {'kova': f"{P('act2')} == 'water_catch' || {P('act2')} == 'water_pour'"},
        # İnşaatçı ve Toplayıcı aksesuarları (diğer robotlarda gizli)
        {'hardhat': 'v.t == 5'}, {'toolbelt': 'v.t == 5'}, {'blueprint': 'v.t == 5'},
        {'antenna_ball24': 'v.t == 5 || v.t == 6'},
        {'headset': 'v.t == 6'}, {'cap': 'v.t == 6'}, {'visor': 'v.t == 6'}, {'backpack': 'v.t == 6'},
    ]
    main = {
        'arrays': {'textures': {'Array.skins': [f'Texture.{s}' for s in skins]}},
        'geometry': 'Geometry.default',
        'materials': [{'*': 'Material.default'}],
        'textures': ['Array.skins[v.skin]'],
        'part_visibility': vis,
    }
    glow = {
        'arrays': {'textures': {'Array.glows': [f'Texture.{s}_glow' for s in skins]}},
        'geometry': 'Geometry.default',
        'materials': [{'*': 'Material.glow'}],
        'textures': ['Array.glows[v.skin]'],
        'part_visibility': vis,
        'ignore_lighting': True,
    }
    return {'format_version': '1.10.0', 'render_controllers': {
        'controller.render.aqualit.robot': main,
        'controller.render.aqualit.robot_glow': glow,
    }}


# ============================================================ RP: sandik
CHEST_TEX = {'genel': 'aqualit_chest', 'madenci': 'chest_miner', 'kurekci': 'chest_digger',
             'ciftci': 'chest_farmer', 'oduncu': 'chest_lumber', 'kilicli': 'aqualit_chest'}


def chest_rp():
    k = P('kind')
    textures = {kind: f'textures/entity/aqualit_chest/{fn}' for kind, fn in CHEST_TEX.items()}
    expr = ' : '.join(f"(({k} == '{kind}') ? {i}" for i, kind in enumerate(CHEST_KINDS)) + ' : 0' + ')' * len(CHEST_KINDS)
    return {
        'format_version': '1.10.0',
        'minecraft:client_entity': {
            'description': {
                'identifier': 'aqualit:robot_chest',
                'materials': {'default': 'entity_alphatest'},
                'textures': textures,
                'geometry': {'default': 'geometry.aqualit.robot_chest'},
                'animations': {'lid': 'controller.animation.aqualit.chest.lid',
                               'open': 'animation.aqualit.chest.open',
                               'close': 'animation.aqualit.chest.close'},
                'scripts': {'pre_animation': [f'v.k = {expr};'], 'animate': ['lid']},
                'render_controllers': ['controller.render.aqualit.chest'],
            }
        }
    }


def chest_anims():
    return {'format_version': '1.8.0', 'animations': {
        'animation.aqualit.chest.open': {'loop': 'hold_on_last_frame', 'animation_length': 0.3, 'bones': {
            'lid': {'rotation': kf((0.0, [0, 0, 0]), (0.3, [-75, 0, 0]))}}},
        'animation.aqualit.chest.close': {'loop': 'hold_on_last_frame', 'animation_length': 0.3, 'bones': {
            'lid': {'rotation': kf((0.0, [-75, 0, 0]), (0.3, [0, 0, 0]))}}},
    }}


def chest_controller():
    o = P('open')
    return {'format_version': '1.10.0', 'animation_controllers': {
        'controller.animation.aqualit.chest.lid': {'initial_state': 'closed', 'states': {
            'closed': {'transitions': [{'opening': o}]},
            'opening': {'animations': ['open'], 'transitions': [{'closing': f'!{o}'}]},
            'closing': {'animations': ['close'], 'transitions': [{'opening': o},
                                                                 {'closed': 'q.all_animations_finished'}]},
        }}}}


def chest_render():
    return {'format_version': '1.10.0', 'render_controllers': {
        'controller.render.aqualit.chest': {
            'arrays': {'textures': {'Array.k': [f'Texture.{kind}' for kind in CHEST_KINDS]}},
            'geometry': 'Geometry.default',
            'materials': [{'*': 'Material.default'}],
            'textures': ['Array.k[v.k]'],
        }}}
