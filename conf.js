import * as fs from "fs";

export function initConf() {
    let confFilePath = './conf/config.json';

    let buffer = fs.readFileSync(confFilePath);
    let confData = JSON.parse(buffer);
    console.log(confData);

    return confData;
}