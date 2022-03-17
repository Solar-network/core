#!/bin/bash

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

echo Thanks for choosing to install Solar Core! Preparing the setup procedure...
echo

RC='export SOLAR_CORE_TOKEN=solar
export SOLAR_CORE="$SOLAR_CORE_TOKEN"-core
export SOLAR_CORE_PATH="$HOME"/"$SOLAR_CORE"
export SOLAR_DATA_PATH="$HOME"/."$SOLAR_CORE_TOKEN"
export N_PREFIX="$SOLAR_DATA_PATH"
export PATH=$PATH:"$SOLAR_DATA_PATH"/usr/bin:"$SOLAR_DATA_PATH"/bin:"$SOLAR_DATA_PATH"/sbin:"$SOLAR_DATA_PATH"/usr/share:"$SOLAR_DATA_PATH"/usr/lib:"$HOME"/.pnpm/bin
export CFLAGS="--sysroot=\"$SOLAR_DATA_PATH\""
export LDFLAGS="--sysroot=\"$SOLAR_DATA_PATH\""
export PERL5LIB=$PERL5LIB:"$SOLAR_DATA_PATH"/usr/share/perl5
export GIT_EXEC_PATH="$SOLAR_DATA_PATH"/usr/lib/git-core
export GIT_TEMPLATE_DIR="$SOLAR_DATA_PATH"/usr/share/git-core/templates
'

eval "$RC"

export SOLAR_TEMP_PATH="$SOLAR_DATA_PATH"/tmp

echo "$RC" > "$HOME"/"."$SOLAR_CORE_TOKEN"rc"

NODEJS=$(which node 2>/dev/null || :)

if [[ -z $NODEJS ]]; then
    NODEVERSION=0
