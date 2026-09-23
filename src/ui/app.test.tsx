import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './app';
import { tick } from '../sim/tick';
import { TICK_DT } from '../data/constants';
import { makeWorld, placeBuildingOk, unlockAll } from '../test-utils/factories';
import { exportGame, importGame } from '../save/exportImport';
import {
  bumpUi,
  closeSettings,
  getState,
  markSimChanged,
  resetWorld,
  selectBuilding,
  setGameCodeHandlers,
  setNewGameHandler,
  setSpeed,
  setWorld,
  syncUi,
  toggleDemolish
} from './store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function clickByText(text: string): void {
  const el = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent?.includes(text) && !b.disabled
  );
  if (!el) throw new Error(`button with enabled text "${text}" not found`);
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function setImportDraft(text: string): void {
  const el = document.querySelector('.import-input') as HTMLTextAreaElement | null;
  if (!el) throw new Error('import textarea not found');
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('HTMLTextAreaElement value setter not found');
    setter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('UI', () => {
  let root: Root;
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    setWorld(makeWorld());
    setSpeed(1);
    act(() => {
      root.render(<App />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    act(() => selectBuilding(null));
    act(() => closeSettings());
    setNewGameHandler(null);
    setSpeed(1);
  });

  it('renders stockpile, build items, speed controls, power gauge, objectives', () => {
    expect(host.textContent).toContain('Iron Ore');
    expect(host.textContent).toContain('Iron Miner');
    expect(host.textContent).toContain('Warehouse');
    expect(host.textContent).toContain('1x');
    expect(host.textContent).toContain('Power');
    expect(host.textContent).toContain('Produce 50 Iron Ingot');
  });

  it('disables locked buildings by default', () => {
    const copperMiner = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copper Miner')
    );
    expect(copperMiner?.disabled).toBe(true);
  });

  it('selects and toggles off a building via the menu', () => {
    clickByText('Iron Miner');
    expect(getState().selectedBuildingId).toBe('iron-miner');
    clickByText('Iron Miner');
    expect(getState().selectedBuildingId).toBeNull();
  });

  it('selecting a building exits demolish mode', () => {
    act(() => toggleDemolish());
    expect(getState().demolishMode).toBe(true);
    clickByText('Solar Panel');
    expect(getState().demolishMode).toBe(false);
    expect(getState().selectedBuildingId).toBe('solar-panel');
  });

  it('speed controls update store speed', () => {
    clickByText('2x');
    expect(getState().speed).toBe(2);
    expect(host.querySelector('.speed-controls button.active')?.textContent).toBe('2x');
  });

  it('external selectBuilding re-renders the menu highlight', () => {
    act(() => selectBuilding('warehouse'));
    const el = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Warehouse')
    );
    expect(el?.className).toContain('selected');
  });

  it('renders the settings button at the right end of the top bar', () => {
    const topbar = host.querySelector('.topbar');
    const settings = topbar?.querySelector('.settings-menu') ?? null;
    expect(settings).not.toBeNull();
    expect(topbar?.lastElementChild).toBe(settings);
    const button = settings?.querySelector('button');
    expect(button?.textContent).toContain('Settings');
  });

  it('opens and closes the settings menu', () => {
    expect(getState().settingsOpen).toBe(false);
    expect(host.textContent).not.toContain('New game');

    clickByText('Settings');
    expect(getState().settingsOpen).toBe(true);
    expect(host.textContent).toContain('New game');

    clickByText('Settings');
    expect(getState().settingsOpen).toBe(false);
    expect(host.textContent).not.toContain('New game');
  });

  it('starts a new game from the settings menu and closes it', () => {
    let started = 0;
    setNewGameHandler(() => {
      started += 1;
      resetWorld(makeWorld(99));
    });

    clickByText('Settings');
    clickByText('New game');

    expect(started).toBe(1);
    expect(getState().settingsOpen).toBe(false);
    expect(host.textContent).not.toContain('New game');
    expect(getState().world?.map.seed).toBe(99);
    expect(getState().selectedBuildingId).toBeNull();
    expect(getState().demolishMode).toBe(false);
  });

  describe('export and import from the settings menu', () => {
    let clipboardWrites: string[];

    function currentCode(): string {
      return exportGame({
        world: getState().world!,
        meta: { savedAt: 1, speed: getState().speed }
      });
    }

    beforeEach(() => {
      clipboardWrites = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            clipboardWrites.push(text);
            return Promise.resolve();
          }
        }
      });
      setGameCodeHandlers({
        exportCode: currentCode,
        importCode: (code) => {
          resetWorld(importGame(code).world);
        }
      });
    });

    afterEach(() => {
      setGameCodeHandlers(null);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });

    it('exports the live save as base64 and copies it to the clipboard', async () => {
      const world = getState().world!;
      world.buildings = [
        {
          id: 'b1',
          buildingId: 'solar-panel',
          x: 10,
          y: 10,
          adjacencyMultiplier: 1,
          progress: 0
        }
      ];
      world.nextBuildingId = 2;
      world.stockpile['iron-ore'] = 42;
      const expected = currentCode();

      clickByText('Settings');
      expect(host.querySelector('.export-code')).toBeNull();
      clickByText('Export save');
      await act(async () => {
        await Promise.resolve();
      });

      const code = host.querySelector('.export-code') as HTMLTextAreaElement;
      expect(code.value).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(code.value).toBe(expected);
      expect(clipboardWrites).toEqual([expected]);
      expect(host.textContent).toContain('Copied!');
    });

    it('reopening the menu shows a clean export dialog', async () => {
      clickByText('Settings');
      clickByText('Export save');
      await act(async () => {
        await Promise.resolve();
      });
      clickByText('Settings');
      clickByText('Settings');
      expect(host.querySelector('.export-code')).toBeNull();
      expect((host.querySelector('.import-input') as HTMLTextAreaElement).value).toBe('');
      expect(host.textContent).not.toContain('Copied!');
    });

    it('imports a pasted code, restoring the world and closing the menu', () => {
      const world = getState().world!;
      unlockAll(world);
      placeBuildingOk(world, 'solar-panel', 10, 10);
      const code = currentCode();

      act(() => resetWorld(makeWorld(77)));
      expect(getState().world!.buildings).toHaveLength(0);

      clickByText('Settings');
      setImportDraft(code);
      clickByText('Import save');

      expect(getState().settingsOpen).toBe(false);
      const restored = getState().world!;
      expect(restored.map.seed).not.toBe(77);
      expect(restored.buildings.map((b) => b.buildingId)).toEqual(['solar-panel']);
    });

    it('downloads the save as a text file named for the current day', async () => {
      const world = getState().world!;
      world.stockpile['iron-ore'] = 7;
      const expected = currentCode();

      const blobs: Blob[] = [];
      const revoked: string[] = [];
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: (blob: Blob) => {
          blobs.push(blob);
          return 'blob:factory-save';
        }
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: (url: string) => {
          revoked.push(url);
        }
      });
      const anchorClicks: { href: string; download: string }[] = [];
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          anchorClicks.push({ href: this.href, download: this.download });
        });

      try {
        clickByText('Settings');
        clickByText('Export file');

        expect(anchorClicks).toHaveLength(1);
        expect(anchorClicks[0].href).toBe('blob:factory-save');
        expect(anchorClicks[0].download).toBe(
          `factory-save-${new Date().toISOString().slice(0, 10)}.txt`
        );
        expect(blobs).toHaveLength(1);
        expect(blobs[0].type).toBe('text/plain');
        expect(await blobs[0].text()).toBe(expected);
        expect(revoked).toEqual(['blob:factory-save']);
        expect(getState().settingsOpen).toBe(true);
      } finally {
        clickSpy.mockRestore();
        delete (URL as Partial<typeof URL>).createObjectURL;
        delete (URL as Partial<typeof URL>).revokeObjectURL;
      }
    });

    it('shows an inline error for a bad import and keeps the current world untouched', () => {
      act(() => resetWorld(makeWorld(77)));

      clickByText('Settings');
      setImportDraft('@@@@ not base64 @@@@');
      clickByText('Import save');

      expect(host.querySelector('.import-error')?.textContent).toMatch(/base64/i);
      expect(getState().settingsOpen).toBe(true);
      expect(getState().world!.map.seed).toBe(77);

      setImportDraft('');
      clickByText('Import save');
      expect(host.querySelector('.import-error')?.textContent).toMatch(/empty/i);
      expect(getState().world!.map.seed).toBe(77);
    });
  });

  describe('science rate top right', () => {
    function rateText(): string | undefined {
      return host.querySelector('.science-rate .res-amt')?.textContent;
    }

    function runGameSeconds(world: ReturnType<typeof makeWorld>, seconds: number): void {
      for (let s = 0; s < seconds; s++) {
        for (let i = 0; i < 10; i++) {
          tick(world, TICK_DT);
        }
        act(() => bumpUi());
      }
    }

    function worldWithLab() {
      const world = makeWorld();
      unlockAll(world);
      // Lab build costs 10 circuits / 20 gears; the extra 4 each feed exactly 4 cycles.
      world.stockpile['circuits'] = 14;
      world.stockpile['gears'] = 24;
      placeBuildingOk(world, 'lab', 10, 10);
      world.power = { supply: 10, demand: 1, efficiency: 1 };
      return world;
    }

    it('sits at the right end of the top bar, left of Settings, showing 0.0 before any science', () => {
      const topbar = host.querySelector('.topbar');
      const children = Array.from(topbar?.children ?? []);
      const contains = (sel: string) => (el: Element) =>
        el.matches(sel) || el.querySelector(sel) !== null;
      const rate = children.findIndex(contains('.science-rate'));
      const capNote = children.findIndex(contains('.cap-note'));
      const settings = children.findIndex(contains('.settings-menu'));
      expect(rate).toBeGreaterThan(-1);
      expect(capNote).toBeLessThan(rate);
      expect(rate).toBeLessThan(settings);
      expect(topbar?.querySelector('.science-rate .res-name')?.textContent).toBe('Science/min');
      expect(rateText()).toBe('0.0');
    });

    it('shows the real tick rate while the lab runs, decays to 0 when starved, resets on new game', () => {
      const world = worldWithLab();
      act(() => setWorld(world));
      expect(rateText()).toBe('0.0');

      runGameSeconds(world, 65);
      expect(world.milestoneProgress['produce-science']).toBe(4);
      expect(rateText()).toBe('4.0');

      runGameSeconds(world, 70);
      expect(rateText()).toBe('0.0');

      act(() => resetWorld(makeWorld(99)));
      expect(rateText()).toBe('0.0');
    });
  });

  describe('sim-driven refresh', () => {
    it('re-renders the stockpile when syncUi emits after a sim change', () => {
      getState().world!.stockpile['iron-ore'] = 123;
      markSimChanged();
      act(() => syncUi(1_000_000));
      expect(host.textContent).toContain('123');
    });

    it('throttles syncUi refreshes to once per second', () => {
      getState().world!.stockpile['iron-ore'] = 456;
      markSimChanged();
      act(() => syncUi(1_000_500));
      expect(host.textContent).not.toContain('456');
      act(() => syncUi(1_001_500));
      expect(host.textContent).toContain('456');
    });

    it('does not emit from syncUi when the sim has not changed', () => {
      getState().world!.stockpile['iron-ore'] = 789;
      act(() => syncUi(2_000_000));
      expect(host.textContent).not.toContain('789');
      markSimChanged();
      act(() => syncUi(2_000_000));
      expect(host.textContent).toContain('789');
    });
  });
});
