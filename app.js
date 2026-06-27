/**
 * SiliconIDE - UI and State Controller
 * Manages templates, simulation tick runs, synth mockups, audio feedback, and HUD updates.
 */

// 1. Core Logic Templates
const HDL_TEMPLATES = {
    verilog: {
        and_gate: `// Combinational Logic: Simple Logic Gates
module logic_gates(
    input a,
    input b,
    output z_and,
    output z_or,
    output z_xor
);
    // Continuous assignments for gates
    assign z_and = a & b;
    assign z_or = a | b;
    assign z_xor = a ^ b;
endmodule`,

        full_adder: `// Arithmetic Logic: 1-bit Full Adder
module full_adder(
    input a,
    input b,
    input cin,
    output sum,
    output cout
);
    // Boolean equations for addition
    assign sum = a ^ b ^ cin;
    assign cout = (a & b) | (b & cin) | (a & cin);
endmodule`,

        mux_2to1: `// Data Path Logic: 2-to-1 Multiplexer
module mux_2to1(
    input a,
    input b,
    input sel,
    output out
);
    // When sel is 1, out = b. When sel is 0, out = a.
    assign out = (sel & b) | (~sel & a);
endmodule`,

        d_flipflop: `// Sequential Logic: D Flip-Flop
module d_flipflop(
    input clk,
    input rst,
    input d,
    output reg q
);
    // Sequential block triggered on clock positive edge
    always @(posedge clk) begin
        if (rst)
            q <= 0; // Synchronous Reset
        else
            q <= d;   // Load input D
    end
endmodule`,

        binary_counter: `// Sequential Logic: 4-Bit Binary Up-Counter
module binary_counter(
    input clk,
    input rst,
    output reg [3:0] count
);
    // Increments count on each clock cycle
    always @(posedge clk) begin
        if (rst)
            count <= 0;
        else
            count <= count + 1;
    end
endmodule`,

        shift_register: `// Sequential Logic: 4-Bit Shift Register
module shift_register(
    input clk,
    input rst,
    input sin,
    output reg [3:0] q
);
    // Shift logic
    always @(posedge clk) begin
        if (rst)
            q <= 0;
        else
            q <= {q[2:0], sin};
    end
endmodule`
    },
    vhdl: {
        and_gate: `-- Combinational Logic: VHDL Gates
library ieee;
use ieee.std_logic_1164.all;

entity logic_gates is
    port (
        a     : in  std_logic;
        b     : in  std_logic;
        z_and : out std_logic;
        z_or  : out std_logic
    );
end entity logic_gates;

architecture behavioral of logic_gates is
begin
    z_and <= a and b;
    z_or  <= a or b;
end architecture behavioral;`,

        full_adder: `-- Arithmetic Logic: VHDL Full Adder
library ieee;
use ieee.std_logic_1164.all;

entity full_adder is
    port (
        a    : in  std_logic;
        b    : in  std_logic;
        cin  : in  std_logic;
        sum  : out std_logic;
        cout : out std_logic
    );
end entity full_adder;

architecture behavioral of full_adder is
begin
    sum  <= a xor b xor cin;
    cout <= (a and b) or (b and cin) or (a and cin);
end architecture behavioral;`,

        mux_2to1: `-- VHDL 2-to-1 Multiplexer
library ieee;
use ieee.std_logic_1164.all;

entity mux_2to1 is
    port (
        a   : in  std_logic;
        b   : in  std_logic;
        sel : in  std_logic;
        q   : out std_logic
    );
end entity mux_2to1;

architecture behavioral of mux_2to1 is
begin
    q <= b when sel = '1' else a;
end architecture behavioral;`,

        d_flipflop: `-- Sequential Logic: VHDL D Flip-Flop
library ieee;
use ieee.std_logic_1164.all;

entity d_flipflop is
    port (
        clk : in  std_logic;
        rst : in  std_logic;
        d   : in  std_logic;
        q   : out std_logic
    );
end entity d_flipflop;

architecture behavioral of d_flipflop is
begin
    process(clk)
    begin
        if rising_edge(clk) then
            if rst = '1' then
                q <= '0';
            else
                q <= d;
            end if;
        end if;
    end process;
end architecture behavioral;`,

        binary_counter: `-- VHDL 4-Bit Binary Counter
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity binary_counter is
    port (
        clk   : in  std_logic;
        rst   : in  std_logic;
        count : out std_logic_vector(3 downto 0)
    );
end entity binary_counter;

architecture behavioral of binary_counter is
    signal r_count : unsigned(3 downto 0) := "0000";
begin
    process(clk)
    begin
        if rising_edge(clk) then
            if rst = '1' then
                r_count <= (others => '0');
            else
                r_count <= r_count + 1;
            end if;
        end if;
    end process;
    count <= std_logic_vector(r_count);
end architecture behavioral;`,

        shift_register: `-- VHDL 4-Bit Shift Register
library ieee;
use ieee.std_logic_1164.all;

entity shift_register is
    port (
        clk : in  std_logic;
        rst : in  std_logic;
        sin : in  std_logic;
        q   : out std_logic_vector(3 downto 0)
    );
end entity shift_register;

architecture behavioral of shift_register is
    signal r_reg : std_logic_vector(3 downto 0) := "0000";
begin
    process(clk)
    begin
        if rising_edge(clk) then
            if rst = '1' then
                r_reg <= "0000";
            else
                r_reg <= r_reg(2 downto 0) & sin;
            end if;
        end if;
    end process;
    q <= r_reg;
end architecture behavioral;`
    }
};

