#!/bin/bash

function cleanup() {
    PATH=$SOLAR_OLD_PATH
    CFLAGS=$SOLAR_OLD_CFLAGS
    LDFLAGS=$SOLAR_OLD_LDFLAGS
    PERL5LIB=$SOLAR_OLD_PERL5LIB
    GIT_EXEC_PATH=$SOLAR_OLD_GIT_EXEC_PATH
    GIT_TEMPLATE_DIR=$SOLAR_OLD_GIT_TEMPLATE_DIR

    unset SOLAR_OLD_PATH
    unset SOLAR_OLD_CFLAGS
    unset SOLAR_OLD_LDFLAGS
    unset SOLAR_OLD_PERL5LIB
    unset SOLAR_OLD_GIT_EXEC_PATH
    unset SOLAR_OLD_GIT_TEMPLATE_DIR

    rm -rf "$SOLAR_TEMP_PATH"
    tput cnorm
}

function sigtrap() {
    cleanup
    exit 1
}

echo '
███████╗ ██████╗ ██╗      █████╗ ██████╗      ██████╗ ██████╗ ██████╗ ███████╗
██╔════╝██╔═══██╗██║     ██╔══██╗██╔══██╗    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
███████╗██║   ██║██║     ███████║██████╔╝    ██║     ██║   ██║██████╔╝█████╗
╚════██║██║   ██║██║     ██╔══██║██╔══██╗    ██║     ██║   ██║██╔══██╗██╔══╝
███████║╚██████╔╝███████╗██║  ██║██║  ██║    ╚██████╗╚██████╔╝██║  ██║███████╗
╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝
'
DEB=$(which apt-get 2>/dev/null || :)

if [[ -z $DEB ]]; then
    echo Sorry, Solar Core is only compatible with Debian-based Linux distributions
    echo
    exit 1
fi

if [ $EUID -eq 0 ]; then
    echo Sorry, you must not be a superuser to install and run Solar Core
    echo
    exit 1
fi

if [[ "$HOME" =~ \ |\' ]]; then
    echo Sorry, your home directory must not contain spaces to install Solar Core
    echo
    exit 1
fi

tput civis
echo Thanks for choosing to install Solar Core! Preparing the setup procedure...
echo

SOLAR_OLD_PATH=$PATH
SOLAR_OLD_CFLAGS=$CFLAGS
SOLAR_OLD_LDFLAGS=$LDFLAGS
SOLAR_OLD_PERL5LIB=$PERL5LIB
SOLAR_OLD_GIT_EXEC_PATH=$GIT_EXEC_PATH
SOLAR_OLD_GIT_TEMPLATE_DIR=$GIT_TEMPLATE_DIR

RC='SOLAR_CORE_TOKEN=solar
SOLAR_CORE="$SOLAR_CORE_TOKEN"-core
SOLAR_CORE_PATH="$HOME"/"$SOLAR_CORE"
SOLAR_DATA_PATH="$HOME"/."$SOLAR_CORE_TOKEN"
SOLAR_TEMP_PATH="$SOLAR_DATA_PATH"/tmp
PATH="$SOLAR_DATA_PATH"/usr/bin:"$SOLAR_DATA_PATH"/bin:"$SOLAR_DATA_PATH"/sbin:"$SOLAR_DATA_PATH"/usr/share:"$SOLAR_DATA_PATH"/usr/lib:"$SOLAR_DATA_PATH"/.pnpm/bin:/bin:/usr/bin
CFLAGS="--sysroot=\"$SOLAR_DATA_PATH\""
LDFLAGS="--sysroot=\"$SOLAR_DATA_PATH\""
PERL5LIB="$SOLAR_DATA_PATH"/usr/share/perl5
GIT_EXEC_PATH="$SOLAR_DATA_PATH"/usr/lib/git-core
GIT_TEMPLATE_DIR="$SOLAR_DATA_PATH"/usr/share/git-core/templates'

eval "$RC"

trap sigtrap INT

mkdir -p "$SOLAR_DATA_PATH" "$SOLAR_DATA_PATH"/etc "$SOLAR_TEMP_PATH"/cache "$SOLAR_TEMP_PATH"/state/archives/partial "$SOLAR_TEMP_PATH"/state/lists/partial

echo "$(source <(echo "echo \"$RC\""))" > "$SOLAR_DATA_PATH"/.env &&

