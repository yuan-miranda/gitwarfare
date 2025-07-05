// ===== GAME CONFIGURATION =====
const CONFIG = {
    WORLD: { WIDTH: 16384, HEIGHT: 16384 },
    PLAYER: { SPEED: 3, SIZE: 30, MAX_HEALTH: 100 },
    MINIMAP: { MIN_SIZE: 80, MAX_SIZE: 300, DEFAULT_SIZE: 120 },
    VISUAL: { DIAGONAL_FACTOR: 0.707, FADE_SPEED: 0.02, GRID_SIZE: 50 },
    SPAWN: { 
        ENEMY_RATE: 0.035,
        MIN_DISTANCE: 300,
        MAX_ATTEMPTS: 15,
        CLUSTER_SIZE: 4,
        CLUSTER_RADIUS: 120,
        CLUSTER_COOLDOWN: 60,
        INITIAL_BOOST_RATE: 1,
        INITIAL_BOOST_DURATION: 10000,
        INITIAL_BOOST_COOLDOWN: 10
    }
};

// ===== DOM ELEMENTS & GAME STATE =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const healthElement = document.getElementById('health');

const gameState = {
    running: true,
    score: 0,
    lastTime: 0,
    canStart: false,
    shootingEnabled: false
};

const worldSystem = {
    image: null,
    loading: false,
    loaded: false,
    loadingFadeAlpha: 1.0,
    uiFadeAlpha: 0.0
};

const camera = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
const input = { 
    keys: {}, 
    mouseX: 0, 
    mouseY: 0, 
    mousePressed: false,
    // Mobile controls
    mobile: {
        joystick: { active: false, x: 0, y: 0, centerX: 0, centerY: 0 },
        shooting: false,
        moveX: 0,
        moveY: 0
    }
};

const minimap = {
    size: parseInt(localStorage.getItem('minimapSize')) || CONFIG.MINIMAP.DEFAULT_SIZE,
    isDragging: false,
    dragStart: { x: 0, y: 0, size: 0 }
};

const player = {
    x: CONFIG.WORLD.WIDTH / 2,
    y: CONFIG.WORLD.HEIGHT / 2,
    width: CONFIG.PLAYER.SIZE,
    height: CONFIG.PLAYER.SIZE,
    speed: CONFIG.PLAYER.SPEED,
    health: CONFIG.PLAYER.MAX_HEALTH,
    maxHealth: CONFIG.PLAYER.MAX_HEALTH
};

const gameObjects = {
    bullets: [],
    enemies: [],
    particles: []
};

// ===== GAME CLASSES =====
// ===== GAME CLASSES =====
class Bullet {
    constructor(x, y, direction) {
        Object.assign(this, { x, y, direction, width: 6, height: 6, speed: 10, color: '#00ffff', life: 120 });
    }

    update() {
        this.x += Math.cos(this.direction) * this.speed;
        this.y += Math.sin(this.direction) * this.speed;
        this.life--;
    }

    draw() {
        const screenPos = utils.screenPosition(this.x, this.y);
        if (utils.isOnScreen(screenPos, this.width)) {
            ctx.fillStyle = ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            ctx.fillRect(screenPos.x, screenPos.y, this.width, this.height);
            ctx.fillRect(screenPos.x, screenPos.y, this.width, this.height);
            ctx.shadowBlur = 0;
        }
    }

    isDead() { return this.life <= 0; }
}

class Enemy {
    constructor() {
        this.width = 25 + Math.random() * 20;
        this.height = this.width;
        this.speed = 1.0 + Math.random() * 1.0;
        this.health = this.maxHealth = 2;
        this.rotation = 0;
        this.rotationSpeed = 0.02 + Math.random() * 0.05;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 0;
        this.aggroRange = 200;
        this.isAggro = false;
        this.huntMode = false;
        this.clusterId = Math.random();
        this.groupRadius = 200;
        this.separationRadius = 80;
        this.x = Math.random() * CONFIG.WORLD.WIDTH;
        this.y = Math.random() * CONFIG.WORLD.HEIGHT;
    }

    update() {
        this.rotation += this.rotationSpeed;
        
        const distanceToPlayer = utils.distance(this.x, this.y, player.x, player.y);
        const flockingForce = this.calculateFlocking();
        
        if (distanceToPlayer < this.aggroRange) {
            this.moveTowardsPlayer(flockingForce);
            this.huntMode = true;
        } else if (this.huntMode && distanceToPlayer < this.aggroRange * 1.5) {
            this.moveTowardsPlayer(flockingForce);
        } else {
            this.huntMode = false;
            this.wanderWithGroup(flockingForce);
        }
        
        this.constrainToWorld();
        this.checkPlayerCollision();
    }

    moveTowardsPlayer(flockingForce) {
        this.isAggro = true;
        const playerAngle = utils.angle(this.x, this.y, player.x, player.y);
        const combinedX = Math.cos(playerAngle) + flockingForce.x * 0.4;
        const combinedY = Math.sin(playerAngle) + flockingForce.y * 0.4;
        const magnitude = Math.sqrt(combinedX * combinedX + combinedY * combinedY);
        
        if (magnitude > 0) {
            this.x += (combinedX / magnitude) * this.speed;
            this.y += (combinedY / magnitude) * this.speed;
        }
    }