// SystemVerilog templates fall back to Verilog
HDL_TEMPLATES.sysverilog = { ...HDL_TEMPLATES.verilog };

// State Management
let currentLanguage = 'verilog';
let currentTemplate = 'and_gate';
let parser = null;
let waveViewer = null;
let schematicViewer = null;

// Supabase and Gemini AI Global State
let supabaseClient = null;
let currentUser = null;
let isGeminiSubscribed = false;

if (window.SUPABASE_CONFIG && window.supabase) {
    supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
}

// Simulation State variables
let simState = {};
let simHistory = [];
let simInterval = null;
let isSimRunning = false;
let clockCycle = 0;
let clkPulseHigh = false; // Tracks clock pulse status for auto-run toggle
let simLogElement = null;

// Audio Configuration
let isAudioOn = true;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playBeep(type) {
    if (!isAudioOn) return;
    initAudio();
    if (!audioCtx) return;

    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'click') {
            // Mechanical short high-pitch tick
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'error') {
            // Low alarm buzz
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'success') {
            // High upward chime sweep
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'clock') {
            // Soft clock boundary pulse click
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            gain.gain.setValueAtTime(0.02, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
            osc.start(now);
            osc.stop(now + 0.03);
        }
    } catch (e) {
        console.warn("Audio play blocked: need user gesture", e);
    }
}

// 2. Application Boot Setup
document.addEventListener("DOMContentLoaded", () => {
    // Initialize processors
    parser = new HDLParser();
    waveViewer = new WaveformViewer('waveform-canvas');
    schematicViewer = new SchematicViewer('schematic-canvas');
    simLogElement = document.getElementById('sim-log-output');

    lucide.createIcons();



    // Sync Textarea scroll with line numbers
    const codeArea = document.getElementById('code-input');
    const lineNums = document.getElementById('editor-line-numbers');
    codeArea.addEventListener('scroll', () => {
        lineNums.scrollTop = codeArea.scrollTop;
    });

    codeArea.addEventListener('input', () => {
        updateLineNumbers();
    });

    // Wire HUD Navigation
    document.getElementById('hud-home-btn').addEventListener('click', () => {
        playBeep('click');
        switchScreen('boot-screen');
    });

    document.getElementById('reboot-system-btn').addEventListener('click', () => {
        playBeep('error');
        if (confirm("Perform Hardware System Reboot? (All editor code and simulation timeline will be cleared)")) {
            // Clear editor code
            const codeInput = document.getElementById('code-input');
            codeInput.value = "";
            
            // Clear compiler/linter state in parser
            parser.resetState();
            
            // Re-run compilation to update diagnostics, simulator ports, stimulus panel, etc.
            runHDLCompilation();
            
            // Update line numbers and overlay scroll
            updateLineNumbers();
            
            // Focus code input and set cursor position to the very beginning (line 1)
            codeInput.focus();
            codeInput.setSelectionRange(0, 0);
        }
    });

    // Wire Card Selectors
    const cards = document.querySelectorAll('.selector-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            playBeep('click');
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentLanguage = card.dataset.hdl;
            loadActiveTemplate();
        });
    });

    // Wire Template Chips
    const chips = document.querySelectorAll('.template-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            playBeep('click');
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentTemplate = chip.dataset.template;
            loadActiveTemplate();
        });
    });

    // Boot Command Trigger
    document.getElementById('initialize-core-btn').addEventListener('click', () => {
        playBeep('success');
        
        // Show simulated booting diagnostics
        const terminal = document.querySelector('.diagnostic-terminal');
        terminal.innerHTML = "";
        
        const lines = [
            `> LOADING CORRESPONDING ARCHITECTURE STACKS...`,
            `> COMPILING INTEGRATED GATE LIBRARIES...`,
            `> CHIP INITIALIZATION COMPLETING IN T-MINUS 1S...`,
            `> STACK LOADED. LAUNCHING WORKSPACE CORE CONSOLE...`
        ];

        let index = 0;
        const interval = setInterval(() => {
            if (index < lines.length) {
                const p = document.createElement('div');
                p.className = 'term-line glow-green';
                p.innerText = lines[index++];
                terminal.appendChild(p);
            } else {
                clearInterval(interval);
                switchScreen('workspace-screen');
                // Run initial compile
                runHDLCompilation();
            }
        }, 300);
    });

    // Compiler Action
    document.getElementById('editor-compile-btn').addEventListener('click', () => {
        playBeep('click');
        runHDLCompilation();
    });

    // Diagnostics Tabs Toggles
    document.getElementById('tab-errors').addEventListener('click', () => {
        playBeep('click');
        toggleDiagTab('errors');
    });
    document.getElementById('tab-autocorrect').addEventListener('click', () => {
        playBeep('click');
        toggleDiagTab('autocorrect');
    });

    // Apply auto-correct patch
    document.getElementById('apply-patch-btn').addEventListener('click', () => {
        playBeep('success');
        applyDiagnosticsPatch();
    });

    // Synthesizer Quick prompts
    const quickChips = document.querySelectorAll('.quick-chip');
    quickChips.forEach(chip => {
        chip.addEventListener('click', () => {
            playBeep('click');
            document.getElementById('synth-prompt').value = chip.dataset.prompt;
        });
    });

    // Neural synthesis trigger
    document.getElementById('generate-code-btn').addEventListener('click', () => {
        playBeep('click');
        triggerNeuralSynthesis();
    });

    // Inject generated code
    document.getElementById('inject-editor-btn').addEventListener('click', () => {
        playBeep('success');
        injectSynthesizedCode();
    });

    // Copy to clipboard
    document.getElementById('editor-copy-btn').addEventListener('click', () => {
        playBeep('click');
        navigator.clipboard.writeText(codeArea.value);
        showTemporaryBadge('COPIED!');
    });

    // Download File
    document.getElementById('editor-download-btn').addEventListener('click', () => {
        playBeep('success');
        const code = document.getElementById('code-input').value;
        const filename = document.getElementById('current-filename').innerText;
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Simulation Controls
    document.getElementById('sim-run-btn').addEventListener('click', () => {
        playBeep('click');
        toggleSimulationRun();
    });

    document.getElementById('sim-step-btn').addEventListener('click', () => {
        playBeep('click');
        stepClockPulseManual();
    });

    document.getElementById('sim-reset-btn').addEventListener('click', () => {
        playBeep('click');
        resetSimulationEngine();
    });

    // Sim display tabs
    document.getElementById('sim-tab-wave').addEventListener('click', () => {
        playBeep('click');
        toggleSimScreen('wave');
    });
    document.getElementById('sim-tab-schematic').addEventListener('click', () => {
        playBeep('click');
        toggleSimScreen('schematic');
    });
    document.getElementById('sim-tab-console').addEventListener('click', () => {
        playBeep('click');
        toggleSimScreen('console');
    });

    // Audio HUD toggler
    document.getElementById('audio-toggle-btn').addEventListener('click', () => {
        isAudioOn = !isAudioOn;
        const btn = document.getElementById('audio-toggle-btn');
        if (isAudioOn) {
            btn.innerHTML = `<i data-lucide="volume-2"></i> SOUND ON`;
            btn.classList.remove('highlight');
        } else {
            btn.innerHTML = `<i data-lucide="volume-x"></i> SOUND OFF`;
            btn.classList.add('highlight');
        }
        lucide.createIcons();
    });

    // Scanline Filter HUD Toggler
    document.getElementById('scanline-toggle-btn').addEventListener('click', () => {
        playBeep('click');
        document.body.classList.toggle('scanlines');
    });

    // Trigger load templates
    loadActiveTemplate();

    // Initialize Supabase Auth & Configuration
    initAuth();
});

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    if (screenId === 'workspace-screen') {
        setTimeout(() => {
            waveViewer.resize();
            schematicViewer.resize();
        }, 100);
    }
}

