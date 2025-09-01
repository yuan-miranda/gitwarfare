import Phaser from "phaser";
import MainScene from "./scenes/MainScene.js";
import PauseOverlay from "./ui/PauseOverlay.js";
import VirtualJoystickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';

const config = {
    parent: 'app',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        min: {
            width: 320,
            height: 240
        },
        max: {
            width: 1920,
            height: 1080
        }
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

new Phaser.Game(config);