import Phaser from "phaser";
import MainScene from "./scenes/MainScene.js";
import PauseOverlay from "./scenes/PauseOverlay.js";
import VirtualJoystickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';

const config = {
    parent: 'app',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 640,
        height: 480
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {
                x: 0,
                y: 0
            },
        }
    },
    scene: [MainScene, PauseOverlay],
    plugins: {
        scene: [
            {
                key: 'rexVirtualJoystick',
                plugin: VirtualJoystickPlugin,
                mapping: 'joystick'
            }
        ]
    }
};

const game = new Phaser.Game(config);