function updateHudClock() {
    const el = document.getElementById('hud-clock');
    if (!el) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    el.innerText = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}:${pad(Math.floor(now.getMilliseconds() / 10))}`;
}

function updateLineNumbers() {
    const codeArea = document.getElementById('code-input');
    const lineNums = document.getElementById('editor-line-numbers');
    const linesCount = codeArea.value.split('\n').length;
    
    let html = "";
    for (let i = 1; i <= linesCount; i++) {
        html += `<div>${i}</div>`;
    }
    lineNums.innerHTML = html;
}

function loadActiveTemplate() {
    const codeArea = document.getElementById('code-input');
    const template = HDL_TEMPLATES[currentLanguage]?.[currentTemplate] || "";
    codeArea.value = template;
    
    document.getElementById('current-filename').innerText = currentLanguage === 'vhdl' ? 'main.vhd' : 'main.v';
    document.getElementById('current-hdl-label').innerText = currentLanguage.toUpperCase();
    
    updateLineNumbers();
}

// 3. HDL Compiler Dispatcher
function runHDLCompilation() {
    const code = document.getElementById('code-input').value;
    const report = parser.analyze(code, currentLanguage);

    const badge = document.getElementById('compilation-status-badge');
    const summaryBadge = document.getElementById('diagnostic-summary-badge');
    const timestampEl = document.getElementById('diagnostic-timestamp');

    // Update timestamp
    const now = new Date();
    timestampEl.innerText = `INTEGRITY CORE OK // CHECKED AT: ${now.toLocaleTimeString()}`;

    if (report.hasErrors) {
        playBeep('error');
        // Compiler status lights
        badge.innerHTML = `<span class="led red"></span> LINT FAILED`;
        summaryBadge.className = 'status-indicator red';
        summaryBadge.innerText = 'SYNTAX DEFECTS DETECTED';
        
        // Show error list
        populateDiagnosticsList(report.errors);
        
        // Setup patch diff
        setupProposedPatch(code, report.correctedCode);
        
        // Go to errors tab
        toggleDiagTab('errors');
    } else {
        playBeep('success');
        badge.innerHTML = `<span class="led green"></span> COMPILED`;
        summaryBadge.className = 'status-indicator green';
        summaryBadge.innerText = 'MODULE STABLE';

        populateDiagnosticsList([]); // success screen
        setupProposedPatch(code, code);

        // Feed compilation core to simulation visualizers if Verilog, SystemVerilog, or VHDL
        if (currentLanguage === 'verilog' || currentLanguage === 'sysverilog' || currentLanguage === 'vhdl') {
            setupSimulationFromCompilation(report);
        }
    }
}

