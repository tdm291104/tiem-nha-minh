import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { UI, UI_TEXT, HUD_LAYOUT } from '../src/game/ui/UiTheme.ts';

function loadScene(name, loaded) {
  const objects = [], buttons = [], handlers = new Map(), transitions = [];
  const object = (text = '') => {
    const value = new Proxy({ visible: true, text }, {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => {
          if (key === 'setVisible') target.visible = args[0];
          if (key === 'setDepth') target.depth = args[0];
          if (key === 'setText') target.text = args[0];
          return value;
        };
      },
    });
    objects.push(value); return value;
  };
  class Scene {
    add = { container: () => object(), graphics: () => object(), text: (_x, _y, text) => object(text), image: () => object() };
    cameras = { main: object() };
    textures = { exists: () => true };
    events = { once: () => {} };
    input = { keyboard: { on: (key, fn) => handlers.set(key, fn) } };
    scene = { start: (name, data) => transitions.push({ name, data }) };
  }
  const primitives = {
    modalPaper: () => object(),
    panelButton: (_scene, parent, _x, _y, label, action) => {
      buttons.push({ label, click: () => { if (parent.visible) action(); } });
    },
  };
  const modules = {
    phaser: { Scene, Scenes: { Events: { SHUTDOWN: 'shutdown' } } },
    '../audio/createSceneAudio': { createSceneAudio: () => ({}) },
    '../presentation/VisualTheme': { cssColor: () => '#ffffff' },
    '../config/settings': { VIEW: { width: 1100, height: 800 } },
    '../persistence/GameSave': { browserSaves: () => ({ load: () => loaded }) },
    '../ui/UiTheme': { UI, UI_TEXT, HUD_LAYOUT },
    '../ui/PanelPrimitives': primitives,
    '../ui/SettingsPanel': { SettingsPanel: class { isOpen = false; open() { this.isOpen = true; } close() { this.isOpen = false; } } },
  };
  const source = readFileSync(new URL(`../src/game/scenes/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: id => modules[id] ?? {} });
  const scene = new exports[name]();
  return { scene, objects, buttons, handlers, transitions };
}

test('new-game clicks and shortcuts require confirmation for both modes when a save exists', () => {
  for (const players of [1, 2]) for (const keyboard of [false, true]) {
    const ui = loadScene('MenuScene', { save: { day: { day: 10 }, players: [{}] }, error: false });
    ui.scene.create();
    const trigger = () => keyboard
      ? ui.handlers.get(players === 1 ? 'keydown-ONE' : 'keydown-TWO')()
      : ui.buttons.find(button => button.label === `Tiệm mới · ${players} người`).click();
    trigger(); assert.equal(ui.transitions.length, 0);
    const confirmation = ui.objects.find(object => object.depth === 4500);
    assert.equal(confirmation.visible, true);
    ui.handlers.get('keydown-ESC')(); assert.equal(confirmation.visible, false);
    assert.equal(ui.transitions.length, 0);
    trigger(); ui.buttons.find(button => button.label === 'Giữ tiệm cũ').click();
    assert.equal(confirmation.visible, false); assert.equal(ui.transitions.length, 0);
    trigger(); ui.buttons.find(button => button.label === 'Thay bằng tiệm mới').click();
    assert.equal(ui.transitions.length, 1);
    assert.equal(ui.transitions[0].data.playerCount, players);
  }
});

test('fresh browser starts directly; unreadable save still requires confirmation', () => {
  for (const error of [false, true]) {
    const ui = loadScene('MenuScene', { save: null, error }); ui.scene.create();
    ui.handlers.get('keydown-ONE')(); assert.equal(ui.transitions.length, error ? 0 : 1);
  }
});

test('Enter confirms the selected mode once and ignores a held Enter key', () => {
  const ui = loadScene('MenuScene', { save: { day: { day: 10 }, players: [{}] }, error: false });
  ui.scene.create();
  ui.handlers.get('keydown-ENTER')({ repeat: false }); assert.equal(ui.transitions.length, 0);
  ui.handlers.get('keydown-TWO')();
  ui.handlers.get('keydown-ONE')();
  ui.handlers.get('keydown-ENTER')({ repeat: true }); assert.equal(ui.transitions.length, 0);
  ui.handlers.get('keydown-ENTER')({ repeat: false });
  ui.handlers.get('keydown-ENTER')({ repeat: false });
  assert.equal(ui.transitions.length, 1); assert.equal(ui.transitions[0].data.playerCount, 2);
});

test('returning to menu keeps the live shop when saving fails and allows a successful retry', () => {
  const ui = loadScene('ShopScene');
  const messages = [];
  let saved = false;
  ui.scene.progress = { save: () => saved };
  ui.scene.hud = { notify: message => messages.push(message) };
  ui.scene.returnToMenu(); assert.equal(ui.transitions.length, 0); assert.equal(messages.length, 1);
  saved = true; ui.scene.returnToMenu();
  assert.equal(ui.transitions.length, 1); assert.equal(ui.transitions[0].name, 'MenuScene');
});
