import React from 'react';
import { useGame } from './useGame';
import { requestNewGame, toggleSettings } from './store';

export const SettingsMenu: React.FC = () => {
  const { settingsOpen } = useGame();

  return (
    <div className="settings-menu">
      <button
        className={`settings-btn${settingsOpen ? ' active' : ''}`}
        onClick={toggleSettings}
        aria-expanded={settingsOpen}
        aria-haspopup="menu"
        title="Settings"
      >
        Settings
      </button>
      {settingsOpen && (
        <div className="settings-panel" role="menu">
          <div className="settings-title">Settings</div>
          <button className="settings-new-game" role="menuitem" onClick={requestNewGame}>
            New game
          </button>
        </div>
      )}
    </div>
  );
};