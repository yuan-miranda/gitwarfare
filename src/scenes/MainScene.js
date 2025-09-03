// src/scenes/MainScene.js
import Phaser from "phaser";
import { createPlayer } from "../entities/player.js";
import { createEnemies } from "../entities/enemies.js";
import { createJoystick } from "../ui/joystick.js";
import { GAME_CONFIG } from "../config/constants.js";

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
    }

    preload() {
        this.createTextures();
    }

    createTextures() {
        const createRectTexture = (key, color) => {
            const g = this.make.graphics({ x: 0, y: 0 });
            g.fillStyle(color, 1);
            g.fillRect(0, 0, 16, 16);
            g.generateTexture(key, 16, 16);
        };
        createRectTexture('player', 0xffffff);
        createRectTexture('enemy', 0x56D364);
    }

    create() {
        this.score = 0;
        this.isPaused = false;

        // player
        this.player = createPlayer(this);
        this.enemies = createEnemies(this);

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

        // camera
        this.cameras.main.setBounds(
            0, 0,
            GAME_CONFIG.CAMERA_BOUNDS.width,
            GAME_CONFIG.CAMERA_BOUNDS.height
        );

        // input
        this.cursors = this.input.keyboard?.createCursorKeys();
        this.keys = this.input.keyboard?.addKeys('W,A,S,D');
        this.joystick = createJoystick(this);

        this.lastHorizontal = 0;
        this.lastVertical = 0;

        // movement
        this.input.keyboard?.on('keydown-A', () => this.lastHorizontal = -1);
        this.input.keyboard?.on('keydown-D', () => this.lastHorizontal = 1);
        this.input.keyboard?.on('keyup-A', () => {
            if (this.lastHorizontal === -1) this.lastHorizontal = this.keys.D.isDown ? 1 : 0;
        });
        this.input.keyboard?.on('keyup-D', () => {
            if (this.lastHorizontal === 1) this.lastHorizontal = this.keys.A.isDown ? -1 : 0;
        });

        this.input.keyboard?.on('keydown-W', () => this.lastVertical = -1);
        this.input.keyboard?.on('keydown-S', () => this.lastVertical = 1);
        this.input.keyboard?.on('keyup-W', () => {
            if (this.lastVertical === -1) this.lastVertical = this.keys.S.isDown ? 1 : 0;
        });
        this.input.keyboard?.on('keyup-S', () => {
            if (this.lastVertical === 1) this.lastVertical = this.keys.W.isDown ? -1 : 0;
        });

        // pause toggle
        this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.physics.pause();
            this.scene.launch('PauseOverlay');
        } else {
            this.physics.resume();
            this.scene.stop('PauseOverlay');
        }
    }

    handlePlayerEnemyCollision(player, enemy) {
        enemy.disableBody(true, true);
        this.cameras.main.shake(50, 0.005);
        this.particleBurst?.explode(20, enemy.x, enemy.y);
        this.score++;
    }

    update() {
        if (this.isPaused) return;

        const speed = GAME_CONFIG.PLAYER_SPEED;
        let vx = this.lastHorizontal;
        let vy = this.lastVertical;

        if (this.joystick.force > 0) {
            vx += this.joystick.forceX;
            vy += this.joystick.forceY;
        }

        if (vx || vy) {
            const len = Math.sqrt(vx * vx + vy * vy);
            this.player?.setVelocity((vx / len) * speed, (vy / len) * speed);
        } else {
            this.player?.setVelocity(0, 0);
        }
    }
}
