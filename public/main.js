// Game variables
let canvas, ctx, player, camera, keys, mobileControls;

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Game setup
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    document.body.appendChild(canvas);

    // Set canvas to full screen
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();

    canvas.style.cssText = 'position:absolute;top:0;left:0;background:white';

    // Game state
    player = {
        x: 0,
        y: 0,
        size: 32,
        speed: 4,
        hp: 100,
        maxHp: 100
    };

    camera = {
        x: 0,
        y: 0
    };

    // Mobile controls
    mobileControls = {
        active: false,
        centerX: 0,
        centerY: 0,
        touchX: 0,
        touchY: 0,
        moveX: 0,
        moveY: 0,
        size: 128
    };

    // Input handling
    keys = {};
    window.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        if (e.key === ' ') player.hp = Math.max(0, player.hp - 10);
    });
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener('resize', resizeCanvas);

    // Mobile touch controls
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mobileControls.active = true;
        mobileControls.centerX = touch.clientX - rect.left;
        mobileControls.centerY = touch.clientY - rect.top;
        mobileControls.touchX = mobileControls.centerX;
        mobileControls.touchY = mobileControls.centerY;
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!mobileControls.active) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mobileControls.touchX = touch.clientX - rect.left;
        mobileControls.touchY = touch.clientY - rect.top;
        
        // Calculate movement vector
        const deltaX = mobileControls.touchX - mobileControls.centerX;
        const deltaY = mobileControls.touchY - mobileControls.centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = mobileControls.size / 2;
        
        if (distance > maxDistance) {
            mobileControls.touchX = mobileControls.centerX + (deltaX / distance) * maxDistance;
            mobileControls.touchY = mobileControls.centerY + (deltaY / distance) * maxDistance;
        }
        
        mobileControls.moveX = (mobileControls.touchX - mobileControls.centerX) / maxDistance;
        mobileControls.moveY = (mobileControls.touchY - mobileControls.centerY) / maxDistance;
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileControls.active = false;
        mobileControls.moveX = mobileControls.moveY = 0;
    });

    // Start the game
    gameLoop();
});

function update() {
    // Player movement
    let moveX = 0, moveY = 0;

    // Keyboard input
    if (keys['w'] || keys['arrowup']) moveY -= 1;
    if (keys['s'] || keys['arrowdown']) moveY += 1;
    if (keys['a'] || keys['arrowleft']) moveX -= 1;
    if (keys['d'] || keys['arrowright']) moveX += 1;

    // Mobile input overrides keyboard
    if (mobileControls.active) {
        moveX = mobileControls.moveX;
        moveY = mobileControls.moveY;
    }

    // Apply movement with diagonal normalization
    if (moveX && moveY) {
        player.x += moveX * 0.707 * player.speed;
        player.y += moveY * 0.707 * player.speed;
    } else {
        player.x += moveX * player.speed;
        player.y += moveY * player.speed;
    }

    // Update camera
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
}

function drawGrid() {
    const gridSize = 64;
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Draw vertical lines
    for (let x = startX; x <= startX + canvas.width + gridSize; x += gridSize) {
        const screenX = x - camera.x;
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, canvas.height);
    }

    // Draw horizontal lines
    for (let y = startY; y <= startY + canvas.height + gridSize; y += gridSize) {
        const screenY = y - camera.y;
        ctx.moveTo(0, screenY);
        ctx.lineTo(canvas.width, screenY);
    }

    ctx.stroke();
}

function drawHealthBar() {
    const barWidth = 256, barHeight = 16, barX = 16, barY = 16;
    const healthPercent = player.hp / player.maxHp;
    
    // Background and health
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    ctx.fillStyle = healthPercent > 0.3 ? '#4a9' : '#e44';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    
    // Border and text
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, barX + barWidth + 8, barY + 12);
}

function drawMobileControls() {
    if (!mobileControls.active) return;
    
    const centerX = mobileControls.centerX;
    const centerY = mobileControls.centerY;
    const radius = mobileControls.size / 2;
    
    // Outer circle
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Inner circle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(mobileControls.touchX, mobileControls.touchY, 16, 0, Math.PI * 2);
    ctx.fill();
}

function draw() {
    // Clear and draw grid
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    // Draw player
    ctx.fillStyle = 'black';
    ctx.fillRect(
        player.x - camera.x - player.size / 2,
        player.y - camera.y - player.size / 2,
        player.size,
        player.size
    );

    // Draw UI elements
    drawHealthBar();
    drawMobileControls();

    // Draw text UI
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.fillText(`Position: (${Math.round(player.x)}, ${Math.round(player.y)})`, 10, 65);
    ctx.fillText('Controls: WASD/Arrow Keys or Touch', 10, 85);
    ctx.fillText('Press SPACEBAR to test damage', 10, 105);
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}