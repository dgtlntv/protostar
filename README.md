# CLI Prototyping Tool

This tool allows you to create interactive CLI prototypes using a simple JSON configuration file. It's designed to be easy to use, even for those with limited coding experience.

## Prerequisites

You have to have [git](https://git-scm.com/downloads) and [node](https://nodejs.org/en/download/package-manager) installed.

## Setup and Usage

1. Fork this repository to your GitHub account.
2. Clone your forked repository:

```bash
git clone https://github.com/your-username/cli-prototype.git
cd cli-prototype
```

3. Install dependencies:

```bash
npm install
```

4. Run the development server:

```bash
npm run dev
```

5. Open the provided URL in your web browser to interact with your CLI prototype.

## Deployment

This project is set up to deploy automatically to GitHub Pages using GitHub Actions:

1. In your forked repository, go to Settings > Pages.
2. Under "Source", select "GitHub Actions".
3. The site will deploy automatically on pushes to the main branch.
4. You can find the deployed site URL in the GitHub Actions workflow runs.

## Customizing Your CLI

This prototyping tool is build in a way so that the only file you need to change to customize your CLI prototype is the `src/commands.json` file.
The general schema of the `commands.json` is:

```json
{
    "welcome": {
        "message": "Welcome to My CLI! Type 'help' for available commands.",
        "color": "green"
    },
    "globalVariables": {
        "username": "",
        "isLoggedIn": "false"
    },
    "commands": {
        // We'll add commands here
    }
}
```

Welcome is optional. It defines a welcome message that is output when the CLI is loaded for the first time.
globalVariables is optipnal as well and can be used to define variables that can be set and checked by commands. For example, through them we can prescribe a specific command sequence.
The commands of the CLI are defined in the commands object.

A basic command structure looks the following way:

```json
"commandName": {
  "description": "Description of the command",
  "action": "Output of the command"
}
```

So the key is the name of the command like it will be typed in the terminal. It has a description which will be used in help commands and an action object. The action object is where it is defined what the reaction will be if the user types the command.

## Features

### Colored Output

Specify a color for the command output:

```json
"action": "This will be green",
"color": "green"
```

Available colors: black, red, green, yellow, blue, magenta, cyan, white.

### Flags

Add flags to your commands:

```json
"commandName": {
  "description": "Description of the command",
  "action": "Output of the command",
  "flags": {
    "--flagName": {
      "description": "Description of the flag",
      "requiresValue": true,
      "aliases": ["-f"]
    }
  }
}
```

### Subcommands

Create nested command structures:

```json
"git": {
  "description": "Version control system",
  "subcommands": {
    "commit": {
      "description": "Record changes to the repository",
      "action": "Changes committed successfully."
    }
  }
}
```

### Positional Arguments

Define positional arguments for your commands:

```json
"args": [
  {
    "name": "text",
    "description": "The text to display"
  }
]
```

### Input Prompts

Create interactive prompts:

```json
"prompts": [
  {
    "name": "username",
    "message": "Enter your username:"
  },
  {
    "name": "password",
    "message": "Enter your password:",
    "hidden": true
  }
]
```

### Conditional Execution

Use conditions to determine command behavior:

```json
"action": [
  {
    "if": "flags['--environment'] === 'production'",
    "then": "Deploying to production...",
    "else": "Deploying to {{flags['--environment']}}..."
  }
]
```

### Command Aliases

Create alternative names for your commands:

```json
"aliases": ["ls", "dir"]
```

### Custom Output Formatting

Specify custom data and format:

```json
"action": {
  "data": [
    ["cpu", "memory", "disk"],
    ["25%", "4GB", "120GB"]
  ],
  "format": "table"
}
```

### Command Chaining

Execute multiple actions in sequence:

```json
"action": [
  "Installing dependencies...",
  { "command": "echo", "args": ["Dependencies installed."] },
  "Setup complete!"
]
```

### Time Actions

Simulate time-consuming operations:

```json
"action": [
  {
    "text": "Compiling source files...",
    "delay": 2000
  },
  {
    "text": "Build complete!",
    "delay": 500
  }
]
```

### Progress Bars

Show progress for long-running operations:

```json
"action": [
  {
    "type": "progressBar",
    "text": "Downloading:",
    "duration": 5000
  },
  "Download complete!"
]
```

### Spinners

Display a spinner for indeterminate progress:

```json
"action": [
  {
    "type": "spinner",
    "texts": ["Processing data", "Processing more data"],
    "duration": 3000
  },
  "Processing complete!"
]
```

### Global Variables

Set and use global variables:

```json
"globalVariables": {
  "username": "",
  "isLoggedIn": "false"
},
"commands": {
  "login": {
    "action": [
      {
        "setVariable": "username",
        "value": "{{prompt.username}}"
      },
      {
        "setVariable": "isLoggedIn",
        "value": "true"
      },
      "Welcome, {{globalVariables.username}}!"
    ]
  }
}
```

## Limitations

This is a simulation tool and does not execute actual system commands.
Some advanced features may require additional implementation in the JavaScript code.
