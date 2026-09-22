import React from 'react';
import { TopBar } from './topbar';
import { BuildMenu } from './build-menu';
import { SpeedControls } from './speed-controls';
import { PowerGauge } from './power-gauge';
import { Objectives } from './Objectives';
import { Toasts } from './toasts';
import './ui.css';

export const App: React.FC = () => {
  return (
    <>
      <TopBar />
      <div className="panel panel-left">
        <BuildMenu />
        <Objectives />
      </div>
      <div className="panel panel-bottom">
        <SpeedControls />
        <PowerGauge />
      </div>
      <Toasts />
    </>
  );
};
