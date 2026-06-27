/**
 * SiliconIDE - HDL Parser, Linter, Auto-Correct and Simulation Engine
 * Supported Languages: Verilog (Interactive simulation), VHDL (Linter), SystemVerilog (Linter)
 */

class HDLParser {
    constructor() {
        this.resetState();
    }

    resetState() {
        this.language = 'verilog'; // default
        this.moduleName = 'unnamed';
        this.ports = []; // { name, type: 'input'|'output', width: {high, low}, isReg: boolean }
        this.registers = []; // { name, width: {high, low} }
        this.wires = []; // { name, width: {high, low} }
        this.assignments = []; // { target, exprStr, func, variables: [] }
        this.sequentialBlock = null; // { trigger: 'clk'|'rst', handler: function }
        this.errors = [];
        this.suggestions = [];
        this.correctedCode = "";
        this.hasErrors = false;
    }

    /**
     * Parse code, perform linting, and compile simulator model
     * @param {string} code 
     * @param {string} language 
     * @returns {object} Diagnostic results
     */
    analyze(code, language = 'verilog') {
        this.resetState();
        this.language = language.toLowerCase();
        
        if (!code || code.trim() === "") {
            this.errors.push({
                line: 1,
                severity: 'warning',
                message: 'Source code is empty.',
                suggestion: 'Enter or paste VHDL/Verilog code to begin analysis.'
            });
            this.hasErrors = true;
            return this.getDiagnosticReport(code);
        }

        // Run lint checks based on selected language
        if (this.language === 'verilog' || this.language === 'sysverilog') {
            this.lintVerilog(code);
        } else if (this.language === 'vhdl') {
            this.lintVHDL(code);
        }

        this.hasErrors = this.errors.some(e => e.severity === 'error');

        // Compile logic simulation model
        if (!this.hasErrors) {
            try {
                if (this.language === 'verilog' || this.language === 'sysverilog') {
                    this.compileVerilog(code);
                } else if (this.language === 'vhdl') {
                    this.compileVHDL(code);
                }
            } catch (err) {
                console.error("Simulation compilation failed:", err);
                this.errors.push({
                    line: 1,
                    severity: 'warning',
                    message: `Simulator compilation failed: ${err.message}`,
                    suggestion: 'Ensure logic assignments are standard combinational expressions.'
                });
            }
        }

        return this.getDiagnosticReport(code);
    }

    getDiagnosticReport(originalCode) {
        return {
            hasErrors: this.hasErrors,
            errors: this.errors,
            suggestions: this.suggestions,
            correctedCode: this.correctedCode || originalCode,
            ports: this.ports,
            moduleName: this.moduleName
        };
    }