if [ ! -f ""$SOLAR_DATA_PATH"/bin/node" ]; then
    wget -qO "$SOLAR_TEMP_PATH"/n https://raw.githubusercontent.com/tj/n/master/bin/n
    N_PREFIX="$SOLAR_DATA_PATH" /bin/bash "$SOLAR_TEMP_PATH"/n 16 >/dev/null 2>/dev/null
fi

rm -rf "$SOLAR_DATA_PATH"/.pnpm
mkdir -p "$SOLAR_DATA_PATH"/.pnpm/bin

echo "prefix=""$SOLAR_DATA_PATH""/.pnpm
global-dir=""$SOLAR_DATA_PATH""/.pnpm
global-bin-dir=""$SOLAR_DATA_PATH""/.pnpm/bin
store-dir=""$SOLAR_DATA_PATH""/.pnpm/store" > "$SOLAR_DATA_PATH"/lib/node_modules/npm/npmrc
ln -sf "$SOLAR_DATA_PATH"/lib/node_modules/npm/npmrc "$SOLAR_DATA_PATH"/etc/npmrc

npm install -g cli-cursor@3.1.0 delay@5.0.0 env-paths@2.2.1 kleur@4.1.4 @alessiodf/listr pnpm prompts@2.4.2 >/dev/null 2>/dev/null

cat << 'EOF' > "$SOLAR_TEMP_PATH"/install.js
const Listr = require("@alessiodf/listr");
const { spawn, spawnSync } = require("child_process");
const cliCursor = require("cli-cursor");
const delay = require("delay");
const envPaths = require("env-paths");
const { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } = require("fs");
const { homedir } = require("os");
const { white } = require("kleur");
const prompts = require("prompts");

const envLines = readFileSync(`${process.env.SOLAR_DATA_PATH}/.env`).toString().split("\n");
const envVars = {};

for (const line of envLines) {
    const split = line.split("=");
    envVars[split[0]] = split.slice(1).join("=");
}

for (const [key, value] of Object.entries(envVars)) {
    process.env[key] = value;
}

let currentTask = {};
let log = "";
let shellOutput = "";
let totalPackages = 0;

let verbose = false;

let network;
let pnpmFlags = "--reporter=";

const dependencies = {};
const dependenciesListr = new Listr();

const packages = {};
const packagesListr = new Listr();

let tasks;

function generatePromise(name) {
    let rejecter;
    let resolver;
    return {
        name,
        promise: new Promise((resolve, reject) => {
            rejecter = reject;
            resolver = resolve;
        }),
        reject: rejecter,
        resolve: resolver,
    };
}

const buildPhase = generatePromise();
const downloadPhase = generatePromise();
const installPhase = { start: generatePromise(), end: generatePromise() };

let workspacePrefix = "";

