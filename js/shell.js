// loader/shell.js
import { initControls, destroyControls } from './shared-controls.js';
import { SnakeGame } from './snake.js';
import { DropTheBugGame } from './drop-the-bug.js';

class LoaderShell {
    constructor() {
        this.activeGame = null;
        this.canvas = null;
        this.container = null;
        this.readyPill = null;
        this.onReadyClickCallback = null;
    }

    /**
     * Mounts the loader shell, randomly picks a game, and starts the loop.
     * @param {HTMLElement} mountPoint - The DOM element containing or wrapping the loader.
     */
    mount(mountPoint) {
        this.container = mountPoint;
        this.container.innerHTML = `
            <div class="relative w-full h-full flex flex-col items-center justify-between p-4 select-none touch-none">
                <!-- Status & Score Header -->
                <div class="w-full max-w-md flex items-center justify-between text-xs font-mono text-body z-10 px-2 pt-2">
                    <div id="game-status" class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        <span id="game-title" class="text-heading font-semibold">Loading Arcade...</span>
                    </div>
                    <div id="game-score-box">
                        Score <span id="game-score" class="text-primary font-bold">0</span>
                    </div>
                </div>

               <!-- Per-game instructions, styled as stacked sticky notes -->
                <!-- Per-game instructions, styled as stacked sticky notes -->
                <div class="relative mt-2 mb-6 flex flex-col items-center justify-center w-full gap-2.5">
                    
                    <!-- Primary Note (Left tilt) -->
                    <div class="relative z-10 w-full max-w-xs flex justify-center">
                        <span class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow z-20"></span>
                        <p id="game-note" class="w-full max-w-[280px] -rotate-1 bg-secondary/95 border border-secondary text-heading font-bodyText text-xs text-center leading-snug px-4 py-2.5 rounded-lg shadow-md backdrop-blur-sm"></p>
                    </div>

                    <!-- Secondary Note (Right tilt) -->
                    <div class="relative z-0 w-full max-w-xs flex justify-center">
                        <span class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary/70 shadow z-10"></span>
                        <p class="w-full max-w-[260px] rotate-2 bg-warm/95 border border-secondary/50 text-body font-mono text-[10px] sm:text-xs text-center leading-snug px-4 py-2 rounded-lg shadow-sm">
                            Play the game, Don't be bore... Till the Site Roar🐯!
                        </p>
                    </div>

                </div>

                <!-- Ready CTA (hidden initially) — main call to action once it appears -->
                <button id="ready-pill" class="hidden mx-auto z-50 mb-1">
                    <span class="relative flex">
                        <span class="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping"></span>
                        <span class="relative inline-flex items-center gap-3 px-6 py-3 rounded-full bg-primary hover:bg-heading text-warm font-sans font-bold text-base shadow-2xl shadow-primary/40 ring-4 ring-primary/20 transform transition active:scale-95">
                            <span>⚡Yayyy! Portfolio Ready</span>
                            <span class="bg-white/20 text-xs px-2.5 py-1 rounded-full">View Now</span>
                        </span>
                    </span>
                </button>

                <!-- Game Canvas Box -->
                <div class="relative w-full max-w-md flex-1 flex items-center justify-center my-2">
                    <canvas id="loader-game-canvas" class="w-full max-h-[360px] bg-white/70 backdrop-blur-sm rounded-2xl border-2 border-dashed border-primary/40 shadow-lg"></canvas>
                </div>

                <!-- Shared Touch Controls Mount Container -->
                <div id="controls-root" class="w-full max-w-xs z-10 pb-2"></div>
            </div>
        `;

        this.canvas = this.container.querySelector('#loader-game-canvas');
        this.readyPill = this.container.querySelector('#ready-pill');

        this.readyPill.addEventListener('click', () => {
            if (typeof this.onReadyClickCallback === 'function') {
                const executeReveal = this.onReadyClickCallback; // Cache the function first
                this.teardown(); // Clear memory
                executeReveal(); // Execute safely
            }
        });

        // Pick game randomly: 0 = Snake, 1 = Drop the Bug
        const games = [SnakeGame, DropTheBugGame];
        const SelectedGame = games[Math.floor(Math.random() * games.length)];

        const noteEl = this.container.querySelector('#game-note');
        if (noteEl) noteEl.textContent = SelectedGame.description || '';

        // Initialize shared input emitter and bind to game instance
        const inputEmitter = initControls(this.container.querySelector('#controls-root'));
        this.activeGame = new SelectedGame(this.canvas, inputEmitter, {
            onScoreChange: (score) => {
                const scoreEl = this.container.querySelector('#game-score');
                if (scoreEl) scoreEl.textContent = score;
            },
            setTitle: (title) => {
                const titleEl = this.container.querySelector('#game-title');
                if (titleEl) titleEl.textContent = title;
            }
        });

        this.activeGame.start();
    }

    /**
     * Called when the backend UI generation completes.
     * Displays the interactive "Ready" pill without interrupting the active game run.
     * @param {Function} onViewCallback - Callback executed when user clicks the ready pill.
     */
    notifyReady(onViewCallback) {
        this.onReadyClickCallback = onViewCallback;
        if (this.readyPill) {
            this.readyPill.classList.remove('hidden');
        }
    }

    /**
     * Performs full teardown: stops game loops, removes event listeners, and frees canvas resources.
     */
    teardown() {
        if (this.activeGame) {
            this.activeGame.destroy();
            this.activeGame = null;
        }

        destroyControls();

        if (this.container) {
            this.container.innerHTML = '';
        }

        this.canvas = null;
        this.readyPill = null;
        this.onReadyClickCallback = null;
    }
}

export const loaderShell = new LoaderShell();
