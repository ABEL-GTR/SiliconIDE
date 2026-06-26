/**
 * SiliconIDE - Logic Schematic Auto-Layout Renderer
 * Parses gate arrays and logic expressions to draw live, interactive schematics
 */

class SchematicViewer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.nodes = [];       // List of schematic nodes { id, type, label, x, y, inputs, outputs, level }
        this.wires = [];       // List of connections { fromNode, fromPin, toNode, toPin, signalName }
        this.currentState = {};
        this.pixelRatio = window.devicePixelRatio || 1;
        this.particleOffset = 0; // Animation frame timer
        
        this.setupAnimation();
        this.resize();
    }

    setupAnimation() {
        // Continuous animation loop for flowing trace particles
        const animate = () => {
            this.particleOffset += 0.4;
            if (this.particleOffset > 100) this.particleOffset = 0;
            this.draw();
            this.animFrame = requestAnimationFrame(animate);
        };
        this.animFrame = requestAnimationFrame(animate);
    }

    destroy() {
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
        }
    }

    resize() {
        const rect = this.canvas.parentNode.getBoundingClientRect();
        this.canvas.width = rect.width * this.pixelRatio;
        this.canvas.height = rect.height * this.pixelRatio;
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.draw();
    }

    /**
     * Build nodes and wires from parsed HDL data structures
     */
    buildSchematic(ports, registers, wires, assignments, sequentialBlock) {
        this.nodes = [];
        this.wires = [];
        
        // 1. Add Input Port Nodes
        const inputPorts = ports.filter(p => p.type === 'input');
        inputPorts.forEach((p, idx) => {
            this.nodes.push({
                id: `in_${p.name}`,
                type: 'input',
                label: p.name,
                signal: p.name,
                width: p.width,
                level: 0,
                x: 0, y: 0
            });
        });

        // 2. Add Sequential / Clock Block Nodes
        if (sequentialBlock) {
            this.nodes.push({
                id: 'seq_core',
                type: 'register',
                label: 'D-REG / SEQ',
                level: 2,
                x: 0, y: 0
            });
            
            // Connect clock and rst input nodes to register core
            if (sequentialBlock.clk) {
                this.wires.push({
                    fromNode: `in_${sequentialBlock.clk}`,
                    signalName: sequentialBlock.clk,
                    toNode: 'seq_core',
                    toPin: 'CLK'
                });
            }
            if (sequentialBlock.rst) {
                this.wires.push({
                    fromNode: `in_${sequentialBlock.rst}`,
                    signalName: sequentialBlock.rst,
                    toNode: 'seq_core',
                    toPin: 'RST'
                });
            }
        }

        // 3. Add Logic Gate Nodes from assignments & primitives
        assignments.forEach((ass, idx) => {
            const gateId = `gate_${ass.target}_${idx}`;
            
            // Determine gate label
            let gateType = 'gate';
            let label = '&'; // default AND
            if (ass.exprStr.includes('^')) { label = '=1'; gateType = 'xor'; }
            else if (ass.exprStr.includes('|')) { label = '>=1'; gateType = 'or'; }
            else if (ass.exprStr.includes('~')) { label = '1'; gateType = 'not'; }
            else if (ass.exprStr.includes('&')) { label = '&'; gateType = 'and'; }
            
            if (ass.exprStr.startsWith('and(')) { label = '&'; gateType = 'and'; }
            if (ass.exprStr.startsWith('or(')) { label = '>=1'; gateType = 'or'; }
            if (ass.exprStr.startsWith('xor(')) { label = '=1'; gateType = 'xor'; }
            if (ass.exprStr.startsWith('not(')) { label = '1'; gateType = 'not'; }

            this.nodes.push({
                id: gateId,
                type: gateType,
                label: label,
                targetSignal: ass.target,
                level: 1, // Will compute levels later
                x: 0, y: 0
            });

            // Connect inputs of assignments to the gate
            ass.variables.forEach(v => {
                // If the source is an input node, connect directly
                const hasInputNode = this.nodes.some(n => n.id === `in_${v}`);
                this.wires.push({
                    fromNode: hasInputNode ? `in_${v}` : null, // Will resolve if from intermediate gate
                    signalName: v,
                    toNode: gateId,
                    toPin: 'IN'
                });
            });
        });

        // 4. Add Output Port Nodes
        const outputPorts = ports.filter(p => p.type === 'output');
        outputPorts.forEach((p, idx) => {
            const outId = `out_${p.name}`;
            this.nodes.push({
                id: outId,
                type: 'output',
                label: p.name,
                signal: p.name,
                width: p.width,
                level: 3,
                x: 0, y: 0
            });

            // Connect whatever signal drives this output
            this.wires.push({
                fromNode: null, // Will resolve
                signalName: p.name,
                toNode: outId,
                toPin: 'OUT'
            });
        });

        // 5. Resolve wire source nodes
        this.wires.forEach(wire => {
            if (!wire.fromNode) {
                // Find node that drives this signal
                // Check if it's a register
                if (registers.some(r => r.name === wire.signalName)) {
                    wire.fromNode = 'seq_core';
                } else {
                    // Check if it's a gate output
                    const gateDriver = this.nodes.find(n => n.targetSignal === wire.signalName);
                    if (gateDriver) {
                        wire.fromNode = gateDriver.id;
                    } else {
                        // Check if it's an input port
                        const inPort = this.nodes.find(n => n.type === 'input' && n.label === wire.signalName);
                        if (inPort) wire.fromNode = inPort.id;
                    }
                }
            }
        });

        // Remove unconnected or unresolved wires
        this.wires = this.wires.filter(w => w.fromNode !== null);

        // 6. Compute Node Levels (Topological layout depths)
        this.resolveNodeLevels();

        // 7. Calculate visual layouts coordinates (X, Y)
        this.computeCoordinates();
        
        this.draw();
    }

    resolveNodeLevels() {
        // Simple iteration to push nodes downstream from their sources
        let changed = true;
        let iter = 0;
        
        while (changed && iter < 10) {
            changed = false;
            iter++;
            
            this.wires.forEach(w => {
                const from = this.nodes.find(n => n.id === w.fromNode);
                const to = this.nodes.find(n => n.id === w.toNode);
                
                if (from && to) {
                    // If target is an output port, keep it at level 3 or push it right
                    if (to.type === 'output') {
                        const minL = Math.max(to.level, from.level + 1);
                        if (to.level !== minL) {
                            to.level = minL;
                            changed = true;
                        }
                    } else if (to.type !== 'input') {
                        // Intermediate gate level must be strictly greater than driver level
                        if (to.level <= from.level) {
                            to.level = from.level + 1;
                            changed = true;
                        }
                    }
                }
            });
        }
    }

    computeCoordinates() {
        if (!this.canvas) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Find max level
        const maxLevel = Math.max(...this.nodes.map(n => n.level), 3);
        const colWidth = w / (maxLevel + 1);

        // Group nodes by level
        for (let lvl = 0; lvl <= maxLevel; lvl++) {
            const lvlNodes = this.nodes.filter(n => n.level === lvl);
            const count = lvlNodes.length;
            const rowHeight = h / (count + 1);
            
            lvlNodes.forEach((node, idx) => {
                node.x = colWidth * (lvl + 0.5);
                node.y = rowHeight * (idx + 1);
            });
        }
    }

    updateState(state) {
        this.currentState = state;
        this.draw();
    }

    draw() {
        if (!this.canvas || !this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#020503';
        ctx.fillRect(0, 0, w, h);

        // Draw background grid lines (PCB theme)
        ctx.strokeStyle = '#051009';
        ctx.lineWidth = 1 * this.pixelRatio;
        for (let x = 0; x < w; x += 30 * this.pixelRatio) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += 30 * this.pixelRatio) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        if (this.nodes.length === 0) {
            ctx.fillStyle = '#4e6b56';
            ctx.font = `${14 * this.pixelRatio}px 'Share Tech Mono', monospace`;
            ctx.textAlign = 'center';
            ctx.fillText("COMPILED LOGIC CIRCUIT SCHEMATIC", w / 2, h / 2);
            ctx.textAlign = 'left';
            return;
        }

        // 1. Draw Wires (Traces)
        this.wires.forEach(wire => {
            const from = this.nodes.find(n => n.id === w.fromNode);
            const to = this.nodes.find(n => n.id === w.toNode);
            if (!from || !to) return;

            const val = this.currentState[wire.signalName] || 0;
            const isActive = val === 1;

            // Highlight color based on state
            ctx.strokeStyle = isActive ? '#39ff14' : '#1b3823'; // Neon green when high, dull green-gray when low
            ctx.shadowColor = isActive ? 'rgba(57, 255, 20, 0.4)' : 'transparent';
            ctx.shadowBlur = isActive ? 5 * this.pixelRatio : 0;
            ctx.lineWidth = isActive ? 2 * this.pixelRatio : 1.5 * this.pixelRatio;

            // Draw orthogonal trace (PCB style 90-degree elbows)
            ctx.beginPath();
            ctx.moveTo(from.x * this.pixelRatio, from.y * this.pixelRatio);
            
            const midX = (from.x + to.x) / 2;
            ctx.lineTo(midX * this.pixelRatio, from.y * this.pixelRatio);
            ctx.lineTo(midX * this.pixelRatio, to.y * this.pixelRatio);
            ctx.lineTo(to.x * this.pixelRatio, to.y * this.pixelRatio);
            ctx.stroke();

            // Clear shadow
            ctx.shadowBlur = 0;

            // Draw animated flowing signal particles if active
            if (isActive) {
                ctx.fillStyle = '#ffffff';
                const totalLen = (midX - from.x) + Math.abs(to.y - from.y) + (to.x - midX);
                const percent = (this.particleOffset % 100) / 100;
                const distance = totalLen * percent;

                let px = from.x;
                let py = from.y;

                if (distance < (midX - from.x)) {
                    px = from.x + distance;
                } else if (distance < (midX - from.x) + Math.abs(to.y - from.y)) {
                    px = midX;
                    const diffY = to.y - from.y;
                    const remD = distance - (midX - from.x);
                    py = from.y + (diffY > 0 ? remD : -remD);
                } else {
                    py = to.y;
                    const remD = distance - (midX - from.x) - Math.abs(to.y - from.y);
                    px = midX + remD;
                }

                ctx.beginPath();
                ctx.arc(px * this.pixelRatio, py * this.pixelRatio, 3 * this.pixelRatio, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // 2. Draw Nodes (Logic Gates and pin pads)
        this.nodes.forEach(node => {
            const nx = node.x * this.pixelRatio;
            const ny = node.y * this.pixelRatio;

            ctx.shadowBlur = 0;

            if (node.type === 'input') {
                // Input Ports are drawn as golden octagonal pads
                ctx.fillStyle = '#060e0a';
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 2 * this.pixelRatio;
                ctx.beginPath();
                ctx.arc(nx, ny, 6 * this.pixelRatio, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();

                ctx.font = `bold ${10 * this.pixelRatio}px 'Share Tech Mono', monospace`;
                ctx.fillStyle = '#00e5ff';
                ctx.fillText(node.label, nx - 20 * this.pixelRatio, ny - 10 * this.pixelRatio);
            } 
            else if (node.type === 'output') {
                // Output Ports
                ctx.fillStyle = '#060e0a';
                ctx.strokeStyle = '#39ff14';
                ctx.lineWidth = 2 * this.pixelRatio;
                ctx.beginPath();
                ctx.arc(nx, ny, 6 * this.pixelRatio, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();

                ctx.font = `bold ${10 * this.pixelRatio}px 'Share Tech Mono', monospace`;
                ctx.fillStyle = '#39ff14';
                ctx.fillText(node.label, nx + 12 * this.pixelRatio, ny + 3 * this.pixelRatio);
            }
            else if (node.type === 'register') {
                // Large Register block
                const boxW = 80 * this.pixelRatio;
                const boxH = 60 * this.pixelRatio;
                ctx.fillStyle = '#0a1d13';
                ctx.strokeStyle = '#ff9f00';
                ctx.lineWidth = 2 * this.pixelRatio;
                ctx.fillRect(nx - boxW/2, ny - boxH/2, boxW, boxH);
                ctx.strokeRect(nx - boxW/2, ny - boxH/2, boxW, boxH);

                ctx.font = `bold ${11 * this.pixelRatio}px 'Orbitron', sans-serif`;
                ctx.fillStyle = '#ff9f00';
                ctx.textAlign = 'center';
                ctx.fillText(node.label, nx, ny - 5 * this.pixelRatio);

                ctx.font = `${8 * this.pixelRatio}px 'Share Tech Mono', monospace`;
                ctx.fillStyle = '#4e6b56';
                ctx.fillText("REGISTERS", nx, ny + 12 * this.pixelRatio);
                ctx.textAlign = 'left';
            }
            else {
                // Logic Gates (drawn as standard ANSI circuit blocks)
                const radius = 18 * this.pixelRatio;
                ctx.fillStyle = '#09130d';
                ctx.strokeStyle = '#142a1b';
                ctx.lineWidth = 2 * this.pixelRatio;

                ctx.beginPath();
                ctx.arc(nx, ny, radius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();

                // Draw Gate Symbol text inside
                ctx.font = `bold ${14 * this.pixelRatio}px 'Share Tech Mono', monospace`;
                ctx.fillStyle = '#a1bca8';
                ctx.textAlign = 'center';
                ctx.fillText(node.label, nx, ny + 5 * this.pixelRatio);
                ctx.textAlign = 'left';
            }
        });
    }
}

// Export global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SchematicViewer;
} else {
    window.SchematicViewer = SchematicViewer;
}