    /* ==========================================================================
       LINTER SECTION: VERILOG / SYSTEMVERILOG
       ========================================================================== */
    lintVerilog(code) {
        const lines = code.split('\n');
        let inModule = false;
        let braceStack = [];
        let hasModuleKeyword = false;
        let hasEndmoduleKeyword = false;
        let moduleLineIndex = 0;
        
        this.correctedCode = code;

        // Auto-correct buffers
        let correctedLines = [...lines];

        // Keywords list for checking typo errors
        const keywords = ['module', 'endmodule', 'input', 'output', 'inout', 'reg', 'wire', 'assign', 'always', 'begin', 'end', 'parameter', 'case', 'endcase', 'if', 'else', 'posedge', 'negedge'];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;

            // Skip comment lines
            if (line.startsWith('//') || line.startsWith('/*')) continue;

            // Check typos in words
            const words = line.replace(/[^a-zA-Z0-9_$]/g, ' ').split(/\s+/);
            for (let word of words) {
                if (word === '') continue;
                
                // Common typos
                let typoMapping = {
                    'modul': 'module',
                    'endmodul': 'endmodule',
                    'alwasy': 'always',
                    'begn': 'begin',
                    'assignn': 'assign',
                    'outpt': 'output',
                    'inpt': 'input',
                    'wiree': 'wire',
                    'regg': 'reg'
                };
                if (typoMapping[word]) {
                    this.errors.push({
                        line: lineNum,
                        severity: 'error',
                        message: `Syntax error: Invalid keyword '${word}'. Did you mean '${typoMapping[word]}'?`,
                        suggestion: `Replace '${word}' with '${typoMapping[word]}' to maintain HDL compliance.`
                    });
                    // Queue correction
                    correctedLines[i] = correctedLines[i].replace(new RegExp('\\b' + word + '\\b', 'g'), typoMapping[word]);
                }
            }

            // Monitor module scope
            if (/\bmodule\b/.test(line)) {
                hasModuleKeyword = true;
                inModule = true;
                moduleLineIndex = lineNum;
            }
            if (/\bendmodule\b/.test(line)) {
                hasEndmoduleKeyword = true;
                inModule = false;
            }

            // Semicolon checks for declarations / assignments outside control structures
            if (inModule && line.length > 0) {
                const isControlStructure = /\b(always|begin|end|case|endcase|if|else|initial)\b/.test(line);
                const hasSemicolon = line.endsWith(';') || line.includes(';') || line.endsWith(')') || line.endsWith('end') || line.endsWith(',');
                const isCommentOrBrace = line.startsWith('//') || line === 'begin' || line === 'end' || line === 'endmodule' || line.startsWith('`');
                const isInsideParentheses = braceStack.some(b => b.char === '(');

                if (!isInsideParentheses && !isControlStructure && !hasSemicolon && !isCommentOrBrace) {
                    // Check if it looks like an assign or declaration
                    if (/\b(assign|input|output|reg|wire|parameter)\b/.test(line) || line.includes('=')) {
                        this.errors.push({
                            line: lineNum,
                            severity: 'error',
                            message: `Syntax error: Missing semicolon at the end of declaration.`,
                            suggestion: `Append a semicolon ';' to the end of line ${lineNum}.`
                        });
                        correctedLines[i] = correctedLines[i] + ';';
                    }
                }
            }

            // Monitor block brackets
            for (let char of line) {
                if (char === '(' || char === '{' || char === '[') {
                    braceStack.push({ char, line: lineNum });
                } else if (char === ')' || char === '}' || char === ']') {
                    const last = braceStack.pop();
                    let expected = '';
                    if (char === ')') expected = '(';
                    if (char === '}') expected = '{';
                    if (char === ']') expected = '[';

                    if (!last || last.char !== expected) {
                        this.errors.push({
                            line: lineNum,
                            severity: 'error',
                            message: `Unmatched closing bracket: '${char}' does not match opening brackets.`,
                            suggestion: `Verify nesting order and add corresponding opening bracket '${expected}' if missing.`
                        });
                    }
                }
            }
        }

        // Post-scan validations
        if (hasModuleKeyword && !hasEndmoduleKeyword) {
            this.errors.push({
                line: lines.length,
                severity: 'error',
                message: `Syntactical structural failure: Missing 'endmodule' declaration.`,
                suggestion: `Append 'endmodule' on a new line at the end of the file.`
            });
            correctedLines.push('endmodule');
        }

        if (braceStack.length > 0) {
            const unclosed = braceStack.pop();
            this.errors.push({
                line: unclosed.line,
                severity: 'error',
                message: `Syntax error: Unclosed bracket/parenthesis '${unclosed.char}'.`,
                suggestion: `Close the parenthesis/bracket that was opened on line ${unclosed.line}.`
            });
        }

