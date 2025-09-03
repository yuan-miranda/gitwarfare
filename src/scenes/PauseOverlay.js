// src/scenes/PauseOverlay.js
import Phaser from "phaser";
export default class PauseOverlay extends Phaser.Scene {
    constructor() {
        super('PauseOverlay');
    }

    create() {
        this.pauseOverlay = this.add.container(0, 0);
        const background = this.add.rectangle(320, 240, 640, 480, 0x000000, 0.5);
        const pauseText = this.add.text(320, 240, 'Paused', {
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const resumeBtn = this.add.text(320, 300, 'Resume', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#00aa88',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        resumeBtn.on('pointerdown', () => {
            const mainScene = this.scene.get('MainScene');
            if (mainScene) {
                mainScene.isPaused = false;
                mainScene.physics.resume();
            }
            this.scene.stop();
        });

        this.pauseOverlay.add([background, pauseText, resumeBtn]);
    }
}
