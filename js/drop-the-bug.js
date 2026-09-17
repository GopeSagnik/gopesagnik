export class DropTheBugGame {
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
        this.score = 0;
        this.isGameOver = false;
        
        // Entities
        this.bucket = { x: 0, targetX: 0, width: 80, height: 20 };
        this.words = [];
        
        // Difficulty scaling
        this.baseSpeed = 2;
        this.spawnRate = 1200; // ms between spawns
        this.spawnTimer = 0;

        // Content
        this.goodWords = ["C", "Python", "SQL", "AWS", "React", "Node", "CSS", "API"];
        this.badWords = ["Bug", "Error", "Crash", "Lag", "404", "Break"];

        this.callbacks.setTitle("Drop the Bug");
        
        // Bind input from shared-controls (only LEFT/RIGHT matter here)
        inputEmitter.onInput((dir) => this.queueInput(dir));
        
        // Handle canvas resizing gracefully
        this.handleResize = this.handleResize.bind(this);
        this.resizeObserver = new ResizeObserver(this.handleResize);
        this.resizeObserver.observe(this.canvas.parentElement);
    }

    start() {
        this.reset();
        this.lastTime = performance.now();
        this.loop = this.loop.bind(this);
        this.animationId = requestAnimationFrame(this.loop);
    }

    queueInput(dir) {
        if (this.isGameOver || !this.canvas.width) return;

        const moveAmount = this.canvas.width / 4; // Move 25% of screen per tap
        
        if (dir === 'LEFT') {
            this.bucket.targetX -= moveAmount;
        } else if (dir === 'RIGHT') {
            this.bucket.targetX += moveAmount;
        }

        // Clamp target to screen bounds
        const maxTarget = (this.canvas.width / (window.devicePixelRatio || 1)) - this.bucket.width;
        this.bucket.targetX = Math.max(0, Math.min(this.bucket.targetX, maxTarget));
    }

    handleResize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        
        // Keep bucket grounded at the bottom
        const logicalHeight = rect.height;
        this.bucket.y = logicalHeight - this.bucket.height - 10;
        
        // Center bucket initially if it hasn't been placed
        if (this.bucket.targetX === 0 && this.bucket.x === 0) {
            this.bucket.targetX = (rect.width - this.bucket.width) / 2;
            this.bucket.x = this.bucket.targetX;
        }
    }

    reset() {
        this.score = 0;
        this.callbacks.onScoreChange(this.score);
        this.isGameOver = false;
        
        this.words = [];
        this.baseSpeed = 2;
        this.spawnRate = 1200;
        this.spawnTimer = 0;
        
        this.handleResize();
    }

    spawnWord() {
        const logicalWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const isBad = Math.random() < 0.35; // 35% chance to spawn a bug
        
        const textArray = isBad ? this.badWords : this.goodWords;
        const text = textArray[Math.floor(Math.random() * textArray.length)];
        
        this.ctx.font = '500 16px "Libre Baskerville", serif';
        const textWidth = this.ctx.measureText(text).width;
        
        this.words.push({
            text,
            isBad,
            x: Math.random() * (logicalWidth - textWidth - 20) + 10,
            y: -20,
            width: textWidth,
            height: 16,
            speed: this.baseSpeed + (Math.random() * 1.5) // Slight variance in fall speed
        });
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        if (!this.isGameOver) {
            this.update(deltaTime);
        }
        this.draw();
        
        if (this.animationId) {
            this.animationId = requestAnimationFrame(this.loop);
        }
    }

    update(deltaTime) {
        // Smoothly move bucket towards targetX
        this.bucket.x += (this.bucket.targetX - this.bucket.x) * 0.2;

        // Handle Spawning
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnRate) {
            this.spawnWord();
            this.spawnTimer = 0;
        }

        const logicalHeight = this.canvas.height / (window.devicePixelRatio || 1);

        // Move Words & Check Collisions
        for (let i = this.words.length - 1; i >= 0; i--) {
            const word = this.words[i];
            word.y += word.speed;

            // AABB Collision check with Bucket
            const isColliding = (
                word.x < this.bucket.x + this.bucket.width &&
                word.x + word.width > this.bucket.x &&
                word.y < this.bucket.y + this.bucket.height &&
                word.y + word.height > this.bucket.y
            );

            if (isColliding) {
                if (word.isBad) {
                    this.triggerGameOver();
                    return;
                } else {
                    this.score += 10;
                    this.callbacks.onScoreChange(this.score);
                    
                    // Escalate difficulty safely
                    this.baseSpeed = Math.min(6, this.baseSpeed + 0.1);
                    this.spawnRate = Math.max(400, this.spawnRate - 30);
                    
                    this.words.splice(i, 1);
                }
            } else if (word.y > logicalHeight) {
                // Word fell out of bounds
                this.words.splice(i, 1);
            }
        }
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.callbacks.setTitle("System Crashed! Rebooting...");
        setTimeout(() => {
            if (this.animationId) {
                this.callbacks.setTitle("Drop the Bug");
                this.reset();
            }
        }, 1500);
    }

    draw() {
        const logicalWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const logicalHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        this.ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        // Draw Bucket — navy housing, warm cream screen (matches the site's CTA colors)
        this.ctx.fillStyle = '#2A404D';
        this.ctx.fillRect(this.bucket.x, this.bucket.y, this.bucket.width, this.bucket.height);
        this.ctx.fillStyle = '#FCFAF8';
        this.ctx.fillRect(this.bucket.x + 4, this.bucket.y + 4, this.bucket.width - 8, this.bucket.height - 8);

        // Draw Words
        this.ctx.font = '500 16px "Libre Baskerville", serif';
        this.ctx.textBaseline = 'top';
        
        this.words.forEach(word => {
            this.ctx.fillStyle = word.isBad ? '#C1523C' : '#7C9473'; // warm rust or sage — same tonal family as the rest of the site
            this.ctx.fillText(word.text, word.x, word.y);
        });
        
        if (this.isGameOver) {
            this.ctx.fillStyle = 'rgba(42, 64, 77, 0.55)';
            this.ctx.fillRect(0, 0, logicalWidth, logicalHeight);
            
            this.ctx.fillStyle = '#C1523C';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("BUG CAUGHT!", logicalWidth / 2, logicalHeight / 2 - 10);
            this.ctx.textAlign = 'left'; // Reset
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
DropTheBugGame.description = "🐞 Catch the good tech, dodge the bugs — left/right to move. Almost there!";
