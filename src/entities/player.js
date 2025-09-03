export function createPlayer(scene, x = 400, y = 300) {
    const player = scene.physics.add.sprite(x, y, 'player');
    player
        .setCollideWorldBounds(true)
        .setDamping(true)
        .setDrag(100)
        .setMaxVelocity(200);
    return player;
}
