import { readFile } from 'fs/promises';
import path from 'path';

import { useEffect, useMemo, useState } from 'react';
import { List, ActionPanel, Action, getPreferenceValues, ListItem } from '@raycast/api';

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

function Actions({ path }: { path: string }) {
  const uri = useMemo(() => {
    const { vaultName } = getPreferenceValues<Preferences>();
    return `obsidian://adv-uri?vault=${encodeURIComponent(vaultName)}&filepath=${encodeURIComponent(path)}&openmode=true`;
  }, [path]);

  return (
    <ActionPanel>
      <Action.Open title="Open" target={uri} />
    </ActionPanel>
  );
}

export default function ObsidianSearchTabs() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

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
        const obsidianItems: ListItem[] = workspaceSettings.main?.children
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
        setLoading(false);
      } catch (error) {
        console.log(error);
        setItems([]);
      }
    })();
  }, []);

  return (
    <List navigationTitle="Search currently opened tabs" isLoading={loading}>
      {!loading && !items.length ? (
        <List.EmptyView title="No opened tabs found" />
      ) : (
        items.map(({ id, title, path }) => (
          <List.Item key={id} title={title} actions={<Actions path={path} />} />
        ))
      )}
    </List>
  );
}
