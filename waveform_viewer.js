/**
 * SiliconIDE - Waveform Timing Diagram Renderer
 * Renders scrolling multi-signal digital wave traces and hex bus value boxes
 */

class WaveformViewer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.history = []; // Array of { cycle, state }
        this.signals = []; // Array of port structures
        
        this.hoverIndex = -1; // Index of cycle currently hovered
        this.pixelRatio = window.devicePixelRatio || 1;
        
        // Layout Configs
        this.labelWidth = 140;   // Left margin for names
        this.rowHeight = 45;    // Vertical spacing per wave
        this.colWidth = 30;     // Horizontal spacing per cycle tick
        this.paddingTop = 40;   // Header timeline space
        
        this.setupEvents();
        this.resize();
    }

    setupEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * this.pixelRatio;
            
            // Calculate hover cycle
            const activeWidth = this.canvas.width - this.labelWidth;
            const scrollOffset = this.getScrollOffset();
            
            const relativeX = mouseX - this.labelWidth;
            if (relativeX > 0) {
                const hoveredTick = Math.floor((relativeX + scrollOffset) / this.colWidth);
                if (hoveredTick >= 0 && hoveredTick < this.history.length) {
                    this.hoverIndex = hoveredTick;
                } else {
                    this.hoverIndex = -1;
                }
            } else {
                this.hoverIndex = -1;
            }
            this.draw();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoverIndex = -1;
            this.draw();
        });

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.parentNode.getBoundingClientRect();
        this.canvas.width = rect.width * this.pixelRatio;
        this.canvas.height = Math.max(rect.height, (this.signals.length * this.rowHeight) + this.paddingTop + 20) * this.pixelRatio;
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = (this.canvas.height / this.pixelRatio) + 'px';
        
        this.draw();
    }

    setSignals(signals) {
        this.signals = signals;
        this.resize();
    }

    updateHistory(history) {
        this.history = history;
        this.draw();
    }

    getScrollOffset() {
        // If history runs off the screen, calculate a scroll offset to show the latest cycles
        const maxVisibleTicks = Math.floor((this.canvas.width - this.labelWidth) / this.colWidth);
        if (this.history.length > maxVisibleTicks - 2) {
            return (this.history.length - (maxVisibleTicks - 2)) * this.colWidth;
        }
        return 0;
    }

    draw() {
        if (!this.canvas || !this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear screen to PCB charcoal
        ctx.fillStyle = '#020503';
        ctx.fillRect(0, 0, w, h);

        if (this.signals.length === 0 || this.history.length === 0) {
            this.drawEmptyMessage();
            return;
        }

        const scrollOffset = this.getScrollOffset();

        // 1. Draw Grid lines and cycle headers
        this.drawTimelineGrid(scrollOffset);

        // 2. Draw Signal Traces
        for (let i = 0; i < this.signals.length; i++) {
            const sig = this.signals[i];
            const isBus = (sig.width.high - sig.width.low) > 0;
            const baselineY = this.paddingTop + (i * this.rowHeight) + this.rowHeight - 10;
            
            // Draw Signal Background Row Stripe
            ctx.fillStyle = i % 2 === 0 ? 'rgba(9, 19, 13, 0.2)' : 'rgba(4, 9, 6, 0.1)';
            ctx.fillRect(0, this.paddingTop + (i * this.rowHeight), w, this.rowHeight);

            // Draw wave traces
            this.drawSignalTrace(sig, isBus, baselineY, scrollOffset);

            // Draw Label Panel Divider
            ctx.fillStyle = '#0d1d14';
            ctx.fillRect(0, 0, this.labelWidth, h);
            ctx.fillStyle = '#142a1b';
            ctx.fillRect(this.labelWidth - 1, 0, 1, h);

            // Draw Signal Text Label
            ctx.font = `bold ${12 * this.pixelRatio}px 'Share Tech Mono', monospace`;
            ctx.fillStyle = sig.type === 'input' ? '#00e5ff' : '#39ff14';
            
            let labelName = sig.name;
            if (isBus) {
                labelName += `[${sig.width.high}:${sig.width.low}]`;
            }
            
            // Draw direction indicator
            ctx.fillText(labelName, 15 * this.pixelRatio, (this.paddingTop + (i * this.rowHeight) + 25) * this.pixelRatio);
            
            // Draw IO direction tag
            ctx.font = `${9 * this.pixelRatio}px 'Share Tech Mono', monospace`;
            ctx.fillStyle = '#4e6b56';
            ctx.fillText(sig.type.toUpperCase(), (this.labelWidth - 35) * this.pixelRatio, (this.paddingTop + (i * this.rowHeight) + 24) * this.pixelRatio);
        }

        // 3. Draw Hover scanning line & value bubble
        if (this.hoverIndex !== -1 && this.hoverIndex < this.history.length) {
            this.drawScanningCursor(scrollOffset);
        }
    }

    drawEmptyMessage() {
        const ctx = this.ctx;
        ctx.fillStyle = '#4e6b56';
        ctx.font = `${14 * this.pixelRatio}px 'Share Tech Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText("WAITING FOR TIMELINE TRACE DATA...", this.canvas.width / 2, this.canvas.height / 2);
        ctx.textAlign = 'left';
    }

    drawTimelineGrid(scrollOffset) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.strokeStyle = '#0b160f';
        ctx.lineWidth = 1 * this.pixelRatio;

        // Draw timeline header backgrounds
        ctx.fillStyle = '#060e09';
        ctx.fillRect(0, 0, w, this.paddingTop);
        ctx.fillStyle = '#142a1b';
        ctx.fillRect(0, this.paddingTop - 1, w, 1);

        const startX = this.labelWidth;
        const maxVisibleTicks = Math.floor((w - startX) / this.colWidth) + 1;

        ctx.font = `${10 * this.pixelRatio}px 'Share Tech Mono', monospace`;
        ctx.fillStyle = '#ff9f00'; // Amber cycle counts

        for (let t = 0; t < this.history.length; t++) {
            const x = startX + (t * this.colWidth) - scrollOffset;
            if (x < startX - 10 || x > w + 10) continue;

            // Draw vertical tick lines
            ctx.beginPath();
            ctx.moveTo(x * this.pixelRatio, this.paddingTop * this.pixelRatio);
            ctx.lineTo(x * this.pixelRatio, h);
            ctx.stroke();

            // Label cycle number
            ctx.fillText(`T${t}`, (x + 5) * this.pixelRatio, 24 * this.pixelRatio);
        }
    }

    drawSignalTrace(sig, isBus, baselineY, scrollOffset) {
        const ctx = this.ctx;
        const startX = this.labelWidth;
        const w = this.canvas.width;

        ctx.lineWidth = 2 * this.pixelRatio;

        if (isBus) {
            // Bus values are drawn as interlocking hexagon bubbles (Vivado/ModelSim style)
            ctx.strokeStyle = '#00e5ff'; // Cyan logic bus
            ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';

            for (let t = 0; t < this.history.length; t++) {
                const x = startX + (t * this.colWidth) - scrollOffset;
                if (x < startX - 30 || x > w) continue;

                const val = this.history[t].state[sig.name] || 0;
                
                // Draw hexagon box for this cycle block
                ctx.beginPath();
                ctx.moveTo(x * this.pixelRatio, (baselineY - 18) * this.pixelRatio);
                ctx.lineTo((x + this.colWidth - 4) * this.pixelRatio, (baselineY - 18) * this.pixelRatio);
                ctx.lineTo((x + this.colWidth) * this.pixelRatio, (baselineY - 9) * this.pixelRatio);
                ctx.lineTo((x + this.colWidth - 4) * this.pixelRatio, (baselineY) * this.pixelRatio);
                ctx.lineTo(x * this.pixelRatio, (baselineY) * this.pixelRatio);
                ctx.lineTo((x - 4) * this.pixelRatio, (baselineY - 9) * this.pixelRatio);
                ctx.closePath();
                
                ctx.fill();
                ctx.stroke();

                // Draw hex value inside
                ctx.font = `bold ${9 * this.pixelRatio}px 'Share Tech Mono', monospace`;
                ctx.fillStyle = '#e2f4e8';
                
                const hexVal = val.toString(16).toUpperCase();
                ctx.fillText(hexVal, (x + 6) * this.pixelRatio, (baselineY - 6) * this.pixelRatio);
            }
        } else {
            // Single bit signal (drawn as standard high-low trace)
            ctx.strokeStyle = sig.type === 'input' ? '#00e5ff' : '#39ff14'; // input: cyan, output: green
            ctx.shadowColor = sig.type === 'input' ? 'rgba(0, 229, 255, 0.3)' : 'rgba(57, 255, 20, 0.3)';
            ctx.shadowBlur = 4 * this.pixelRatio;

            ctx.beginPath();
            
            let lastX = startX - scrollOffset;
            let lastY = baselineY;

            // Set initial point
            if (this.history.length > 0) {
                const initialVal = this.history[0].state[sig.name] || 0;
                lastY = initialVal === 1 ? baselineY - 20 : baselineY;
                ctx.moveTo(lastX * this.pixelRatio, lastY * this.pixelRatio);
            }

            for (let t = 0; t < this.history.length; t++) {
                const x = startX + (t * this.colWidth) - scrollOffset;
                const val = this.history[t].state[sig.name] || 0;
                const nextY = val === 1 ? baselineY - 20 : baselineY;

                if (x >= startX) {
                    // Slanted transition line to look digital and organic
                    ctx.lineTo(x * this.pixelRatio, lastY * this.pixelRatio);
                    ctx.lineTo(x * this.pixelRatio, nextY * this.pixelRatio);
                }

                lastX = x;
                lastY = nextY;
            }
            
            // Finish line to the end of block
            ctx.lineTo((lastX + this.colWidth) * this.pixelRatio, lastY * this.pixelRatio);
            ctx.stroke();

            // Reset shadow
            ctx.shadowBlur = 0;
        }
    }

    drawScanningCursor(scrollOffset) {
        const ctx = this.ctx;
        const h = this.canvas.height;
        const startX = this.labelWidth;

        const x = startX + (this.hoverIndex * this.colWidth) - scrollOffset;

        // Draw vertical glowing scanning line
        ctx.strokeStyle = 'rgba(255, 159, 0, 0.5)';
        ctx.lineWidth = 1 * this.pixelRatio;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x * this.pixelRatio, this.paddingTop * this.pixelRatio);
        ctx.lineTo(x * this.pixelRatio, h);
        ctx.stroke();
        ctx.setLineDash([]); // clear dash

        // Draw hover tooltip bubble in top header
        const tooltipW = 100;
        const tooltipH = 30;
        let tooltipX = x - (tooltipW / 2);
        
        // constrain tooltip screen bounds
        if (tooltipX < this.labelWidth) tooltipX = this.labelWidth + 5;
        if (tooltipX + tooltipW > this.canvas.width) tooltipX = this.canvas.width - tooltipW - 5;

        ctx.fillStyle = '#ff9f00';
        ctx.fillRect(tooltipX * this.pixelRatio, 5 * this.pixelRatio, tooltipW * this.pixelRatio, tooltipH * this.pixelRatio);

        ctx.font = `bold ${10 * this.pixelRatio}px 'Orbitron', sans-serif`;
        ctx.fillStyle = '#000';
        ctx.fillText(`READOUT T${this.hoverIndex}`, (tooltipX + 10) * this.pixelRatio, 17 * this.pixelRatio);
        
        ctx.font = `${9 * this.pixelRatio}px 'Share Tech Mono', monospace`;
        ctx.fillText(`STIMULATING ACTIVE`, (tooltipX + 10) * this.pixelRatio, 27 * this.pixelRatio);
    }
}

// Export global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WaveformViewer;
} else {
    window.WaveformViewer = WaveformViewer;
}
