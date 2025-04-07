import { readFile } from 'fs/promises';
import { exec } from 'child_process';
import path from 'path';

import { useEffect, useState } from 'react';
import { List, ActionPanel, Action, getPreferenceValues, ListItem, closeMainWindow, popToRoot } from '@raycast/api';

interface Preferences {
  obsidianPath: string;
  vaultName: string;
  positionWindow: boolean;
}

interface ObsidianChild {
  id: string;
  state: {
    title: string;
    state: {
      file: string;
    };
  };
}

interface ListItem {
  id: string;
  title: string;
  path: string;
}

async function execAsync(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function Actions({ path }: { path: string }) {
  const handleOpen = async (): Promise<void> => {
    try {
      const { vaultName } = getPreferenceValues<Preferences>();
      const uri = `obsidian://adv-uri\\?vault=${encodeURIComponent(vaultName)}\\&filepath=${encodeURIComponent(path)}\\&openmode=tab`;

      await execAsync(`open ${uri}`);
      await closeMainWindow();
      await popToRoot();
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <ActionPanel>
      <Action title="Open" onAction={handleOpen} />
    </ActionPanel>
  );
}

export default function ObsidianSearchTabs() {
  const [items, setItems] = useState<ListItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { obsidianPath, vaultName } = getPreferenceValues<Preferences>();
        const workspaceSettings = JSON.parse(
          await readFile(
            path.join(obsidianPath, vaultName, '.obsidian', 'workspace.json'),
            'utf-8',
          ),
        );
        const obsidianItems: ListItem[] = workspaceSettings.main.children
          .find(({ type }: { type: string }) => type === 'tabs')
          ?.children.map(
            ({
              id,
              state: {
                title,
                state: { file },
              },
            }: ObsidianChild) => ({ id, title, path: file }),
          );

        setItems(obsidianItems);
      } catch (error) {
        console.log(error);
      }
    })();
  }, []);

  return (
    <List navigationTitle="Search currently opened tabs">
      {items.map(({ id, title, path }) => (
        <List.Item key={id} title={title} actions={<Actions path={path} />} />
      ))}
    </List>
  );
}
