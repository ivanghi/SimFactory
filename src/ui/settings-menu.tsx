import React, { useEffect, useReducer } from 'react';
import { useGame } from './useGame';
import {
  closeSettings,
  exportSaveCode,
  importSaveCode,
  requestNewGame,
  toggleSettings
} from './store';
import { SaveError } from '../save/serialize';

let draftText = '';
let exportCode = '';
let copied = false;
let importError: string | null = null;

function resetDialog(): void {
  draftText = '';
  exportCode = '';
  copied = false;
  importError = null;
}

function saveFileName(date: Date): string {
  return `factory-save-${date.toISOString().slice(0, 10)}.txt`;
}

export const SettingsMenu: React.FC = () => {
  const { settingsOpen } = useGame();
  const [, forceRender] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (settingsOpen) {
      resetDialog();
      forceRender();
    }
  }, [settingsOpen]);

  const handleDraftChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    draftText = event.target.value;
    importError = null;
    forceRender();
  };

  const handleExport = (): void => {
    exportCode = exportSaveCode();
    copied = false;
    const clipboard = navigator.clipboard;
    if (clipboard) {
      clipboard.writeText(exportCode).then(
        () => {
          copied = true;
          forceRender();
        },
        () => {}
      );
    }
    forceRender();
  };

  const handleDownloadFile = (): void => {
    const code = exportSaveCode();
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = saveFileName(new Date());
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (): void => {
    const code = draftText;
    try {
      importSaveCode(code);
      closeSettings();
    } catch (error) {
      importError = error instanceof SaveError ? error.message : 'Import failed.';
      forceRender();
    }
  };

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
          <div className="settings-section">
            <div className="settings-section-title">Export</div>
            <div className="export-row">
              <button className="settings-export" role="menuitem" onClick={handleExport}>
                Export save
              </button>
              <button className="settings-export" role="menuitem" onClick={handleDownloadFile}>
                Export file
              </button>
              {copied && <span className="export-copied">Copied!</span>}
            </div>
            {exportCode && (
              <textarea
                className="export-code"
                readOnly
                rows={3}
                value={exportCode}
                aria-label="Exported save code"
                onFocus={(event) => event.currentTarget.select()}
              />
            )}
          </div>
          <div className="settings-section">
            <div className="settings-section-title">Import</div>
            <textarea
              className="import-input"
              rows={3}
              placeholder="Paste save code"
              aria-label="Import save code"
              value={draftText}
              onChange={handleDraftChange}
            />
            <button className="settings-import" role="menuitem" onClick={handleImport}>
              Import save
            </button>
            {importError && (
              <div className="import-error" role="alert">
                {importError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
