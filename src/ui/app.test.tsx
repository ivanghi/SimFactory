import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './app';
import { makeWorld } from '../test-utils/factories';
import {
  closeSettings,
  getState,
  markSimChanged,
  resetWorld,
  selectBuilding,
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