function toggleDiagTab(tab) {
    document.querySelectorAll('.diag-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    if (tab === 'errors') {
        document.getElementById('tab-errors').classList.add('active');
        document.getElementById('content-errors').classList.add('active');
    } else {
        document.getElementById('tab-autocorrect').classList.add('active');
        document.getElementById('content-autocorrect').classList.add('active');
    }
}

function populateDiagnosticsList(errors) {
    const container = document.getElementById('diagnostic-list-container');
    container.innerHTML = "";

    if (errors.length === 0) {
        container.innerHTML = `
            <div class="diagnostic-empty">
                <i data-lucide="check-circle" class="glow-green-icon"></i>
                <h3>SYSTEM INTEGRITY STABLE</h3>
                <p>Compile syntax analysis has executed cleanly. There are no identified compilation warnings or structural hazards.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    errors.forEach(e => {
        const item = document.createElement('div');
        item.className = `diag-item ${e.severity}`;
        
        item.innerHTML = `
            <div class="diag-meta">
                <span class="severity">${e.severity.toUpperCase()}</span>
                <span class="line">LINE ${e.line}</span>
            </div>
            <div class="diag-msg">${e.message}</div>
            <div class="diag-suggest"><i data-lucide="info" style="height:12px; width:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Suggestion: ${e.suggestion}</div>
        `;
        container.appendChild(item);
    });
}

function setupProposedPatch(originalCode, correctedCode) {
    const diffBody = document.getElementById('diff-view-area');
    const patchBtn = document.getElementById('apply-patch-btn');

    if (originalCode === correctedCode) {
        diffBody.innerHTML = `<div class="diff-placeholder">Compiled logic matches compliance standards. No patches recommended.</div>`;
        patchBtn.disabled = true;
        return;
    }

    // Line-by-line diff
    const origLines = originalCode.split('\n');
    const corrLines = correctedCode.split('\n');
    let diffHtml = "";

    const maxLines = Math.max(origLines.length, corrLines.length);
    for (let i = 0; i < maxLines; i++) {
        const origL = origLines[i] !== undefined ? origLines[i] : "";
        const corrL = corrLines[i] !== undefined ? corrLines[i] : "";

        if (origL !== corrL) {
            if (origL !== "") {
                diffHtml += `<div class="diff-line removed">- L${i+1}: ${escapeHtml(origL)}</div>`;
            }
            if (corrL !== "") {
                diffHtml += `<div class="diff-line added">+ L${i+1}: ${escapeHtml(corrL)}</div>`;
            }
        } else {
            diffHtml += `<div class="diff-line">  L${i+1}: ${escapeHtml(origL)}</div>`;
        }
    }

    diffBody.innerHTML = diffHtml;
    patchBtn.disabled = false;
}

function applyDiagnosticsPatch() {
    const codeArea = document.getElementById('code-input');
    codeArea.value = parser.correctedCode;
    updateLineNumbers();
    runHDLCompilation();
}

function showTemporaryBadge(text) {
    const btn = document.getElementById('editor-copy-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span style="font-family:'Share Tech Mono'; font-size:10px; color:#39ff14;">${text}</span>`;
    setTimeout(() => {
        btn.innerHTML = originalText;
    }, 1500);
}

// 4. Neural synthesis Engine Mockup
function triggerNeuralSynthesis() {
    const prompt = document.getElementById('synth-prompt').value.trim();
    if (prompt === "") {
        alert("Please describe a logic module structure to synthesize.");
        return;
    }

    const consoleLog = document.getElementById('synth-terminal-log');
    consoleLog.innerHTML = "";

    // Check if user entered a Gemini API Key
    const apiKey = document.getElementById('gemini-api-key').value.trim() || localStorage.getItem('gemini_api_key') || "";

    if (apiKey === "") {
        // Run simulated local model
        const logLines = [
            `[i] CONNECTING TO LOCAL SANDBOX MATRIX CORE...`,
            `[!] WARNING: No Gemini API Key. Running local simulation rules.`,
            `[i] GENERATING INTERMEDIATE ABSTRACT LOGIC NODES...`,
            `[i] CONSTRUCTING REGISTER TRANSFER LEVEL (RTL) BLOCKS...`,
            `[i] RESOLVING PORT ASSIGNMENTS & SIGNAL SCHEMAS...`,
            `[o] SYNTHESIS COMPLETE. STREAMING LOGIC TEMPLATE...`
        ];

        let lineIndex = 0;
        const interval = setInterval(() => {
            if (lineIndex < logLines.length) {
                const l = document.createElement('div');
                l.className = 'term-line glow-green';
                l.innerText = logLines[lineIndex++];
                consoleLog.appendChild(l);
                consoleLog.scrollTop = consoleLog.scrollHeight;
            } else {
                clearInterval(interval);
                // Stream the actual code inside target
                streamSynthesizedCode(prompt);
            }
        }, 250);
    } else {
        // Run actual Google Gemini call!
        const l1 = document.createElement('div');
        l1.className = 'term-line glow-green';
        l1.innerText = `[i] ESTABLISHING GOOGLE GEMINI AI DIALOG LINK...`;
        consoleLog.appendChild(l1);
        
        const l2 = document.createElement('div');
        l2.className = 'term-line glow-green';
        l2.innerText = `[i] RUNNING REMOTE SYNTHESIS ENGINE AT CLOUD CLUSTERS...`;
        consoleLog.appendChild(l2);
        consoleLog.scrollTop = consoleLog.scrollHeight;

        runActualGeminiAISynthesis(prompt, apiKey, consoleLog);
    }
}

function streamSynthesizedCode(prompt) {
    let generatedVerilog = "";

    // Keywords logic to synthesize custom code blocks
    const lower = prompt.toLowerCase();
    if (lower.includes('alu') || lower.includes('arithmetic')) {
        generatedVerilog = `// Synthesized 4-Bit ALU Module
module alu_4bit(
    input [3:0] a,
    input [3:0] b,
    input [1:0] op,     // 00: ADD, 01: SUB, 10: AND, 11: OR
    output reg [3:0] out,
    output reg carry
);
    // Combinational multiplexed block
    always @(*) begin
        carry = 0;
        case(op)
            2'b00: {carry, out} = a + b; // ADD
            2'b01: out = a - b;          // SUB
            2'b10: out = a & b;          // AND
            2'b11: out = a | b;          // OR
            default: out = 4'b0000;
        endcase
    end
endmodule`;
    } else if (lower.includes('decoder') || lower.includes('segment')) {
        generatedVerilog = `// Synthesized BCD to 7-Segment Decoder
module bcd_to_7seg(
    input [3:0] bcd,
    output reg [6:0] seg // a, b, c, d, e, f, g
);
    // Active low output segment display
    always @(*) begin
        case(bcd)
            4'b0000: seg = 7'b1000000; // 0
            4'b0001: seg = 7'b1111001; // 1
            4'b0010: seg = 7'b0100100; // 2
            4'b0011: seg = 7'b0110000; // 3
            4'b0100: seg = 7'b0011001; // 4
            4'b0101: seg = 7'b0010010; // 5
            4'b0116: seg = 7'b0000010; // 6
            4'b0111: seg = 7'b1111000; // 7
            4'b1000: seg = 7'b0000000; // 8
            4'b1001: seg = 7'b0010000; // 9
            default: seg = 7'b1111111; // Off
        endcase
    end
endmodule`;
    } else if (lower.includes('traffic') || lower.includes('fsm') || lower.includes('state')) {
        generatedVerilog = `// Synthesized Traffic Light Finite State Machine
module traffic_light(
    input clk,
    input rst,
    output reg red,
    output reg yellow,
    output reg green
);
    // State coding parameters
    parameter S_RED    = 2'b00;
    parameter S_GREEN  = 2'b01;
    parameter S_YELLOW = 2'b10;

    reg [1:0] state;

    always @(posedge clk) begin
        if (rst) begin
            state <= S_RED;
        end else begin
            case(state)
                S_RED:    state <= S_GREEN;
                S_GREEN:  state <= S_YELLOW;
                S_YELLOW: state <= S_RED;
                default:  state <= S_RED;
            endcase
        end
    end

    // Output assignment logic
    always @(*) begin
        red = (state == S_RED);
        green = (state == S_GREEN);
        yellow = (state == S_YELLOW);
    end
endmodule`;
    } else {
        // Default generic module: shift register / multiplier
        generatedVerilog = `// Synthesized 4-bit Logic Multiplier
module logic_multiplier(
    input [1:0] a,
    input [1:0] b,
    output [3:0] product
);
    // Logic expansion for parallel multiplication
    assign product[0] = a[0] & b[0];
    assign product[1] = (a[1] & b[0]) ^ (a[0] & b[1]);
    assign product[2] = (a[1] & b[1]) ^ ((a[1] & b[0]) & (a[0] & b[1]));
    assign product[3] = (a[1] & b[1]) & ((a[1] & b[0]) & (a[0] & b[1]));
endmodule`;
    }

    const boxContainer = document.getElementById('synth-result-box');
    const codeBox = document.getElementById('synthesized-code-box');

    boxContainer.style.display = "flex";
    codeBox.innerText = "";

    // Typewriter effect streaming
    let i = 0;
    const timer = setInterval(() => {
        if (i < generatedVerilog.length) {
            codeBox.innerText += generatedVerilog.charAt(i++);
            boxContainer.scrollTop = boxContainer.scrollHeight;
        } else {
            clearInterval(timer);
        }
    }, 3);
}

function injectSynthesizedCode() {
    const codeBox = document.getElementById('synthesized-code-box');
    const codeArea = document.getElementById('code-input');
    
    codeArea.value = codeBox.innerText;
    updateLineNumbers();
    
    // Hide box
    document.getElementById('synth-result-box').style.display = "none";
    document.getElementById('synth-terminal-log').innerHTML = `<div class="term-line opacity-50">Awaiting prompt parameters...</div>`;
    
    runHDLCompilation();
}

// 5. Simulation Integration Core
function setupSimulationFromCompilation(report) {
    // 1. Setup Signal lists
    waveViewer.setSignals(report.ports);

    // 2. Setup Input Stimulus Dashboard
    buildStimulusDashboard(report.ports);

    // 3. Reset timeline
    resetSimulationEngine();

    // 4. Initial schematic rebuild
    const cleanCode = document.getElementById('code-input').value;
    schematicViewer.buildSchematic(
        report.ports,
        parser.registers,
        parser.wires,
        parser.assignments,
        parser.sequentialBlock
    );
}

function buildStimulusDashboard(ports) {
    const container = document.getElementById('stimulus-grid');
    container.innerHTML = "";

    const inputs = ports.filter(p => p.type === 'input');
    if (inputs.length === 0) {
        container.innerHTML = `<div class="stim-empty">No input signals configured for stimulus interface.</div>`;
        return;
    }

    inputs.forEach(pin => {
        // Skip clock and reset for manual toggling if they are handled by stepping buttons
        // but let's keep all ports for flexibility and user stimulus.
        const width = pin.width.high - pin.width.low + 1;
        
        if (width > 1) {
            // Slider / Numeric input for buses
            const pinDiv = document.createElement('div');
            pinDiv.className = 'stim-pin';
            pinDiv.dataset.pin = pin.name;
            pinDiv.innerHTML = `
                <span class="pin-name">${pin.name}</span>
                <input type="number" min="0" max="${(1<<width)-1}" value="0" style="background:#020503; color:#00e5ff; width:50px; border:1px solid #142a1b; outline:none; font-family:'Share Tech Mono';" />
            `;
            pinDiv.querySelector('input').addEventListener('change', (e) => {
                let val = parseInt(e.target.value) || 0;
                val = Math.max(0, Math.min(val, (1 << width) - 1));
                e.target.value = val;
                updateInputPortValue(pin.name, val);
            });
            container.appendChild(pinDiv);
        } else {
            // Button switch for single bits
            const btn = document.createElement('button');
            btn.className = 'stim-pin';
            btn.dataset.pin = pin.name;
            btn.innerHTML = `<span class="pin-name">${pin.name}:</span> <span class="pin-val">0</span>`;
            
            btn.addEventListener('click', () => {
                playBeep('click');
                const isCurrentlyActive = btn.classList.contains('active');
                if (isCurrentlyActive) {
                    btn.classList.remove('active');
                    btn.querySelector('.pin-val').innerText = '0';
                    updateInputPortValue(pin.name, 0);
                } else {
                    btn.classList.add('active');
                    btn.querySelector('.pin-val').innerText = '1';
                    updateInputPortValue(pin.name, 1);
                }
            });
            container.appendChild(btn);
        }
    });
}

function updateInputPortValue(name, value) {
    simState[name] = value;
    
    // Evaluate combinational logic instantly
    simState = parser.stepSimulation(simState, false);
    
    // Re-log
    logSimulationState();
    
    // Refresh wave & schematic
    if (simHistory.length > 0) {
        simHistory[simHistory.length - 1].state = { ...simState };
        waveViewer.updateHistory(simHistory);
    }
    schematicViewer.updateState(simState);
}

function resetSimulationEngine() {
    isSimRunning = false;
    clearInterval(simInterval);
    document.getElementById('sim-run-btn').innerHTML = `<i data-lucide="play"></i> AUTO-RUN`;
    document.getElementById('sim-run-btn').classList.remove('highlight');
    lucide.createIcons();

    clockCycle = 0;
    document.getElementById('clock-cycle-counter').innerText = "000";

    // Setup initial simulator states
    simState = parser.createSimulatorState();
    
    // Evaluate initially
    simState = parser.stepSimulation(simState, false);

    simHistory = [{ cycle: 0, state: { ...simState } }];
    waveViewer.updateHistory(simHistory);
    schematicViewer.updateState(simState);

    simLogElement.innerHTML = `<div class="term-line opacity-50">Simulation core reset. Timeline initialized to T0.</div>`;
    logSimulationState();
}

function logSimulationState() {
    if (!simLogElement) return;

    const pad = (n) => String(n).padStart(3, '0');
    const signals = Object.keys(simState).map(k => `${k}=${simState[k]}`).join(', ');
    
    const div = document.createElement('div');
    div.className = 'term-line';
    div.innerHTML = `<span style="color:#ff9f00;">[T=${pad(clockCycle)}]</span> <span style="color:#a1bca8;">${signals}</span>`;
    
    simLogElement.appendChild(div);
    simLogElement.scrollTop = simLogElement.scrollHeight;
}

function stepClockPulseManual() {
    clockCycle++;
    document.getElementById('clock-cycle-counter').innerText = String(clockCycle).padStart(3, '0');

    // Tick clk 0 -> 1 (posedge triggers registers updates)
    simState.clk = 1;
    simState = parser.stepSimulation(simState, true);
    
    // Record trace history
    simHistory.push({ cycle: clockCycle * 2 - 1, state: { ...simState } });

    // Tick clk 1 -> 0 (falling edge)
    simState.clk = 0;
    simState = parser.stepSimulation(simState, false);
    
    simHistory.push({ cycle: clockCycle * 2, state: { ...simState } });

    // Sync input switches on HUD if exists
    const clkBtn = document.querySelector(`.stim-pin[data-pin="clk"]`);
    if (clkBtn) {
        clkBtn.classList.remove('active');
        clkBtn.querySelector('.pin-val').innerText = '0';
    }

    logSimulationState();
    waveViewer.updateHistory(simHistory);
    schematicViewer.updateState(simState);
}

function toggleSimulationRun() {
    const runBtn = document.getElementById('sim-run-btn');
    
    if (isSimRunning) {
        isSimRunning = false;
        clearInterval(simInterval);
        runBtn.innerHTML = `<i data-lucide="play"></i> AUTO-RUN`;
        runBtn.classList.remove('highlight');
    } else {
        isSimRunning = true;
        runBtn.innerHTML = `<i data-lucide="square"></i> HALT SIM`;
        runBtn.classList.add('highlight');

        // Speed mapping (1 to 10)
        const speedVal = parseInt(document.getElementById('sim-speed-slider').value);
        const delay = 1000 / speedVal;

        simInterval = setInterval(() => {
            playBeep('clock');
            clockCycle++;
            document.getElementById('clock-cycle-counter').innerText = String(clockCycle).padStart(3, '0');

            // Simulate full cycle:
            // 1. posedge
            simState.clk = 1;
            simState = parser.stepSimulation(simState, true);
            simHistory.push({ cycle: clockCycle * 2 - 1, state: { ...simState } });

            // 2. negedge
            simState.clk = 0;
            simState = parser.stepSimulation(simState, false);
            simHistory.push({ cycle: clockCycle * 2, state: { ...simState } });

            logSimulationState();
            waveViewer.updateHistory(simHistory);
            schematicViewer.updateState(simState);

            // Limit history
            if (simHistory.length > 500) {
                simHistory.shift();
                simHistory.shift();
            }

            if (clockCycle >= 1000) {
                toggleSimulationRun(); // auto-stop at 1000 cycles
            }
        }, delay);
    }
    lucide.createIcons();
}

// Speed slider text indicator update
document.getElementById('sim-speed-slider').addEventListener('input', (e) => {
    document.getElementById('speed-val').innerText = `${e.target.value}Hz`;
    if (isSimRunning) {
        // Restart interval with new speed
        toggleSimulationRun();
        toggleSimulationRun();
    }
});

function toggleSimScreen(screen) {
    document.querySelectorAll('.sim-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sim-screen').forEach(s => s.classList.remove('active'));

    if (screen === 'wave') {
        document.getElementById('sim-tab-wave').classList.add('active');
        document.getElementById('sim-screen-wave').classList.add('active');
        waveViewer.resize();
    } else if (screen === 'schematic') {
        document.getElementById('sim-tab-schematic').classList.add('active');
        document.getElementById('sim-screen-schematic').classList.add('active');
        schematicViewer.resize();
    } else {
        document.getElementById('sim-tab-console').classList.add('active');
        document.getElementById('sim-screen-console').classList.add('active');
    }
}

// Helpers
function escapeHtml(text) {
    return text
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/* ==========================================================================
   SUPABASE AUTHENTICATION & GOOGLE GEMINI AI STREAM CONNECTORS
   ========================================================================== */
function initAuth() {
    if (!supabaseClient) {
        console.warn("Supabase SDK is not loaded or configured.");
        return;
    }

    // Load saved API Key from localStorage
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        document.getElementById('gemini-api-key').value = savedKey;
    }

    // Bind Auth Button Click
    const actionBtn = document.getElementById('auth-action-btn');
    if (actionBtn) {
        actionBtn.addEventListener('click', () => {
            playBeep('click');
            if (currentUser) {
                handleSignOut();
            } else {
                handleGoogleSignIn();
            }
        });
    }

    // Save API Key click
    const saveBtn = document.getElementById('save-api-key-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            playBeep('success');
            const key = document.getElementById('gemini-api-key').value.trim();
            localStorage.setItem('gemini_api_key', key);
            alert("Gemini Developer API Key successfully registered in local browser storage.");
        });
    }

    // Listen to Supabase authorization triggers
    supabaseClient.auth.onAuthStateChange((event, session) => {
        const wasGuest = !currentUser;
        updateUserAuthUI(session ? session.user : null);
        if (session && session.user && wasGuest) {
            switchScreen('workspace-screen');
            runHDLCompilation();
        }
    });

    // Check current session on load
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        updateUserAuthUI(session ? session.user : null);
        if (session && session.user) {
            switchScreen('workspace-screen');
            runHDLCompilation();
        }
    });
}