        this.correctedCode = correctedLines.join('\n');
    }

    /* ==========================================================================
       LINTER SECTION: VHDL (Simulated diagnostics for strict typing/structure)
       ========================================================================== */
    lintVHDL(code) {
        const lines = code.split('\n');
        let correctedLines = [...lines];
        let hasLibrary = false;
        let hasEntity = false;
        let hasArchitecture = false;
        let hasEndEntity = false;
        let hasEndArchitecture = false;
        let entityName = "";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim().toLowerCase();
            const lineNum = i + 1;

            if (line.startsWith('--')) continue;

            if (line.includes('library ieee;')) hasLibrary = true;
            
            const entityMatch = /entity\s+(\w+)\s+is/i.exec(line);
            if (entityMatch) {
                hasEntity = true;
                entityName = entityMatch[1].toLowerCase();
            }
            
            if (line.includes('end ') && (line.includes('entity') || (entityName !== "" && line.includes(entityName)))) {
                hasEndEntity = true;
            }

            if (line.includes('architecture ') && line.includes(' of ')) hasArchitecture = true;
            if (line.includes('end ') && (line.includes('architecture') || line.includes('behavioral') || line.includes('rtl'))) hasEndArchitecture = true;

            // VHDL Semicolon Check
            if (line.length > 0 && !line.startsWith('--') && !line.endsWith('begin') && !line.endsWith('is') && !line.endsWith('then') && !line.endsWith('loop')) {
                // Determine if this is the last element in a port / parameter block before closing parenthesis
                let isLastParameter = false;
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine === "" || nextLine.startsWith('--')) continue;
                    if (nextLine.startsWith(')') || nextLine.startsWith('end') || nextLine.startsWith('port')) {
                        isLastParameter = true;
                    }
                    break;
                }

                // Must end with semicolon
                if (!isLastParameter && !line.endsWith(';') && !line.endsWith('port') && !line.endsWith('(') && !line.endsWith(')') && !line.endsWith('generate') && !line.includes('port (')) {
                    this.errors.push({
                        line: lineNum,
                        severity: 'error',
                        message: `VHDL Syntax Error: Missing terminal semicolon ';'.`,
                        suggestion: `Append a semicolon ';' to satisfy VHDL formatting constraints.`
                    });
                    correctedLines[i] = correctedLines[i] + ';';
                }
            }

            // Typo Checks VHDL
            if (line.includes('entty')) {
                this.errors.push({
                    line: lineNum,
                    severity: 'error',
                    message: `Typo detected: 'entty'. Did you mean 'entity'?`,
                    suggestion: `Correct spelling to 'entity'.`
                });
                correctedLines[i] = correctedLines[i].replace(/entty/gi, 'entity');
            }
            if (line.includes('archtecture')) {
                this.errors.push({
                    line: lineNum,
                    severity: 'error',
                    message: `Typo detected: 'archtecture'. Did you mean 'architecture'?`,
                    suggestion: `Correct spelling to 'architecture'.`
                });
                correctedLines[i] = correctedLines[i].replace(/archtecture/gi, 'architecture');
            }
        }

        if (hasEntity && !hasEndEntity) {
            this.errors.push({
                line: lines.length,
                severity: 'warning',
                message: `Structural warning: Entity may be unclosed.`,
                suggestion: `Ensure 'end entity;' or 'end <entity_name>;' completes your entity block.`
            });
        }

        if (hasArchitecture && !hasEndArchitecture) {
            this.errors.push({
                line: lines.length,
                severity: 'error',
                message: `Structural Error: Architecture scope unclosed.`,
                suggestion: `Append 'end behavioral;' or 'end rtl;' to match declaration.`
            });
            correctedLines.push('end behavioral;');
        }

        this.correctedCode = correctedLines.join('\n');
    }

    /* ==========================================================================
       SIMULATION COMPILER SECTION (Verilog Parser & JS Code compiler)
       ========================================================================== */
    compileVerilog(code) {
        // Strip comments first to avoid regex issues
        const cleanCode = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

        // 1. Extract Module Name
        const moduleMatch = /module\s+(\w+)/.exec(cleanCode);
        if (moduleMatch) {
            this.moduleName = moduleMatch[1];
        }

        // 2. Parse Input Ports
        // Matches: input a, b, c;  or  input [3:0] q; or input wire r;
        const inputRegex = /input\s+(?:wire|reg|logic|bit)?\s*(?:\[\s*(\d+)\s*:\s*(\d+)\s*\])?\s*([^;\n\)]+)/g;
        let match;
        while ((match = inputRegex.exec(cleanCode)) !== null) {
            const high = match[1] ? parseInt(match[1]) : 0;
            const low = match[2] ? parseInt(match[2]) : 0;
            const names = match[3].split(',').map(n => n.trim()).filter(n => n !== "");
            for (let name of names) {
                this.ports.push({
                    name,
                    type: 'input',
                    width: { high, low },
                    isReg: false
                });
            }
        }

        // 3. Parse Output Ports
        // Matches: output a; or output reg [3:0] q; or output wire z;
        const outputRegex = /output\s+(reg|wire|logic|bit)?\s*(?:\[\s*(\d+)\s*:\s*(\d+)\s*\])?\s*([^;\n\)]+)/g;
        while ((match = outputRegex.exec(cleanCode)) !== null) {
            const isReg = match[1] === 'reg' || match[1] === 'logic' || match[1] === 'bit';
            const high = match[2] ? parseInt(match[2]) : 0;
            const low = match[3] ? parseInt(match[3]) : 0;
            const names = match[4].split(',').map(n => n.trim()).filter(n => n !== "");
            for (let name of names) {
                this.ports.push({
                    name,
                    type: 'output',
                    width: { high, low },
                    isReg
                });
                if (isReg) {
                    this.registers.push({ name, width: { high, low } });
                } else {
                    this.wires.push({ name, width: { high, low } });
                }
            }
        }

        // 4. Parse internal registers and wires
        const regRegex = /(?:reg|logic|bit)\s+(?:\[\s*(\d+)\s*:\s*(\d+)\s*\])?\s*([^;\n]+)/g;
        while ((match = regRegex.exec(cleanCode)) !== null) {
            const high = match[1] ? parseInt(match[1]) : 0;
            const low = match[2] ? parseInt(match[2]) : 0;
            const names = match[3].split(',').map(n => n.trim()).filter(n => n !== "");
            for (let name of names) {
                // Ensure not already added via ports
                if (!this.registers.some(r => r.name === name)) {
                    this.registers.push({ name, width: { high, low } });
                }
            }
        }

        const wireRegex = /wire\s+(?:\[\s*(\d+)\s*:\s*(\d+)\s*\])?\s*([^;\n]+)/g;
        while ((match = wireRegex.exec(cleanCode)) !== null) {
            const high = match[1] ? parseInt(match[1]) : 0;
            const low = match[2] ? parseInt(match[2]) : 0;
            const names = match[3].split(',').map(n => n.trim()).filter(n => n !== "");
            for (let name of names) {
                if (!this.wires.some(w => w.name === name) && !this.ports.some(p => p.name === name && p.type === 'output')) {
                    this.wires.push({ name, width: { high, low } });
                }
            }
        }

        // 5. Parse continuous assignments
        // Matches: assign out = a & b; or assign sum = a ^ b ^ c;
        const assignRegex = /assign\s+(\w+)(?:\s*\[\s*\d+\s*\])?\s*=\s*([^;]+);/g;
        while ((match = assignRegex.exec(cleanCode)) !== null) {
            const target = match[1].trim();
            const exprStr = match[2].trim();
            
            // Build evaluation function
            const compiled = this.compileExpression(exprStr);
            this.assignments.push({
                target,
                exprStr,
                func: compiled.func,
                variables: compiled.variables
            });
        }

        // 6. Parse gate-level primitives (AND, OR, XOR, NOT, NAND, NOR, XNOR)
        // Matches: and gate1 (out, a, b); or xor (sum, a, b);
        const primitiveRegex = /\b(and|or|xor|not|nand|nor|xnor)\b\s*(?:\w+)?\s*\(([^)]+)\);/g;
        while ((match = primitiveRegex.exec(cleanCode)) !== null) {
            const gateType = match[1];
            const args = match[2].split(',').map(a => a.trim()).filter(a => a !== "");
            const target = args[0]; // first argument is output
            const inputs = args.slice(1);

            let exprStr = "";
            if (gateType === 'not') {
                exprStr = `~${inputs[0]}`;
            } else {
                const opMap = {
                    and: '&',
                    or: '|',
                    xor: '^',
                    nand: '&',
                    nor: '|',
                    xnor: '^'
                };
                const op = opMap[gateType];
                exprStr = inputs.join(` ${op} `);
                if (gateType === 'nand' || gateType === 'nor' || gateType === 'xnor') {
                    exprStr = `~(${exprStr})`;
                }
            }

            const compiled = this.compileExpression(exprStr);
            this.assignments.push({
                target,
                exprStr: `${gateType}(${inputs.join(',')})`,
                func: compiled.func,
                variables: compiled.variables
            });
        }

        // 7. Parse sequential clocked processes (always blocks)
        // Matches: always @(posedge clk) begin ... end  or  always @(posedge clk or posedge rst)
        // Let's support:
        // - D Flip-Flop: always @(posedge clk) q <= d;
        // - Counter: always @(posedge clk) if (rst) count <= 0; else count <= count + 1;
        // - Shift Register: always @(posedge clk) if (rst) r <= 0; else r <= {r[2:0], sin};
        const alwaysRegex = /(?:always|always_ff)\s*@\s*\(\s*(posedge|negedge)\s+(\w+)(?:\s+or\s+(posedge|negedge)\s+(\w+))?\s*\)\s*([\s\S]+?)(?=always|endmodule|$)/g;
        const alwaysMatch = alwaysRegex.exec(cleanCode);
        if (alwaysMatch) {
            const triggerEdge = alwaysMatch[1]; // posedge
            const clkSignal = alwaysMatch[2]; // clk
            const hasRstTrigger = alwaysMatch[3] !== undefined;
            const rstSignal = alwaysMatch[4]; // rst
            const blockBody = alwaysMatch[5].trim();

            this.sequentialBlock = {
                clk: clkSignal,
                rst: rstSignal,
                edge: triggerEdge,
                bodyText: blockBody,
                handler: this.compileSequentialBlock(blockBody, rstSignal)
            };
        }
    }

    /**
     * Translates a Verilog algebraic/logic expression into a JS function
     * Supports:
     * - operators: &, |, ^, ~, !, &&, ||, +, -
     * - bit slicing: count[0], data[3:0]
     */
    compileExpression(exprStr) {
        let jsExpr = exprStr;

        // Replace bitwise slices like a[3:0] -> ((a >> 0) & 15)
        // We look for variables followed by brackets e.g. count[3:0]
        jsExpr = jsExpr.replace(/(\w+)\[\s*(\d+)\s*:\s*(\d+)\s*\]/g, (m, name, hi, lo) => {
            const high = parseInt(hi);
            const low = parseInt(lo);
            const mask = (1 << (high - low + 1)) - 1;
            return `((state.${name} >> ${low}) & ${mask})`;
        });

        // Replace single bit selections like a[1] -> ((a >> 1) & 1)
        jsExpr = jsExpr.replace(/(\w+)\[\s*(\d+)\s*\]/g, (m, name, idx) => {
            return `((state.${name} >> ${idx}) & 1)`;
        });

        // Verilog bitwise invert ~ to JS bitwise invert ~
        // Logical negation ! to JS !
        // In JS we need to enforce bit width boundaries for bitwise inversion!
        // For simplicity, if we have ~expr, we compile it and apply logic masks later.
        
        // Find variables referenced in the expression
        const variables = [];
        const words = exprStr.replace(/[^a-zA-Z0-9_$]/g, ' ').split(/\s+/);
        const allKnown = [...this.ports.map(p=>p.name), ...this.registers.map(r=>r.name), ...this.wires.map(w=>w.name)];
        
        for (let w of words) {
            if (allKnown.includes(w) && !variables.includes(w)) {
                variables.push(w);
            }
        }

        // Prepend "state." to variables in the expression (using boundary check to avoid replacing subwords)
        for (let v of allKnown) {
            jsExpr = jsExpr.replace(new RegExp('\\b' + v + '\\b', 'g'), `state.${v}`);
        }

        // Clean operators (Verilog already matches JS closely: &, |, ^, ~, &&, ||, +, -)
        // Replace single ~ with JS ~ but apply a mask if it results in negative number, e.g. (~val & 1)
        // For simplicity, we wrap evaluated results in a mask inside the simulator cycle execution.

        let compiledFn;
        try {
            compiledFn = new Function('state', `try { return (${jsExpr}) | 0; } catch(e) { return 0; }`);
        } catch (e) {
            console.error("Expression compilation syntax error:", jsExpr, e);
            compiledFn = () => 0;
        }

        return {
            exprStr,
            func: compiledFn,
            variables
        };
    }

    /**
     * Compiles always block code into JS state mutations
     */
    compileSequentialBlock(bodyText, rstSignal) {
        // Simple AST parsing for common patterns:
        // Pattern 1: if (rst) count <= 0; else count <= count + 1;
        // Pattern 2: q <= d;
        // Let's parse assignments target <= value;
        // We use non-blocking assignment syntax <=
        // We compile assignments to updates in a temporary buffer (nextState) to prevent race conditions.
        
        const lines = bodyText.replace(/begin|end/g, '').split(';');
        const assignments = [];

        for (let line of lines) {
            const clean = line.trim();
            if (clean === "") continue;

            // Check if it is an if-else reset structure
            // e.g. if (rst) q <= 0; else q <= d;
            const ifRstRegex = /if\s*\(\s*(\w+)\s*\)\s*(\w+)\s*<=\s*([^;]+)(?:\s*;\s*else\s+(\w+)\s*<=\s*([^;]+))?/;
            const ifRstMatch = ifRstRegex.exec(clean);
            if (ifRstMatch) {
                const target = ifRstMatch[2];
                const resetValStr = ifRstMatch[3];
                const elseTarget = ifRstMatch[4] || target;
                const activeValStr = ifRstMatch[5] || resetValStr;

                assignments.push({
                    type: 'conditional',
                    rstPin: ifRstMatch[1],
                    target,
                    resetVal: this.compileExpression(resetValStr).func,
                    elseTarget,
                    activeVal: this.compileExpression(activeValStr).func
                });
                continue;
            }

            // Normal assignment: target <= expr
            const assMatch = /(\w+)\s*<=\s*([^;]+)/.exec(clean);
            if (assMatch) {
                const target = assMatch[1].trim();
                const expr = assMatch[2].trim();
                assignments.push({
                    type: 'direct',
                    target,
                    valFunc: this.compileExpression(expr).func
                });
            }
        }

        // Return a handler that updates nextState
        return (state, nextState) => {
            for (let ass of assignments) {
                if (ass.type === 'conditional') {
                    const isRst = state[ass.rstPin] === 1;
                    if (isRst) {
                        nextState[ass.target] = ass.resetVal(state);
                    } else {
                        nextState[ass.elseTarget] = ass.activeVal(state);
                    }
                } else if (ass.type === 'direct') {
                    nextState[ass.target] = ass.valFunc(state);
                }
            }
        };
    }

    compileVHDL(code) {
        // Strip comments first
        const cleanCode = code.replace(/--.*$/gm, '');

        // 1. Extract Entity Name
        const entityMatch = /entity\s+(\w+)\s+is/i.exec(cleanCode);
        if (entityMatch) {
            this.moduleName = entityMatch[1];
        }

        // 2. Parse Port block
        const portBlockMatch = /port\s*\(([\s\S]*?)\)\s*;/i.exec(cleanCode);
        if (portBlockMatch) {
            const portContent = portBlockMatch[1];
            const portLines = portContent.split(';');
            for (let pl of portLines) {
                const trimmed = pl.trim();
                if (trimmed === "") continue;
                
                const portRegex = /^([\w\s,]+)\s*:\s*(in|out)\s+(\w+)(?:\s*\(\s*(\d+)\s+(?:downto|to)\s+(\d+)\s*\))?/i;
                const match = portRegex.exec(trimmed);
                if (match) {
                    const names = match[1].split(',').map(n => n.trim()).filter(n => n !== "");
                    const direction = match[2].toLowerCase();
                    const high = match[4] ? parseInt(match[4]) : 0;
                    const low = match[5] ? parseInt(match[5]) : 0;
                    
                    for (let name of names) {
                        this.ports.push({
                            name,
                            type: direction === 'in' ? 'input' : 'output',
                            width: { high, low },
                            isReg: false
                        });
                        if (direction === 'out') {
                            this.wires.push({ name, width: { high, low } });
                        }
                    }
                }
            }
        }

        // 3. Parse internal signals
        const signalRegex = /signal\s+([\w\s,]+)\s*:\s*(\w+)(?:\s*\(\s*(\d+)\s+(?:downto|to)\s+(\d+)\s*\))?\s*(?::=\s*[^;]+)?;/gi;
        let sigMatch;
        while ((sigMatch = signalRegex.exec(cleanCode)) !== null) {
            const names = sigMatch[1].split(',').map(n => n.trim()).filter(n => n !== "");
            const high = sigMatch[3] ? parseInt(sigMatch[3]) : 0;
            const low = sigMatch[4] ? parseInt(sigMatch[4]) : 0;
            for (let name of names) {
                this.wires.push({ name, width: { high, low } });
            }
        }

        // 4. Parse concurrent signal assignments
        const assignRegex = /(\w+)\s*<=\s*([^;]+);/g;
        let assMatch;
        while ((assMatch = assignRegex.exec(cleanCode)) !== null) {
            const target = assMatch[1].trim();
            let exprStr = assMatch[2].trim();
            
            let cleanExpr = exprStr
                .replace(/\bxor\b/gi, '^')
                .replace(/\bor\b/gi, '|')
                .replace(/\band\b/gi, '&')
                .replace(/\bnot\b/gi, '~');
                
            const compiled = this.compileExpression(cleanExpr);
            this.assignments.push({
                target,
                exprStr,
                func: compiled.func,
                variables: compiled.variables
            });
        }
    }

    /**
     * Initializes a fresh simulator state object
     */
    createSimulatorState() {
        const state = {};
        
        // Setup inputs (default 0)
        for (let p of this.ports) {
            state[p.name] = 0;
        }
        
        // Setup registers (default 0)
        for (let r of this.registers) {
            state[r.name] = 0;
        }

        // Setup wires (default 0)
        for (let w of this.wires) {
            state[w.name] = 0;
        }

        return state;
    }

    /**
     * Runs one simulation step: evaluates combinational and triggers sequential logic
     * @param {object} state Current states
     * @param {boolean} clkPosedge Clock transitioned 0 -> 1
     * @returns {object} Next states
     */
    stepSimulation(state, clkPosedge = false) {
        const nextState = { ...state };

        // 1. If clock ticks, evaluate registers
        if (clkPosedge && this.sequentialBlock && this.sequentialBlock.handler) {
            this.sequentialBlock.handler(state, nextState);
        }

        // Apply bit width limits for registers
        for (let r of this.registers) {
            const width = r.width.high - r.width.low + 1;
            const mask = (1 << width) - 1;
            nextState[r.name] = nextState[r.name] & mask;
        }

        // 2. Solve combinational statements iteratively (delta-cycle loop)
        // Run max 20 iterations to let signals propagate.
        let stable = false;
        let iterations = 0;

        while (!stable && iterations < 20) {
            stable = true;
            iterations++;

            for (let ass of this.assignments) {
                const prevVal = nextState[ass.target];
                const newVal = ass.func(nextState);
                
                // Enforce width bounds on wire assignments
                let width = 1;
                const wireObj = this.wires.find(w => w.name === ass.target) || this.ports.find(p => p.name === ass.target && p.type === 'output');
                if (wireObj) {
                    width = wireObj.width.high - wireObj.width.low + 1;
                }
                const mask = (1 << width) - 1;
                const maskedVal = newVal & mask;

                if (prevVal !== maskedVal) {
                    nextState[ass.target] = maskedVal;
                    stable = false; // logic changed, run another delta cycle
                }
            }
        }

        return nextState;
    }
}

// Global export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HDLParser;
} else {
    window.HDLParser = HDLParser;
}
