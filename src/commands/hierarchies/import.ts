import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ImportSettingsBuilderOptions } from '../../interfaces/import-settings-builder-options.interface';
import { FileLog } from '../../common/file-log';
import { getDefaultLogPath } from '../../common/log-helpers';
import { readFile } from 'fs';
import { promisify } from 'util';
import { ContentItem, ContentRepository } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { PublishQueue } from '../../common/import/publish-queue';
import { ImportItemBuilderOptions } from '../../interfaces/import-item-builder-options.interface';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { extractSortable } from '../../common/yargs/sorting-options';

export type Answer = {
  answer?: string[];
};

export type RepositoryOption = {
  baseRepo: string;
};

export const command = 'import <baseRepo> <filePath>';

export const desc = 'Import Hierarchies';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('hierarchies', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('baseRepo', {
      type: 'string',
      requiresArg: true,
      describe: 'Import matching the given repository to the import base directory, by ID or by name.'
    })
    .positional('filePath', {
      describe: 'Source file path containing Hierarchy definition',
      requiresArg: true,
      type: 'string'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite Hierarchy without asking.'
    })
    .option('publish', {
      type: 'boolean',
      boolean: true,
      describe: 'Publish content items.'
    });
};

/**
 *
 * @param client
 * @param nodeId
 */
async function importHierarchy(
  repo: ContentRepository,
  publishable: any,
  node: any,
  parentId: any = null
): Promise<void> {
  const contentItem: any = {
    body: node.contentItem.body,
    label: node.contentItem.label,
    locale: 'en-US',
    hierarchy: node.contentItem.hierarchy
  };

  // Set parent ID
  if (parentId) {
    contentItem.body._meta.hierarchy.parentId = parentId;
    contentItem.hierarchy.parentId = parentId;
  }

  // Create content item in the repository
  const newContent = await repo.related.contentItems.create(contentItem);

  // Add content item to publishable list
  publishable.push(newContent);

  // Get ID of the created content item
  const newContentItemId = newContent.id;

  // Testing with randomly generated ID
  // const contentItemId = "abcd-" + (Math.floor(Math.random()*8000)+1000) + "-efgh"

  console.log(`Imported ${node.label} - ID: ${newContentItemId}, parent: ${parentId}`);

  const children = node.children;
  if (children.length > 0) {
    await Promise.all(children.map((item: any) => importHierarchy(repo, publishable, item, newContentItemId)));
  }
}

export const handler = async (
  argv: Arguments<
    ImportSettingsBuilderOptions & ConfigurationParameters & Answer & RepositoryOption & ImportItemBuilderOptions
  >
): Promise<void> => {
  const { filePath: sourceFile, logFile, baseRepo } = argv;

  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;

  const publishable: ContentItem[] = [];

  try {
    const client = dynamicContentClientFactory(argv);
    const hub = await client.hubs.get(argv.hubId);
    let repo = undefined;

    // Try to get repo by ID
    try {
      repo = await client.contentRepositories.get(baseRepo);
      console.log(`Found repository by ID: ${repo.name} (${repo.id})`);
    } catch (error) {
      log.appendLine(`No repository with ID ${argv.baseRepo} found`);
      repo = null;
    }

    // If no repo found, maybe a repo name was passed on
    if (!repo) {
      const contentRepositoryList = await paginator(hub.related.contentRepositories.list);
      const repoByName = contentRepositoryList.find((item: any) => item.name === argv.baseRepo);
      if (repoByName) {
        console.log(`Found repository by name: ${repoByName.name} (${repoByName.id})`);
        repo = repoByName;
      } else {
        log.appendLine(`No repository with name ${argv.baseRepo} found`);
        return;
      }
    }

    const exportedHierarchy = await promisify(readFile)(sourceFile, { encoding: 'utf8' });
    const hierarchy = JSON.parse(exportedHierarchy);

    // Import hierarchy
    await importHierarchy(repo, publishable, hierarchy);

    // Publish content items if requested
    if (argv.publish) {
      const pubQueue = new PublishQueue(argv);
      log.appendLine(`Publishing ${publishable.length} items.`);

      // Add all content items in the publishing queue in parallel
      await Promise.all(publishable.map((item: any) => pubQueue.publish(item)));

      log.appendLine(`Waiting for all publishes to complete...`);
      await pubQueue.waitForAll();

      log.appendLine(`Finished publishing, with ${pubQueue.failedJobs.length} failed publishes total.`);
      pubQueue.failedJobs.forEach(job => {
        log.appendLine(` - ${job.item.label}`);
      });
    }

    log.appendLine('Done!');

    if (log) {
      await log.close();
    }

    process.stdout.write('\n');
  } catch (e) {
    console.log(e);
  }
};
