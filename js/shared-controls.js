let keydownHandler = null;
let touchHandlers = [];
let currentMount = null;
let inputCallback = null; 

/**
 * Initializes controls and binds keyboard/touch event listeners.
 * The D-pad is only rendered at all on touch-capable devices — this is a
 * runtime JS check, not just CSS, so desktop never even gets the markup.
 * @param {HTMLElement} mountPoint - The DOM element to render the D-pad into.
 * @returns {Object} An emitter object with an `onInput` subscription method.
 */
export function initControls(mountPoint) {
    currentMount = mountPoint;

    const isTouchDevice = (typeof navigator.maxTouchPoints === 'number')
        ? navigator.maxTouchPoints > 0
        : ('ontouchstart' in window); // fallback only for very old browsers lacking maxTouchPoints entirely

    if (isTouchDevice) {
        // Render the D-Pad HTML — touch devices only
        currentMount.innerHTML = `
            <div class="loader-dpad grid grid-cols-3 grid-rows-3 gap-2 w-48 h-48 mx-auto touch-none select-none">
                <!-- UP -->
                <div class="col-start-2 row-start-1 flex justify-center items-center">
                    <button data-dir="UP" class="d-pad-btn w-full h-full bg-white/70 active:bg-primary/20 hover:border-primary/50 rounded-2xl shadow-sm border border-secondary/50 backdrop-blur-sm flex items-center justify-center transition-colors">
                        <svg class="w-8 h-8 text-heading/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                    </button>
                </div>
                <!-- LEFT -->
                <div class="col-start-1 row-start-2 flex justify-center items-center">
                    <button data-dir="LEFT" class="d-pad-btn w-full h-full bg-white/70 active:bg-primary/20 hover:border-primary/50 rounded-2xl shadow-sm border border-secondary/50 backdrop-blur-sm flex items-center justify-center transition-colors">
                        <svg class="w-8 h-8 text-heading/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                </div>
                <!-- RIGHT -->
                <div class="col-start-3 row-start-2 flex justify-center items-center">
                    <button data-dir="RIGHT" class="d-pad-btn w-full h-full bg-white/70 active:bg-primary/20 hover:border-primary/50 rounded-2xl shadow-sm border border-secondary/50 backdrop-blur-sm flex items-center justify-center transition-colors">
                        <svg class="w-8 h-8 text-heading/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
                <!-- DOWN -->
                <div class="col-start-2 row-start-3 flex justify-center items-center">
                    <button data-dir="DOWN" class="d-pad-btn w-full h-full bg-white/70 active:bg-primary/20 hover:border-primary/50 rounded-2xl shadow-sm border border-secondary/50 backdrop-blur-sm flex items-center justify-center transition-colors">
                        <svg class="w-8 h-8 text-heading/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                </div>
            </div>
        `;

        const buttons = currentMount.querySelectorAll('.d-pad-btn');
        buttons.forEach(btn => {
            const dir = btn.getAttribute('data-dir');

            const handler = (e) => {
                e.preventDefault(); // Stops ghost clicks and pinch-zooms
                if (inputCallback) inputCallback(dir);
            };

            // Bind both — touchstart for real touch devices, click as a
            // fallback for hybrid/touchscreen-laptop input that may not
            // fire touch events the same way.
            btn.addEventListener('touchstart', handler, { passive: false });
            btn.addEventListener('click', handler);
            touchHandlers.push({ element: btn, handler });
        });
    } else {
        // Desktop/mouse: no D-pad at all, keyboard only
        currentMount.innerHTML = '';
    }

    // Desktop Keyboard Integration (always active regardless of device)
    keydownHandler = (e) => {
        if (!inputCallback) return;
        
        // Prevent default scrolling for arrow keys
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
        }

        switch(e.key) {
            case 'ArrowUp': case 'w': case 'W': inputCallback('UP'); break;
            case 'ArrowDown': case 's': case 'S': inputCallback('DOWN'); break;
            case 'ArrowLeft': case 'a': case 'A': inputCallback('LEFT'); break;
            case 'ArrowRight': case 'd': case 'D': inputCallback('RIGHT'); break;
        }
    };
    window.addEventListener('keydown', keydownHandler, { passive: false });

    // Return the subscription interface for the active game
    return {
        onInput: (callback) => { 
            inputCallback = callback; 
        }
    };
}

/**
 * Tears down all event listeners and clears the DOM to prevent memory leaks.
 */
export function destroyControls() {
    // Clean up window listeners
    if (keydownHandler) {
        window.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
    }

    // Clean up DOM listeners
    touchHandlers.forEach(({ element, handler }) => {
        element.removeEventListener('touchstart', handler);
        element.removeEventListener('click', handler);
    });
    touchHandlers = [];
    inputCallback = null;

    // Clear UI
    if (currentMount) {
        currentMount.innerHTML = '';
        currentMount = null;
    }
}
