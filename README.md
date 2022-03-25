# Solar Core

<p align="center">
	<img src="./banner.png" />
</p>

## Introduction

> This repository contains all packages that make up the Solar Core.

## Installation

Create a new user (for example `solar`), switch to that account and then download and run `install.sh`:

```
adduser solar
su -l solar
wget -O install.sh https://raw.githubusercontent.com/solar-network/core/main/install.sh
bash install.sh
```

Choose whether you want to run on `Mainnet` (which installs the latest stable release) or `Testnet` (which installs the latest development release) and then wait for the installation to complete.

When it has finished, run `solar` to interact with the command-line interface. If you are a registered delegate, configure the node with your passphrase with `solar config:forger`. To start the relay, run `solar relay:start` and, if you are a delegate, also start the forger process with `solar forger:start`.

You can check that everything is working correctly by reading the logs with `pm2 logs`.

The PM2 process manager is automatically enabled to load on startup, so if you would like Solar Core to automatically start when your system reboots, first launch the processes you would like to restart automatically with the commands above, then run `pm2 save`.

### Command Line Options

You can enable verbose logging during the installation process by adding the `-v` switch to `bash install.sh`. You can also pass the network directly with `--network=mainnet` or `--network=testnet` for an unattended installation.

## Security

If you discover a security vulnerability within any of these packages, please send an e-mail to security@solar.org. All security vulnerabilities will be promptly addressed.

## Credits

This project exists thanks to all the people who [contribute](../../contributors).

## License

Please read the separate [LICENSE](LICENSE) file for details.