function consume(data, stderr) {
    if (verbose) {
        if (!stderr) {
            process.stdout.write(data);
        } else {
            process.stderr.write(data);
        }
        return;
    }
    if (data.endsWith("]") && currentTask.title.startsWith("Downloading operating system dependencies")) {
        const split = data.split(" ");
        if (!split[4].includes("[") && !split[4].includes("]") && !split[6].includes("[") && !split[6].includes("]")) {
            totalPackages++;
            currentTask.title = `Downloading operating system dependencies (${split[4]}-${split[6]})`;
        }
    } else if (data.startsWith("{") && data.endsWith("}")) {
        const parsed = JSON.parse(data);
        if (parsed.name === "pnpm:summary") {
            downloadPhase.resolve();
            installPhase.start.resolve();
            installPhase.end.resolve();
        }

        if (parsed.workspacePrefix) {
            workspacePrefix = parsed.workspacePrefix;
        }

        if (parsed.initial && parsed.initial.name && parsed.prefix) {
            const prefix = parsed.prefix.replace(workspacePrefix, "");
            if (prefix) {
                packages[parsed.prefix] = parsed.initial.name;
                packagesListr.add([
                    {
                        title: `Building ${parsed.initial.name}`,
                        task: () => buildPhase.promise,
                    },
                ]);
            }
        }

        if (parsed.script !== undefined) {
            const pkg = packages[parsed.depPath];
            if (pkg) {
                packagesListr.tasks.find((task) => task.title === `Building ${pkg}`)._state = 0;
            } else if (parsed.depPath) {
                const depPath = parsed.depPath.split("/");
                let dependency = depPath[depPath.length - 1];
                if (/^\d+.\d+.\d+$|^\d+.\d+.\d+-next.\d+$/.test(dependency)) {
                    dependency = depPath[depPath.length - 2];
                }
                if (!dependencies[parsed.depPath]) {
                    dependenciesListr.add([
                        {
                            title: `Building ${dependency}`,
                            task: () => installPhase.end.promise,
                        },
                    ]);
                    dependenciesListr.tasks.find((task) => task.title === `Building ${dependency}`)._state = 0;
                    dependencies[parsed.depPath] = dependency;
                }
                downloadPhase.resolve();
                installPhase.start.resolve();
            }
        }

        if (parsed.exitCode !== undefined) {
            let listr;
            let pkg;
            if (packages[parsed.depPath]) {
                listr = packagesListr;
                pkg = packages[parsed.depPath];
            } else if (dependencies[parsed.depPath]) {
                listr = dependenciesListr;
                pkg = dependencies[parsed.depPath];
            }

            if (listr && pkg) {
                listr.tasks.find((task) => task.title === `Building ${pkg}`)._state = parsed.exitCode === 0 ? 1 : 2;
                if (parsed.exitCode !== 0) {
                    const tasksInProgress = listr.tasks.filter((task) => task._state === 0);
                    for (const task of tasksInProgress) {
                        delete task._state;
                    }
                    raiseError(new Error(`The process failed with error code ${parsed.exitCode}`));
                }
            }
        }

        if (parsed.line) {
            data = parsed.line;
        }
    }
    if (!data.startsWith("{") && !data.endsWith("}")) {
        log += data + "\n";
    }
}

function route(data, stderr) {
    if (verbose) {
        consume(data, stderr);
        return;
    }
    shellOutput += data;
    while (shellOutput.includes("\n")) {
        const line = shellOutput.substring(0, shellOutput.indexOf("\n"));
        consume(line);
        shellOutput = shellOutput.substring(line.length + 1);
    }
}

async function addPlugin(plugin) {
    return new Promise(async (resolve, reject) => {
        const cli = spawn(plugin.command, { shell: true });
        cli.stdout.on("data", (data) => route(data));
        cli.stderr.on("data", (data) => route(data, true));
        cli.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`The process failed with error code ${code}`));
            }
        });
    });
}

async function addPlugins() {
    const listr = new Listr();
    const plugins = [
        {
            package: "@alessiodf/rocket-boot",
            command:
                `"$SOLAR_DATA_PATH"/bin/node "$SOLAR_CORE_PATH"/packages/core/bin/run plugin:install @alessiodf/rocket-boot --network=${network} --token="$SOLAR_CORE_TOKEN" && "$SOLAR_DATA_PATH"/bin/node "$SOLAR_CORE_PATH"/packages/core/bin/run rocket:enable --force --network=${network} --token="$SOLAR_CORE_TOKEN"`,
        },
        {
            package: "@alessiodf/round-monitor",
            command:
                `"$SOLAR_DATA_PATH"/bin/node "$SOLAR_CORE_PATH"/packages/core/bin/run plugin:install @alessiodf/round-monitor --network=${network} --token="$SOLAR_CORE_TOKEN" && "$SOLAR_DATA_PATH"/bin/node "$SOLAR_CORE_PATH"/packages/core/bin/run monitor:enable --disableServer --restartTimeBuffer=45 --force --network=${network} --token="$SOLAR_CORE_TOKEN"`,
        },
    ];
    for (const plugin of plugins) {
        if (verbose) {
            await addPlugin(plugin);
        } else {
            listr.add([
                {
                    title: `Adding ${plugin.package}`,
                    task: () => addPlugin(plugin),
                },
            ]);
        }
    }
    return listr;
}

