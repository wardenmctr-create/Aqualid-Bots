"""Ses tanımları: RP sounds/sound_definitions.json ve sounds.json (varlık sesleri)."""

# olay adı -> (dosyalar, ses düzeyi, en uzak duyulma)
DEFS = {
    'aqualit.robot.step': (['robot_step1', 'robot_step2', 'robot_step3', 'robot_step4'], 0.32, 14),
    'aqualit.robot.servo': (['robot_servo1', 'robot_servo2', 'robot_servo3'], 0.22, 12),
    'aqualit.robot.beep': (['robot_beep1', 'robot_beep2', 'robot_beep3', 'robot_beep4', 'robot_beep5', 'robot_beep6'], 0.55, 16),
    'aqualit.robot.ambient': (['robot_ambient1', 'robot_ambient2', 'robot_ambient3'], 0.35, 12),
    'aqualit.robot.hurt': (['robot_hurt1', 'robot_hurt2', 'robot_hurt3'], 0.75, 16),
    'aqualit.robot.death': (['robot_death'], 1.0, 20),
    'aqualit.robot.boot': (['robot_boot'], 0.7, 16),
    'aqualit.robot.swing': (['robot_swing1', 'robot_swing2'], 0.6, 16),
    'aqualit.power.charge': (['guc_sarj'], 0.9, 24),
    'aqualit.power.zap': (['guc_carp1', 'guc_carp2', 'guc_carp3'], 0.8, 20),
    'aqualit.power.teleport': (['guc_isinlan'], 0.9, 20),
    'aqualit.power.dome': (['guc_kubbe'], 0.9, 24),
    'aqualit.power.hook': (['guc_kanca'], 0.8, 20),
    # v0.2.5 epik efekt sesleri
    'aqualit.power.thunder': (['guc_gok1', 'guc_gok2'], 1.0, 64),
    'aqualit.power.crackle': (['guc_citirti1', 'guc_citirti2', 'guc_citirti3'], 0.55, 14),
    'aqualit.power.shock': (['guc_sok'], 1.0, 32),
    'aqualit.power.chain': (['guc_zincir'], 0.85, 20),
    'aqualit.power.blade': (['guc_kilic'], 0.95, 24),
    'aqualit.power.shadow': (['guc_golge'], 0.9, 20),
    # Keşif robotu (V3c)
    'aqualit.kesif.goggles': (['kesif_gozluk'], 0.8, 16),
    'aqualit.kesif.transform': (['kesif_donusum'], 0.9, 24),
    'aqualit.kesif.untransform': (['kesif_geri_donusum'], 0.9, 24),
    'aqualit.kesif.lock': (['kesif_kilit'], 0.9, 20),
    'aqualit.kesif.sparkle': (['kesif_parilti'], 0.7, 20),
    'aqualit.kesif.plane': (['kesif_ucak'], 0.9, 32),
    'aqualit.kesif.plane_loop': (['kesif_ucak_dongu'], 0.6, 32),
    'aqualit.kesif.boat': (['kesif_gemi'], 0.9, 28),
    'aqualit.kesif.boat_loop': (['kesif_gemi_dongu'], 0.6, 28),
    'aqualit.kesif.sonar': (['kesif_sonar'], 0.8, 28),
    'aqualit.kesif.sub_loop': (['kesif_denizalti_dongu'], 0.5, 20),
    'aqualit.kesif.rover': (['kesif_arazi'], 0.9, 28),
    'aqualit.kesif.rover_loop': (['kesif_arazi_dongu'], 0.6, 28),
    'aqualit.kesif.drill': (['kesif_matkap'], 0.9, 28),
    'aqualit.kesif.drill_loop': (['kesif_matkap_dongu'], 0.6, 28),
}

FILES = sorted({f for files, _, _ in DEFS.values() for f in files})


def sound_definitions():
    out = {}
    for ev, (files, vol, dist) in DEFS.items():
        out[ev] = {'category': 'neutral', 'max_distance': float(dist),
                   'sounds': [{'name': f'sounds/aqualit/{f}', 'volume': vol, 'load_on_low_memory': True} for f in files]}
    return {'format_version': '1.20.20', 'sound_definitions': out}


def sounds_json():
    return {'entity_sounds': {'entities': {
        'aqualit:robot': {'volume': 1.0, 'pitch': [0.92, 1.08], 'events': {
            'ambient': 'aqualit.robot.ambient',
            'hurt': 'aqualit.robot.hurt',
            'death': 'aqualit.robot.death',
        }},
    }}}


# animasyon ses efektleri: istemci varlığındaki kısa ad -> olay
ANIM_EFFECTS = {
    'step': 'aqualit.robot.step', 'servo': 'aqualit.robot.servo', 'beep': 'aqualit.robot.beep',
    'boot': 'aqualit.robot.boot', 'swing': 'aqualit.robot.swing', 'charge': 'aqualit.power.charge',
    'dome': 'aqualit.power.dome', 'hook': 'aqualit.power.hook',
}
