import { loaderShell } from './shell.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('intent-form');
    const input = document.getElementById('intent-input');
    const loader = document.getElementById('generation-loader');
    const iframeContainer = document.getElementById('generated-site-container');
    const iframe = document.getElementById('generated-iframe');
    const closeBtn = document.getElementById('close-preview-btn');

    // Add a state flag to prevent concurrent generations
    let isGenerating = false;

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Block overlapping requests if already loading
            if (isGenerating) return;

            const userIntent = input.value.trim();
            if (!userIntent) return;

            // Lock the form and remove focus to prevent spacebar triggers
            isGenerating = true;
            if (document.activeElement) {
                document.activeElement.blur();
            }

            // 1. Gather Screen & Device Telemetry
            const screenData = {
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                deviceType: window.innerWidth < 768 ? 'Mobile' : (window.innerWidth < 1024 ? 'Tablet' : 'Desktop'),
                pixelRatio: window.devicePixelRatio || 1
            };

            // 2. Show Full Screen Loader & Mount Arcade Game
            loader.classList.remove('opacity-0', 'invisible');
            loader.classList.add('opacity-100', 'visible');
            
            // Mounts the game UI inside the loader div
            loaderShell.mount(loader);

            try {
                // 3. Call Serverless Backend with Intent and Screen Context
                const response = await fetch('/api', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        intent: userIntent,
                        screen: screenData
                    })
                });

                // if (!response.ok) {
                //     throw new Error(`Server returned status: ${response.status}`);
                // }

                // const data = await response.json();
                if (!response.ok) {
                    // Attempt to read the specific error message from the backend
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || `Server returned status: ${response.status}`);
                }

                const data = await response.json();

                if (!data.html) {
                    throw new Error("No HTML received from generator");
                }

                // 4. Wrap with full Tailwind & versatile Google Fonts
                const fullPageDoc = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <link rel="preconnect" href="https://fonts.googleapis.com">
                        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Fira+Code:wght@400;600&family=Playfair+Display:ital,wght@0,600;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                        <script src="https://cdn.tailwindcss.com"></script>
                        <script>
                            tailwind.config = {
                                theme: {
                                    extend: {
                                        fontFamily: {
                                            sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
                                            heading: ['"Space Grotesk"', 'sans-serif'],
                                            serif: ['"Playfair Display"', 'serif'],
                                            mono: ['"Fira Code"', 'monospace']
                                        }
                                    }
                                }
                            }
                        </script>
                        <style>
                            /* Smooth scrolling & custom scrollbars */
                            html { scroll-behavior: smooth; }
                            ::-webkit-scrollbar { width: 6px; }
                            ::-webkit-scrollbar-track { background: transparent; }
                            ::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 3px; }
                        </style>
                    </head>
                    <body class="min-h-screen antialiased selection:bg-orange-500 selection:text-white">
                        ${data.html}
                    </body>
                    </html>
                `;

                iframe.srcdoc = fullPageDoc;

                // 5. Notify the shell that generation is done, pass the reveal callback
                loaderShell.notifyReady(() => {
                    // Release the lock on success
                    isGenerating = false;
                    
                    // Hide Loader & Reveal Preview ONLY when user clicks the ready pill
                    loader.classList.remove('opacity-100', 'visible');
                    loader.classList.add('opacity-0', 'invisible');

                    iframeContainer.classList.remove('translate-y-full');
                    iframeContainer.classList.add('translate-y-0');
                });

            } catch (error) {
                console.error("Generation Error:", error);
                
                // Release the lock on failure
                isGenerating = false;
                
                // Tear down game and hide loader on error
                loaderShell.teardown();
                loader.classList.remove('opacity-100', 'visible');
                loader.classList.add('opacity-0', 'invisible');
                alert(error.message ||"Generation failed. Please try again in a moment.");
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            iframeContainer.classList.remove('translate-y-0');
            iframeContainer.classList.add('translate-y-full');
            setTimeout(() => {
                iframe.srcdoc = '';
            }, 700);
        });
    }
});