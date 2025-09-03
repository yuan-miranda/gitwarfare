// src/entities/enemies.js
export function createEnemies(scene, count = 100) {
    const enemies = scene.physics.add.group({
        key: 'enemy',
        repeat: count - 1,
        setXY: { x: 50, y: 50, stepX: 20, stepY: 10 }
    });

    enemies.children.iterate((enemy) => {
        return enemy
            .setCollideWorldBounds(true)
            .setBounce(1)
            .setVelocity(
                Phaser.Math.Between(scene.game.config.ENEMIES?.MIN_SPEED ?? -50, scene.game.config.ENEMIES?.MAX_SPEED ?? 50),
                Phaser.Math.Between(scene.game.config.ENEMIES?.MIN_SPEED ?? -50, scene.game.config.ENEMIES?.MAX_SPEED ?? 50)
            );
    });

    return enemies;
}

export function enableEnemyCollisions(scene, enemies) {
    scene.physics.add.collider(enemies, enemies);
}
