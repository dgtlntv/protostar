= Environment setup using multipass

== Install multipass

MacOS X users can download and install Multipass from the [official download page](https://multipass.run/download/macos/).
Alternatively they can use [Homebrew](https://brew.sh/) to install it using 'brew install multipass'.

Windows users can download and install Multipass from
the [official download page](https://multipass.run/download/windows/).

Linux users can run 'snap install multipass' from the command line.

== Setup VM for development

Go to a directory that you want to use for development.

'''
git clone https://github.com/dgtlntv/protostar

multipass launch -n node --cloud-init protostar/ci-node.yaml
multipass mount protostar node:protostar
'''

Open a shell with multipass shell node or using the Multipass UI.

In the shell, continue with running the example script:

'''
yarn
yarn dev --host
'''

== Connecting to the server

Find out the IP address of the VM using the GUI -> Instances view, or using 'multipass list'

Open a web browser pointing to http://IP_ADDRESS:5173
