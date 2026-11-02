
/* ==================================
   IY CALCULATOR - BY JARRY
   Scientific Calculator Engine
================================== */

const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const displayMode = document.getElementById("displayMode");

const scientificKeys = document.getElementById("scientificKeys");
const modeButtons = document.querySelectorAll(".mode-btn");

const historyToggle = document.getElementById("historyToggle");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const clearHistoryButton = document.getElementById("clearHistory");

let expression = "";
let currentMode = "basic";
let justCalculated = false;

let history = [];

try {
    history = JSON.parse(
        localStorage.getItem("iyCalculatorHistory") || "[]"
    );

    if (!Array.isArray(history)) history = [];
} catch {
    history = [];
}

// DISPLAY

function updateDisplay() {
    expressionDisplay.textContent = expression || "0";

    if (!expression) {
        resultDisplay.textContent = "0";
        return;
    }

    try {
        const answer = evaluateExpression(expression);

        resultDisplay.textContent = formatNumber(answer);
    } catch {
        resultDisplay.textContent = " ";
    }
}

function formatNumber(number) {
    if (!Number.isFinite(number)) {
        return "Error";
    }

    if (Object.is(number, -0)) number = 0;

    return Number(number.toPrecision(12)).toString();
}

// TOKENIZER

function tokenize(input) {
    const tokens = [];
    const regex = /\s*([0-9]+(?:\.[0-9]*)?|\.[0-9]+|[a-zA-Z]+|[+\-*/^()%!])/gy;

    let position = 0;

    while (position < input.length) {
        regex.lastIndex = position;

        const match = regex.exec(input);

        if (!match) {
            throw new Error("Invalid expression");
        }

        tokens.push(match[1]);
        position = regex.lastIndex;
    }

    // Handle implicit multiplication: 2pi, 2(3), 2sin(30)

    const expanded = [];

    for (let i = 0; i < tokens.length; i++) {
        const current = tokens[i];
        const previous = expanded[expanded.length - 1];

        const previousIsValue =
            previous !== undefined &&
            (
                !isNaN(Number(previous)) ||
                ["pi", "e", ")", "!", "%"].includes(previous)
            );

        const currentStartsValue =
            !isNaN(Number(current)) ||
            ["pi", "e", "("].includes(current) ||
            /^[a-zA-Z]+$/.test(current) && !["e", "pi"].includes(current);

        if (previousIsValue && currentStartsValue) {
            expanded.push("*");
        }

        expanded.push(current);
    }

    return expanded;
}

// MATHEMATICAL PARSER

