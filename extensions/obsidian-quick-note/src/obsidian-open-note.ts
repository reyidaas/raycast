import path from 'path';
import { exec } from 'child_process';
import { getPreferenceValues, WindowManagement, popToRoot, closeMainWindow, getFrontmostApplication } from '@raycast/api';
import { runAppleScript } from '@raycast/utils';
import { readFile } from 'fs/promises';

interface Preferences {
  obsidianPath: string;
  notePath: string;
  vaultName: string;
  sidePositioned: boolean;
}

async function positionObsidian(positionWindow: boolean, retryCount?: number): Promise<void> {
  if (retryCount) {
    if (retryCount > 5) return;
    await new Promise((resolve) => {
      setTimeout(() => resolve(undefined), 500);
    });
  }

  const obsidianApp = (await WindowManagement.getWindowsOnActiveDesktop()).find(
    ({ application }) => application?.name === 'Obsidian',
  );
  if (!obsidianApp) return positionObsidian(positionWindow, retryCount ? retryCount + 1 : 1);

  const activeDesktop = (await WindowManagement.getDesktops()).find(({ active }) => active);
  if (!activeDesktop) return positionObsidian(positionWindow, retryCount ? retryCount + 1 : 1);

  if (!positionWindow) return;

  const width = 500;
  const height = activeDesktop.size.height * 0.85;

  await WindowManagement.setWindowBounds({
    id: obsidianApp.id,
    desktopId: activeDesktop.id,
    bounds: {
      size: { width, height },
      position: {
        x: activeDesktop.size.width - width - activeDesktop.size.width * 0.025,
        y: activeDesktop.size.height * 0.075,
      },
    },
  });
}

async function execAsync(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function isCurrentlyOpened() {
  try {
    const frontMostApp = await getFrontmostApplication();
    if (frontMostApp.name !== 'Obsidian') return false;

    const { obsidianPath, vaultName } = getPreferenceValues<Preferences>();

    const workspaceSettings = JSON.parse(
      await readFile(
        path.join(obsidianPath, vaultName, '.obsidian', 'workspace.json'),
        'utf-8',
      ),
    );

    const tabsData = workspaceSettings.main?.children
      .find(({ type }: { type: string }) => type === 'tabs');
    if (!tabsData) return false;

    const currentTabIdx = tabsData.currentTab;
    if (currentTabIdx === -1) return false;

    const currentTab = tabsData.children[currentTabIdx]
    if (!currentTab) return false;

    const {
      state: {
        state: { file },
      },
    } = currentTab;
    const { notePath } = getPreferenceValues<Preferences>();

    return file === `${notePath}.md`;
  } catch (error) {
    console.log(error);
  }
}

export default async function main() {
  const { vaultName, notePath, sidePositioned } = getPreferenceValues<Preferences>();

  if (await isCurrentlyOpened()) {
    await runAppleScript(`
    tell application "System Events"
      set visible of process "Obsidian" to false
    end tell
  `);
  } else {
    await execAsync(
      `open obsidian://open\\?vault=${vaultName}\\&file=${encodeURIComponent(path.join(...notePath.split('/')))}`,
    );
    await positionObsidian(sidePositioned);
  }

  await closeMainWindow();
  await popToRoot();
}