    wanderWithGroup(flockingForce) {
        this.isAggro = false;
        this.wanderTimer++;
        
        if (this.wanderTimer > 120) {
            const playerAngle = utils.angle(this.x, this.y, player.x, player.y);
            this.wanderAngle = playerAngle + (Math.random() - 0.5) * Math.PI;
            this.wanderTimer = 0;
        }
        
        const wanderX = Math.cos(this.wanderAngle) * 0.4;
        const wanderY = Math.sin(this.wanderAngle) * 0.4;
        const combinedX = wanderX + flockingForce.x * 0.8;
        const combinedY = wanderY + flockingForce.y * 0.8;
        
        this.x += combinedX * this.speed;
        this.y += combinedY * this.speed;
    }

    calculateFlocking() {
        let cohesionX = 0, cohesionY = 0, separationX = 0, separationY = 0;
        let alignmentX = 0, alignmentY = 0, clusterMates = 0;
        
        for (const other of gameObjects.enemies) {
            if (other === this) continue;
            
            const distance = utils.distance(this.x, this.y, other.x, other.y);
            
            if (distance < this.groupRadius) {
                clusterMates++;
                cohesionX += other.x;
                cohesionY += other.y;
                
                const otherAngle = other.wanderAngle || 0;
                alignmentX += Math.cos(otherAngle);
                alignmentY += Math.sin(otherAngle);
                
                if (distance < this.separationRadius && distance > 0) {
                    const separationForce = (this.separationRadius - distance) / this.separationRadius;
                    separationX += ((this.x - other.x) / distance) * separationForce;
                    separationY += ((this.y - other.y) / distance) * separationForce;
                }
            }
        }
        
        let flockX = 0, flockY = 0;
        
        if (clusterMates > 0) {
            const cohesionAngle = utils.angle(this.x, this.y, cohesionX / clusterMates, cohesionY / clusterMates);
            flockX += Math.cos(cohesionAngle) * 0.15;
            flockY += Math.sin(cohesionAngle) * 0.15;
            
            alignmentX /= clusterMates;
            alignmentY /= clusterMates;
            const alignMagnitude = Math.sqrt(alignmentX * alignmentX + alignmentY * alignmentY);
            if (alignMagnitude > 0) {
                flockX += (alignmentX / alignMagnitude) * 0.08;
                flockY += (alignmentY / alignMagnitude) * 0.08;
            }
        }
        
        return { x: flockX + separationX * 0.8, y: flockY + separationY * 0.8 };
    }

    constrainToWorld() {
        this.x = utils.clamp(this.x, 0, CONFIG.WORLD.WIDTH - this.width);
        this.y = utils.clamp(this.y, 0, CONFIG.WORLD.HEIGHT - this.height);
    }

    checkPlayerCollision() {
        if (utils.collides(this, player)) {
            player.health -= 10;
            this.health = 0;
            this.createExplosion();
        }
    }

    draw() {
        const screenPos = utils.screenPosition(this.x, this.y);
        if (utils.isOnScreen(screenPos, this.width)) {
            ctx.save();
            ctx.translate(screenPos.x + this.width / 2, screenPos.y + this.height / 2);
            ctx.rotate(this.rotation);

            const healthRatio = this.health / this.maxHealth;
            const fillColor = this.isAggro 
                ? `rgb(${Math.min(255, Math.floor(255 * (1 - healthRatio)) + 50)}, ${Math.floor(150 * healthRatio)}, 0)`
                : `rgb(${Math.floor(255 * (1 - healthRatio))}, ${Math.floor(150 * healthRatio)}, 0)`;

            ctx.fillStyle = fillColor;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

            ctx.shadowColor = fillColor;
            ctx.shadowBlur = this.isAggro ? 15 : 8;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.shadowBlur = 0;

            ctx.strokeStyle = this.isAggro ? '#ff0000' : '#fff';
            ctx.lineWidth = this.isAggro ? 2 : 1;
            ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
            
            ctx.restore();
        }
    }

    createExplosion() {
        for (let i = 0; i < 8; i++) {
            gameObjects.particles.push(new Particle(
                this.x + this.width / 2, this.y + this.height / 2,
                (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6,
                '#00ff00'
            ));
        }
    }
}

class Particle {
    constructor(x, y, vx, vy, color) {
        Object.assign(this, { x, y, vx, vy, color, life: 30, maxLife: 30, size: 3 });
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.vx *= 0.99;
        this.vy *= 0.99;
    }

    draw() {
        const screenPos = utils.screenPosition(this.x, this.y);
        if (utils.isOnScreen(screenPos, this.size)) {
            const alpha = this.life / this.maxLife;
            ctx.fillStyle = this.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.fillRect(screenPos.x, screenPos.y, this.size, this.size);
        }
    }

