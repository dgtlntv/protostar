# Terminal Emulator Tests

This directory contains end-to-end tests for the terminal emulator.

## Test Philosophy

The tests focus on verifying the basic functionality of the terminal emulator:

1. Correctly rendering user input to the terminal
2. Handling special characters
3. Supporting arrow navigation
4. Managing text editing operations (backspace, insertions)
5. Properly wrapping long lines

## Running Tests

Tests are implemented using Playwright for browser-based testing.

```bash
# Run tests headlessly
npm test

# Run tests with UI
npm run test:ui
```

## Test Files

- `terminal-test.html` - Test page with a terminal instance
- `input-rendering.spec.js` - Tests for input rendering functionality

## Future Test Areas

- Command execution
- Output rendering
- Handling of complex terminal operations
- Performance testing