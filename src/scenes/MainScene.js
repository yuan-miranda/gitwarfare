import Phaser from "phaser";

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
    }

    preload() {
        const playerTexture = this.make.graphics({ x: 0, y: 0 });
        playerTexture.fillStyle(0xffffff, 1);
        playerTexture.fillRect(0, 0, 16, 16);
        playerTexture.generateTexture('player', 16, 16);

        const enemyTexture = this.make.graphics({ x: 0, y: 0 });
        enemyTexture.fillStyle(0x56D364, 1);
        enemyTexture.fillRect(0, 0, 16, 16);
        enemyTexture.generateTexture('enemy', 16, 16);
    }

    create() {
        this.score = 0;
        this.isPaused = false;

        // player
        this.player = this.physics.add.sprite(400, 300, 'player');
        this.player
            .setCollideWorldBounds(true)
            .setDamping(true)
            .setDrag(100)
            .setMaxVelocity(200);

        // input
        this.cursors = this.input.keyboard?.createCursorKeys();
        this.keys = this.input.keyboard?.addKeys('W,A,S,D');

        this.joystick = this.joystick.add(this, {
            x: this.cameras.main.width / 2,
            y: this.cameras.main.height - 80,
            radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888, 0.4),
            thumb: this.add.circle(0, 0, 25, 0xffffff, 0.7),
        });

        // enemies
        this.enemies = this.physics.add.group({
            key: 'enemy',
            repeat: 100,
            setXY: { x: 50, y: 50, stepX: 20, stepY: 10 }
        });
        this.enemies.children.iterate((enemy) => {
            return enemy
                .setCollideWorldBounds(true)
                .setBounce(1)
                .setVelocity(
                    Phaser.Math.Between(-50, 50),
                    Phaser.Math.Between(-50, 50)
                );
        });

        // particles
        this.particleBurst = this.add.particles(0, 0, 'enemy', {
            lifespan: 500,
            speed: { min: -150, max: 150 },
            scale: { start: 0.6, end: 0 },
            alpha: { start: 1, end: 0 },
            quantity: 20,
            emitting: false
        });

        // collision
        this.physics.add.overlap(
            this.player,
            this.enemies,
            this.handlePlayerEnemyCollision,
            undefined,
            this
        );

        // camera bounds
        this.cameras.main.setBounds(0, 0, 640, 480);

        this.input.keyboard?.on('keydown-ESC', () => {
            this.isPaused = !this.isPaused;
            console.log('Pause:', this.isPaused);
            if (this.isPaused) {
                this.physics.pause();
                this.scene.launch('PauseOverlay');
            } else {
                this.physics.resume();
                this.scene.stop('PauseOverlay');
            }
        });
    }

    handlePlayerEnemyCollision(player, enemy) {
        enemy.disableBody(true, true);
        this.cameras.main.shake(50, 0.005);
        this.particleBurst?.explode(20, enemy.x, enemy.y);
        this.score++;
    }

    update() {
        if (this.isPaused) return;

        const speed = 200;
        let vx = 0, vy = 0;

        if (this.cursors?.left.isDown || this.keys.A.isDown) vx -= 1;
        if (this.cursors?.right.isDown || this.keys.D.isDown) vx += 1;
        if (this.cursors?.up.isDown || this.keys.W.isDown) vy -= 1;
        if (this.cursors?.down.isDown || this.keys.S.isDown) vy += 1;

        if (this.joystick.force > 0) {
            vx += this.joystick.forceX;
            vy += this.joystick.forceY;
        }

        if (vx !== 0 || vy !== 0) {
            const len = Math.sqrt(vx * vx + vy * vy);
            const velX = (vx / len) * speed;
            const velY = (vy / len) * speed;

            this.player?.setVelocity(velX, velY);
        } else {
            this.player?.setVelocity(0, 0);
        }
    }
}
