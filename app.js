document.addEventListener('DOMContentLoaded', () => {
    const targetDiv = document.getElementById('character-target-div');
    const inkCanvas = document.getElementById('ink-canvas');
    const inkCtx = inkCanvas.getContext('2d');

    let writer = null;
    let currentWordIndex = -1;
    let isDrawing = false;
    let currentStrokePoints = [];

    function getWriterSize() {
        // Use getBoundingClientRect to get the precise inner size
        // We need to subtract borders if we want the content box, 
        // but since we are using flex centering, we can just fit it within the content box.
        // However, HanziWriter sets explicit pixel size.
        // Let's use the computed style to get the content width/height.
        const style = window.getComputedStyle(targetDiv);
        const width = parseFloat(style.width) - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
        const height = parseFloat(style.height) - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth);
        return Math.min(width, height);
    }

    function resizeCanvas() {
        const size = getWriterSize();
        // Match canvas resolution to display size
        inkCanvas.width = size * window.devicePixelRatio;
        inkCanvas.height = size * window.devicePixelRatio;
        inkCanvas.style.width = `${size}px`;
        inkCanvas.style.height = `${size}px`;
        inkCtx.scale(window.devicePixelRatio, window.devicePixelRatio);

        inkCtx.lineCap = 'round';
        inkCtx.lineJoin = 'round';
        inkCtx.lineWidth = 12; // Match Hanzi Writer width roughly
        inkCtx.strokeStyle = '#2C3E50'; // User ink color
    }

    // Initial resize
    resizeCanvas();

    function createWriter(character) {
        // Clear previous writer but keep canvas
        // Note: HanziWriter appends to the div, so we need to be careful not to remove the canvas
        // The canvas is inside targetDiv. 
        // Strategy: Clear everything EXCEPT the canvas? 
        // Or just empty the div and re-append canvas?
        // Simpler: Re-create canvas or move it out?
        // Let's just empty and re-add.
        targetDiv.innerHTML = '';
        targetDiv.appendChild(inkCanvas);

        // Clear ink
        inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);

        const size = getWriterSize();

        writer = HanziWriter.create('character-target-div', character, {
            width: size,
            height: size,
            padding: 5,
            showOutline: true,
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 200,
            // Make the "correct" stroke transparent during quiz so we see our own ink
            strokeColor: '#2C3E50', // Default color for animation
            radicalColor: '#FF6B6B',
            outlineColor: '#DDD',
            drawingWidth: 20,
            showHintAfterMisses: 3,
            highlightOnComplete: false, // We handle completion manually
        });

        // Auto-animate then start quiz
        writer.animateCharacter({
            onComplete: function () {
                setTimeout(() => {
                    startQuiz();
                }, 500);
            }
        });
    }

    function showNextWord() {
        let nextIndex;
        do {
            nextIndex = Math.floor(Math.random() * practiceWords.length);
        } while (nextIndex === currentWordIndex && practiceWords.length > 1);

        currentWordIndex = nextIndex;
        const char = practiceWords[currentWordIndex];

        createWriter(char);
    }

    function animateCharacter() {
        if (writer) {
            // Reset color for animation
            writer.updateColor('strokeColor', '#2C3E50');
            inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height); // Clear user ink
            writer.animateCharacter();
        }
    }

    function startQuiz() {
        if (writer) {
            // Clear user ink before starting quiz
            inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);

            // Set stroke color to transparent for the quiz so we don't see the "snap"
            writer.updateColor('strokeColor', 'rgba(0,0,0,0)');

            writer.quiz({
                onMistake: function (strokeData) {
                    console.log('Mistake!', strokeData);
                    // Shake effect or visual feedback?
                    // Clear the last stroke the user drew
                    // Since we don't track strokes individually on canvas easily, 
                    // we might just have to clear the whole canvas if we want to be strict,
                    // OR we rely on the fact that the user will try again.
                    // But if we don't clear, the wrong ink stays.
                    // Let's try to clear the canvas and redraw valid strokes? 
                    // No, we don't have valid strokes data easily.
                    // Simple approach: Flash red?
                    // For now, just let the user draw over it or clear it manually?
                    // Better: Fade out the ink?

                    // Actually, since we are drawing in real-time, if it's a mistake, 
                    // we should probably undo the last drawing action.
                    // But we don't have undo history here yet.
                    // Let's just clear the canvas for now to force retry? 
                    // No, that clears previous correct strokes too.

                    // Ideally, we only clear the *current* stroke.
                    // But all ink is on one layer.
                    // We could use `save()` and `restore()`?
                    // When a stroke starts, save canvas state.
                    // If mistake, restore.
                    // If correct, keep.

                    // Let's implement save/restore in the touch handlers.
                },
                onCorrectStroke: function (strokeData) {
                    console.log('Correct stroke!', strokeData);
                    // Keep the ink!
                },
                onComplete: function (summaryData) {
                    console.log('Character complete!');
                    // Clear user ink
                    inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
                    // Show the standard character
                    writer.updateColor('strokeColor', '#2C3E50');
                    writer.showCharacter();
                }
            });
        }
    }

    // --- Ink Drawing Logic ---

    let savedCanvasState = null;

    function getPos(e) {
        const rect = inkCanvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDrawing(e) {
        isDrawing = true;
        const pos = getPos(e);

        // Save canvas state before this stroke
        savedCanvasState = inkCtx.getImageData(0, 0, inkCanvas.width, inkCanvas.height);

        inkCtx.beginPath();
        inkCtx.moveTo(pos.x, pos.y);
        currentStrokePoints = [pos];
    }

    function draw(e) {
        if (!isDrawing) return;
        // Don't prevent default here, let it bubble to Hanzi Writer?
        // Hanzi Writer needs the event.
        // But if we don't prevent default, scrolling might happen on mobile.
        // Hanzi Writer handles scrolling prevention usually.

        const pos = getPos(e);

        inkCtx.lineTo(pos.x, pos.y);
        inkCtx.stroke();
        currentStrokePoints.push(pos);
    }

    function stopDrawing() {
        isDrawing = false;
        // We don't know if it was correct or not yet.
        // The quiz callback happens asynchronously or synchronously?
        // Hanzi Writer processes the stroke on 'touchend'.
        // So the callback should fire shortly.
        // We need to know if we should restore the canvas.
        // We can listen to the callbacks.
    }

    // We need to hook into the quiz callbacks to know whether to restore.
    // But the callbacks are defined in `startQuiz`.
    // We can use a shared flag or method.

    // Let's redefine startQuiz to handle the restore logic.
    // We need to expose a way to restore.

    function restoreCanvas() {
        if (savedCanvasState) {
            inkCtx.putImageData(savedCanvasState, 0, 0);
        }
    }

    const scoreDisplay = document.getElementById('score-display');
    let mistakeCount = 0;

    // Override startQuiz to use the restore logic
    startQuiz = function () {
        if (writer) {
            // Clear user ink before starting quiz
            inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
            scoreDisplay.style.opacity = '0'; // Hide score
            mistakeCount = 0; // Reset mistakes

            writer.updateColor('strokeColor', 'rgba(0,0,0,0)');

            writer.quiz({
                onMistake: function (strokeData) {
                    console.log('Mistake!');
                    mistakeCount++;
                    // It was a mistake, undo the ink
                    restoreCanvas();
                },
                onCorrectStroke: function (strokeData) {
                    console.log('Correct stroke data:', strokeData);
                    // Keep ink
                },
                onComplete: function (summaryData) {
                    console.log('Complete summary data:', summaryData);

                    // Calculate score
                    let score = 100 - (mistakeCount * 10);
                    if (score < 0) score = 0;

                    // Show score
                    scoreDisplay.textContent = score + '分';
                    scoreDisplay.style.opacity = '1';

                    // Wait a tiny bit then show standard
                    setTimeout(() => {
                        inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
                        writer.updateColor('strokeColor', '#2C3E50');
                        writer.showCharacter();

                        // Auto-advance after a short delay
                        setTimeout(() => {
                            scoreDisplay.style.opacity = '0'; // Hide score before next
                            showNextWord();
                        }, 2000); // Slightly longer delay to see score
                    }, 500);
                }
            });
        }
    };

    // Event Listeners for Ink
    // We listen on the container or window?
    // Hanzi Writer binds to the SVG.
    // Since inkCanvas has pointer-events: none, events go to SVG.
    // We can capture them on the parent div `targetDiv`.

    targetDiv.addEventListener('mousedown', startDrawing, true); // Capture
    targetDiv.addEventListener('mousemove', draw, true);
    targetDiv.addEventListener('mouseup', stopDrawing, true);

    targetDiv.addEventListener('touchstart', startDrawing, { passive: false, capture: true });
    targetDiv.addEventListener('touchmove', draw, { passive: false, capture: true });
    targetDiv.addEventListener('touchend', stopDrawing, true);

    // Handle resize
    window.addEventListener('resize', () => {
        if (currentWordIndex !== -1) {
            resizeCanvas();
            createWriter(practiceWords[currentWordIndex]);
        }
    });

    // Start with a word
    // showNextWord(); // Moved to after fetch

    // Fetch data from Google Sheet
    const SHEET_ID = '1AGnVIaOZbH3O7dmoBo4IHG-EUj09tbPo4363KaqYaas';
    const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

    // Default fallback
    let practiceWords = ['一', '二', '三'];

    fetch(CSV_URL)
        .then(response => response.text())
        .then(text => {
            // Parse CSV: handle standard comma, full-width comma, newlines, and mixed spacing
            // Remove quotes if present (Google Sheets CSV might quote fields)
            const cleanText = text.replace(/['"]/g, '');
            const words = cleanText.split(/[,，\s\n]+/) // Split by comma (half/full), whitespace, newline
                .map(w => w.trim())
                .filter(w => w.length > 0); // Filter empty

            if (words.length > 0) {
                practiceWords = words;
                console.log('Loaded words:', practiceWords);
            }
            showNextWord();
        })
        .catch(err => {
            console.error('Failed to load words:', err);
            // Use fallback
            showNextWord();
        });
});
