// src/entities/player.js
export function createPlayer(scene, x = 0, y = 0) {
    const player = scene.physics.add.sprite(x, y, 'player');
    player
        .setCollideWorldBounds(true)
        .setDamping(true)
        .setDrag(100)
        .setMaxVelocity(200);
    return player;
}
