// src/ui/joystick.js
export function createJoystick(scene) {
    const joystick = scene.joystick.add(scene, {
        x: scene.cameras.main.width / 2,
        y: scene.cameras.main.height - 80,
        radius: 50,
        base: scene.add.circle(0, 0, 50, 0x888888, 0.4),
        thumb: scene.add.circle(0, 0, 25, 0xffffff, 0.7),
        forceMin: 0
    });

    scene.scale.on('resize', (windowSize) => {
        joystick.x = windowSize.width /  2;
        joystick.y = windowSize.height - 80;
    })

    return joystick;
}
