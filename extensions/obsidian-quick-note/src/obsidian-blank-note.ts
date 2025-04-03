import {
  WindowManagement,
  getPreferenceValues,
  type LaunchProps,
  closeMainWindow,
  popToRoot,
} from '@raycast/api';
import { readFile, writeFile } from 'fs/promises';
import { exec } from 'child_process';
import path from 'path';

interface Preferences {
  obsidianPath: string;
  vaultName: string;
  positionWindow: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

async function execAsync(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
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

function getMetaDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${year}-${month}-${day}${hours}:${minutes}`;
}

function getDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replaceAll(',', '')
    .replaceAll('/', '-')
    .replaceAll(':', '.');
}

export default async function main(props: LaunchProps) {
  const { obsidianPath, vaultName, positionWindow } = getPreferenceValues<Preferences>();
  const vaultPath = path.join(obsidianPath, vaultName);
  const meetingNoteTemplatePath = path.join(vaultPath, 'Templates', 'Blank.md');
  const destPath = path.join(vaultPath, 'Zettelkasten', 'Source');

  const date = new Date();
  const displayDate = getDisplayDate(date);
  const metaDate = getMetaDate(date);
  const nameArg: string = props.arguments.name;
  const name = `${nameArg} ${displayDate}.md`;

  const templateContent = (await readFile(meetingNoteTemplatePath)).toString();
  const parsedTemplateContent = templateContent
    .replace('{{date}}{{time}}', metaDate)
    .replaceAll('{{DATE:DD-MM-YYYY HH.mm}}', displayDate)
    .replaceAll('{{name}}', nameArg);

  await writeFile(path.join(destPath, name), parsedTemplateContent);
  await sleep(500);
  await execAsync(
    `open obsidian://open\\?vault=${vaultName}\\&file=${encodeURIComponent(path.join('Zettelkasten', 'Source', name))}`,
  );

  await closeMainWindow();
  await popToRoot();
  await positionObsidian(positionWindow);
}
