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
endmodule`,
        new_project: ""
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
end architecture behavioral;`,
        new_project: ""
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
let activeTestbenchQueue = [];

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
    const overlay = document.getElementById('code-overlay');
    
    codeArea.addEventListener('scroll', () => {
        lineNums.scrollTop = codeArea.scrollTop;
        if (overlay) {
            overlay.scrollTop = codeArea.scrollTop;
            overlay.scrollLeft = codeArea.scrollLeft;
        }
    });

    codeArea.addEventListener('input', () => {
        updateLineNumbers();
        runHDLCompilation();
    });

    // Reboot / Hard Reset handler
    document.getElementById('reboot-system-btn').addEventListener('click', () => {
        playBeep('success');
        
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

        // Also clear testbench
        const tbInput = document.getElementById('testbench-input');
        if (tbInput) {
            tbInput.value = "";
            updateTbLineNumbers();
        }
        runTbCompilation();

        // Redirect back to Window 1
        switchWindow('window-auth-entry');
    });

    // Wire Card Selectors (Window 1 Entry and Sidebar)
    const cards = document.querySelectorAll('.selector-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            if (!currentUser) {
                alert("Identity verification required. Please sign in with Google to select languages.");
                return;
            }
            playBeep('click');
            const hdl = card.dataset.hdl;
            document.querySelectorAll('.selector-card').forEach(c => {
                if (c.dataset.hdl === hdl) {
                    c.classList.add('active');
                } else {
                    c.classList.remove('active');
                }
            });
            currentLanguage = hdl;
            loadActiveTemplate();
            
            // Update active core displays
            const footerStatus = document.getElementById('lang-footer-status');
            if (footerStatus) footerStatus.innerText = `ACTIVE CORE: ${hdl.toUpperCase()}`;
            
            const tbFilename = document.getElementById('tb-filename');
            if (tbFilename) tbFilename.innerText = hdl === 'vhdl' ? 'tb_main.vhd' : 'tb_main.v';

            // Clear testbench on language shift
            const tbInput = document.getElementById('testbench-input');
            if (tbInput) {
                tbInput.value = "";
                updateTbLineNumbers();
            }

            runHDLCompilation();
            runTbCompilation();

            // Transition to Window 2 immediately on language click
            switchWindow('window-hdl-dev');
        });
    });

    // Wire Template Chips & Board Presets
    const chips = document.querySelectorAll('.template-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (!currentUser) {
                alert("Identity verification required. Please sign in with Google.");
                return;
            }
            playBeep('click');
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentTemplate = chip.dataset.template;
            loadActiveTemplate();
            runHDLCompilation();
        });
    });

    // Compiler Action (Window 2 -> Window 3 compile step)
    document.getElementById('editor-compile-btn').addEventListener('click', () => {
        playBeep('click');
        runHDLCompilation();
    });

    // Apply auto-correct patch
    document.getElementById('apply-patch-btn').addEventListener('click', () => {
        playBeep('success');
        applyDiagnosticsPatch();
    });

    // Testbench Editor Scrolling & Input Changes
    const tbInput = document.getElementById('testbench-input');
    const tbLineNums = document.getElementById('tb-line-numbers');
    const tbOverlay = document.getElementById('tb-overlay');
    if (tbInput && tbLineNums) {
        tbInput.addEventListener('scroll', () => {
            tbLineNums.scrollTop = tbInput.scrollTop;
            if (tbOverlay) {
                tbOverlay.scrollTop = tbInput.scrollTop;
                tbOverlay.scrollLeft = tbInput.scrollLeft;
            }
        });
        tbInput.addEventListener('input', () => {
            updateTbLineNumbers();
            runTbCompilation();
        });
    }

    // Neural Coprocessor Action Buttons
    const generateCodeBtn = document.getElementById('generate-code-btn');
    if (generateCodeBtn) {
        generateCodeBtn.addEventListener('click', () => {
            playBeep('click');
            triggerNeuralSynthesis();
        });
    }

    const injectEditorBtn = document.getElementById('inject-editor-btn');
    if (injectEditorBtn) {
        injectEditorBtn.addEventListener('click', () => {
            playBeep('success');
            injectSynthesizedCode();
        });
    }

    // Testbench Inject Button
    const injectTbBtn = document.getElementById('inject-tb-btn');
    if (injectTbBtn) {
        injectTbBtn.addEventListener('click', () => {
            playBeep('success');
            injectSynthesizedTestbench();
        });
    }

    // Testbench Action Buttons
    document.getElementById('tb-generate-btn').addEventListener('click', () => {
        playBeep('click');
        triggerTestbenchSynthesis();
    });

    // Testbench Copy & Download
    document.getElementById('tb-copy-btn').addEventListener('click', () => {
        playBeep('click');
        navigator.clipboard.writeText(document.getElementById('testbench-input').value);
        showTemporaryBadge('COPIED!');
    });
    document.getElementById('tb-download-btn').addEventListener('click', () => {
        playBeep('success');
        const code = document.getElementById('testbench-input').value;
        const filename = document.getElementById('tb-filename').innerText;
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

    // Testbench Simulation Runner (Window 3 -> Window 4 simulation step)
    const tbSimRunBtn = document.getElementById('tb-sim-run-btn');
    if (tbSimRunBtn) {
        tbSimRunBtn.addEventListener('click', () => {
            playBeep('success');
            runTestbenchSimulation();
        });
    }

    // Results back button (Window 4 -> Window 3 navigation)
    const resultsBackBtn = document.getElementById('results-back-btn');
    if (resultsBackBtn) {
        resultsBackBtn.addEventListener('click', () => {
            playBeep('click');
            switchWindow('window-tb-dev');
        });
    }

    // Entry Wizard gateway Enter button
    const enterBtn = document.getElementById('gateway-enter-btn');
    if (enterBtn) {
        enterBtn.addEventListener('click', () => {
            if (!currentUser) {
                alert("Identity verification required. Please sign in with Google.");
                return;
            }
            playBeep('success');
            switchWindow('window-hdl-dev');
        });
    }

    // Wizard Breadcrumb navigation listeners
    const steps = ['step-nav-entry', 'step-nav-hdl', 'step-nav-tb', 'step-nav-sim'];
    steps.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                if (el.classList.contains('completed') || el.classList.contains('active')) {
                    playBeep('click');
                    switchWindow(el.dataset.window);
                }
            });
        }
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

