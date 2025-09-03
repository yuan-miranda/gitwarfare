import { GAME_CONFIG } from "../config/constants.js";

export function cameraFollow(scene, target) {
    if (!scene.cameras?.main || !target) return;

    scene.cameras.main.startFollow(target, true, 0.08, 0.08);
    scene.cameras.main.setBounds(
        0, 0,
        GAME_CONFIG.WORLD_BOUNDS.width,
        GAME_CONFIG.WORLD_BOUNDS.height
    );
}
