import Phaser from "phaser";
import MainScene from "./scenes/MainScene.js";
import PauseOverlay from "./ui/PauseOverlay.js";

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
    scene: [MainScene, PauseOverlay]
};

new Phaser.Game(config);