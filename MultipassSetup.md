# Environment setup using Multipass

## Install Multipass

MacOS X users can download and install Multipass from the [official Mac download page](https://multipass.run/download/macos/).
Alternatively they can use [Homebrew](https://brew.sh/) to install it using `brew install multipass`.

Windows users can download and install Multipass from
the [official Windows download page](https://multipass.run/download/windows/).

Linux users can run `snap install multipass` from the command line.

## Setup VM for development

Go to a directory that you want to use for development: On a Mac, open Terminal and use e.g. `mkdir workspace; cd workspace`. On Mac make sure that you are not in a system directory like `Documents`or `Desktop` as mounting a directory in Multipass will not work in these directories.

On a Windows machine, you will also need to [install git](https://git-scm.com/download/win) before opening CMD or Powershell
and using e.g. `md workspace; cd workspace`.

```
git clone https://github.com/dgtlntv/protostar

multipass launch -n node --cloud-init ./protostar/ci-node.yaml --mount ./protostar:protostar
```

Open a shell with `multipass shell node` or using the Multipass UI.

In the shell, continue with installing the dependencies and starting the prototype:

```
yarn
yarn dev --host
```

## Connecting to the server

The server will display a message like this:

```
   VITE v5.4.0  ready in 768 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://10.83.94.241:5173/
  ➜  press h + enter to show help
```

The second arrow points to the NETWORK_ADDRESS that will allow you to connect to the server (in this example 10.83.94.241). Copy that address and open a web browser pointing to http://NETWORK_ADDRESS:5173