async function core() {
    return new Promise((resolve, reject) => {
        const pnpm = spawn(
            `
                . "${process.env.SOLAR_DATA_PATH}"/.env &&
                npm -g install pnpm &&
                pnpm -g install pm2 &&
                pm2 install pm2-logrotate &&
                pm2 set pm2-logrotate:max_size 500M &&
                pm2 set pm2-logrotate:compress true &&
                pm2 set pm2-logrotate:retain 7 &&
                ln -sf "$SOLAR_DATA_PATH"/bin/node "$SOLAR_DATA_PATH"/.pnpm/bin/node &&
                rm -rf /tmp/pm2-logrotate &&
                (crontab -l; echo "@reboot /bin/bash -lc \\"source "$SOLAR_DATA_PATH"/.env; "$SOLAR_DATA_PATH"/.pnpm/bin/pm2 resurrect\\"") | sort -u - | crontab - 2>/dev/null &&
                cd "$SOLAR_CORE_PATH" &&
                CFLAGS="$CFLAGS" CPATH="$CPATH" LDFLAGS="$LDFLAGS" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" pnpm install ${pnpmFlags} &&
                pnpm build ${pnpmFlags} &&
                RC=POSTGRES_DIR=$(find "$SOLAR_DATA_PATH" -regex ".*/usr/lib/postgresql/[0-9]+") &&
                echo "$RC" >> "$SOLAR_DATA_PATH"/.env &&
                sed -i "s@"/usr/lib/postgresql/"@""$SOLAR_DATA_PATH"/usr/lib/postgresql/"@g" "$SOLAR_DATA_PATH"/usr/share/perl5/PgCommon.pm
            `,
            { shell: true },
        );
        pnpm.stdout.on("data", (data) => route(data));
        pnpm.stderr.on("data", (data) => route(data, true));
        pnpm.on("close", async (code) => {
            if (code === 0) {
                buildPhase.resolve();
                resolve();
            } else {
                if (tasks && tasks.tasks) {
                    const task = tasks.tasks.find((task) => task._state === 0);
                    if (task) {
                        task._state = 2;
                    }
                }
                await raiseError(new Error(`The process failed with error code ${code}`));
            }
        });
    });
}

async function downloadCore(version) {
    return new Promise((resolve, reject) => {
        const architecture = spawnSync(
            `
                . "${process.env.SOLAR_DATA_PATH}"/.env &&
                gcc -dumpmachine
            `,
            { shell: true },
        )
            .stdout.toString()
            .trim();
        const git = spawn(
            `
                . "${process.env.SOLAR_DATA_PATH}"/.env &&
                RC=CPATH="$SOLAR_DATA_PATH"/usr/include:"$SOLAR_DATA_PATH"/usr/include/${architecture} &&
                echo "$RC" >> "$SOLAR_DATA_PATH"/.env &&
                RC=LD_LIBRARY_PATH="$SOLAR_DATA_PATH"/usr/lib/${architecture} &&
                eval "$RC" &&
                echo "$RC" >> "$SOLAR_DATA_PATH"/.env &&
                ln -sf "$SOLAR_DATA_PATH"/usr/bin/gcc "$SOLAR_DATA_PATH"/usr/bin/cc &&
                ln -sf /usr/lib/${architecture}/libgcc_s.* "$SOLAR_DATA_PATH"/usr/lib/${architecture}/ &&
                (grep -rl include_next "$SOLAR_DATA_PATH"/usr/include/c++/ | xargs sed -i "s/include_next/include/g" 2>/dev/null; true) &&
                rm -rf "$SOLAR_CORE_PATH" &&
                cd "$HOME" &&
                LD_LIBRARY_PATH="$LD_LIBRARY_PATH" git clone "https://github.com/solar-network/core.git" "$SOLAR_CORE_PATH" --progress &&
                cd "$SOLAR_CORE_PATH" &&
                git checkout tags/${version}
            `,
            { shell: true },
        );
        git.stdout.on("data", (data) => route(data));
        git.stderr.on("data", (data) => route(data, true));
        git.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`The process failed with error code ${code}`));
            }
        });
    });
}