    isDead() { return this.life <= 0; }
}

// ===== UTILITY FUNCTIONS =====
const utils = {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    distance: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    angle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    screenPosition: (worldX, worldY) => ({ x: worldX - camera.x, y: worldY - camera.y }),
    worldPosition: (screenX, screenY) => ({ x: screenX + camera.x, y: screenY + camera.y }),
    isOnScreen: (pos, size) => pos.x > -size && pos.x < canvas.width && pos.y > -size && pos.y < canvas.height,
    collides: (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
};

// ===== CORE SYSTEMS =====
const cameraSystem = {
    update() {
        camera.x = utils.clamp(player.x - canvas.width / 2, 0, CONFIG.WORLD.WIDTH - canvas.width);
        camera.y = utils.clamp(player.y - canvas.height / 2, 0, CONFIG.WORLD.HEIGHT - canvas.height);
    }
};

const combatSystem = {
    isShooting: false,
    lastShotTime: 0,
    fireRate: 200,
    
    startShooting(targetX, targetY) {
        if (!gameState.running || worldSystem.loading || !gameState.shootingEnabled) return;
        this.isShooting = true;
        this.shoot(targetX, targetY);
    },
    
    stopShooting() { this.isShooting = false; },
    
    update() {
        if (this.isShooting && (input.mousePressed || input.mobile.shooting)) {
            const currentTime = Date.now();
            if (currentTime - this.lastShotTime >= this.fireRate) {
                this.shoot(input.mouseX, input.mouseY);
                this.lastShotTime = currentTime;
            }
        }
    },

    shoot(targetX, targetY) {
        if (!gameState.running || worldSystem.loading || !gameState.shootingEnabled) return;

        const playerCenter = {
            x: player.x + player.width / 2,
            y: player.y + player.height / 2
        };

        const worldTarget = utils.worldPosition(targetX, targetY);
        const direction = utils.angle(playerCenter.x, playerCenter.y, worldTarget.x, worldTarget.y);

        gameObjects.bullets.push(new Bullet(playerCenter.x, playerCenter.y, direction));
    }
};

const inputSystem = {
    setup() {
        document.addEventListener('keydown', (e) => input.keys[e.key.toLowerCase()] = true);
        document.addEventListener('keyup', (e) => input.keys[e.key.toLowerCase()] = false);
        canvas.addEventListener('mousemove', this.handleMouseMove);
        canvas.addEventListener('mousedown', this.handleMouseDown);
        canvas.addEventListener('mouseup', this.handleMouseUp);
    },

    handleMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        input.mouseX = e.clientX - rect.left;
        input.mouseY = e.clientY - rect.top;

        if (minimap.isDragging) {
            const delta = Math.max(-(input.mouseX - minimap.dragStart.x), input.mouseY - minimap.dragStart.y);
            minimap.size = utils.clamp(minimap.dragStart.size + delta, CONFIG.MINIMAP.MIN_SIZE, CONFIG.MINIMAP.MAX_SIZE);
            localStorage.setItem('minimapSize', minimap.size.toString());
        }
    },

    handleMouseDown(e) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Handle restart on game over
        if (!gameState.running) {
            window.location.reload();
            return;
        }

        if (minimapSystem.handleResizeClick(clickX, clickY)) {
            e.preventDefault();
            return;
        }

        input.mousePressed = true;
        combatSystem.startShooting(clickX, clickY);
    },

    handleMouseUp() {
        minimap.isDragging = false;
        input.mousePressed = false;
        combatSystem.stopShooting();
    }
};

