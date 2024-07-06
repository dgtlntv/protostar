# CLI Prototyping Tool

This tool allows you to create interactive CLI prototypes using a simple JSON configuration file. It's designed to be easy to use, even for those with limited coding experience.

## Usage

Usage

Define your CLI prototype in the commands.json file using the features described below.
Open the HTML file in a web browser to interact with your CLI prototype.

## Limitations

This is a simulation tool and does not execute actual system commands.
Some features (like custom output formatting) may require additional implementation in the JavaScript code.

## Features

The CLI prototype is configured using a `commands.json` file. Here are the features available:

### Basic Command Structure

```json
"commandName": {
  "description": "Description of the command",
  "action": "Output of the command"
}
```

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
"flags": {
  "--flagName": {
    "description": "Description of the flag",
    "requiresValue": true,
    "aliases": ["-f"]
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

Specify custom data and format (formatting to be implemented in JavaScript):

```json
"action": {
  "data": {
    "cpu": "25%",
    "memory": "4GB",
    "disk": "120GB"
  },
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
    "text": "Processing data",
    "duration": 3000
  },
  "Processing complete!"
]
```
