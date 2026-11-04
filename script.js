'use strict';

(function (root) {
  var MAX_DIGITS = 15;
  var SYMBOLS = { '+': '+', '-': '\u2212', '*': '\u00D7', '/': '\u00F7' };

  // Remove floating-point noise (0.1 + 0.2 -> 0.3).
  function clean(n) {
    return Number(n.toPrecision(12));
  }

  function format(n) {
    if (Object.is(n, -0)) { n = 0; }
    var abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) {
      return n.toExponential(6).replace(/\.?0+e/, 'e');
    }
    return String(n);
  }

  // Pure arithmetic. Returns null for anything that is not a finite number.
  function compute(a, op, b) {
    var r;
    switch (op) {
      case '+': r = a + b; break;
      case '-': r = a - b; break;
      case '*': r = a * b; break;
      case '/':
        if (b === 0) { return null; }
        r = a / b;
        break;
      default: return null;
    }
    return isFinite(r) ? clean(r) : null;
  }

  function digitCount(s) {
    return s.replace(/[^0-9]/g, '').length;
  }

  function Calculator() {
    this.reset();
  }

  Calculator.prototype.reset = function () {
    this.current = '0';
    this.prev = null;
    this.op = null;
    this.overwrite = false; // next digit replaces the display
    this.ready = false;     // an operand has been entered for the pending operator
    this.error = false;
    this.lastOp = null;
    this.lastOperand = null;
    this.expr = '';
  };

  Calculator.prototype.fail = function (op, b) {
    this.reset();
    this.current = (op === '/' && b === 0) ? 'Cannot divide by zero' : 'Error';
    this.error = true;
  };

  Calculator.prototype.digit = function (d) {
    if (!/^[0-9]$/.test(d)) { return; }
    if (this.error) { this.reset(); }
    if (this.overwrite) {
      this.current = d;
      this.overwrite = false;
      if (this.op === null) { this.expr = ''; }
    } else if (this.current === '0') {
      this.current = d;
    } else if (digitCount(this.current) < MAX_DIGITS) {
      this.current += d;
    }
    this.ready = true;
  };

  Calculator.prototype.decimal = function () {
    if (this.error) { this.reset(); }
    if (this.overwrite) {
      this.current = '0.';
      this.overwrite = false;
      if (this.op === null) { this.expr = ''; }
    } else if (this.current.indexOf('.') === -1) {
      this.current += '.';
    }
    this.ready = true;
  };

  Calculator.prototype.operator = function (op) {
    if (!Object.prototype.hasOwnProperty.call(SYMBOLS, op)) { return; }
    if (this.error) { return; }
    if (this.op !== null && this.ready) {
      var b = parseFloat(this.current);
      var r = compute(this.prev, this.op, b);
      if (r === null) { this.fail(this.op, b); return; }
      this.prev = r;
      this.current = format(r);
    } else if (this.op === null) {
      this.prev = parseFloat(this.current);
    }
    this.op = op;
    this.overwrite = true;
    this.ready = false;
    this.lastOp = null;
    this.expr = format(this.prev) + ' ' + SYMBOLS[op];
  };

  Calculator.prototype.equals = function () {
    if (this.error) { return; }
    var a, op, b;
    if (this.op !== null) {
      a = this.prev;
      op = this.op;
      b = parseFloat(this.current);
    } else if (this.lastOp !== null) {
      a = parseFloat(this.current);
      op = this.lastOp;
      b = this.lastOperand;
    } else {
      return;
    }
    var r = compute(a, op, b);
    if (r === null) { this.fail(op, b); return; }
    this.expr = format(a) + ' ' + SYMBOLS[op] + ' ' + format(b) + ' =';
    this.lastOp = op;
    this.lastOperand = b;
    this.current = format(r);
    this.prev = null;
    this.op = null;
    this.overwrite = true;
    this.ready = false;
  };

  Calculator.prototype.percent = function () {
    if (this.error) { return; }
    var cur = parseFloat(this.current);
    var v;
    if (this.prev !== null && (this.op === '+' || this.op === '-')) {
      v = clean(this.prev * cur / 100);   // 200 + 10%  ->  200 + 20
    } else {
      v = clean(cur / 100);
    }
    this.current = format(v);
    this.overwrite = true;
    this.ready = true;
  };

  Calculator.prototype.negate = function () {
    if (this.error || this.current === '0') { return; }
    this.current = this.current.charAt(0) === '-' ? this.current.slice(1) : '-' + this.current;
    if (this.op !== null) { this.ready = true; }
  };

  Calculator.prototype.backspace = function () {
    if (this.error) { this.reset(); return; }
    if (this.overwrite) { return; }
    this.current = this.current.slice(0, -1);
    if (this.current === '' || this.current === '-' || this.current === '-0') {
      this.current = '0';
    }
  };

  Calculator.prototype.clear = function () {
    this.reset();
  };

  // ---- Browser wiring (uses textContent only, never innerHTML) ----
  function init() {
    var calc = new Calculator();
    var display = document.getElementById('display');
    var expression = document.getElementById('expression');
    var keys = document.getElementById('keys');

    function render() {
      display.textContent = calc.current;
      expression.textContent = calc.expr;
      var len = calc.current.length;
      display.className = 'display' +
        (calc.error ? ' error' : len > 13 ? ' xsmall' : len > 10 ? ' small' : '');
    }

    function run(action, value) {
      switch (action) {
        case 'digit':     calc.digit(value); break;
        case 'decimal':   calc.decimal(); break;
        case 'operator':  calc.operator(value); break;
        case 'equals':    calc.equals(); break;
        case 'clear':     calc.clear(); break;
        case 'backspace': calc.backspace(); break;
        case 'negate':    calc.negate(); break;
        case 'percent':   calc.percent(); break;
        default: return;
      }
      render();
    }

    keys.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-action]') : null;
      if (!btn || !keys.contains(btn)) { return; }
      run(btn.getAttribute('data-action'), btn.getAttribute('data-value'));
    });

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) { return; }
      var k = e.key;
      var handled = true;
      if (k >= '0' && k <= '9' && k.length === 1) { run('digit', k); }
      else if (k === '.' || k === ',')            { run('decimal'); }
      else if (k === '+' || k === '-' || k === '*' || k === '/') { run('operator', k); }
      else if (k === 'x' || k === 'X')            { run('operator', '*'); }
      else if (k === 'Enter' || k === '=')        { run('equals'); }
      else if (k === 'Backspace')                 { run('backspace'); }
      else if (k === 'Escape' || k === 'c' || k === 'C') { run('clear'); }
      else if (k === '%')                         { run('percent'); }
      else { handled = false; }
      if (handled) { e.preventDefault(); }
    });

    render();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Calculator: Calculator, compute: compute, format: format };
  }
})(this);