const mobileControlSystem = {
    joystickElement: null,
    joystickKnob: null,
    shootArea: null,
    minimapPlus: null,
    minimapMinus: null,
    
    setup() {
        this.joystickElement = document.getElementById('mobileJoystick');
        this.joystickKnob = document.getElementById('mobileJoystickKnob');
        this.shootArea = document.getElementById('mobileShootArea');
        this.minimapPlus = document.getElementById('minimapPlus');
        this.minimapMinus = document.getElementById('minimapMinus');
        
        if (this.joystickElement) {
            // Touch events for joystick
            this.joystickElement.addEventListener('touchstart', this.handleJoystickStart.bind(this), { passive: false });
            this.joystickElement.addEventListener('touchmove', this.handleJoystickMove.bind(this), { passive: false });
            this.joystickElement.addEventListener('touchend', this.handleJoystickEnd.bind(this), { passive: false });
            
            // Get joystick center position
            const rect = this.joystickElement.getBoundingClientRect();
            input.mobile.joystick.centerX = rect.left + rect.width / 2;
            input.mobile.joystick.centerY = rect.top + rect.height / 2;
        }
        
        if (this.shootArea) {
            // Touch events for shooting - make it work like movement (hold to continue)
            this.shootArea.addEventListener('touchstart', this.handleShootStart.bind(this), { passive: false });
            this.shootArea.addEventListener('touchmove', this.handleShootMove.bind(this), { passive: false });
            this.shootArea.addEventListener('touchend', this.handleShootEnd.bind(this), { passive: false });
        }
        
        // Minimap controls
        if (this.minimapPlus) {
            this.minimapPlus.addEventListener('touchstart', this.handleMinimapResize.bind(this, 10), { passive: false });
            this.minimapPlus.addEventListener('click', this.handleMinimapResize.bind(this, 10));
        }
        
        if (this.minimapMinus) {
            this.minimapMinus.addEventListener('touchstart', this.handleMinimapResize.bind(this, -10), { passive: false });
            this.minimapMinus.addEventListener('click', this.handleMinimapResize.bind(this, -10));
        }
        
        // Screen tap for restart when game is over
        canvas.addEventListener('touchstart', this.handleScreenTouch.bind(this), { passive: false });
        canvas.addEventListener('click', this.handleScreenClick.bind(this));
        
        // Prevent default touch behaviors on canvas for gameplay
        canvas.addEventListener('touchmove', this.preventDefaultTouch, { passive: false });
        canvas.addEventListener('touchend', this.preventDefaultTouch, { passive: false });
        
        // Update joystick center on window resize
        window.addEventListener('resize', this.updateJoystickCenter.bind(this));
    },
    
    preventDefaultTouch(e) {
        e.preventDefault();
    },
    
    handleScreenTouch(e) {
        if (!gameState.running) {
            e.preventDefault();
            this.handleRestart();
        }
    },
    
    handleScreenClick(e) {
        if (!gameState.running) {
            e.preventDefault();
            this.handleRestart();
        }
    },
    
    updateJoystickCenter() {
        if (this.joystickElement) {
            const rect = this.joystickElement.getBoundingClientRect();
            input.mobile.joystick.centerX = rect.left + rect.width / 2;
            input.mobile.joystick.centerY = rect.top + rect.height / 2;
        }
    },
    
    handleJoystickStart(e) {
        e.preventDefault();
        input.mobile.joystick.active = true;
        this.updateJoystickPosition(e.touches[0]);
    },
    
    handleJoystickMove(e) {
        e.preventDefault();
        if (input.mobile.joystick.active) {
            this.updateJoystickPosition(e.touches[0]);
        }
    },
    
    handleJoystickEnd(e) {
        e.preventDefault();
        input.mobile.joystick.active = false;
        input.mobile.moveX = 0;
        input.mobile.moveY = 0;
        
        // Reset knob position
        if (this.joystickKnob) {
            this.joystickKnob.style.transform = 'translate(-50%, -50%)';
        }
    },
    
    updateJoystickPosition(touch) {
        const deltaX = touch.clientX - input.mobile.joystick.centerX;
        const deltaY = touch.clientY - input.mobile.joystick.centerY;
        
        // Limit movement to joystick radius
        const maxRadius = 40; // Half of joystick width minus knob width
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        let normalizedX = deltaX;
        let normalizedY = deltaY;
        
        if (distance > maxRadius) {
            normalizedX = (deltaX / distance) * maxRadius;
            normalizedY = (deltaY / distance) * maxRadius;
        }
        
        // Update knob position
        if (this.joystickKnob) {
            this.joystickKnob.style.transform = `translate(${normalizedX - 20}px, ${normalizedY - 20}px)`;
        }
        
        // Update movement input (normalize to -1 to 1)
        input.mobile.moveX = normalizedX / maxRadius;
        input.mobile.moveY = normalizedY / maxRadius;
    },
    
    handleShootStart(e) {
        e.preventDefault();
        input.mobile.shooting = true;
        
        // Calculate shooting direction from center of screen
        input.mouseX = canvas.width / 2;
        input.mouseY = canvas.height / 2;
        
        combatSystem.startShooting(input.mouseX, input.mouseY);
    },
    
    handleShootMove(e) {
        e.preventDefault();
        // Continue shooting while touching
        if (input.mobile.shooting) {
            // Update shooting direction based on touch position relative to shoot area
            const rect = this.shootArea.getBoundingClientRect();
            const touch = e.touches[0];
            const deltaX = touch.clientX - (rect.left + rect.width / 2);
            const deltaY = touch.clientY - (rect.top + rect.height / 2);
            
            // Convert to screen coordinates for shooting direction
            input.mouseX = canvas.width / 2 + deltaX * 2;
            input.mouseY = canvas.height / 2 + deltaY * 2;
        }
    },
    
    handleShootEnd(e) {
        e.preventDefault();
        input.mobile.shooting = false;
        combatSystem.stopShooting();
    },
    
    handleMinimapResize(delta, e) {
        e.preventDefault();
        minimap.size = utils.clamp(minimap.size + delta, CONFIG.MINIMAP.MIN_SIZE, CONFIG.MINIMAP.MAX_SIZE);
        localStorage.setItem('minimapSize', minimap.size.toString());
    },
    
    handleRestart() {
        window.location.reload();
    }
};


const minimapSystem = {
    getPosition() {
        return { x: canvas.width - minimap.size - 10, y: 10 };
    },

    handleResizeClick(clickX, clickY) {
        const pos = this.getPosition();
        const resizeHandleSize = 15;

        if (clickX >= pos.x && clickX <= pos.x + resizeHandleSize &&
            clickY >= pos.y + minimap.size - resizeHandleSize && clickY <= pos.y + minimap.size) {
            minimap.isDragging = true;
            minimap.dragStart = { x: clickX, y: clickY, size: minimap.size };
            return true;
        }
        return false;
    },

    updateCursor() {
        const mapMouseX = input.mouseX - this.getPosition().x;
        const mapMouseY = input.mouseY - this.getPosition().y;

        canvas.style.cursor = (mapMouseX >= 0 && mapMouseX <= 15 &&
            mapMouseY >= minimap.size - 15 && mapMouseY <= minimap.size) ? 'sw-resize' : 
            (!minimap.isDragging ? 'crosshair' : 'sw-resize');
    }
};

