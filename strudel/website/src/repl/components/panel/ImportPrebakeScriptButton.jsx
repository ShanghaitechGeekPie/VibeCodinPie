import { errorLogger } from '@strudel/core';
import { useSettings, storePrebakeScript } from '../../../settings.mjs';
import { SpecialActionInput } from '../button/action-button';
import { confirmDialog, SETTING_CHANGE_RELOAD_MSG } from '@src/repl/util.mjs';

async function importScript(script) {
  const reader = new FileReader();
  reader.readAsText(script);

  reader.onload = () => {
    const text = reader.result;
    storePrebakeScript(text);
  };

  reader.onerror = () => {
    errorLogger(new Error('failed to import prebake script'), 'importScript');
  };
}
export function ImportPrebakeScriptButton() {
  const settings = useSettings();

  return (
    <SpecialActionInput
      type="file"
      label="import prebake script"
      accept=".strudel"
      onChange={async (e) => {
        const file = e.target.files[0];
        const confirmed = await confirmDialog(SETTING_CHANGE_RELOAD_MSG);
        if (!confirmed) {
          return;
        }
        try {
          await importScript(file);
          window.location.reload();
        } catch (e) {
          errorLogger(e);
        }
      }}
    />
  );
}