function evaluateExpression(input) {
    const tokens = tokenize(input);

    let index = 0;

    function peek() {
        return tokens[index];
    }

    function consume() {
        return tokens[index++];
    }

    function parseExpression() {
        let value = parseTerm();

        while (peek() === "+" || peek() === "-") {
            const operator = consume();
            const right = parseTerm();

            value = operator === "+"
                ? value + right
                : value - right;
        }

        return value;
    }

    function parseTerm() {
        let value = parseUnary();

        while (peek() === "*" || peek() === "/") {
            const operator = consume();
            const right = parseUnary();

            if (operator === "/" && right === 0) {
                throw new Error("Division by zero");
            }

            value = operator === "*"
                ? value * right
                : value / right;
        }

        return value;
    }

    function parseUnary() {
        if (peek() === "+") {
            consume();
            return parseUnary();
        }

        if (peek() === "-") {
            consume();
            return -parseUnary();
        }

        return parsePower();
    }

    function parsePower() {
        let value = parsePostfix();

        if (peek() === "^") {
            consume();
            value = Math.pow(value, parseUnary());
        }

        return value;
    }

    function parsePostfix() {
        let value = parsePrimary();

        while (peek() === "!" || peek() === "%") {
            const operator = consume();

            if (operator === "!") {
                if (
                    value < 0 ||
                    !Number.isInteger(value) ||
                    value > 170
                ) {
                    throw new Error("Invalid factorial");
                }

                let factorial = 1;

                for (let i = 2; i <= value; i++) {
                    factorial *= i;
                }

                value = factorial;
            }

            if (operator === "%") {
                value = value / 100;
            }
        }

        return value;
    }

    function parsePrimary() {
        const token = consume();

        if (token === undefined) {
            throw new Error("Incomplete expression");
        }

        if (token === "(") {
            const value = parseExpression();

            if (consume() !== ")") {
                throw new Error("Missing bracket");
            }

            return value;
        }

        if (!isNaN(Number(token)) && token !== "") {
            return Number(token);
        }

        if (token === "pi") return Math.PI;
        if (token === "e") return Math.E;

        const functions = [
            "sin", "cos", "tan",
            "log", "ln", "sqrt",
            "square", "inv",
            "factorial"
        ];

        if (functions.includes(token)) {
            if (consume() !== "(") {
                throw new Error("Function needs brackets");
            }

            const value = parseExpression();

            if (consume() !== ")") {
                throw new Error("Missing bracket");
            }

            switch (token) {
                case "sin":
                    return Math.sin(value * Math.PI / 180);

                case "cos":
                    return Math.cos(value * Math.PI / 180);

                case "tan":
                    return Math.tan(value * Math.PI / 180);

                case "log":
                    if (value <= 0) throw new Error("Invalid log");
                    return Math.log10(value);

                case "ln":
                    if (value <= 0) throw new Error("Invalid ln");
                    return Math.log(value);

                case "sqrt":
                    if (value < 0) throw new Error("Invalid root");
                    return Math.sqrt(value);

                case "square":
                    return value * value;

                case "inv":
                    if (value === 0) throw new Error("Cannot divide by zero");
                    return 1 / value;

                case "factorial":
                    if (
                        value < 0 ||
                        !Number.isInteger(value) ||
                        value > 170
                    ) {
                        throw new Error("Invalid factorial");
                    }

                    let answer = 1;

                    for (let i = 2; i <= value; i++) {
                        answer *= i;
                    }

                    return answer;
            }
        }

        throw new Error("Invalid input");
    }

    const answer = parseExpression();

    if (index !== tokens.length) {
        throw new Error("Invalid expression");
    }

    if (!Number.isFinite(answer)) {
        throw new Error("Math error");
    }

    return answer;
}

// INPUT HANDLING

function addInput(value, type) {

    if (justCalculated) {
        if (
            type === "operator" ||
            type === "function" && value === "power" ||
            type === "bracket" && value === ")"
        ) {
            justCalculated = false;
        } else {
            expression = "";
            justCalculated = false;
        }
    }

    if (type === "number") {
        expression += value;
    }

    else if (type === "decimal") {
        const lastPart = expression.split(/[+\-*/^()%()]/).pop();

        if (!lastPart.includes(".")) {
            expression += lastPart === "" ? "0." : ".";
        }
    }

    else if (type === "operator") {
        if (!expression && value !== "-") return;

        if (/[+\-*/^]$/.test(expression)) {
            expression = expression.slice(0, -1);
        }

        expression += value;
    }

    else if (type === "bracket") {
        if (value === "(" && expression.endsWith(")")) {
            expression += "*";
        }

        expression += value;
    }

    else if (type === "constant") {
        expression += value;

    }

    else if (type === "function") {
        const functions = {
            sin: "sin(",
            cos: "cos(",
            tan: "tan(",
            log: "log(",
            ln: "ln(",
            sqrt: "sqrt(",
            square: "square(",
            power: "^",
            factorial: "factorial(",
            inverse: "inv(",
            percent: "%"
        };

        expression += functions[value];
    }

    updateDisplay();
}

// CLEAR AND DELETE

function clearCalculator() {
    expression = "";
    justCalculated = false;
    updateDisplay();
}

function deleteLast() {
    if (justCalculated) {
        clearCalculator();
        return;
    }

    expression = expression.slice(0, -1);
    updateDisplay();
}