const spawnSystem = {
    lastClusterTime: 0,
    clusterCooldown: 0,
    gameStartTime: 0,
    
    spawnEnemy() {
        if (this.gameStartTime === 0) this.gameStartTime = Date.now();
        
        const timeSinceStart = Date.now() - this.gameStartTime;
        const isInitialBoost = timeSinceStart < CONFIG.SPAWN.INITIAL_BOOST_DURATION;
        
        if (this.clusterCooldown > 0) {
            this.clusterCooldown--;
            return;
        }
        
        const currentSpawnRate = isInitialBoost ? CONFIG.SPAWN.INITIAL_BOOST_RATE : CONFIG.SPAWN.ENEMY_RATE;
        
        if (Math.random() < currentSpawnRate) {
            this.spawnEnemyCluster(isInitialBoost);
            this.clusterCooldown = isInitialBoost ? CONFIG.SPAWN.INITIAL_BOOST_COOLDOWN : CONFIG.SPAWN.CLUSTER_COOLDOWN;
        }
    },
    
    spawnEnemyCluster(isInitialBoost = false) {
        let clusterCenter;
        let attempts = 0;
        
        do {
            clusterCenter = {
                x: CONFIG.SPAWN.CLUSTER_RADIUS + Math.random() * (CONFIG.WORLD.WIDTH - 2 * CONFIG.SPAWN.CLUSTER_RADIUS),
                y: CONFIG.SPAWN.CLUSTER_RADIUS + Math.random() * (CONFIG.WORLD.HEIGHT - 2 * CONFIG.SPAWN.CLUSTER_RADIUS)
            };
            attempts++;
        } while (!this.isValidClusterPosition(clusterCenter) && attempts < CONFIG.SPAWN.MAX_ATTEMPTS);
        
        if (attempts >= CONFIG.SPAWN.MAX_ATTEMPTS) return;
        
        const maxClusterSize = isInitialBoost ? 5 : CONFIG.SPAWN.CLUSTER_SIZE;
        const clusterSize = Math.floor(Math.random() * maxClusterSize) + 1;
        const clusterId = Math.random();
        
        for (let i = 0; i < clusterSize; i++) {
            const enemy = new Enemy();
            enemy.clusterId = clusterId;
            
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * CONFIG.SPAWN.CLUSTER_RADIUS;
            
            enemy.x = utils.clamp(
                clusterCenter.x + Math.cos(angle) * distance,
                0, CONFIG.WORLD.WIDTH - enemy.width
            );
            enemy.y = utils.clamp(
                clusterCenter.y + Math.sin(angle) * distance,
                0, CONFIG.WORLD.HEIGHT - enemy.height
            );
            
            gameObjects.enemies.push(enemy);
        }
    },
    
    isValidClusterPosition(clusterCenter) {
        return !gameObjects.enemies.some(enemy => 
            utils.distance(clusterCenter.x, clusterCenter.y, enemy.x, enemy.y) < CONFIG.SPAWN.MIN_DISTANCE
        );
    }
};

// ===== GAME UPDATES =====
const gameUpdates = {
    player() {
        if (worldSystem.loading) return;

        let moveX = 0, moveY = 0;
        
        // Keyboard input
        if (input.keys['a'] || input.keys['arrowleft']) moveX -= 1;
        if (input.keys['d'] || input.keys['arrowright']) moveX += 1;
        if (input.keys['w'] || input.keys['arrowup']) moveY -= 1;
        if (input.keys['s'] || input.keys['arrowdown']) moveY += 1;
        
        // Mobile input
        if (input.mobile.joystick.active) {
            moveX = input.mobile.moveX;
            moveY = input.mobile.moveY;
        }

        if (moveX !== 0 && moveY !== 0) {
            moveX *= CONFIG.VISUAL.DIAGONAL_FACTOR;
            moveY *= CONFIG.VISUAL.DIAGONAL_FACTOR;
        }

        player.x = utils.clamp(player.x + moveX * CONFIG.PLAYER.SPEED, 0, CONFIG.WORLD.WIDTH - player.width);
        player.y = utils.clamp(player.y + moveY * CONFIG.PLAYER.SPEED, 0, CONFIG.WORLD.HEIGHT - player.height);

        if (player.health <= 0) gameState.running = false;
    },

    bullets() {
        for (let i = gameObjects.bullets.length - 1; i >= 0; i--) {
            const bullet = gameObjects.bullets[i];
            bullet.update();

            if (bullet.isDead()) {
                gameObjects.bullets.splice(i, 1);
                continue;
            }

            for (let j = gameObjects.enemies.length - 1; j >= 0; j--) {
                const enemy = gameObjects.enemies[j];
                if (utils.collides(bullet, enemy)) {
                    enemy.health--;
                    gameObjects.bullets.splice(i, 1);

                    if (enemy.health <= 0) {
                        enemy.createExplosion();
                        gameObjects.enemies.splice(j, 1);
                        gameState.score += 10;
                    }
                    break;
                }
            }
        }
    },

    enemies() {
        for (let i = gameObjects.enemies.length - 1; i >= 0; i--) {
            const enemy = gameObjects.enemies[i];
            enemy.update();
            if (enemy.health <= 0) gameObjects.enemies.splice(i, 1);
        }
    },

    particles() {
        for (let i = gameObjects.particles.length - 1; i >= 0; i--) {
            const particle = gameObjects.particles[i];
            particle.update();
            if (particle.isDead()) gameObjects.particles.splice(i, 1);
        }
    }
};

// ===== RENDERING SYSTEM =====
const renderer = {
    player() {
        const screenPos = utils.screenPosition(player.x, player.y);

        ctx.fillStyle = ctx.shadowColor = '#0099ff';
        ctx.shadowBlur = 10;
        ctx.fillRect(screenPos.x, screenPos.y, player.width, player.height);
        ctx.fillRect(screenPos.x, screenPos.y, player.width, player.height);
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenPos.x, screenPos.y, player.width, player.height);

        // Health bar
        const healthRatio = player.health / player.maxHealth;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(screenPos.x, screenPos.y - 8, player.width, 4);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(screenPos.x, screenPos.y - 8, player.width * healthRatio, 4);
    },

    gameObjects() {
        gameObjects.bullets.forEach(bullet => bullet.draw());
        gameObjects.enemies.forEach(enemy => enemy.draw());
        gameObjects.particles.forEach(particle => particle.draw());
    },

    gameOver() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ff0000';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);

        ctx.fillStyle = '#ffffff';
        ctx.font = '24px Arial';
        ctx.fillText(`Final Score: ${gameState.score}`, canvas.width / 2, canvas.height / 2 + 50);
        
        // Show different restart instructions based on device
        const isMobile = window.matchMedia('(max-width: 768px)').matches || navigator.maxTouchPoints > 0;
        if (isMobile) {
            ctx.fillText('Tap anywhere to restart', canvas.width / 2, canvas.height / 2 + 100);
        } else {
            ctx.fillText('Click anywhere or press F5 to restart', canvas.width / 2, canvas.height / 2 + 100);
        }
    },

    updateUI() {
        scoreElement.textContent = gameState.score;
        healthElement.textContent = Math.max(0, player.health);

        const uiElements = document.querySelectorAll('.ui, .controls');
        uiElements.forEach(element => {
            element.style.opacity = worldSystem.uiFadeAlpha;
        });
    }
};