else
    NODEVERSION=$("$NODEJS" -v)
    NODEVERSION="${NODEVERSION:1}"
    NODEVERSION=(${NODEVERSION//./ }})
fi

rm -rf "$SOLAR_TEMP_PATH"
mkdir -p "$SOLAR_DATA_PATH" "$HOME"/.pnpm/bin "$SOLAR_TEMP_PATH"/cache "$SOLAR_TEMP_PATH"/state/archives/partial "$SOLAR_TEMP_PATH"/state/lists/partial

if [ $NODEVERSION -lt 16 ]; then
    rm -rf "$HOME"/.nvm
    wget -qO n https://raw.githubusercontent.com/tj/n/master/bin/n
    bash n 16 >/dev/null
    rm n
fi

npm config set prefix "$SOLAR_TEMP_PATH"
npm config set global-dir "$SOLAR_TEMP_PATH"
npm config set global-bin-dir "$SOLAR_TEMP_PATH"/bin
npm install -g delay kleur listr pnpm prompts >/dev/null 2>/dev/null
npm config set prefix "$HOME"/.pnpm
npm config set global-dir "$HOME"/.pnpm
npm config set global-bin-dir "$HOME"/.pnpm/bin

export NODE_PATH="$SOLAR_TEMP_PATH"/lib/node_modules
cat << 'EOF' > "$SOLAR_TEMP_PATH"/install.js
const { spawn, spawnSync } = require("child_process");
const delay = require("delay");
const { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } = require("fs");
const { homedir } = require("os");
const { white } = require("kleur");
const Listr = require("listr");
const prompts = require("prompts");

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
    if (data.endsWith("not upgraded.")) {
        const split = data.split(" ");
        totalPackages = +split[0] + +split[2] + +split[5];
    } else if (data.startsWith("Get:") && totalPackages > 0) {
        const split = data.split(" ");
        const currentPackage = split[0].substring(4);
        currentTask.title = `Downloading dependencies (${currentPackage} of ${totalPackages}: ${split[4]}-${split[6]})`;
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
                "\"$SOLAR_CORE_PATH\"/packages/core/bin/run plugin:install @alessiodf/rocket-boot && \"$SOLAR_CORE_PATH\"/packages/core/bin/run rocket:enable --force --token=\"$SOLAR_CORE_TOKEN\"",
        },
        {
            package: "@alessiodf/round-monitor",
            command:
                "\"$SOLAR_CORE_PATH\"/packages/core/bin/run plugin:install @alessiodf/round-monitor && \"$SOLAR_CORE_PATH\"/packages/core/bin/run monitor:enable --disableServer --restartTimeBuffer=45 --force --token=\"$SOLAR_CORE_TOKEN\"",
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
        const pnpm = spawn(`
        . "$HOME"/"."$SOLAR_CORE_TOKEN"rc"
        npm -g install pnpm &&
        pnpm -g install pm2 &&
        pm2 install pm2-logrotate &&
        pm2 set pm2-logrotate:max_size 500M &&
        pm2 set pm2-logrotate:compress true &&
        pm2 set pm2-logrotate:retain 7 &&
        rm -rf /tmp/pm2-logrotate &&
        (crontab -l; echo "@reboot /bin/bash -lc \\"source "$HOME"/"."$SOLAR_CORE_TOKEN"rc"; pm2 resurrect\\"") | sort -u - | crontab - 2>/dev/null &&
        cd "$SOLAR_CORE_PATH" &&
        pnpm install ${pnpmFlags} &&
        pnpm build ${pnpmFlags} &&
        RC='export POSTGRES_DIR=$(find "$SOLAR_DATA_PATH" -regex ".*/usr/lib/postgresql/[0-9]+")\n` +
        `alias "$SOLAR_CORE_TOKEN"="\"$SOLAR_CORE_PATH\"/packages/core/bin/run $@ --token=\"$SOLAR_CORE_TOKEN\""' &&
        eval "$RC" &&
        echo "$RC" >> "$HOME"/"."$SOLAR_CORE_TOKEN"rc" &&
        packages/core/bin/run config:publish --network=${network} >/dev/null 2>/dev/null
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
        const architecture = spawnSync("gcc -dumpmachine", { shell: true }).stdout.toString().trim();
        const git = spawn(`
        RC='export CPATH=$CPATH:"$SOLAR_DATA_PATH"/usr/include:"$SOLAR_DATA_PATH"/usr/include/${architecture}\n` +
        `export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:"$SOLAR_DATA_PATH"/usr/lib/${architecture}'\n
        eval "$RC" &&
        echo "$RC" >> "$HOME"/"."$SOLAR_CORE_TOKEN"rc" &&
        ln -fs "$SOLAR_DATA_PATH"/usr/bin/gcc "$SOLAR_DATA_PATH"/usr/bin/cc &&
        ln -fs /usr/lib/${architecture}/libgcc_s.* "$SOLAR_DATA_PATH"/usr/lib/${architecture}/ &&
        (grep -rl include_next "$SOLAR_DATA_PATH"/usr/include/c++/ | xargs sed -i "s/include_next/include/g" 2>/dev/null; true) &&
        rm -rf "$SOLAR_CORE_PATH" &&
        cd "$HOME" &&
        git clone "https://github.com/solar-network/core.git" "$SOLAR_CORE_PATH" --progress &&
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
            "libjemalloc-dev",
            "libpq-dev",
            "libtool",
            "postgresql",
            "postgresql-contrib",
            "postgresql-client",
            "postgresql-client-common",
            "python",
        ];

        const enumerateDependencies = () => {
            const cache = spawnSync(`apt-cache depends ${packages.join(" ")} | grep '[ |]Depends: [^<]' | cut -d: -f2`, {
                shell: true,
            }).stdout.toString();
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
            reject (new Error("System updates are currently in progress. Please wait for them to finish and try again"));
            return;
        }

        const apt = spawn(`
        APT_PARAMS="-o debug::nolocking=true -o dir::cache=\"$SOLAR_TEMP_PATH\"/cache -o dir::state=\"$SOLAR_TEMP_PATH/state\"" &&
        apt-get $APT_PARAMS update &&
        apt-get $APT_PARAMS -y -d install --reinstall ${enumerateDependencies()}`,
            { shell: true },
        );
        apt.stdout.on("data", (data) => route(data));
        apt.stderr.on("data", (data) => route(data, true));
        apt.on("close", (code) => {
            if (code === 0) {
                writeFileSync(`${process.env.SOLAR_DATA_PATH}/.installed`, "");
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
                currentTask.title = `Installing dependencies (${currentPackage} of ${totalPackages}: ${name})`;
            }
            try {
                await installOSDependency(pkg);
            } catch (error) {
                reject(error);
            }
        }
        currentTask.title = "Installing dependencies";
        resolve();
    });
}

async function installOSDependency(pkg) {
    return await new Promise((resolve, reject) => {
        const dpkg = spawn(`dpkg -x ${pkg} "${process.env.SOLAR_DATA_PATH}"`, { shell: true });
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

async function setUpDatabase() {
    return new Promise((resolve, reject) => {
        const psql = spawn(`
        . "$HOME"/".${process.env.SOLAR_CORE_TOKEN}rc" &&
        mkdir -p "$HOME"/.local/share/$SOLAR_CORE/${network}/database &&
        "$POSTGRES_DIR"/bin/initdb -D "$HOME"/.local/share/"$SOLAR_CORE"/${network}/database &&
        echo "\n# "$SOLAR_CORE_TOKEN"\nlisten_addresses = ''\nunix_socket_directories = '"$HOME"/.local/share/"$SOLAR_CORE"/${network}/database'\nunix_socket_permissions = 0700" >> "$HOME"/.local/share/"$SOLAR_CORE"/${network}/database/postgresql.conf &&
        "$POSTGRES_DIR"/bin/pg_ctl -D "$HOME"/.local/share/"$SOLAR_CORE"/${network}/database start >"$SOLAR_TEMP_PATH"/pg_ctl.log &&
        cat "$SOLAR_TEMP_PATH"/pg_ctl.log &&
        rm "$SOLAR_TEMP_PATH"/pg_ctl.log &&
        sed -i "s@\"/usr/lib/postgresql/\"@\""$SOLAR_DATA_PATH"/usr/lib/postgresql/\"@g" "$SOLAR_DATA_PATH"/usr/share/perl5/PgCommon.pm
        createdb -h "$HOME"/.local/share/"$SOLAR_CORE"/${network}/database "$SOLAR_CORE_TOKEN"_${network}
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

function skip(phase) {
    switch (phase) {
        case 0: {
            return existsSync(`${process.env.SOLAR_DATA_PATH}/.installed`);
        }
        case 1: {
            return totalPackages === 0;
        }
        case 2: {
            const home = homedir();
            if (existsSync(`${home}/.local/share/${process.env.SOLAR_CORE}/${network}/database/postgresql.conf`)) {
                const config = readFileSync(
                    `${home}/.local/share/${process.env.SOLAR_CORE}/${network}/database/postgresql.conf`,
                ).toString();
                return config.includes(`# ${process.env.SOLAR_CORE_TOKEN}`);
            }
        }
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
        }

        pnpmFlags += verbose ? "append-only" : "ndjson";

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
            return;
        }

        const { confirm } = await prompts({
            type: "confirm",
            name: "confirm",
            message: "Are you sure?",
        });

        if (!confirm) {
            await start();
            return;
        }

        console.log();
        console.log(`Installing Solar Core for ${network}. This process may take a few minutes`);

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
                title: `Downloading operating system dependencies`,
                skip: () => skip(0),
                task: async (_, task) => {
                    currentTask = task;
                    return await downloadOSDependencies();
                },
            },
            {
                title: "Installing operating system dependencies",
                skip: () => skip(1),
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
                title: `Downloading Core dependencies`,
                task: async () => {
                    core().catch(() => {});
                    return await downloadPhase.promise;
                },
            },
            {
                title: `Installing Core dependencies`,
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
                title: "Adding plugins",
                task: () => addPlugins(),
            },
            {
                title: "Setting up database",
                skip: () => skip(2),
                task: () => setUpDatabase(),
            },
        ]);

        if (!verbose) {
            await tasks.run(tasks);
        } else {
            if (!skip(0)) {
                await downloadOSDependencies();
                await installOSDependencies();
            }
            await downloadCore(version);
            await core();
            await addPlugins();
            if (!skip(2)) {
                await setUpDatabase();
            }
        }

        const home = homedir();

        for (const file of [".bashrc", ".kshrc", ".zshrc"]) {
            const rcFile = `${home}/${file}`;
            let add = true;
            if (existsSync(rcFile)) {
                const data = readFileSync(rcFile).toString();
                if (data.includes(`.${process.env.SOLAR_CORE_TOKEN}rc`)) {
                    add = false;
                }
            }

            if (add) {
                appendFileSync(rcFile, `\n. "$HOME"/".${process.env.SOLAR_CORE_TOKEN}rc"\n`);
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

node "$SOLAR_TEMP_PATH"/install.js $@;

if [ $? -eq 0 ]; then
    exec $SHELL;
fi
