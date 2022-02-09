import { sync } from "execa";

import { injectable } from "../ioc";

/**
 * @export
 * @class Installer
 */
@injectable()
export class Installer {
    /**
     * @param {string} pkg
     * @memberof Installer
     */
    public install(pkg: string, tag: string = "latest"): void {
        const coreDirectory = __dirname + "/../../../../";

        const getLastTag = (regex) => `\`git tag --sort=committerdate | grep -Px ${regex} | tail -1\``;
        let gitTag = tag;
        if (tag === "latest") {
            gitTag = getLastTag('"^\\d+.\\d+.\\d+"');
        } else if (tag === "next") {
            gitTag = getLastTag('"^\\d+.\\d+.\\d+-next.\\d+"');
        }

        const command = `cd ${coreDirectory} && git tag -l | xargs git tag -d && git fetch --all --tags -f && git reset --hard && git checkout tags/${gitTag} && yarn setup`;
        const { stderr, exitCode } = sync(command, { shell: true });

        if (exitCode !== 0) {
            throw new Error(`"${command}" exited with code ${exitCode}\n${stderr}`);
        }
    }
}