// ===== SETUP AND INITIALIZATION =====
const gameSetup = {
    canvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        camera.width = canvas.width;
        camera.height = canvas.height;
    },

    init() {
        this.canvas();
        window.addEventListener('resize', () => this.canvas());
        inputSystem.setup();
        mobileControlSystem.setup();
        worldSystem.uiFadeAlpha = 0.0;
        const uiElements = document.querySelectorAll('.ui, .controls');
        uiElements.forEach(element => {
            element.style.opacity = '0';
        });
    }
};

const worldImageSystem = {
    setImage(imageSrc) {
        worldSystem.loading = true;
        worldSystem.loaded = false;
        worldSystem.image = new Image();

        worldSystem.uiFadeAlpha = 0.0;
        const uiElements = document.querySelectorAll('.ui, .controls');
        uiElements.forEach(element => {
            element.style.opacity = '0';
        });

        worldSystem.image.onload = () => {
            console.log('World image loaded:', imageSrc);
            worldSystem.loading = false;
            worldSystem.loaded = true;
            worldSystem.loadingFadeAlpha = 1.0;
            worldSystem.uiFadeAlpha = 0.0;
            gameState.canStart = false;
            gameState.shootingEnabled = false;
        };

        worldSystem.image.onerror = () => {
            console.warn('Failed to load world image:', imageSrc);
            worldSystem.loading = false;
            worldSystem.loaded = false;
            worldSystem.image = null;
            worldSystem.uiFadeAlpha = 1.0;
            const uiElements = document.querySelectorAll('.ui, .controls');
            uiElements.forEach(element => {
                element.style.opacity = '1';
            });
        };

        worldSystem.image.src = imageSrc;
    }
};

// ===== BACKGROUND RENDERING =====
const backgroundRenderer = {
    draw() {
        if (worldSystem.loading) {
            this.drawLoading();
            return;
        }

        if (worldSystem.image && worldSystem.loaded) {
            this.drawImageBackground();
        } else {
            this.drawGridBackground();
        }

        this.drawWorldBounds();
    },

    drawLoading() {
        ctx.fillStyle = '#001122';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Loading World', canvas.width / 2, canvas.height / 2 - 20);

        // Animated loading dots centered below the text
        const dots = '.'.repeat((Math.floor(Date.now() / 400) % 4));
        ctx.font = '24px Arial';
        ctx.fillText(dots.padEnd(3, ' '), canvas.width / 2, canvas.height / 2 + 20);
    },

    drawImageBackground() {
        const scale = Math.max(CONFIG.WORLD.WIDTH / worldSystem.image.width, CONFIG.WORLD.HEIGHT / worldSystem.image.height);
        const scaledWidth = worldSystem.image.width * scale;
        const scaledHeight = worldSystem.image.height * scale;

        const worldImageX = (CONFIG.WORLD.WIDTH - scaledWidth) / 2;
        const worldImageY = (CONFIG.WORLD.HEIGHT - scaledHeight) / 2;

        const visibleBounds = this.calculateVisibleBounds(worldImageX, worldImageY, scaledWidth, scaledHeight);

        if (visibleBounds.width > 0 && visibleBounds.height > 0) {
            this.drawVisibleImagePortion(visibleBounds, scale, worldImageX, worldImageY);
        }

        this.fillImageBorders(worldImageX, worldImageY, scaledWidth, scaledHeight);
    },

    calculateVisibleBounds(worldImageX, worldImageY, scaledWidth, scaledHeight) {
        return {
            left: Math.max(0, camera.x - worldImageX),
            top: Math.max(0, camera.y - worldImageY),
            right: Math.min(scaledWidth, camera.x + canvas.width - worldImageX),
            bottom: Math.min(scaledHeight, camera.y + canvas.height - worldImageY),
            get width() { return this.right - this.left; },
            get height() { return this.bottom - this.top; }
        };
    },

    drawVisibleImagePortion(bounds, scale, worldImageX, worldImageY) {
        const sourceX = bounds.left / scale;
        const sourceY = bounds.top / scale;
        const sourceWidth = bounds.width / scale;
        const sourceHeight = bounds.height / scale;

        const destX = Math.max(0, worldImageX - camera.x);
        const destY = Math.max(0, worldImageY - camera.y);

        ctx.drawImage(
            worldSystem.image,
            sourceX, sourceY, sourceWidth, sourceHeight,
            destX, destY, bounds.width, bounds.height
        );
    },

    fillImageBorders(worldImageX, worldImageY, scaledWidth, scaledHeight) {
        ctx.fillStyle = '#001122';

        // Fill borders around the image
        const borders = [
            { x: 0, y: 0, w: Math.max(0, worldImageX - camera.x), h: canvas.height }, // Left
            { x: Math.max(0, worldImageX + scaledWidth - camera.x), y: 0, w: canvas.width, h: canvas.height }, // Right
            { x: 0, y: 0, w: canvas.width, h: Math.max(0, worldImageY - camera.y) }, // Top
            { x: 0, y: Math.max(0, worldImageY + scaledHeight - camera.y), w: canvas.width, h: canvas.height } // Bottom
        ];

        borders.forEach(border => {
            if (border.w > 0 && border.h > 0) {
                ctx.fillRect(border.x, border.y, border.w, border.h);
            }
        });
    },

    drawGridBackground() {
        ctx.fillStyle = '#001122';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(0, 100, 200, 0.2)';
        ctx.lineWidth = 1;

        const startX = Math.floor(camera.x / CONFIG.VISUAL.GRID_SIZE) * CONFIG.VISUAL.GRID_SIZE;
        const startY = Math.floor(camera.y / CONFIG.VISUAL.GRID_SIZE) * CONFIG.VISUAL.GRID_SIZE;

        // Draw grid lines
        for (let x = startX; x < camera.x + canvas.width + CONFIG.VISUAL.GRID_SIZE; x += CONFIG.VISUAL.GRID_SIZE) {
            const screenX = x - camera.x;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, canvas.height);
            ctx.stroke();
        }

        for (let y = startY; y < camera.y + canvas.height + CONFIG.VISUAL.GRID_SIZE; y += CONFIG.VISUAL.GRID_SIZE) {
            const screenY = y - camera.y;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(canvas.width, screenY);
            ctx.stroke();
        }
    },

    drawWorldBounds() {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;

        const bounds = [
            { condition: camera.y <= 0, x1: 0, y1: -camera.y, x2: canvas.width, y2: -camera.y },
            { condition: camera.y + canvas.height >= CONFIG.WORLD.HEIGHT, x1: 0, y1: CONFIG.WORLD.HEIGHT - camera.y, x2: canvas.width, y2: CONFIG.WORLD.HEIGHT - camera.y },
            { condition: camera.x <= 0, x1: -camera.x, y1: 0, x2: -camera.x, y2: canvas.height },
            { condition: camera.x + canvas.width >= CONFIG.WORLD.WIDTH, x1: CONFIG.WORLD.WIDTH - camera.x, y1: 0, x2: CONFIG.WORLD.WIDTH - camera.x, y2: canvas.height }
        ];

        bounds.forEach(bound => {
            if (bound.condition) {
                ctx.beginPath();
                ctx.moveTo(bound.x1, bound.y1);
                ctx.lineTo(bound.x2, bound.y2);
                ctx.stroke();
            }
        });
    }
};