async function handleGoogleSignIn() {
    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    } catch (err) {
        console.error("Supabase OAuth Google initiation failure:", err.message);
        alert(`Authentication Error: ${err.message}`);
    }
}

async function handleSignOut() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    } catch (err) {
        console.error("Sign out process failed:", err.message);
    }
}

function updateUserAuthUI(user) {
    currentUser = user;
    const led = document.getElementById('auth-status-led');
    const label = document.getElementById('auth-status-label');
    const actionBtn = document.getElementById('auth-action-btn');
    const overlay = document.getElementById('synth-lock-overlay');
    const lockTitle = document.getElementById('lock-title');
    const lockDesc = document.getElementById('lock-desc');
    const actionsContainer = document.getElementById('lock-actions-container');

    if (user) {
        // Logged-in authenticated
        if (led) led.className = 'led green';
        const displayLabel = user.email.split('@')[0];
        if (label) label.innerText = displayLabel.toUpperCase();
        if (actionBtn) actionBtn.innerHTML = `<i data-lucide="log-out"></i> SIGN OUT`;

        // Retrieve subscription tier
        isGeminiSubscribed = user.user_metadata?.gemini_subscribed === true;

        if (isGeminiSubscribed) {
            if (overlay) overlay.style.display = 'none'; // Unlocks AI synthesizers
        } else {
            // Under verification or needs subscription
            if (overlay) overlay.style.display = 'flex';
            if (lockTitle) lockTitle.innerText = "GEMINI ADVANCED SUBSCRIPTION REQUISITE";
            if (lockDesc) lockDesc.innerText = "Your account is logged in, but you do not have an active Google Gemini subscription associated. Please activate your subscription state in this sandbox to test advanced AI logic generation.";
            
            if (actionsContainer) {
                actionsContainer.innerHTML = `
                    <button class="glowing-btn" id="activate-sub-btn" style="color:var(--neon-amber);">
                        <span class="btn-border" style="border-color:var(--neon-amber);"></span>
                        <span class="btn-text"><i data-lucide="zap"></i> ACTIVATE GEMINI SUBSCRIPTION (SANDBOX)</span>
                    </button>
                `;
            }
            lucide.createIcons();

            const actBtn = document.getElementById('activate-sub-btn');
            if (actBtn) {
                actBtn.addEventListener('click', async () => {
                    playBeep('success');
                    actBtn.disabled = true;
                    actBtn.querySelector('.btn-text').innerText = "PROVISIONING CORE LICENSE...";
                    
                    try {
                        const { error } = await supabaseClient.auth.updateUser({
                            data: { gemini_subscribed: true }
                        });
                        if (error) throw error;
                        alert("Google Gemini Subscription sandbox license activated successfully! AI synthesis cores initialized.");
                    } catch (err) {
                        alert(`Activation failed: ${err.message}`);
                        actBtn.disabled = false;
                    }
                });
            }
        }
    } else {
        // Anonymous visitor
        if (led) led.className = 'led red';
        if (label) label.innerText = 'GUEST';
        if (actionBtn) actionBtn.innerHTML = `<i data-lucide="log-in"></i> SIGN IN`;
        
        if (overlay) overlay.style.display = 'flex';
        if (lockTitle) lockTitle.innerText = "COPROCESSOR INTERLOCK ACTIVE";
        if (lockDesc) lockDesc.innerText = "Neural Logic Synthesis cores require Sign-In with Google & an active Google Gemini subscription.";
        
        if (actionsContainer) {
            actionsContainer.innerHTML = `
                <button class="glowing-btn" id="lock-signin-btn">
                    <span class="btn-border"></span>
                    <span class="btn-text"><i data-lucide="log-in"></i> SIGN IN WITH GOOGLE</span>
                </button>
            `;
        }
        lucide.createIcons();
        const lockSBtn = document.getElementById('lock-signin-btn');
        if (lockSBtn) {
            lockSBtn.addEventListener('click', () => {
                playBeep('click');
                handleGoogleSignIn();
            });
        }
    }
    lucide.createIcons();
}