async function downloadOSDependencies() {
    return await new Promise((resolve, reject) => {
        const packages = [
            "apt-transport-https",
            "autoconf",
            "automake",
            "build-essential",
            "gcc",
            "git",
            "jq",
            "libcairo2-dev",
            "libpq-dev",
            "libtool",
            "postgresql",
            "postgresql-contrib",
            "postgresql-client",
            "postgresql-client-common",
            "python3",
        ];

        const enumerateDependencies = () => {
            const cache = spawnSync(
                `apt-cache depends ${packages.join(" ")} | grep '[ |]Depends: [^<]' | cut -d: -f2`,
                {
                    shell: true,
                },
            ).stdout.toString();
            const deps = cache.split("\n");
            let again = false;
            for (const dep of deps) {
                const dependency = dep.trim();
                if (dependency.length > 0 && !packages.includes(dependency)) {
                    packages.push(dependency);
                    again = true;
                }
            }

            if (again) {
                return enumerateDependencies();
            }

            return packages.join(" ");
        };

        const locked = spawnSync("dpkg -C", { shell: true }).status !== 0;

        if (locked) {
            reject(new Error("System updates are currently in progress. Please wait for them to finish and try again"));
            return;
        }

        const apt = spawn(
            `
                . "${process.env.SOLAR_DATA_PATH}"/.env &&
                APT_PARAMS="-o debug::nolocking=true -o dir::cache="$SOLAR_TEMP_PATH"/cache -o dir::state="$SOLAR_TEMP_PATH/state"" &&
                apt-get $APT_PARAMS update &&
                apt-get $APT_PARAMS -y -d install --reinstall ${enumerateDependencies()}
            `,
            { shell: true },
        );
        apt.stdout.on("data", (data) => route(data));
        apt.stderr.on("data", (data) => route(data, true));
        apt.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`The process failed with error code ${code}`));
            }
        });
    });
}

async function installOSDependencies() {
    return await new Promise(async (resolve, reject) => {
        const dir = `${process.env.SOLAR_TEMP_PATH}/cache/archives`;
        const packages = readdirSync(dir)
            .filter((pkg) => pkg.endsWith(".deb") && statSync(`${dir}/${pkg}`).isFile())
            .map((pkg) => `${dir}/${pkg}`);
        let currentPackage = 0;
        for (const pkg of packages) {
            currentPackage++;
            const name = unescape(pkg.substring(0, pkg.length - 4).substring(pkg.lastIndexOf("/") + 1));
            if (currentTask.title) {
                 currentTask.title = `Installing operating system dependencies (${currentPackage} of ${totalPackages}: ${name})`;
             }
            try {
                await installOSDependency(pkg);
            } catch (error) {
                reject(error);
            }
        }
        currentTask.title = "Installing operating system dependencies";
        resolve();
    });
}

async function installOSDependency(pkg) {
    return await new Promise((resolve, reject) => {
        const dpkg = spawn(
            `
                . "${process.env.SOLAR_DATA_PATH}"/.env &&
                dpkg -x ${pkg} "${process.env.SOLAR_DATA_PATH}"
            `,
            { shell: true },
        );
        dpkg.stdout.on("data", (data) => route(data));
        dpkg.stderr.on("data", (data) => route(data, true));
        dpkg.on("close", (code) => {
            if (code === 0) {
                unlinkSync(pkg);
                resolve();
            } else {
                reject(new Error(`The process failed with error code ${code}`));
            }
        });
    });
}

