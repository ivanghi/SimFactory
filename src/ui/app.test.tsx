import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './app';
import { makeWorld } from '../test-utils/factories';
import { getState, selectBuilding, setSpeed, setWorld, toggleDemolish } from './store';

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
});
