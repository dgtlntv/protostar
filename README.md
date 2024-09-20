# CLI Prototyping Tool

This tool allows you to create interactive CLI prototypes using a simple JSON configuration file. It's designed to be easy to use, even for those with limited coding experience.

## Prerequisites

You have to have [git](https://git-scm.com/downloads), [node](https://nodejs.org/en/download/package-manager) and [yarn](https://classic.yarnpkg.com/lang/en/docs/install/) installed.

## Setup and Usage

1. Fork this repository to your GitHub account.
2. Clone your forked repository:

```bash
git clone https://github.com/your-username/cli-prototype.git
cd cli-prototype
```

3. Install dependencies:

```bash
yarn install
```

4. Run the development server:

```bash
yarn run dev
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
    // Welcome message for the CLI prototype
    "welcome": "Welcome to My CLI! Type 'help' for available commands.",

    // The global variables you can read and write accross commands
    "variables": {
        "username": "dgtlntv",
        "isLoggedIn": "false"
    },
    "commands": {
        // The commands available in the CLI prototype
    }
}
```

-   `welcome` is optional. It defines a welcome message that is output when the CLI is loaded for the first time.
-   `variables` is optional as well and can be used to define variables that can be set and checked by commands. For example, through them we can prescribe a specific command sequence.
-   The commands of the CLI are defined in the commands object.

### Commands

#### Command name

The command name with which the command can be called is the key of the command object. In this example we are creating a `register` command:

```json
{
    "commands": {
        "register": {
            // Command content
        }
    }
}
```

##### Description

The description is shown in the automatically generated help message.

```json
{
    "commands": {
        "register": {
            "description": "This command registers a new account with the service."
        }
    }
}
```

##### Alias

An alias allows you to call the same command with a different command name. Can either be a single string or an array of strings.
In the following example the user could call the same `register`command with `enrol` or `signup` now.

```json
{
    "commands": {
        "register": {
            "alias": ["enrol", "signup"]
        }
    }
}
```

##### Example

The example will be used to provide example usages of a command in the automatically generated help message. Can be a single example [command, description] or an array of such examples.

```json
{
    "commands": {
        "register": {
            "example": [
                "register email@example.com",
                "Register a new account with the email@example.com email."
            ]
        }
    }
}
```

##### Positional arguments

Positional arguments in commands can be either required or optional. Required positional arguments are denoted as `<email>`, while optional arguments are represented as `[username]`.

```json
{
    "commands": {
        "register <email> [username]": {
            // Command content
        }
    }
}
```

The `|` character allows you to specify aliases for positional arguments.

```json
{
    "commands": {
        "register <email | username>": {
            // Command content
        }
    }
}
```

The last positional argument can optionally accept an array of values, by using the `..` operator:

```json
{
    "commands": {
        "register <email> [..socialUrls]": {
            // Command content
        }
    }
}
```

Under `positional` the positional argument of a command are defined. You can use the following fields to describe the positional arguments:

| Field        | Description                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| alias        | Alternative name(s) for the positional argument.                                                                              |
| choices      | An array of valid values for this positional argument.                                                                        |
| default      | The default value for this positional argument if not provided.                                                               |
| demandOption | Marks the argument as required. If true, the command will fail without it. If a string, it will be used as the error message. |
| description  | A short description of the positional argument.                                                                               |
| type         | The expected data type of the positional argument (boolean, number, string).                                                  |

```json
{
    "commands": {
        "register <email>": {
            "positional": {
                "email": {
                    "alias": "username",
                    // choice and default don't really make sense in this example, but is an available configuration
                    // "choices": [
                    //     "choice1",
                    //     "choice2",
                    //     "choice3"
                    // ],
                    // "default": "defaultOption",
                    "demandOption": true,
                    "description": "The email to register your account with",
                    "type": "string"
                }
            }
        }
    }
}
```

##### Options / flags

Under `options` the flags (eg. `--flag`) of a command are defined. You can use the following fields to describe the options/flags:

| Field              | Description                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| alias              | Alternative name(s) for the positional argument.                                                                              |
| choices            | An array of valid values for this positional argument.                                                                        |
| default            | The default value for this positional argument if not provided.                                                               |
| defaultDescription | A description of the default value.                                                                                           |
| demandOption       | Marks the argument as required. If true, the command will fail without it. If a string, it will be used as the error message. |
| description        | A short description of the positional argument.                                                                               |
| group              | The group to which this option belongs, used for grouping related options in help output.                                     |
| hidden             | If true, the option will not be shown in help output.                                                                         |
| nargs              | The number of arguments to be consumed by this option.                                                                        |
| requiresArg        | If true, the option must be specified with a value.                                                                           |
| type               | The expected data type of the positional argument (boolean, number, string).                                                  |

```json
{
    "commands": {
        "register": {
            "options": {
                "password": {
                    "alias": ["pwd", "pw"],
                    // choice and default don't really make sense in this example, but is an available configuration
                    // "choices": [
                    //     "choice1",
                    //     "choice2",
                    //     "choice3"
                    // ],
                    // "default": "defaultOption",
                    // "defaultDescription": "The description for the default option",
                    "demandOption": true,
                    "description": "The password for your account",
                    "group": "Login credentials",
                    "hidden": false,
                    "nargs": 1,
                    "requiresArg": true,
                    "type": "string"
                }
            }
        }
    }
}
```

##### Sub-commands

If you want to chain multiple commands you can nest commands under `commands`. The commands defined under `commands` allow for the exact same configuration as a root command.

```json
{
    "commands": {
        "register": {
            "commands": {
                "user": {
                    // Command content
                },
                "serviceaccount": {
                    // Command content
                }
            }
        }
    }
}
```

##### Handler

Under `handler` the response to a command is defined. The handler accepts the components available in the CLI prototyping tool. The available components are the following:

| Component    | Description                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| text         | Prints text to the terminal.                                                                              |
| progressBar  | Renders a progress bar to the terminal.                                                                   |
| spinner      | Renders a spinner to the terminal.                                                                        |
| table        | Renders a table to the terminal.                                                                          |
| conditional  | Evaluates a condition and then executes a component based on if the condition evaluated to true or false. |
| variable     | Saves a value to a global variable.                                                                       |
| autoComplete | Prompt that auto-completes as the user types.                                                             |
| basicAuth    | Prompt for username and password authentication.                                                          |
| confirm      | Prompt to confirm or deny a statement.                                                                    |
| form         | Prompt for multiple values on a single terminal screen.                                                   |
| input        | Prompt for user input.                                                                                    |
| invisible    | Prompt for user input, hiding it from the terminal.                                                       |
| list         | Prompt returning a list of values, created by splitting user input.                                       |
| multiSelect  | Prompt allowing selection of multiple items from a list of options.                                       |
| number       | Prompt that takes a number as input.                                                                      |
| password     | Prompt that takes user input and masks it in the terminal.                                                |
| quiz         | Prompt for multiple-choice quiz questions.                                                                |
| survey       | Prompt for user feedback on a list of questions using a defined scale.                                    |
| scale        | Compact version of Survey prompt using a Likert Scale for quick feedback.                                 |
| select       | Prompt for selecting from a list of options.                                                              |
| sort         | Prompt for sorting items in a list.                                                                       |
| snippet      | Prompt for replacing placeholders in a snippet of code or text.                                           |
| toggle       | Prompt for toggling between two values.                                                                   |

The handler accepts either a single component:

```json
{
    "commands": {
        "register": {
            "handler": {
                "component": "text",
                "output": "Registered successfully"
            }
        }
    }
}
```

Or an array of components:

```json
{
    "commands": {
        "register": {
            "handler": [
                {
                    "component": "text",
                    "output": "Registering in progress...",
                    "duration": 5000
                },
                {
                    "component": "text",
                    "output": "Registered successfully"
                }
            ]
        }
    }
}
```

The following section explains each available component more in depth:

###### Components

**Text**
The simplest of the components is the text component. It simply prints text to the terminal, while optionally waiting for some time after printing the text to the terminal.

| field    | required/optional | Description                                                                                                                                                          |
| -------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| output   | required          | The text that should be printed to the terminal                                                                                                                      |
| duration | optional          | The duration (in milliseconds) that should be waited after printing the text. Also accepts "random" which will waits for a random duration between 100ms and 3000ms. |

```json
{
    "commands": {
        "register": {
            "handler": [
                {
                    "component": "text",
                    "output": "Registering in progress...",
                    "duration": 5000
                },
                {
                    "component": "text",
                    "output": "Registered successfully"
                }
            ]
        }
    }
}
```

---

Progress bar
The progress bar component renders a progress bar in the terminal, showing a task's completion over time.
fieldrequired/optionalDescriptionoutputrequiredThe text displayed alongside the progress bardurationrequiredThe duration (in milliseconds) for the progress bar to complete. Also accepts "random" which will use a random duration between 100ms and 3000ms.
jsonCopy{
"commands": {
"install": {
"handler": {
"component": "progressBar",
"output": "Installing dependencies...",
"duration": 3000
}
}
}
}
Spinner
The spinner component displays an animated spinner in the terminal, indicating that a process is ongoing.
fieldrequired/optionalDescriptionoutputrequiredThe text or array of texts displayed alongside the spinnerdurationrequiredThe duration (in milliseconds) for which the spinner should run. Also accepts "random" which will use a random duration between 100ms and 3000ms.conclusionoptionalSpecifies how the spinner should conclude its animation. Can be "stop", "success", or "fail".
jsonCopy{
"commands": {
"process": {
"handler": {
"component": "spinner",
"output": ["Processing", "Please wait", "Almost done"],
"duration": 5000,
"conclusion": "success"
}
}
}
}
Table
The table component renders a formatted table in the terminal.
fieldrequired/optionalDescriptionoutputrequiredA 2D array representing the table data, including headers if desiredcolWidthsoptionalAn array of numbers representing the width of each column in the table
jsonCopy{
"commands": {
"list": {
"handler": {
"component": "table",
"output": [
["Name", "Age", "City"],
["John", "30", "New York"],
["Alice", "25", "London"]
],
"colWidths": [10, 5, 15]
}
}
}
}
Conditional
The conditional component allows for branching logic based on a condition.
fieldrequired/optionalDescriptionoutputrequiredAn object containing "if", "then", and optionally "else" fieldsifrequiredA string representing the condition to be evaluatedthenrequiredThe component to be executed if the condition is trueelseoptionalThe component to be executed if the condition is false (if this field is provided)
jsonCopy{
"commands": {
"check": {
"handler": {
"component": "conditional",
"output": {
"if": "isLoggedIn == true",
"then": {
"component": "text",
"output": "Welcome back!"
},
"else": {
"component": "text",
"output": "Please log in first."
}
}
}
}
}
}
Variable
The variable component allows setting global variables that can be used across commands.
fieldrequired/optionalDescriptionoutputrequiredAn object where keys are variable names and values are strings
jsonCopy{
"commands": {
"setUser": {
"handler": {
"component": "variable",
"output": {
"username": "john_doe",
"isLoggedIn": "true"
}
}
}
}
}
AutoComplete
The autoComplete component provides a prompt that auto-completes as the user types.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the prompt's resultmessagerequiredMessage to display with the prompt in the terminalchoicesrequiredList of items for user selectionlimitoptionalNumber of choices to display on-screeninitialoptionalThe index of the initial selectionmultipleoptionalAllows selection of multiple choicesfooteroptionalOptional message in muted color providing interaction hint
jsonCopy{
"commands": {
"search": {
"handler": {
"component": "autoComplete",
"name": "query",
"message": "Search for a fruit:",
"choices": ["Apple", "Banana", "Cherry", "Date", "Elderberry"],
"limit": 3,
"footer": "Use arrow keys to navigate"
}
}
}
}
BasicAuth
The basicAuth component prompts for username and password authentication.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the prompt's resultmessagerequiredMessage to display with the prompt in the terminalusernamerequiredUsername to compare againstpasswordrequiredPassword to compare againstshowPasswordoptionalDetermines whether to hide or show the password
jsonCopy{
"commands": {
"login": {
"handler": {
"component": "basicAuth",
"name": "auth",
"message": "Please enter your credentials:",
"username": "admin",
"password": "secret",
"showPassword": false
}
}
}
}
Confirm
The confirm component prompts to confirm or deny a statement.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the prompt's resultmessagerequiredQuestion to be confirmed or deniedinitialoptionalSet whether the initial value is true or false
jsonCopy{
"commands": {
"delete": {
"handler": {
"component": "confirm",
"name": "confirmDelete",
"message": "Are you sure you want to delete this item?",
"initial": false
}
}
}
}
Form
The form component prompts for multiple values on a single terminal screen.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the form's resultsmessagerequiredMessage to display with the form in the terminalchoicesrequiredArray of form fields
Each choice in the choices array should have the following properties:

name: Identifier for the form field
message: Label for the form field
initial (optional): Initial placeholder value for the field

jsonCopy{
"commands": {
"register": {
"handler": {
"component": "form",
"name": "userInfo",
"message": "Please enter your information:",
"choices": [
{
"name": "username",
"message": "Username:",
"initial": "user123"
},
{
"name": "email",
"message": "Email:"
}
]
}
}
}
}
Input
The input component prompts for user input.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the input's resultmessagerequiredQuestion or prompt for user inputinitialoptionalInitial placeholder value
jsonCopy{
"commands": {
"setName": {
"handler": {
"component": "input",
"name": "username",
"message": "What's your name?",
"initial": "Anonymous"
}
}
}
}
Invisible
The invisible component prompts for user input, hiding it from the terminal.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the input's resultmessagerequiredQuestion or prompt for hidden user input
jsonCopy{
"commands": {
"setPassword": {
"handler": {
"component": "invisible",
"name": "password",
"message": "Enter your password:"
}
}
}
}
List
The list component prompts for a list of values, created by splitting user input.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the list's resultmessagerequiredQuestion or prompt for list input
jsonCopy{
"commands": {
"addTags": {
"handler": {
"component": "list",
"name": "tags",
"message": "Enter tags (comma-separated):"
}
}
}
}
MultiSelect
The multiSelect component allows selection of multiple items from a list of options.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the selection resultsmessagerequiredMessage to display with the selection promptchoicesrequiredArray of selectable optionslimitoptionalNumber of choices to display on-screen
Each choice in the choices array should have the following properties:

name: Display text for the choice
value: Value to be returned if selected

jsonCopy{
"commands": {
"selectFeatures": {
"handler": {
"component": "multiSelect",
"name": "features",
"message": "Select desired features:",
"choices": [
{ "name": "Auto-save", "value": "autosave" },
{ "name": "Dark mode", "value": "darkmode" },
{ "name": "Notifications", "value": "notifications" }
],
"limit": 2
}
}
}
}
Number
The number component prompts for a numeric input.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the number input resultmessagerequiredQuestion or prompt for number input
jsonCopy{
"commands": {
"setAge": {
"handler": {
"component": "number",
"name": "age",
"message": "Enter your age:"
}
}
}
}
Password
The password component prompts for a password, masking the input in the terminal.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the password input resultmessagerequiredQuestion or prompt for password input
jsonCopy{
"commands": {
"changePassword": {
"handler": {
"component": "password",
"name": "newPassword",
"message": "Enter new password:"
}
}
}
}
Quiz
The quiz component presents multiple-choice quiz questions.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the quiz resultmessagerequiredQuiz question to displaychoicesrequiredList of possible answers to the quiz questioncorrectChoicerequiredIndex of the correct choice from the choices array
jsonCopy{
"commands": {
"quiz": {
"handler": {
"component": "quiz",
"name": "capitalQuiz",
"message": "What is the capital of France?",
"choices": ["London", "Berlin", "Paris", "Madrid"],
"correctChoice": 2
}
}
}
}
Survey
The survey component prompts for user feedback on a list of questions using a defined scale.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the survey resultsmessagerequiredMessage to display with the survey promptscalerequiredDefinition of the survey scalechoicesrequiredList of survey questions
Each item in the scale array should have:

name: Label for the scale point
message: Explanation text for the scale point

Each item in the choices array should have:

name: Identifier for the survey question
message: Survey question text

jsonCopy{
"commands": {
"feedback": {
"handler": {
"component": "survey",
"name": "userSatisfaction",
"message": "Please rate your experience:",
"scale": [
{ "name": "1", "message": "Strongly Disagree" },
{ "name": "3", "message": "Neutral" },
{ "name": "5", "message": "Strongly Agree" }
],
"choices": [
{ "name": "easeOfUse", "message": "The product was easy to use" },
{ "name": "features", "message": "The product had all the features I needed" }
]
}
}
}
}
Scale
The scale component is a compact version of the Survey prompt, using a Likert Scale for quick feedback.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the scale resultsmessagerequiredMessage to display with the scale promptscalerequiredDefinition of the scalechoicesrequiredList of scale questions
The scale and choices arrays have the same structure as in the Survey component. Additionally, each choice can have an optional initial property to set an initial value.
jsonCopy{
"commands": {
"quickFeedback": {
"handler": {
"component": "scale",
"name": "productRating",
"message": "Rate our product:",
"scale": [
{ "name": "1", "message": "Poor" },
{ "name": "3", "message": "Average" },
{ "name": "5", "message": "Excellent" }
],
"choices": [
{ "name": "overall", "message": "Overall satisfaction", "initial": 3 },
{ "name": "support", "message": "Customer support" }
]
}
}
}
}
Select
The select component prompts for selecting from a list of options.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the selection resultmessagerequiredMessage to display with the selection promptchoicesrequiredList of options to select from
The choices can be either an array of strings or an array of objects with name and value properties.

jsonCopy{
"commands": {
"chooseColor": {
"handler": {
"component": "select",
"name": "favoriteColor",
"message": "Choose your favorite color:",
"choices": [
{ "name": "Red", "value": "red" },
{ "name": "Blue", "value": "blue" },
{ "name": "Green", "value": "green" }
]
}
}
}
}
Sort
The sort component prompts for sorting items in a list.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the sorted resultmessagerequiredMessage to display with the sorting promptchoicesrequiredList of items to be sorted
jsonCopy{
"commands": {
"prioritizeTasks": {
"handler": {
"component": "sort",
"name": "taskOrder",
"message": "Sort these tasks by priority:",
"choices": [
"Fix bugs",
"Implement new feature",
"Write documentation",
"Refactor code"
]
}
}
}
}
Snippet
The snippet component prompts for replacing placeholders in a snippet of code or text.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the completed snippetmessagerequiredMessage to display with the snippet promptfieldsrequiredList of fields to be filled in the snippettemplaterequiredTemplate string with placeholders marked as ${name}
Each item in the fields array should have:

name: Identifier for the field
message: Prompt message for the field

jsonCopy{
"commands": {
"generateCode": {
"handler": {
"component": "snippet",
"name": "generatedFunction",
"message": "Generate a function:",
"fields": [
{ "name": "functionName", "message": "Function name:" },
{ "name": "paramName", "message": "Parameter name:" }
],
"template": "function ${functionName}(${paramName}) {\n // Your code here\n}"
}
}
}
}
Toggle
The toggle component prompts for toggling between two values.
fieldrequired/optionalDescriptionnamerequiredIdentifier for accessing the toggle resultmessagerequiredMessage to display with the toggle promptenabledrequiredLabel for the enabled statedisabledrequiredLabel for the disabled state
jsonCopy{
"commands": {
"toggleNotifications": {
"handler": {
"component": "toggle",
"name": "notificationsEnabled",
"message": "Enable notifications?",
"enabled": "Yes",
"disabled": "No"
}
}
}
}