async function runActualGeminiAISynthesis(prompt, apiKey, consoleLog) {
    const l3 = document.createElement('div');
    l3.className = 'term-line glow-green';
    l3.innerText = `[i] DEPLOYING COGNITIVE SYNTHESIZER MODULE PORTMAPS...`;
    consoleLog.appendChild(l3);
    consoleLog.scrollTop = consoleLog.scrollHeight;

    const langName = currentLanguage === 'vhdl' ? 'VHDL' : (currentLanguage === 'sysverilog' ? 'SystemVerilog' : 'Verilog');
    
    // Call Gemini Developer API endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const requestPayload = {
        contents: [{
            parts: [{
                text: `You are an expert HDL synthesis assistant. The user wants to design: "${prompt}". Generate clean, synthesizable, fully functional ${langName} code. Output ONLY the raw code text. Do NOT wrap the code in markdown code fences (do NOT use \`\`\`verilog or \`\`\`vhdl or similar), do NOT write any introduction or explanation or conversational text.`
            }]
        }],
        generationConfig: {
            temperature: 0.2
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        let rawCode = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        if (rawCode === "") {
            throw new Error("Received empty content from Gemini AI.");
        }

        // Clean up markdown tags in case Gemini returned them
        rawCode = rawCode.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();

        const l4 = document.createElement('div');
        l4.className = 'term-line glow-green';
        l4.innerText = `[o] SYNTHESIS PIPELINE CONVERGED. STREAMING RESULTS...`;
        consoleLog.appendChild(l4);
        consoleLog.scrollTop = consoleLog.scrollHeight;

        const boxContainer = document.getElementById('synth-result-box');
        const codeBox = document.getElementById('synthesized-code-box');

        if (boxContainer) boxContainer.style.display = "flex";
        if (codeBox) codeBox.innerText = "";

        // Stream typewriter
        let i = 0;
        const timer = setInterval(() => {
            if (i < rawCode.length) {
                if (codeBox) codeBox.innerText += rawCode.charAt(i++);
                if (boxContainer) boxContainer.scrollTop = boxContainer.scrollHeight;
            } else {
                clearInterval(timer);
            }
        }, 3);

    } catch (err) {
        console.error("Gemini AI API failure:", err);
        const lErr = document.createElement('div');
        lErr.className = 'term-line';
        lErr.innerHTML = `<span style="color:var(--neon-red);">[!] REMOTE LINK FAIL: ${escapeHtml(err.message)}</span>`;
        consoleLog.appendChild(lErr);
        
        const lFallback = document.createElement('div');
        lFallback.className = 'term-line opacity-50';
        lFallback.innerText = `Reverting to local dynamic rule synthesizer...`;
        consoleLog.appendChild(lFallback);
        consoleLog.scrollTop = consoleLog.scrollHeight;

        // Fall back to local simulated stream
        setTimeout(() => {
            streamSynthesizedCode(prompt);
        }, 1500);
    }
}