let currentActiveWindow = 'window-auth-entry';

function switchWindow(windowId) {
    currentActiveWindow = windowId;
    
    // Hide/show viewports
    document.querySelectorAll('.window-viewport').forEach(w => {
        w.classList.remove('active');
    });
    const target = document.getElementById(windowId);
    if (target) {
        target.classList.add('active');
    }
    
    // Resize canvasses on screen load
    if (windowId === 'window-simulator') {
        setTimeout(() => {
            if (waveViewer) waveViewer.resize();
            if (schematicViewer) schematicViewer.resize();
        }, 80);
    }

    // Update nav indicators
    const steps = [
        { id: 'step-nav-entry', win: 'window-auth-entry' },
        { id: 'step-nav-hdl', win: 'window-hdl-dev' },
        { id: 'step-nav-tb', win: 'window-tb-dev' },
        { id: 'step-nav-sim', win: 'window-simulator' }
    ];

    let foundActive = false;
    steps.forEach((s) => {
        const el = document.getElementById(s.id);
        if (!el) return;

        if (s.win === windowId) {
            el.className = 'nav-step active';
            foundActive = true;
        } else if (!foundActive) {
            // Steps before the active step are completed & clickable
            el.className = 'nav-step completed';
        } else {
            // Steps after active step are disabled
            el.className = 'nav-step disabled';
        }
    });
    
    // Trigger Lucide refresh
    if (window.lucide) {
        lucide.createIcons();
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
    if (codeArea) codeArea.value = template;
    
    const filenameEl = document.getElementById('current-filename');
    if (filenameEl) {
        filenameEl.innerText = currentLanguage === 'vhdl' ? 'main.vhd' : 'main.v';
    }
    const hdlLabelEl = document.getElementById('current-hdl-label');
    if (hdlLabelEl) {
        hdlLabelEl.innerText = currentLanguage.toUpperCase();
    }
    
    updateLineNumbers();
}

function detectLanguage(code) {
    const clean = code.toLowerCase();
    if (clean.includes('library ieee') || clean.includes('entity ') || clean.includes('architecture ') || clean.includes('std_logic')) {
        return 'vhdl';
    }
    if (clean.includes('endmodule') || clean.includes('always @') || (clean.includes('module ') && !clean.includes('entity '))) {
        if (clean.includes('always_comb') || clean.includes('always_ff') || clean.includes('logic ')) {
            return 'sysverilog';
        }
        return 'verilog';
    }
    return null;
}

// 3. HDL Compiler Dispatcher
function runHDLCompilation() {
    const code = document.getElementById('code-input').value;
    
    // Auto-detect language switch on paste
    const detectedLang = detectLanguage(code);
    if (detectedLang && detectedLang !== currentLanguage) {
        currentLanguage = detectedLang;
        const filenameEl = document.getElementById('current-filename');
        if (filenameEl) filenameEl.innerText = currentLanguage === 'vhdl' ? 'main.vhd' : 'main.v';
        const labelEl = document.getElementById('current-hdl-label');
        if (labelEl) labelEl.innerText = currentLanguage.toUpperCase();
        
        // Update active selector card class on the home screen
        const cards = document.querySelectorAll('.selector-card');
        cards.forEach(c => {
            if (c.dataset.hdl === currentLanguage) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
    }

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
        if (summaryBadge) {
            summaryBadge.className = 'status-indicator red';
            summaryBadge.innerText = 'SYNTAX DEFECTS DETECTED';
        }
        
        // Show error list
        populateDiagnosticsList(report.errors);
        
        // Setup patch diff
        setupProposedPatch(code, report.correctedCode);
        
        // Go to errors tab
        toggleDiagTab('errors');
    } else {
        playBeep('success');
        badge.innerHTML = `<span class="led green"></span> COMPILED`;
        if (summaryBadge) {
            summaryBadge.className = 'status-indicator green';
            summaryBadge.innerText = 'MODULE STABLE';
        }

        populateDiagnosticsList([]); // success screen
        setupProposedPatch(code, code);

        // Feed compilation core to simulation visualizers if Verilog, SystemVerilog, or VHDL
        if (currentLanguage === 'verilog' || currentLanguage === 'sysverilog' || currentLanguage === 'vhdl') {
            setupSimulationFromCompilation(report);
        }

        // Auto-navigate to Testbench lab window after successful compilation
        setTimeout(() => {
            switchWindow('window-tb-dev');
        }, 650);
    }
}

function toggleDiagTab(tab) {
    document.querySelectorAll('.hdl-tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.hdl-tab-content').forEach(c => c.classList.remove('active'));
    
    if (tab === 'errors') {
        const tabEl = document.getElementById('tab-errors');
        const contentEl = document.getElementById('content-errors');
        if (tabEl) tabEl.classList.add('active');
        if (contentEl) contentEl.classList.add('active');
    } else if (tab === 'autocorrect') {
        const tabEl = document.getElementById('tab-autocorrect');
        const contentEl = document.getElementById('content-autocorrect');
        if (tabEl) tabEl.classList.add('active');
        if (contentEl) contentEl.classList.add('active');
    } else if (tab === 'generator') {
        const tabEl = document.getElementById('tab-generator');
        const contentEl = document.getElementById('content-generator');
        if (tabEl) tabEl.classList.add('active');
        if (contentEl) contentEl.classList.add('active');
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
    } else if (lower.includes('mux') || lower.includes('multiplexer') || lower.includes('multiplexor')) {
        if (currentLanguage === 'vhdl') {
            generatedVerilog = `-- Synthesized 4-to-1 Multiplexer
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity mux_4to1 is
    Port (
        a    : in  STD_LOGIC;
        b    : in  STD_LOGIC;
        c    : in  STD_LOGIC;
        d    : in  STD_LOGIC;
        sel1 : in  STD_LOGIC;
        sel0 : in  STD_LOGIC;
        y    : out STD_LOGIC
    );
end mux_4to1;

architecture Behavioral of mux_4to1 is
begin
    y <= (not sel1 and not sel0 and a) or
         (not sel1 and     sel0 and b) or
         (    sel1 and not sel0 and c) or
         (    sel1 and     sel0 and d);
end Behavioral;`;
        } else {
            generatedVerilog = `// Synthesized 4-to-1 Multiplexer
module mux_4to1(
    input a,
    input b,
    input c,
    input d,
    input [1:0] sel,
    output y
);
    // Multiplexer selection using continuous bitwise assignments
    assign y = (~sel[1] & ~sel[0] & a) | (~sel[1] & sel[0] & b) | (sel[1] & ~sel[0] & c) | (sel[1] & sel[0] & d);
endmodule`;
        }
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
    codeBox.textContent = "";

    // Typewriter effect streaming
    let i = 0;
    const timer = setInterval(() => {
        if (i < generatedVerilog.length) {
            codeBox.textContent += generatedVerilog.charAt(i++);
            boxContainer.scrollTop = boxContainer.scrollHeight;
        } else {
            clearInterval(timer);
        }
    }, 3);
}

function injectSynthesizedCode() {
    const codeBox = document.getElementById('synthesized-code-box');
    const codeArea = document.getElementById('code-input');
    
    codeArea.value = codeBox.textContent;
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

    // Clear active testbench queue
    activeTestbenchQueue = [];

    // Setup initial simulator states
    simState = parser.createSimulatorState();
    
    // Evaluate initially
    simState = parser.stepSimulation(simState, false);

    simHistory = [{ cycle: 0, state: { ...simState } }];
    waveViewer.updateHistory(simHistory);
    schematicViewer.updateState(simState);

    if (simLogElement) simLogElement.innerHTML = `<div class="term-line opacity-50">Simulation core reset. Timeline initialized to T0.</div>`;
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
    const isTestbenchMode = document.getElementById('stimulus-source-select')?.value === 'testbench';
    if (isTestbenchMode) {
        const active = applyNextTestbenchVector();
        if (!active) {
            alert("No remaining testbench stimulus vectors. Click reset to start timeline over.");
            return;
        }
    }

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
            const isTestbenchMode = document.getElementById('stimulus-source-select')?.value === 'testbench';
            if (isTestbenchMode) {
                const active = applyNextTestbenchVector();
                if (!active) {
                    toggleSimulationRun(); // Halt
                    const simConsole = document.getElementById('sim-log-output');
                    if (simConsole) {
                        const line = document.createElement('div');
                        line.className = 'term-line glow-green';
                        line.innerText = `[o] TESTBENCH SIMULATION COMPLETE // Cycle Ticks: ${clockCycle}`;
                        simConsole.appendChild(line);
                        simConsole.scrollTop = simConsole.scrollHeight;
                    }
                    return;
                }
            }

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
    const tabs = document.querySelectorAll('.sim-tab');
    if (tabs.length > 0) tabs.forEach(t => t.classList.remove('active'));
    
    const screens = document.querySelectorAll('.sim-screen');
    if (screens.length > 0) screens.forEach(s => s.classList.remove('active'));

    if (screen === 'wave') {
        const tab = document.getElementById('sim-tab-wave');
        if (tab) tab.classList.add('active');
        const scr = document.getElementById('sim-screen-wave');
        if (scr) scr.classList.add('active');
        if (waveViewer) waveViewer.resize();
    } else if (screen === 'schematic') {
        const tab = document.getElementById('sim-tab-schematic');
        if (tab) tab.classList.add('active');
        const scr = document.getElementById('sim-screen-schematic');
        if (scr) scr.classList.add('active');
        if (schematicViewer) schematicViewer.resize();
    } else {
        const tab = document.getElementById('sim-tab-console');
        if (tab) tab.classList.add('active');
        const scr = document.getElementById('sim-screen-console');
        if (scr) scr.classList.add('active');
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
            switchWindow('window-hdl-dev');
            runHDLCompilation();
        }
    });

    // Check current session on load
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        updateUserAuthUI(session ? session.user : null);
        if (session && session.user) {
            switchWindow('window-hdl-dev');
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
    
    // Header components
    const led = document.getElementById('auth-status-led');
    const label = document.getElementById('auth-status-label');
    const actionBtn = document.getElementById('auth-action-btn');

    // Sidebar components
    const sidebarLed = document.getElementById('sidebar-auth-status-led');
    const sidebarLabel = document.getElementById('sidebar-auth-status-label');
    const sidebarContainer = document.getElementById('sidebar-lock-actions-container');

    // Lock overlays
    const hdlOverlay = document.getElementById('synth-lock-overlay');
    const tbOverlay = document.getElementById('tb-synth-lock-overlay');

    // Gateway views in Window 1 (Dynamic Sign-In vs Compiler Presets)
    const gatewayLocked = document.getElementById('gateway-auth-locked-view');
    const gatewayControls = document.getElementById('gateway-auth-unlocked-view');
    const gatewayEmail = document.getElementById('gateway-user-email');

    if (user) {
        const displayLabel = user.email.split('@')[0].toUpperCase();
        
        // Show unlocked settings controls in Window 1
        if (gatewayLocked) gatewayLocked.style.display = 'none';
        if (gatewayControls) gatewayControls.style.display = 'flex';
        if (gatewayEmail) gatewayEmail.innerText = user.email.toUpperCase();

        // Update header profiles
        if (led) led.className = 'led green';
        if (label) label.innerText = displayLabel;
        if (actionBtn) actionBtn.innerHTML = `<i data-lucide="log-out"></i> SIGN OUT`;

        // Update sidebar profiles
        if (sidebarLed) sidebarLed.className = 'led green';
        if (sidebarLabel) sidebarLabel.innerText = displayLabel;
        if (sidebarContainer) {
            sidebarContainer.innerHTML = `
                <button class="glowing-btn highlight" id="sidebar-auth-action-btn" style="width:100%;">
                    <span class="btn-border" style="border-color:var(--neon-red);"></span>
                    <span class="btn-text" style="font-size:0.75rem;"><i data-lucide="log-out"></i> SIGN OUT</span>
                </button>
            `;
            const sBtn = document.getElementById('sidebar-auth-action-btn');
            if (sBtn) {
                sBtn.addEventListener('click', () => {
                    playBeep('click');
                    handleSignOut();
                });
            }
        }

        // Wire Gateway Sign-Out
        const gatewaySignOutBtn = document.getElementById('gateway-signout-btn');
        if (gatewaySignOutBtn) {
            gatewaySignOutBtn.addEventListener('click', () => {
                playBeep('click');
                handleSignOut();
            });
        }

        // Retrieve subscription tier
        isGeminiSubscribed = user.user_metadata?.gemini_subscribed === true;

        if (isGeminiSubscribed) {
            if (hdlOverlay) hdlOverlay.style.display = 'none';
            if (tbOverlay) tbOverlay.style.display = 'none';
        } else {
            // Logged in but requires subscription activation
            if (hdlOverlay) {
                hdlOverlay.style.display = 'flex';
                const hdlTitle = hdlOverlay.querySelector('#lock-title');
                const hdlDesc = hdlOverlay.querySelector('#lock-desc');
                const hdlActions = hdlOverlay.querySelector('#lock-actions-container');
                if (hdlTitle) hdlTitle.innerText = "SUBSCRIPTION REQUIRED";
                if (hdlDesc) hdlDesc.innerText = "An active Google Gemini subscription is required for logic synthesis. Activate subscription in the sandbox below.";
                if (hdlActions) {
                    hdlActions.innerHTML = `
                        <button class="glowing-btn" id="activate-sub-btn" style="color:var(--neon-amber); width:100%;">
                            <span class="btn-border" style="border-color:var(--neon-amber);"></span>
                            <span class="btn-text" style="font-size:0.75rem;"><i data-lucide="zap"></i> ACTIVATE GEMINI (SANDBOX)</span>
                        </button>
                    `;
                }
            }

            if (tbOverlay) {
                tbOverlay.style.display = 'flex';
                const tbTitle = tbOverlay.querySelector('#tb-lock-title');
                const tbDesc = tbOverlay.querySelector('#tb-lock-desc');
                const tbActions = tbOverlay.querySelector('#tb-lock-actions-container');
                if (tbTitle) tbTitle.innerText = "SUBSCRIPTION REQUIRED";
                if (tbDesc) tbDesc.innerText = "An active Google Gemini subscription is required for testbench synthesis. Activate subscription in the sandbox below.";
                if (tbActions) {
                    tbActions.innerHTML = `
                        <button class="glowing-btn" id="tb-activate-sub-btn" style="color:var(--neon-amber); width:100%;">
                            <span class="btn-border" style="border-color:var(--neon-amber);"></span>
                            <span class="btn-text" style="font-size:0.75rem;"><i data-lucide="zap"></i> ACTIVATE GEMINI (SANDBOX)</span>
                        </button>
                    `;
                }
            }

            // Wire activation clicks
            const actBtn = document.getElementById('activate-sub-btn');
            const tbActBtn = document.getElementById('tb-activate-sub-btn');
            const activateHandler = async (btnElement) => {
                playBeep('success');
                btnElement.disabled = true;
                btnElement.querySelector('.btn-text').innerText = "PROVISIONING LICENSE...";
                try {
                    const { error } = await supabaseClient.auth.updateUser({
                        data: { gemini_subscribed: true }
                    });
                    if (error) throw error;
                    alert("Google Gemini Subscription sandbox license activated successfully! Coprocessors unlocked.");
                } catch (err) {
                    alert(`Activation failed: ${err.message}`);
                    btnElement.disabled = false;
                }
            };

            if (actBtn) actBtn.addEventListener('click', () => activateHandler(actBtn));
            if (tbActBtn) tbActBtn.addEventListener('click', () => activateHandler(tbActBtn));
        }

    } else {
        // Guest account - locked out
        isGeminiSubscribed = false;

        // Show locked card settings notice in Window 1
        if (gatewayLocked) gatewayLocked.style.display = 'flex';
        if (gatewayControls) gatewayControls.style.display = 'none';

        // Update header profiles
        if (led) led.className = 'led red';
        if (label) label.innerText = 'GUEST';
        if (actionBtn) actionBtn.innerHTML = `<i data-lucide="log-in"></i> SIGN IN`;

        // Update sidebar profiles
        if (sidebarLed) sidebarLed.className = 'led red';
        if (sidebarLabel) sidebarLabel.innerText = 'GUEST ACCOUNT';
        if (sidebarContainer) {
            sidebarContainer.innerHTML = `
                <button class="glowing-btn" id="sidebar-auth-action-btn" style="width:100%;">
                    <span class="btn-border"></span>
                    <span class="btn-text" style="font-size:0.75rem;"><i data-lucide="log-in"></i> SIGN IN WITH GOOGLE</span>
                </button>
            `;
            const sBtn = document.getElementById('sidebar-auth-action-btn');
            if (sBtn) {
                sBtn.addEventListener('click', () => {
                    playBeep('click');
                    handleGoogleSignIn();
                });
            }
        }

        // Wire Gateway Sign-In
        const gatewaySignInBtn = document.getElementById('gateway-auth-signin-btn');
        if (gatewaySignInBtn) {
            gatewaySignInBtn.addEventListener('click', () => {
                playBeep('click');
                handleGoogleSignIn();
            });
        }

        // Show lock screens on both AI panels
        if (hdlOverlay) {
            hdlOverlay.style.display = 'flex';
            const hdlTitle = hdlOverlay.querySelector('#lock-title');
            const hdlDesc = hdlOverlay.querySelector('#lock-desc');
            const hdlActions = hdlOverlay.querySelector('#lock-actions-container');
            if (hdlTitle) hdlTitle.innerText = "COPROCESSOR INTERLOCK ACTIVE";
            if (hdlDesc) hdlDesc.innerText = "Neural Logic Synthesis cores require Sign-In with Google & an active Google Gemini subscription.";
            if (hdlActions) {
                hdlActions.innerHTML = `
                    <button class="glowing-btn" id="lock-signin-btn" style="width:100%;">
                        <span class="btn-border"></span>
                        <span class="btn-text" style="font-size:0.75rem;"><i data-lucide="log-in"></i> SIGN IN WITH GOOGLE</span>
                    </button>
                `;
            }
            const signBtn = document.getElementById('lock-signin-btn');
            if (signBtn) signBtn.addEventListener('click', () => { playBeep('click'); handleGoogleSignIn(); });
        }

        if (tbOverlay) {
            tbOverlay.style.display = 'flex';
            const tbTitle = tbOverlay.querySelector('#tb-lock-title');
            const tbDesc = tbOverlay.querySelector('#tb-lock-desc');
            const tbActions = tbOverlay.querySelector('#tb-lock-actions-container');
            if (tbTitle) tbTitle.innerText = "COPROCESSOR INTERLOCK ACTIVE";
            if (tbDesc) tbDesc.innerText = "Testbench AI Synthesis cores require Sign-In with Google & an active Google Gemini subscription.";
            if (tbActions) {
                tbActions.innerHTML = `
                    <button class="glowing-btn" id="tb-lock-signin-btn" style="width:100%;">
                        <span class="btn-border"></span>
                        <span class="btn-text" style="font-size:0.75rem;"><i data-lucide="log-in"></i> SIGN IN WITH GOOGLE</span>
                    </button>
                `;
            }
            const tbSignBtn = document.getElementById('tb-lock-signin-btn');
            if (tbSignBtn) tbSignBtn.addEventListener('click', () => { playBeep('click'); handleGoogleSignIn(); });
        }

        // Force viewport back to entry portal if user logs out
        switchWindow('window-auth-entry');
    }
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
        if (codeBox) codeBox.textContent = "";

        // Stream typewriter
        let i = 0;
        const timer = setInterval(() => {
            if (i < rawCode.length) {
                if (codeBox) codeBox.textContent += rawCode.charAt(i++);
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

// ==========================================================================
// TESTBENCH LAB GLOBAL HELPERS & SIMULATION ENGINE
// ==========================================================================
let tbReport = null;
let tbSimInterval = null;

function toggleTbTab(tab) {
    document.querySelectorAll('.tb-tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tb-tab-content').forEach(c => c.classList.remove('active'));
    
    if (tab === 'generator') {
        document.getElementById('tb-tab-generator').classList.add('active');
        document.getElementById('tb-content-generator').classList.add('active');
    } else if (tab === 'diagnostics') {
        document.getElementById('tb-tab-diagnostics').classList.add('active');
        document.getElementById('tb-content-diagnostics').classList.add('active');
    }
}

function updateTbLineNumbers() {
    const tbInput = document.getElementById('testbench-input');
    const lineNums = document.getElementById('tb-line-numbers');
    if (!tbInput || !lineNums) return;
    const linesCount = tbInput.value.split('\n').length;
    
    let html = "";
    for (let i = 1; i <= linesCount; i++) {
        html += `<div>${i}</div>`;
    }
    lineNums.innerHTML = html;
}

function runTbCompilation() {
    const tbInput = document.getElementById('testbench-input');
    if (!tbInput) return;
    const tbCode = tbInput.value;
    const mainModuleName = parser.moduleName || "uut";
    
    tbReport = parser.analyzeTestbench(tbCode, mainModuleName, currentLanguage);
    
    const badge = document.getElementById('tb-status-badge');
    const container = document.getElementById('tb-diagnostic-list-container');
    if (!container) return;
    container.innerHTML = "";
    
    if (tbReport.hasErrors) {
        if (badge) badge.innerHTML = `<span class="led red"></span> TB LINT FAILED`;
        
        tbReport.errors.forEach(e => {
            const item = document.createElement('div');
            item.className = `diag-item ${e.severity}`;
            item.innerHTML = `
                <div class="diag-meta">
                    <span class="severity">${e.severity.toUpperCase()}</span>
                    <span class="line">LINE ${e.line}</span>
                </div>
                <div class="diag-msg">${escapeHtml(e.message)}</div>
                <div class="diag-suggest"><i data-lucide="info" style="height:12px; width:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Suggestion: ${e.suggestion}</div>
            `;
            container.appendChild(item);
        });
        lucide.createIcons();
    } else {
        if (badge) badge.innerHTML = `<span class="led green"></span> TB COMPILED`;
        
        if (tbReport.errors.length > 0) {
            tbReport.errors.forEach(e => {
                const item = document.createElement('div');
                item.className = `diag-item ${e.severity}`;
                item.innerHTML = `
                    <div class="diag-meta">
                        <span class="severity">${e.severity.toUpperCase()}</span>
                    </div>
                    <div class="diag-msg">${escapeHtml(e.message)}</div>
                    <div class="diag-suggest">Suggestion: ${e.suggestion}</div>
                `;
                container.appendChild(item);
            });
            lucide.createIcons();
        } else {
            container.innerHTML = `
                <div class="diagnostic-empty">
                    <i data-lucide="check-circle" class="glow-green-icon"></i>
                    <h3>TESTBENCH INTEGRITY STABLE</h3>
                    <p>Syntax checks passed. Simulation stimulus is loaded and ready.</p>
                </div>
            `;
            lucide.createIcons();
        }
    }
    
    setupTbProposedPatch(tbCode, tbReport.correctedCode);
}

function setupTbProposedPatch(originalCode, correctedCode) {
    const diffBody = document.getElementById('tb-diff-view-area');
    const patchBtn = document.getElementById('tb-apply-patch-btn');
    const container = document.getElementById('tb-diff-container');
    if (!diffBody || !patchBtn || !container) return;

    if (originalCode === correctedCode) {
        container.style.display = "none";
        patchBtn.disabled = true;
        return;
    }

    container.style.display = "block";
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

function applyTbDiagnosticsPatch() {
    const tbInput = document.getElementById('testbench-input');
    if (!tbInput || !tbReport) return;
    tbInput.value = tbReport.correctedCode;
    updateTbLineNumbers();
    runTbCompilation();
}

function triggerTestbenchSynthesis() {
    const promptField = document.getElementById('tb-synth-prompt');
    if (!promptField) return;
    const prompt = promptField.value.trim();
    if (prompt === "") {
        alert("Please describe the testbench stimulus specifications.");
        return;
    }

    const consoleLog = document.getElementById('tb-terminal-log');
    if (!consoleLog) return;
    consoleLog.innerHTML = "";

    const logLines = [
        `[i] CORE STIMULUS SYNTHESIZER ONLINE...`,
        `[i] FETCHING MAIN MODULE INTERFACE PORTS...`,
        `[i] CONSTRUCTING WAVEFORM DRIVER TIMELINES...`,
        `[i] GENERATING EXHAUSTIVE SIGNAL PATTERNS...`,
        `[o] TESTBENCH GENERATION SUCCEEDED.`
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
            streamSynthesizedTestbench(prompt);
        }
    }, 250);
}

function streamSynthesizedTestbench(prompt) {
    let generatedTb = "";
    const moduleName = parser.moduleName || "uut";
    
    if (currentLanguage === 'vhdl') {
        generatedTb = `-- Synthesized VHDL Testbench
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity tb_main is
end tb_main;

architecture test of tb_main is
    component ${moduleName} is
        Port (
`;
        parser.ports.forEach((p, idx) => {
            const endChar = idx === parser.ports.length - 1 ? "" : ";";
            if (p.width.high > 0) {
                generatedTb += `            ${p.name} : ${p.type === 'input' ? 'in' : 'out'} STD_LOGIC_VECTOR(${p.width.high} downto ${p.width.low})${endChar}\n`;
            } else {
                generatedTb += `            ${p.name} : ${p.type === 'input' ? 'in' : 'out'} STD_LOGIC${endChar}\n`;
            }
        });

        generatedTb += `        );
    end component;

`;
        parser.ports.forEach(p => {
            if (p.width.high > 0) {
                generatedTb += `    signal tb_${p.name} : STD_LOGIC_VECTOR(${p.width.high} downto ${p.width.low}) := (others => '0');\n`;
            } else {
                generatedTb += `    signal tb_${p.name} : STD_LOGIC := '0';\n`;
            }
        });

        generatedTb += `
begin
    uut_inst : ${moduleName}
        port map (
`;
        parser.ports.forEach((p, idx) => {
            const endChar = idx === parser.ports.length - 1 ? "" : ",";
            generatedTb += `            ${p.name} => tb_${p.name}${endChar}\n`;
        });

        generatedTb += `        );

    stim_proc: process
    begin
        wait for 10 ns;
`;
        const inputs = parser.ports.filter(p => p.type === 'input');
        if (inputs.length > 0) {
            inputs.forEach(i => {
                generatedTb += `        tb_${i.name} <= '1';\n`;
            });
            generatedTb += `        wait for 20 ns;\n`;
            inputs.forEach(i => {
                generatedTb += `        tb_${i.name} <= '0';\n`;
            });
            generatedTb += `        wait for 20 ns;\n`;
        }

        generatedTb += `        wait;
    end process;
end test;`;

    } else {
        generatedTb = `// Synthesized Verilog Testbench
module tb_main;
`;
        parser.ports.forEach(p => {
            if (p.type === 'input') {
                if (p.width.high > 0) {
                    generatedTb += `    reg [${p.width.high}:${p.width.low}] ${p.name};\n`;
                } else {
                    generatedTb += `    reg ${p.name};\n`;
                }
            } else {
                if (p.width.high > 0) {
                    generatedTb += `    wire [${p.width.high}:${p.width.low}] ${p.name};\n`;
                } else {
                    generatedTb += `    wire ${p.name};\n`;
                }
            }
        });

        generatedTb += `
    // Instantiate Unit Under Test
    ${moduleName} uut (
`;
        parser.ports.forEach((p, idx) => {
            const endChar = idx === parser.ports.length - 1 ? "" : ",";
            generatedTb += `        .${p.name}(${p.name})${endChar}\n`;
        });

        generatedTb += `    );

    initial begin
`;
        const inputs = parser.ports.filter(p => p.type === 'input');
        inputs.forEach(i => {
            generatedTb += `        ${i.name} = 0;\n`;
        });
        generatedTb += `        #10;\n`;

        if (inputs.length > 0) {
            generatedTb += `        // Test Vector 1\n`;
            inputs.forEach(i => {
                generatedTb += `        ${i.name} = 1;\n`;
            });
            generatedTb += `        #20;\n`;

            generatedTb += `        // Test Vector 2\n`;
            inputs.forEach(i => {
                generatedTb += `        ${i.name} = 0;\n`;
            });
            generatedTb += `        #20;\n`;
        }

        generatedTb += `        $finish;
    end
endmodule`;
    }

    const boxContainer = document.getElementById('tb-result-box');
    const codeBox = document.getElementById('tb-synthesized-code-box');
    if (!boxContainer || !codeBox) return;

    boxContainer.style.display = "flex";
    codeBox.textContent = "";

    let i = 0;
    const timer = setInterval(() => {
        if (i < generatedTb.length) {
            codeBox.textContent += generatedTb.charAt(i++);
            boxContainer.scrollTop = boxContainer.scrollHeight;
        } else {
            clearInterval(timer);
        }
    }, 3);
}

// Target: inject tb textContent
function injectSynthesizedTestbench() {
    const codeBox = document.getElementById('tb-synthesized-code-box');
    const tbArea = document.getElementById('testbench-input');
    if (!codeBox || !tbArea) return;
    
    tbArea.value = codeBox.textContent;
    updateTbLineNumbers();
    
    const resBox = document.getElementById('tb-result-box');
    if (resBox) resBox.style.display = "none";
    
    const termLog = document.getElementById('tb-terminal-log');
    if (termLog) termLog.innerHTML = `<div class="term-line opacity-50">Awaiting testbench prompt...</div>`;
    
    runTbCompilation();
}

function applyNextTestbenchVector() {
    if (!tbReport) {
        runTbCompilation();
    }
    if (!tbReport || tbReport.stimulus.length === 0) {
        return false;
    }
    
    if (clockCycle === 1 || activeTestbenchQueue.length === 0) {
        activeTestbenchQueue = [...tbReport.stimulus];
    }
    
    if (activeTestbenchQueue.length > 0) {
        const nextVector = activeTestbenchQueue.shift();
        const inputPorts = parser.ports.filter(p => p.type === 'input').map(p => p.name);
        
        Object.keys(nextVector.inputs).forEach(name => {
            const matchedPort = inputPorts.find(p => p.toLowerCase() === name.toLowerCase() || p.toLowerCase() === name.replace('tb_', '').toLowerCase());
            if (matchedPort) {
                simState[matchedPort] = nextVector.inputs[name];
                
                const btn = document.querySelector(`.stim-pin[data-pin="${matchedPort}"]`);
                if (btn) {
                    const width = parser.ports.find(p => p.name === matchedPort).width;
                    const bitWidth = width.high - width.low + 1;
                    if (bitWidth > 1) {
                        const inputField = btn.querySelector('input');
                        if (inputField) inputField.value = nextVector.inputs[name];
                    } else {
                        if (nextVector.inputs[name] === 1) {
                            btn.classList.add('active');
                            const pinVal = btn.querySelector('.pin-val');
                            if (pinVal) pinVal.innerText = '1';
                        } else {
                            btn.classList.remove('active');
                            const pinVal = btn.querySelector('.pin-val');
                            if (pinVal) pinVal.innerText = '0';
                        }
                    }
                }
            }
        });
        return true;
    }
    return false;
}

function runTestbenchSimulation() {
    const tbInput = document.getElementById('testbench-input');
    const tbCode = tbInput ? tbInput.value.trim() : "";

    const sourceSelect = document.getElementById('stimulus-source-select');
    const overlay = document.getElementById('stimulus-overlay-cover');

    if (!tbCode) {
        // Fallback: Testbench is empty -> manual inputs mode
        if (sourceSelect) sourceSelect.value = 'manual';
        if (overlay) overlay.style.display = 'none';
        
        resetSimulationEngine();
        
        // Log manual fallback trace message
        if (simLogElement) {
            const line = document.createElement('div');
            line.className = 'term-line glow-green';
            line.innerText = `[i] TESTBENCH NOT PROVIDED. ENTERED MANUAL BOARD MODE.`;
            simLogElement.appendChild(line);
        }

        switchWindow('window-simulator');
        return;
    }

    // Testbench code is present -> compile and run it
    runTbCompilation();
    
    if (tbReport && tbReport.hasErrors) {
        alert("Your testbench compiled with errors. Please resolve syntax defects or clear the editor to run in Manual Board mode.");
        return;
    }

    if (sourceSelect) sourceSelect.value = 'testbench';
    if (overlay) overlay.style.display = 'flex';

    resetSimulationEngine();
    
    if (tbReport && tbReport.stimulus && tbReport.stimulus.length > 0) {
        activeTestbenchQueue = [...tbReport.stimulus];
    }

    switchWindow('window-simulator');
    toggleSimulationRun();
}
