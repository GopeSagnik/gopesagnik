export class SnakeGame {
    constructor(canvas, inputEmitter, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.callbacks = callbacks;
        
        // Internal state
        this.animationId = null;
        this.resizeObserver = null;
        this.lastTime = 0;
        this.accumulator = 0;
        
        // Game state
        this.gridSize = 20; // 20 logical units per cell
        this.cols = 0;
        this.rows = 0;
        this.snake = [];
        this.food = { x: 0, y: 0 };
        this.dx = 1;
        this.dy = 0;
        
        // Input queueing prevents 180-degree self-collisions on rapid double taps
        this.inputQueue = []; 
        this.score = 0;
        this.tickRate = 150; // Starting ms per move
        this.isGameOver = false;

        this.callbacks.setTitle("Snake");
        
        // Bind input from shared-controls
        inputEmitter.onInput((dir) => this.queueInput(dir));
        
        // Handle canvas resizing gracefully
        this.handleResize = this.handleResize.bind(this);
        this.resizeObserver = new ResizeObserver(this.handleResize);
        this.resizeObserver.observe(this.canvas.parentElement);
    }

    start() {
        // Establish cols/rows synchronously first — ResizeObserver's callback
        // fires a beat later, and reset()/spawnFood() need real grid dimensions
        // before the first tick or the snake reads as instantly wall-colliding.
        this.handleResize();
        this.reset();
        this.lastTime = performance.now();
        this.loop = this.loop.bind(this);
        this.animationId = requestAnimationFrame(this.loop);
    }

    queueInput(dir) {
        // Prevent queue overflow
        if (this.inputQueue.length > 2) return; 
        
        const lastInput = this.inputQueue.length > 0 
            ? this.inputQueue[this.inputQueue.length - 1] 
            : { dx: this.dx, dy: this.dy };

        let newDx = lastInput.dx;
        let newDy = lastInput.dy;

        if (dir === 'UP' && lastInput.dy === 0) { newDx = 0; newDy = -1; }
        else if (dir === 'DOWN' && lastInput.dy === 0) { newDx = 0; newDy = 1; }
        else if (dir === 'LEFT' && lastInput.dx === 0) { newDx = -1; newDy = 0; }
        else if (dir === 'RIGHT' && lastInput.dx === 0) { newDx = 1; newDy = 0; }

        if (newDx !== lastInput.dx || newDy !== lastInput.dy) {
            this.inputQueue.push({ dx: newDx, dy: newDy });
        }
    }

    handleResize() {
        // Match internal resolution to display size for crisp rendering
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        
        this.cols = Math.floor(rect.width / this.gridSize);
        this.rows = Math.floor(rect.height / this.gridSize);
        
        // Respawn food if it got stranded outside new bounds
        if (this.food.x >= this.cols || this.food.y >= this.rows) {
            this.spawnFood();
        }
    }

    reset() {
        this.score = 0;
        this.tickRate = 150;
        this.callbacks.onScoreChange(this.score);
        this.isGameOver = false;
        
        this.dx = 1;
        this.dy = 0;
        this.inputQueue = [];
        
        // Start center-left
        const startX = Math.max(3, Math.floor(this.cols / 4));
        const startY = Math.floor(this.rows / 2);
        
        this.snake = [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];
        
        this.spawnFood();
    }

    spawnFood() {
        if (this.cols === 0 || this.rows === 0) return;
        
        let valid = false;
        while (!valid) {
            this.food = {
                x: Math.floor(Math.random() * this.cols),
                y: Math.floor(Math.random() * this.rows)
            };
            valid = !this.snake.some(segment => segment.x === this.food.x && segment.y === this.food.y);
        }
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        this.accumulator += deltaTime;
        
        if (this.accumulator >= this.tickRate) {
            this.update();
            this.accumulator -= this.tickRate;
            // Prevent spiral of death if tab was inactive
            if (this.accumulator > this.tickRate) this.accumulator = 0; 
        }
        
        this.draw();
        
        if (this.animationId) {
            this.animationId = requestAnimationFrame(this.loop);
        }
    }

    update() {
        if (this.isGameOver || this.snake.length === 0) return;

        // Process next input
        if (this.inputQueue.length > 0) {
            const next = this.inputQueue.shift();
            this.dx = next.dx;
            this.dy = next.dy;
        }

        const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };

        // Wall Collision
        if (head.x < 0 || head.x >= this.cols || head.y < 0 || head.y >= this.rows) {
            this.triggerGameOver();
            return;
        }

        // Self Collision
        if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.triggerGameOver();
            return;
        }

        this.snake.unshift(head);

        // Food Collision
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.callbacks.onScoreChange(this.score);
            // Escalate difficulty
            this.tickRate = Math.max(50, this.tickRate - 3); 
            this.spawnFood();
        } else {
            this.snake.pop();
        }
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.callbacks.setTitle("Game Over! Restarting...");
        setTimeout(() => {
            if (this.animationId) {
                this.callbacks.setTitle("Snake");
                this.reset();
            }
        }, 1500);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Food — heading navy, reads clearly against the warm canvas + orange snake
        this.ctx.fillStyle = '#2A404D';
        this.ctx.fillRect(this.food.x * this.gridSize, this.food.y * this.gridSize, this.gridSize - 1, this.gridSize - 1);

        // Draw Snake — brand terracotta, darker toward the tail
        this.snake.forEach((segment, index) => {
            this.ctx.fillStyle = index === 0 ? '#D97A35' : '#B5652E';
            this.ctx.fillRect(segment.x * this.gridSize, segment.y * this.gridSize, this.gridSize - 1, this.gridSize - 1);
        });
        
        if (this.isGameOver) {
            this.ctx.fillStyle = 'rgba(42, 64, 77, 0.45)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Short instructional note shell.js displays while this game is active
SnakeGame.description = "🐍 Snake to pass the time — arrow keys, WASD, or the pad below. Your site's building in the background.";