// SIGN CHANGE

function toggleSign() {
    if (!expression) {
        expression = "-";
    } else if (expression.startsWith("-(") && expression.endsWith(")")) {
        expression = expression.slice(2, -1);
    } else {
        expression = "-(" + expression + ")";
    }

    justCalculated = false;
    updateDisplay();
}

// CALCULATE

function calculate() {
    if (!expression) return;

    try {
        const original = expression;
        const answer = evaluateExpression(expression);

        const formatted = formatNumber(answer);

        saveHistory(original, formatted);

        expression = formatted;
        justCalculated = true;

        expressionDisplay.textContent = original + " =";
        resultDisplay.textContent = formatted;

    } catch (error) {
        resultDisplay.textContent = "Error";
    }
}

// HISTORY

function saveHistory(original, answer) {
    history.unshift({
        expression: original,
        result: answer
    });

    history = history.slice(0, 50);

    localStorage.setItem(
        "iyCalculatorHistory",
        JSON.stringify(history)
    );

    renderHistory();
}

function renderHistory() {
    if (!history.length) {
        historyList.innerHTML =
            '<p class="empty-history">No calculations yet.</p>';
        return;
    }

    historyList.innerHTML = history.map((item, index) => `
        <div class="history-item" data-history-index="${index}">
            <div class="history-expression">${escapeHTML(item.expression)}</div>
            <div class="history-result">${escapeHTML(item.result)}</div>
        </div>
    `).join("");
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

historyList.addEventListener("click", event => {
    const item = event.target.closest("[data-history-index]");

    if (!item) return;

    const selected = history[Number(item.dataset.historyIndex)];

    if (selected) {
        expression = selected.result;
        justCalculated = true;
        updateDisplay();
        historyPanel.classList.remove("show");
    }
});

clearHistoryButton.addEventListener("click", () => {
    history = [];

    localStorage.removeItem("iyCalculatorHistory");

    renderHistory();
});

// MODE SWITCHING

modeButtons.forEach(button => {
    button.addEventListener("click", () => {
        currentMode = button.dataset.mode;

        modeButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        if (currentMode === "scientific") {
            scientificKeys.classList.add("show");
            displayMode.textContent = "SCIENTIFIC MODE";
        } else {
            scientificKeys.classList.remove("show");
            displayMode.textContent = "BASIC MODE";
        }
    });
});

// BUTTON EVENTS

document.querySelector(".calculator-keys")
    .addEventListener("click", event => {

        const button = event.target.closest("button");

        if (!button) return;

        const action = button.dataset.action;
        const value = button.dataset.value;

        if (action === "clear") clearCalculator();
        else if (action === "delete") deleteLast();
        else if (action === "sign") toggleSign();
        else if (action === "calculate") calculate();
        else addInput(value, action);
    });

scientificKeys.addEventListener("click", event => {
    const button = event.target.closest("button");

    if (!button) return;

    addInput(button.dataset.value, button.dataset.action);
});

// HISTORY PANEL

historyToggle.addEventListener("click", () => {
    historyPanel.classList.toggle("show");
});

// KEYBOARD SUPPORT

document.addEventListener("keydown", event => {
    const key = event.key;

    if (/^[0-9]$/.test(key)) {
        addInput(key, "number");
    }

    else if (["+", "-", "*", "/", "^"].includes(key)) {
        addInput(key, "operator");
    }

    else if (key === ".") {
        addInput(".", "decimal");
    }

    else if (key === "Enter" || key === "=") {
        event.preventDefault();
        calculate();
    }

    else if (key === "Backspace") {
        deleteLast();
    }

    else if (key === "Escape") {
        clearCalculator();
    }

    else if (key === "(" || key === ")") {
        addInput(key, "bracket");
    }

    else if (key === "%") {
        addInput("%", "function");
    }
});

// INITIALIZE

renderHistory();
updateDisplay();

console.log("IY Calculator initialized successfully.");

