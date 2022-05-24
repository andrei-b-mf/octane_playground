'use strict';

import { initConf } from './conf.js';
import { Octane } from '@microfocus/alm-octane-js-rest-sdk';
import { writeFileSync } from 'fs';

class Main {
    SHAREDSPACE_ENTITIES_METADATA_URL = '/api/shared_spaces/1001/metadata/entities?show_all=true';
    WORKSPACE_ENTITIES_METADATA_URL = '/api/shared_spaces/1001/workspaces/1002/metadata/entities?show_all=true';
    COMMANDS_PER_ENTITYTYPE_URL = '/admin/metadata/commands?entity=PLACEHOLDER&flavor=DEFAULT';

    extractNames(metadata) {
        let names = metadata.data.filter(e => {
            let isAggregated = e.features.filter(f => f.name == 'subtypes').length > 0;
            if(isAggregated) {
                console.log('Filtering out \'' + e.name + '\' because it is aggregated and will fail at command retrieval as it is not supported');
            }

            return !isAggregated;
        }).map(e => e.name);

        return names;
    }

    async gatherCommands(octaneRestClient, entityNames) {
        let commandsPerEntityType = [];
        for (const element of entityNames) {
            const commandsUrl = this.COMMANDS_PER_ENTITYTYPE_URL.replace('PLACEHOLDER', element);

            try {
                let commands = await octaneRestClient.executeCustomRequest(commandsUrl, Octane.operationTypes.get, undefined, { 'ALM-OCTANE-TECH-PREVIEW': true });
                commandsPerEntityType[element] = commands;
            } catch(e) {
                console.log('Could not retrieve commands for \'' + element + '\'');
                console.log('Status: ' + e.response.status + '\nResponse data: ');
                console.log(e.response.data);
            }
        }

        return commandsPerEntityType;
    }

    async run() {
        let conf = initConf();

        const octaneRestClient = new Octane({
            server: conf.octane.server,
            sharedSpace: conf.octane.sharedSpace,
            workspace: conf.octane.workspace,
            user: conf.octane.user,
            password: conf.octane.password,
            headers: conf.octane.headers
        });

        let sharedspaceEntitiesMetadata = await octaneRestClient.executeCustomRequest(this.SHAREDSPACE_ENTITIES_METADATA_URL, Octane.operationTypes.get, undefined, { 'ALM-OCTANE-TECH-PREVIEW': true });
        let workspaceEntitiesMetadata = await octaneRestClient.executeCustomRequest(this.WORKSPACE_ENTITIES_METADATA_URL, Octane.operationTypes.get, undefined, { 'ALM-OCTANE-TECH-PREVIEW': true });

        const sharedspaceEntitiesNames = this.extractNames(sharedspaceEntitiesMetadata);
        const workspaceEntitiesNames = this.extractNames(workspaceEntitiesMetadata);

        const commandsPerSharedspaceEntityType = await this.gatherCommands(octaneRestClient, sharedspaceEntitiesNames);
        let commandsCountPerEntityTypeOnSharedSpace = this.detectDuplicateCommandsPerService(commandsPerSharedspaceEntityType);
        this.generateReport(commandsCountPerEntityTypeOnSharedSpace, 'sharedspaceCommands.json');

        const commandsPerWorkspaceEntityType = await this.gatherCommands(octaneRestClient, workspaceEntitiesNames);
        let commandsCountPerEntityTypeOnWorkSpace = this.detectDuplicateCommandsPerService(commandsPerWorkspaceEntityType);
        this.generateReport(commandsCountPerEntityTypeOnWorkSpace, 'workspaceCommands.json');
    }

    detectDuplicateCommandsPerService(commandsPerEntityType) {
        let result = {};
        for(const [key, value] of Object.entries(commandsPerEntityType)) {
            result[key] = {};

            for(let i = 0; i < value.length; i++) {
                const resultKey = value[i].service;
                result[key][resultKey] = {};

                for(let j = 0; j < value[i].commands.length; j++) {
                    let command = value[i].commands[j];

                    if(result[key][resultKey][command.name]) {
                        result[key][resultKey][command.name] = result[key][resultKey][command.name] + 1;
                    } else {
                        result[key][resultKey][command.name] = 1;
                    }
                }
            }
        }

        return result;
    }

    generateReport(commandsCountPerEntityTypeOnSpace, reportName, logToConsole) {
        let json = JSON.stringify(commandsCountPerEntityTypeOnSpace);

        if(logToConsole) {
            console.log(json);
        }

        try {
            writeFileSync('./' + reportName, json);
        } catch(e) {
            console.log('Could not generate report: ' + reportName);
        }
    }
}

new Main().run();