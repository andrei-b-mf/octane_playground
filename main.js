'use strict';

import { initConf } from './conf.js';
import { Octane } from '@microfocus/alm-octane-js-rest-sdk';

function extractNames(metadata) {
    let names = metadata.data.map(e => e.name);

    return names;
}

async function gatherCommands(octaneRestClient, entityNames) {
    let commandsPerEntityType = [];
    for(const element of sharedspaceEntitiesNames) {
        const commandsUrl = commandsPerEntityTypeUrl.replace('PLACEHOLDER', element);
        let commands = await octaneRestClient.executeCustomRequest(commandsUrl, Octane.operationTypes.get, undefined, { 'ALM-OCTANE-TECH-PREVIEW': true });

        commandsPerEntityType[element] = commands;
    }

    return commandsPerEntityType;
}

async function main() {
    let conf = initConf();

    let sharedspaceEntitiesMetadataUrl = '/api/shared_spaces/1001/metadata/entities?show_all=true';
    let workspaceEntitiesMetadataUrl = '/api/shared_spaces/1001/workspaces/1002/metadata/entities?show_all=true';
    let commandsPerEntityTypeUrl = '/admin/metadata/commands?entity=PLACEHOLDER&flavor=DEFAULT';

    const octaneRestClient = new Octane({
        server: conf.octane.server,
        sharedSpace: conf.octane.sharedSpace,
        workspace: conf.octane.workspace,
        user: conf.octane.user,
        password: conf.octane.password,
        headers: conf.octane.headers
    });

    let sharedspaceEntitiesMetadata = await octaneRestClient.executeCustomRequest(sharedspaceEntitiesMetadataUrl, Octane.operationTypes.get, undefined, { 'ALM-OCTANE-TECH-PREVIEW': true });
    let workspaceEntitiesMetadata = await octaneRestClient.executeCustomRequest(workspaceEntitiesMetadataUrl, Octane.operationTypes.get, undefined, { 'ALM-OCTANE-TECH-PREVIEW': true });

    const sharedspaceEntitiesNames = extractNames(sharedspaceEntitiesMetadata);
    const workspaceEntitiesNames = extractNames(workspaceEntitiesMetadata);

    const commandsPerSharedspaceEntityType = await gatherCommands(octaneRestClient, sharedspaceEntitiesNames);
    const commandsPerWorkspaceEntityType = await gatherCommands(octaneRestClient, workspaceEntitiesNames);
}

main();