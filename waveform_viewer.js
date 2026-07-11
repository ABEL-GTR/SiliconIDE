/**
 * SiliconIDE - Waveform Timing Diagram Renderer
 * Renders scrolling multi-signal digital wave traces and hex bus value boxes
 * Supports synchronized manual scrolling via custom scroll viewport elements
 */

class WaveformViewer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.viewport = this.canvas.parentNode.querySelector('.waveform-scroll-viewport');
        this.dummy = this.canvas.parentNode.querySelector('.waveform-scroll-dummy');
        
        this.history = []; // Array of { cycle, state }
        this.signals = []; // Array of port structures
        
        this.hoverIndex = -1; // Index of cycle currently hovered
        this.pixelRatio = window.devicePixelRatio || 1;
        
        // Layout Configs
        this.labelWidth = 140;   // Left margin for names
        this.rowHeight = 45;    // Vertical spacing per wave
        this.colWidth = 30;     // Horizontal spacing per cycle tick
        this.paddingTop = 40;   // Header timeline space
        
        this.scrollOffset = 0;
        this.verticalScrollOffset = 0;
        
        this.setupEvents();
        this.resize();
    }

    setupEvents() {
        const target = this.viewport || this.canvas;
        
        target.addEventListener('mousemove', (e) => {
            const rect = target.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * this.pixelRatio;
            
            const startX = this.labelWidth;
            const relativeX = mouseX - (startX * this.pixelRatio);
            
            if (relativeX > 0) {
                const hoveredTick = Math.floor((relativeX + (this.scrollOffset * this.pixelRatio)) / (this.colWidth * this.pixelRatio));
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

        target.addEventListener('mouseleave', () => {
            this.hoverIndex = -1;
            this.draw();
        });

        if (this.viewport) {
            this.viewport.addEventListener('scroll', () => {
                this.scrollOffset = this.viewport.scrollLeft;
                this.verticalScrollOffset = this.viewport.scrollTop;
                this.draw();
            });
        }

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.parentNode.getBoundingClientRect();
        this.canvas.width = rect.width * this.pixelRatio;
        this.canvas.height = rect.height * this.pixelRatio;
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        if (this.dummy) {
            const neededWidth = this.labelWidth + (this.history.length * this.colWidth) + 80;
            const neededHeight = this.paddingTop + (this.signals.length * this.rowHeight) + 30;
            this.dummy.style.width = Math.max(rect.width, neededWidth) + 'px';
            this.dummy.style.height = Math.max(rect.height, neededHeight) + 'px';
        }
        
        this.draw();
    }

    setSignals(signals) {
        this.signals = signals;
        this.resize();
    }

    updateHistory(history) {
        const wasNearEnd = this.viewport && (this.viewport.scrollLeft + this.viewport.clientWidth >= this.viewport.scrollWidth - 50);
        this.history = history;
        this.resize();
        
        if (this.viewport && (wasNearEnd || this.history.length <= 1)) {
            // Wait for DOM to adjust and scroll to end
            setTimeout(() => {
                this.viewport.scrollLeft = this.viewport.scrollWidth - this.viewport.clientWidth;
            }, 10);
        }
        
        this.draw();
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

        // 1. Draw Vertical Grid Lines
        this.drawVerticalGridLines(this.scrollOffset);

        // 2. Draw Signal Traces, Row Backgrounds & Signal Labels
        for (let i = 0; i < this.signals.length; i++) {
            const sig = this.signals[i];
            const isBus = (sig.width.high - sig.width.low) > 0;
            const baselineY = this.paddingTop + (i * this.rowHeight) + this.rowHeight - 10 - this.verticalScrollOffset;
            
            // Draw Signal Background Row Stripe (scrolls vertically)
            ctx.fillStyle = i % 2 === 0 ? 'rgba(9, 19, 13, 0.2)' : 'rgba(4, 9, 6, 0.1)';
            ctx.fillRect(0, (this.paddingTop + (i * this.rowHeight) - this.verticalScrollOffset) * this.pixelRatio, w, this.rowHeight * this.pixelRatio);

            // Draw wave traces (scrolls horizontally & vertically)
            this.drawSignalTrace(sig, isBus, baselineY, this.scrollOffset);

            // Draw Label Panel Background (scrolls vertically, but sticky horizontally)
            ctx.fillStyle = '#0d1d14';
            ctx.fillRect(0, (this.paddingTop + (i * this.rowHeight) - this.verticalScrollOffset) * this.pixelRatio, this.labelWidth * this.pixelRatio, this.rowHeight * this.pixelRatio);
            
            // Draw Label Panel Divider
            ctx.fillStyle = '#142a1b';
            ctx.fillRect((this.labelWidth - 1) * this.pixelRatio, (this.paddingTop + (i * this.rowHeight) - this.verticalScrollOffset) * this.pixelRatio, 1 * this.pixelRatio, this.rowHeight * this.pixelRatio);

            // Draw Signal Text Label
            ctx.font = `bold ${12 * this.pixelRatio}px 'Share Tech Mono', monospace`;
            ctx.fillStyle = sig.type === 'input' ? '#00e5ff' : '#39ff14';
            
            let labelName = sig.name;
            if (isBus) {
                labelName += `[${sig.width.high}:${sig.width.low}]`;
            }
            
            ctx.fillText(labelName, 15 * this.pixelRatio, (this.paddingTop + (i * this.rowHeight) + 25 - this.verticalScrollOffset) * this.pixelRatio);
            
            // Draw IO direction tag
            ctx.font = `${9 * this.pixelRatio}px 'Share Tech Mono', monospace`;
            ctx.fillStyle = '#4e6b56';
            ctx.fillText(sig.type.toUpperCase(), (this.labelWidth - 35) * this.pixelRatio, (this.paddingTop + (i * this.rowHeight) + 24 - this.verticalScrollOffset) * this.pixelRatio);
        }

        // 3. Draw sticky timeline header background over the scrolled signals
        ctx.fillStyle = '#060e09';
        ctx.fillRect(0, 0, w, this.paddingTop * this.pixelRatio);
        ctx.fillStyle = '#142a1b';
        ctx.fillRect(0, (this.paddingTop - 1) * this.pixelRatio, w, 1 * this.pixelRatio);

        // Draw header cycle numbers
        const startX = this.labelWidth;
        ctx.font = `${10 * this.pixelRatio}px 'Share Tech Mono', monospace`;
        ctx.fillStyle = '#ff9f00'; // Amber cycle counts

        for (let t = 0; t < this.history.length; t++) {
            const x = startX + (t * this.colWidth) - this.scrollOffset;
            if (x < startX - 10 || x > (w / this.pixelRatio) + 10) continue;
            ctx.fillText(`T${t}`, (x + 5) * this.pixelRatio, 24 * this.pixelRatio);
        }

        // Draw top-left corner brand block
        ctx.fillStyle = '#0d1d14';
        ctx.fillRect(0, 0, this.labelWidth * this.pixelRatio, this.paddingTop * this.pixelRatio);
        ctx.fillStyle = '#142a1b';
        ctx.fillRect((this.labelWidth - 1) * this.pixelRatio, 0, 1 * this.pixelRatio, this.paddingTop * this.pixelRatio);
        
        ctx.font = `bold ${10 * this.pixelRatio}px 'Orbitron', sans-serif`;
        ctx.fillStyle = '#ff9f00';
        ctx.fillText("SIGNAL NAME", 15 * this.pixelRatio, 24 * this.pixelRatio);

        // 4. Draw Hover scanning line & value bubble
        if (this.hoverIndex !== -1 && this.hoverIndex < this.history.length) {
            this.drawScanningCursor(this.scrollOffset);
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

    drawVerticalGridLines(scrollOffset) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.strokeStyle = '#0b160f';
        ctx.lineWidth = 1 * this.pixelRatio;

        const startX = this.labelWidth;
        for (let t = 0; t < this.history.length; t++) {
            const x = startX + (t * this.colWidth) - scrollOffset;
            if (x < startX - 10 || x > (w / this.pixelRatio) + 10) continue;

            ctx.beginPath();
            ctx.moveTo(x * this.pixelRatio, this.paddingTop * this.pixelRatio);
            ctx.lineTo(x * this.pixelRatio, h);
            ctx.stroke();
        }
    }

    drawSignalTrace(sig, isBus, baselineY, scrollOffset) {
        const ctx = this.ctx;
        const startX = this.labelWidth;
        const w = this.canvas.width;

        ctx.lineWidth = 2 * this.pixelRatio;

        if (isBus) {
            ctx.strokeStyle = '#00e5ff'; // Cyan logic bus
            ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';

            for (let t = 0; t < this.history.length; t++) {
                const x = startX + (t * this.colWidth) - scrollOffset;
                if (x < startX - 30 || x > (w / this.pixelRatio)) continue;

                const val = this.history[t].state[sig.name] || 0;
                
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

                ctx.font = `bold ${9 * this.pixelRatio}px 'Share Tech Mono', monospace`;
                ctx.fillStyle = '#e2f4e8';
                
                const hexVal = val.toString(16).toUpperCase();
                ctx.fillText(hexVal, (x + 6) * this.pixelRatio, (baselineY - 6) * this.pixelRatio);
            }
        } else {
            ctx.strokeStyle = sig.type === 'input' ? '#00e5ff' : '#39ff14'; // input: cyan, output: green
            ctx.shadowColor = sig.type === 'input' ? 'rgba(0, 229, 255, 0.3)' : 'rgba(57, 255, 20, 0.3)';
            ctx.shadowBlur = 4 * this.pixelRatio;

            ctx.beginPath();
            
            let lastX = startX - scrollOffset;
            let lastY = baselineY;
            let firstPoint = true;

            for (let t = 0; t < this.history.length; t++) {
                const x = startX + (t * this.colWidth) - scrollOffset;
                const val = this.history[t].state[sig.name] || 0;
                const nextY = val === 1 ? baselineY - 20 : baselineY;

                if (firstPoint) {
                    ctx.moveTo(lastX * this.pixelRatio, nextY * this.pixelRatio);
                    firstPoint = false;
                } else if (x >= startX) {
                    ctx.lineTo(x * this.pixelRatio, lastY * this.pixelRatio);
                    ctx.lineTo(x * this.pixelRatio, nextY * this.pixelRatio);
                }

                lastX = x;
                lastY = nextY;
            }
            
            if (this.history.length > 0) {
                ctx.lineTo((lastX + this.colWidth) * this.pixelRatio, lastY * this.pixelRatio);
                ctx.stroke();
            }

            ctx.shadowBlur = 0;
        }
    }

    drawScanningCursor(scrollOffset) {
        const ctx = this.ctx;
        const h = this.canvas.height;
        const startX = this.labelWidth;

        const x = startX + (this.hoverIndex * this.colWidth) - scrollOffset;

        ctx.strokeStyle = 'rgba(255, 159, 0, 0.5)';
        ctx.lineWidth = 1 * this.pixelRatio;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x * this.pixelRatio, this.paddingTop * this.pixelRatio);
        ctx.lineTo(x * this.pixelRatio, h);
        ctx.stroke();
        ctx.setLineDash([]);

        const tooltipW = 100;
        const tooltipH = 30;
        let tooltipX = x - (tooltipW / 2);
        
        if (tooltipX < this.labelWidth) tooltipX = this.labelWidth + 5;
        if (tooltipX + tooltipW > (this.canvas.width / this.pixelRatio)) tooltipX = (this.canvas.width / this.pixelRatio) - tooltipW - 5;

        ctx.fillStyle = '#ff9f00';
        ctx.fillRect(tooltipX * this.pixelRatio, 5 * this.pixelRatio, tooltipW * this.pixelRatio, tooltipH * this.pixelRatio);

        ctx.font = `bold ${10 * this.pixelRatio}px 'Orbitron', sans-serif`;
        ctx.fillStyle = '#000';
        ctx.fillText(`READOUT T${this.hoverIndex}`, (tooltipX + 10) * this.pixelRatio, 17 * this.pixelRatio);
        
        ctx.font = `${9 * this.pixelRatio}px 'Share Tech Mono', monospace`;
        ctx.fillText(`STIMULATING ACTIVE`, (tooltipX + 10) * this.pixelRatio, 27 * this.pixelRatio);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WaveformViewer;
} else {
    window.WaveformViewer = WaveformViewer;
}
