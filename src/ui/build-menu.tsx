import React from 'react';
import { buildings, type BuildingDef } from '../data/buildings';
import { getRecipe } from '../data/recipes';
import { resources } from '../data/resources';
import { useGame } from './useGame';
import { selectBuilding, toggleDemolish } from './store';
import { Tooltip } from './tooltip';

const SWATCH: Record<string, string> = {
  'iron-miner': '#8B7355',
  'copper-miner': '#D2691E',
  'coal-miner': '#555',
  pumpjack: '#4A6B4A',
  'water-pump': '#4682B4',
  smelter: '#C04040',
  'copper-smelter': '#E08030',
  refinery: '#6A6A7A',
  'chemical-plant': '#3A8A3A',
  'gear-assembler': '#7A8A9A',
  'circuit-assembler': '#4A8A6A',
  'solar-panel': '#1E90FF',
  'coal-generator': '#8B3A3A',
  warehouse: '#A0724A'
};

function resourceName(id: string): string {
  return resources.find((resource) => resource.id === id)?.name ?? id;
}

function placementText(def: BuildingDef): string {
  if (def.recipeId === 'water') return 'Place on water';
  switch (def.placementRule) {
    case 'resource':
      return `Place on ${resourceName(def.recipeId)} node (grass)`;
    case 'factory':
      return 'Place on grass';
    case 'power':
      return 'Place on grass';
    case 'storage':
      return 'Place on grass';
    default:
      return def.placementRule;
  }
}

function InfoTip({ def }: { def: BuildingDef }): React.ReactElement {
  const recipe = getRecipe(def.recipeId);
  return (
    <div className="tip-lines">
      <div className="tip-title">{def.name}</div>
      <div>{def.category}</div>
      <div>{placementText(def)}</div>
      {recipe ? (
        <div>
          {recipe.inputs.map((i) => `${i.amount} ${resourceName(i.resource)}`).join(' + ')} →{' '}
          {recipe.outputs.map((o) => `${o.amount} ${resourceName(o.resource)}`).join(' + ')} ({recipe.cycleTime}s)
        </div>
      ) : def.category === 'extractor' ? (
        <div>Produces {resourceName(def.recipeId)}</div>
      ) : null}
      {def.powerOutput ? <div>Power: +{def.powerOutput}</div> : null}
      {def.powerDraw > 0 ? <div>Power: -{def.powerDraw}</div> : null}
    </div>
  );
}

export const BuildMenu: React.FC = () => {
  const { world, selectedBuildingId, demolishMode } = useGame();
  if (!world) return null;

  return (
    <div className="build-menu">
      <h3>Build</h3>
      {buildings.map((def) => {
        const unlocked = !!world.unlocked[def.id];
        const affordable = def.cost.every((c) => (world.stockpile[c.resource] ?? 0) >= c.amount);
        const selected = selectedBuildingId === def.id;
        const costText = def.cost.map((c) => `${c.amount} ${resourceName(c.resource)}`).join(', ');
        return (
          <Tooltip key={def.id} text={<InfoTip def={def} />}>
            <button
              className={[
                'build-item',
                selected ? 'selected' : '',
                !unlocked ? 'locked' : '',
                unlocked && !affordable ? 'unaffordable' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!unlocked}
              onClick={() => selectBuilding(def.id)}
              title={unlocked ? undefined : 'Locked'}
            >
              <span className="swatch" style={{ background: SWATCH[def.id] ?? '#888' }} />
              <span className="bname">{def.name}</span>
              <span className="bcost">{unlocked ? costText : 'Locked'}</span>
            </button>
          </Tooltip>
        );
      })}
      <button
        className={`demolish-btn${demolishMode ? ' active' : ''}`}
        onClick={toggleDemolish}
      >
        Demolish mode
      </button>
    </div>
  );
};