async function saveConfiguration() {
    return new Promise((resolve, reject) => {
        const config = spawn(
            `
                cd "$SOLAR_CORE_PATH" &&
                "$SOLAR_DATA_PATH"/bin/node packages/core/bin/run config:publish --network=${network}
            `,
            { shell: true },
        );
        config.stdout.on("data", (data) => route(data));
        config.stderr.on("data", (data) => route(data, true));
        config.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`The process failed with error code ${code}`));
            }
        });
    });
}

async function setUpDatabase() {
    return new Promise((resolve, reject) => {
        const { data } = envPaths(process.env.SOLAR_CORE_TOKEN, { suffix: "core" });
        const psql = spawn(
            `
                cd "$SOLAR_CORE_PATH" &&
                "$SOLAR_DATA_PATH"/bin/node packages/core/bin/run database:create --network=${network}
            `,
            { shell: true },
        );
        psql.stdout.on("data", (data) => route(data));
        psql.stderr.on("data", (data) => route(data, true));
        psql.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`The process failed with error code ${code}`));
            }
        });
    });
}

function skipConfiguration() {
    const home = homedir();
    const { config } = envPaths(process.env.SOLAR_CORE_TOKEN, { suffix: "core" });
    return existsSync(`${config}/${network}`);
}

function skipDatabase() {
    const home = homedir();
    const { data } = envPaths(process.env.SOLAR_CORE_TOKEN, { suffix: "core" });
    if (existsSync(`${data}/${network}/database/postgresql.conf`)) {
        const config = readFileSync(`${data}/${network}/database/postgresql.conf`).toString();
        return config.includes(`# ${process.env.SOLAR_CORE_TOKEN}`);
    }
}

async function raiseError(error) {
    await delay(250);
    log = log.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
    let message = `The process did not complete successfully:\n${log}\n${error.message}`;
    console.log();
    if (verbose) {
        message = error.message;
    }
    console.error(white().bgRed(`[ERROR] ${message}`));
    let code = 1;
    try {
        const split = (error.message ? error.message : message).split(" ");
        code = +split[split.length - 1];
        if (isNaN(code)) {
            code = 1;
        }
    } catch {
        //
    }
    process.exit(code);
}

