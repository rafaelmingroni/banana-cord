const fs = require('fs');
const path = require('path');
const vm = require('vm');

class ClassList {
  constructor(values = []) { this.set = new Set(values); }
  add(v) { this.set.add(v); }
  remove(v) { this.set.delete(v); }
  contains(v) { return this.set.has(v); }
  toggle(v, force) {
    if (force === undefined) {
      if (this.set.has(v)) this.set.delete(v); else this.set.add(v);
      return this.set.has(v);
    }
    if (force) this.set.add(v); else this.set.delete(v);
    return force;
  }
}

class Element {
  constructor(id, dataset = {}, classes = []) {
    this.id = id;
    this.dataset = dataset;
    this.classList = new ClassList(classes);
    this.hidden = false;
    this.type = '';
    this.textContent = '';
    this.attrs = {};
    this.style = { values: {}, setProperty: (k, v, p) => { this.style.values[k] = { value: v, priority: p }; } };
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  closest(selector) { return selector === '[data-cloud-tab]' && this.dataset.cloudTab ? this : null; }
}

const login = new Element('cloudLoginForm', {}, ['cloud-form']);
const register = new Element('cloudRegisterForm', {}, ['cloud-form', 'hidden']);
const error = new Element('cloudAuthError', {}, ['cloud-error', 'hidden']);
const loginTab = new Element('loginTab', { cloudTab: 'login' }, ['active']);
const registerTab = new Element('registerTab', { cloudTab: 'register' });
const byId = new Map([[login.id, login], [register.id, register], [error.id, error]]);
let clickHandler;

const document = {
  getElementById: id => byId.get(id) || null,
  querySelectorAll: selector => selector === '[data-cloud-tab]' ? [loginTab, registerTab] : [],
  querySelector: selector => selector === '[data-cloud-tab].active' ? [loginTab, registerTab].find(x => x.classList.contains('active')) || null : null,
  addEventListener: (name, handler) => { if (name === 'click') clickHandler = handler; }
};

const context = {
  document,
  window: {},
  queueMicrotask: fn => fn()
};
vm.createContext(context);
const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'cloud-v2-ui-fix.js'), 'utf8');
vm.runInContext(script, context);

function assert(ok, msg) {
  if (!ok) { console.error(`Cloud UI smoke test failed: ${msg}`); process.exit(1); }
}

assert(typeof clickHandler === 'function', 'click handler was not registered');
assert(!login.classList.contains('hidden'), 'login should start visible');
assert(register.classList.contains('hidden'), 'register should start hidden');

clickHandler({ target: registerTab, preventDefault() {} });
assert(login.classList.contains('hidden'), 'login should hide after clicking Criar conta');
assert(!register.classList.contains('hidden'), 'register should appear after clicking Criar conta');
assert(register.style.values.display?.value === 'grid', 'register display must be forced visible');
assert(registerTab.classList.contains('active'), 'register tab should become active');
assert(!loginTab.classList.contains('active'), 'login tab should become inactive');

clickHandler({ target: loginTab, preventDefault() {} });
assert(!login.classList.contains('hidden'), 'login should reappear after clicking Entrar');
assert(register.classList.contains('hidden'), 'register should hide after clicking Entrar');

console.log('Banana Cord V2 auth tab click regression test: OK');