// ===== MAIN GAME LOOP =====
const gameLoop = {
    run(currentTime) {
        gameState.lastTime = currentTime;

        if (worldSystem.loading) {
            backgroundRenderer.draw();
            requestAnimationFrame((time) => gameLoop.run(time));
            return;
        }

        if (worldSystem.loadingFadeAlpha > 0 && worldSystem.loaded) {
            worldSystem.loadingFadeAlpha -= CONFIG.VISUAL.FADE_SPEED;
            worldSystem.uiFadeAlpha += CONFIG.VISUAL.FADE_SPEED;

            if (worldSystem.loadingFadeAlpha <= 0) {
                worldSystem.loadingFadeAlpha = 0;
                worldSystem.uiFadeAlpha = 1.0;
                gameState.canStart = true;
                gameState.shootingEnabled = true;
            }

            backgroundRenderer.draw();
            ctx.fillStyle = `rgba(0, 17, 34, ${worldSystem.loadingFadeAlpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            requestAnimationFrame((time) => gameLoop.run(time));
            return;
        }

        if (!gameState.canStart && !worldSystem.image) {
            gameState.canStart = true;
            gameState.shootingEnabled = true;
            worldSystem.uiFadeAlpha = 1.0;
            const uiElements = document.querySelectorAll('.ui, .controls');
            uiElements.forEach(element => {
                element.style.opacity = '1';
            });
        }

        if (gameState.running && gameState.canStart) {
            gameUpdates.player();
            cameraSystem.update();
            combatSystem.update();
            gameUpdates.bullets();
            gameUpdates.enemies();
            gameUpdates.particles();
            spawnSystem.spawnEnemy();

            backgroundRenderer.draw();
            renderer.player();
            renderer.gameObjects();
            minimapRenderer.draw();
            renderer.updateUI();
            minimapSystem.updateCursor();
        } else {
            renderer.gameOver();
        }

        requestAnimationFrame((time) => gameLoop.run(time));
    }
};

// ===== MINIMAP RENDERER =====
const minimapRenderer = {
    draw() {
        const pos = minimapSystem.getPosition();
        const scale = minimap.size / CONFIG.WORLD.WIDTH;

        this.drawBackground(pos, scale);
        this.drawBorders(pos);
        this.drawGameObjects(pos, scale);
        this.drawCameraView(pos, scale);
        this.drawResizeHandle(pos);
    },

    drawBackground(pos, scale) {
        if (worldSystem.loading) {
            this.drawLoadingState(pos);
        } else if (worldSystem.image && worldSystem.loaded) {
            this.drawImageBackground(pos);
        } else {
            this.drawGridBackground(pos, scale);
        }
    },

    drawLoadingState(pos) {
        ctx.fillStyle = '#001122';
        ctx.fillRect(pos.x, pos.y, minimap.size, minimap.size);

        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(8, minimap.size / 12)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('Loading', pos.x + minimap.size / 2, pos.y + minimap.size / 2 - 5);

        const dots = '.'.repeat((Math.floor(Date.now() / 400) % 4));
        ctx.font = `${Math.max(6, minimap.size / 15)}px Arial`;
        ctx.fillText(dots.padEnd(3, ' '), pos.x + minimap.size / 2, pos.y + minimap.size / 2 + 8);
    },

    drawImageBackground(pos) {
        const imageAspect = worldSystem.image.width / worldSystem.image.height;
        const minimapAspect = 1;

        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

        if (imageAspect > minimapAspect) {
            drawHeight = minimap.size;
            drawWidth = minimap.size * imageAspect;
            offsetX = -(drawWidth - minimap.size) / 2;
        } else {
            drawWidth = minimap.size;
            drawHeight = minimap.size / imageAspect;
            offsetY = -(drawHeight - minimap.size) / 2;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(pos.x, pos.y, minimap.size, minimap.size);
        ctx.clip();

        ctx.drawImage(
            worldSystem.image,
            pos.x + offsetX, pos.y + offsetY,
            drawWidth, drawHeight
        );

        ctx.restore();

        // Fill borders
        ctx.fillStyle = '#001122';
        if (offsetX > 0) {
            ctx.fillRect(pos.x, pos.y, offsetX, minimap.size);
            ctx.fillRect(pos.x + minimap.size - offsetX, pos.y, offsetX, minimap.size);
        }
        if (offsetY > 0) {
            ctx.fillRect(pos.x, pos.y, minimap.size, offsetY);
            ctx.fillRect(pos.x, pos.y + minimap.size - offsetY, minimap.size, offsetY);
        }
    },

    drawGridBackground(pos, scale) {
        ctx.fillStyle = '#001122';
        ctx.fillRect(pos.x, pos.y, minimap.size, minimap.size);

        ctx.strokeStyle = 'rgba(0, 100, 200, 0.4)';
        ctx.lineWidth = 0.5;

        const scaledGridSize = CONFIG.VISUAL.GRID_SIZE * scale;

        if (scaledGridSize >= 0.5) {
            // Draw grid lines
            for (let x = 0; x < CONFIG.WORLD.WIDTH; x += CONFIG.VISUAL.GRID_SIZE) {
                const lineX = pos.x + x * scale;
                if (lineX >= pos.x && lineX <= pos.x + minimap.size) {
                    ctx.beginPath();
                    ctx.moveTo(lineX, pos.y);
                    ctx.lineTo(lineX, pos.y + minimap.size);
                    ctx.stroke();
                }
            }

            for (let y = 0; y < CONFIG.WORLD.HEIGHT; y += CONFIG.VISUAL.GRID_SIZE) {
                const lineY = pos.y + y * scale;
                if (lineY >= pos.y && lineY <= pos.y + minimap.size) {
                    ctx.beginPath();
                    ctx.moveTo(pos.x, lineY);
                    ctx.lineTo(pos.x + minimap.size, lineY);
                    ctx.stroke();
                }
            }
        }
    },

    drawBorders(pos) {
        // World bounds (red)
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x, pos.y, minimap.size, minimap.size);

        // Minimap border (white)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, minimap.size, minimap.size);
    },

    drawGameObjects(pos, scale) {
        // Player
        const playerMapX = pos.x + player.x * scale;
        const playerMapY = pos.y + player.y * scale;
        const playerDotSize = Math.max(2, minimap.size / 30);

        ctx.fillStyle = '#0099ff';
        ctx.fillRect(playerMapX - playerDotSize / 2, playerMapY - playerDotSize / 2, playerDotSize, playerDotSize);

        // Enemies
        ctx.fillStyle = '#00ff00';
        const enemyDotSize = Math.max(1, minimap.size / 60);
        gameObjects.enemies.forEach(enemy => {
            const enemyMapX = pos.x + enemy.x * scale;
            const enemyMapY = pos.y + enemy.y * scale;
            ctx.fillRect(enemyMapX - enemyDotSize / 2, enemyMapY - enemyDotSize / 2, enemyDotSize, enemyDotSize);
        });
    },

    drawCameraView(pos, scale) {
        const cameraMapX = pos.x + camera.x * scale;
        const cameraMapY = pos.y + camera.y * scale;
        const cameraMapWidth = canvas.width * scale;
        const cameraMapHeight = canvas.height * scale;

        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        ctx.strokeRect(cameraMapX, cameraMapY, cameraMapWidth, cameraMapHeight);
    },

    drawResizeHandle(pos) {
        const resizeHandleSize = 15;
        const handleX = pos.x;
        const handleY = pos.y + minimap.size - resizeHandleSize;

        ctx.fillStyle = minimap.isDragging ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(handleX, handleY, resizeHandleSize, resizeHandleSize);

        // Draw resize icon
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const offset = i * 4 + 2;
            ctx.beginPath();
            ctx.moveTo(handleX + 2, handleY + offset);
            ctx.lineTo(handleX + resizeHandleSize - offset, handleY + resizeHandleSize - 2);
            ctx.stroke();
        }
    }
};

// ===== GAME INITIALIZATION =====
gameSetup.init();

// Start the game loop
requestAnimationFrame((time) => gameLoop.run(time));

// Example: Uncomment the line below to test with an image background
worldImageSystem.setImage('https://picsum.photos/1024/1024?random=1');