async function start() {
    try {
        for (const flag of process.argv) {
            if (flag === "-v") {
                verbose = true;
            }
            if (flag.startsWith("--network")) {
                if (network) {
                    process.stdin.write("\033[A");
                    throw new Error("Only one network parameter may be specified");
                }

                network = flag.substring(10);

                if (!["mainnet", "testnet"].includes(network)) {
                    process.stdin.write("\033[A");
                    throw new Error("Only mainnet or testnet are valid networks");
                }
            }
        }

        pnpmFlags += verbose ? "append-only" : "ndjson";

        if (!network) {
            ({ network } = await prompts({
                type: "select",
                name: "network",
                message: "Which network do you want to connect to?",
                choices: [
                    { title: "Mainnet", value: "mainnet" },
                    { title: "Testnet", value: "testnet" },
                ],
            }));

            if (!network) {
                console.log();
                console.log("Installation aborted");
                process.exit(1);
            }

            const { confirm } = await prompts({
                type: "confirm",
                name: "confirm",
                message: "Are you sure?",
            });

            if (!confirm) {
                network = undefined;
                await start();
                return;
            }
            console.log();
        }

        console.log(`Installing Solar Core for ${network}. This process may take a few minutes`);
        cliCursor.hide();

        let regex = /^\d+.\d+.\d+$/;

        if (network === "testnet") {
            regex = /^\d+.\d+.\d+-next.\d+$/;
        }

        let version;

        try {
            const tags = JSON.parse(
                spawnSync("wget -qO- https://api.github.com/repos/solar-network/core/git/refs/tags", { shell: true })
                    .stdout,
            );
            version = Object.values(tags.map((tag) => tag.ref.substring(10)))
                .filter((tag) => regex.test(tag))
                .reverse()[0];
        } catch {
            throw new Error("There was a problem connecting to GitHub. Please try again later");
        }

        if (!version) {
            throw new Error(`It looks like ${network} is not available right now. Please try again later`);
        }

        console.log();

        tasks = new Listr([
            {
                title: "Downloading operating system dependencies",
                task: async (_, task) => {
                    currentTask = task;
                    return await downloadOSDependencies();
                },
            },
            {
                title: "Installing operating system dependencies",
                task: async (_, task) => {
                    currentTask.title = currentTask.title.substring(0, currentTask.title.lastIndexOf("("));
                    currentTask = task;
                    return await installOSDependencies();
                },
            },
            {
                title: `Downloading Core ${version}`,
                task: () => downloadCore(version),
            },
            {
                title: "Downloading Core dependencies",
                task: async () => {
                    core().catch(() => {});
                    return await downloadPhase.promise;
                },
            },
            {
                title: "Installing Core dependencies",
                task: async () => {
                    await installPhase.start.promise;
                    return dependenciesListr;
                },
            },
            {
                title: `Building Core ${version}`,
                task: () => packagesListr,
            },
            {
                title: "Saving configuration",
                skip: () => skipConfiguration(),
                task: () => saveConfiguration(),
            },
            {
                title: "Adding plugins",
                task: () => addPlugins(),
            },
            {
                title: "Setting up database",
                skip: () => skipDatabase(),
                task: () => setUpDatabase(),
            },
        ]);

        if (!verbose) {
            await tasks.run(tasks);
        } else {
            await downloadOSDependencies();
            await installOSDependencies();
            await downloadCore(version);
            await core();
            if (!skipConfiguration()) {
                await saveConfiguration();
            }
            await addPlugins();
            if (!skipDatabase()) {
                await setUpDatabase();
            }
        }

        const home = homedir();

        const rc =
            `alias ${process.env.SOLAR_CORE_TOKEN}="${process.env.SOLAR_DATA_PATH}/bin/node ${process.env.SOLAR_CORE_PATH}/packages/core/bin/run $@ --token=${process.env.SOLAR_CORE_TOKEN}"\n` +
            `alias pm2="${process.env.SOLAR_DATA_PATH}/.pnpm/bin/pm2"`;
        writeFileSync(`${home}/.${process.env.SOLAR_CORE_TOKEN}rc`, rc);

        for (const file of [".bashrc", ".kshrc", ".zshrc"]) {
            const rcFile = `${home}/${file}`;
            if (existsSync(rcFile)) {
                const data = readFileSync(rcFile).toString();
                if (!data.includes(`.${process.env.SOLAR_CORE_TOKEN}rc`)) {
                    appendFileSync(rcFile, `\n. "$HOME"/".${process.env.SOLAR_CORE_TOKEN}rc"\n`);
                }
            }
        }
        console.log();
        console.log(
            `Solar Core has been successfully installed! To get started, type \x1b[1m${process.env.SOLAR_CORE_TOKEN}\x1b[22m`,
        );
    } catch (error) {
        await raiseError(error);
    }
}

start();
EOF

SOLAR_DATA_PATH="$SOLAR_DATA_PATH" SOLAR_CORE_TOKEN="$SOLAR_CORE_TOKEN" SOLAR_TEMP_PATH="$SOLAR_TEMP_PATH" NODE_PATH="$SOLAR_DATA_PATH"/.pnpm/lib/node_modules ARGV="$@" /bin/bash -c '
"$SOLAR_DATA_PATH"/bin/node "$SOLAR_TEMP_PATH"/install.js $ARGV
ERRORLEVEL=$?
rm -rf "$SOLAR_TEMP_PATH"
exit $ERRORLEVEL'

ERRORLEVEL=$?

cleanup

if [ $ERRORLEVEL -eq 0 ]; then
    exec $SHELL
fi
