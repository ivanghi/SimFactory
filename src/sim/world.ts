// Pure data structure for the game world
export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Building {
  id: string;
  position: Position;
  size: Size;
  buildingId: string;
}

export interface ResourceAmount {
  resource: string;
  amount: number;
}

export interface WorldState {
  buildings: Building[];
  resources: Record<string, number>;
  power: {
    produced: number;
    consumed: number;
  };
}