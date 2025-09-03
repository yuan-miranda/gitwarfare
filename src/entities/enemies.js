export function createEnemies(scene) {
    const enemies = scene.physics.add.group({
        key: 'enemy',
        repeat: 100,
        setXY: { x: 50, y: 50, stepX: 20, stepY: 10 }
    });

    enemies.children.iterate((enemy) => {
        return enemy
            .setCollideWorldBounds(true)
            .setBounce(1)
            .setVelocity(
                Phaser.Math.Between(-50, 50),
                Phaser.Math.Between(-50, 50)
            );
    });

    return enemies;
}
