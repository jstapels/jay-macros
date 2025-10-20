# Jay Macros - AI Development Guide

## Module Overview

**Jay Macros** is a Foundry VTT module that automatically creates macros for selected tokens on a designated hotbar page. When a player or GM selects one or more tokens, the module dynamically populates a hotbar page with macros for that token's usable items.

### Key Features
- Automatically creates macros when tokens are selected
- Cleans up macros when tokens are deselected
- Supports multiple simultaneous token selections
- Configurable hotbar page assignment
- Filters items by activation type (action, bonus action, reaction, etc.)
- Integrates with D&D 5e favorites system
- Optional GM-only mode

## Technical Details

### Compatibility
- **Foundry VTT**: v12+ (verified for v13)
- **D&D 5e System**: v4.0+ (verified for v5.0)
- Uses the D&D 5e **activities system** (introduced in v4.0)

### File Structure
```
jay-macros/
├── scripts/
│   └── main.mjs          # Main module logic
├── lang/
│   └── en.json           # English localization
├── module.json           # Module manifest
├── README.md             # User-facing documentation
└── CLAUDE.md             # This file (AI development guide)
```

## Core Architecture

### Main Components (`scripts/main.mjs`)

#### 1. Token Selection Hook
```javascript
Hooks.on('controlToken', controlTokenHook);
```
- Triggered whenever a token is selected or deselected
- Uses **debouncing** (100ms) to handle rapid selections
- Prevents race conditions when selecting multiple tokens quickly

#### 2. Debounce Mechanism
The module implements a debounce pattern to solve timing issues:
- When tokens are selected/deselected rapidly, a 100ms timer starts
- If more selections occur during this time, the timer resets
- After the timer expires, all currently selected tokens are processed together
- This prevents the macro bar from getting "jumbled" during multi-select operations

#### 3. Macro Creation Flow
1. Get all currently selected tokens (`canvas.tokens.controlled`)
2. For each token, collect usable items:
   - Check for actor favorites (if available)
   - Filter items by activation type settings
3. Clean up existing auto-created macros
4. Create new macros for available hotbar slots
5. Update the hotbar in a single bulk operation

#### 4. Item Filtering (`isItemAction`)
Items are filtered based on:
- Presence of activities (`item.system.activities`)
- Activation type (action, bonus, reaction, special, none)
- User-configured settings for which activation types to include
- Items with no activities can optionally be included

### Important Implementation Details

#### Work Queue
```javascript
let workQueue = Promise.resolve();
```
- Ensures macro operations happen sequentially
- Prevents overlapping async operations
- Each update is chained onto the queue

#### Debounce Timer
```javascript
let updateTimeout = null;
```
- Global timeout handle for debouncing
- Cleared and reset on each token selection/deselection
- Set to 100ms delay (configurable if needed)

#### Hotbar Updates
```javascript
await game.user.update({ hotbar: update }, { diff: false, recursive: false, noHook: true });
```
- Uses bulk update with `diff: false` for reliability
- `noHook: true` prevents triggering additional hooks
- Clones the hotbar object before modification

## Settings

All settings are world-scoped and configured via the module settings menu:

| Setting | Key | Default | Description |
|---------|-----|---------|-------------|
| Hotbar Page | `hotbarPage` | 5 | Which hotbar page to populate (1-5) |
| Only GMs | `onlyGMs` | false | Restrict functionality to GMs only |
| Action Type | `activationAction` | true | Include items requiring an action |
| Bonus Type | `activationBonus` | true | Include bonus action items |
| Reaction Type | `activationReaction` | true | Include reaction items |
| Special Type | `activationSpecial` | true | Include special activation items |
| None Type | `activationNone` | false | Include items with no activation cost |
| Empty Type | `activationEmpty` | false | Include items without activities |

## Known Issues & Solutions

### Timing Issues (RESOLVED)
**Problem**: When selecting multiple tokens rapidly, the macro bar would become jumbled or display incorrect macros.

**Root Cause**: Each token selection triggered an independent macro creation operation. These operations executed sequentially but could interfere with each other's hotbar slot assignments.

**Solution**: Implemented debouncing and batch processing:
1. Added 100ms debounce delay via `scheduleUpdate()`
2. Changed from processing individual tokens to processing all selected tokens at once
3. All currently selected tokens are processed in a single operation
4. Macros are cleaned and recreated atomically

### D&D 5e Activities System
The module uses the new activities system introduced in D&D 5e v4.0:
```javascript
item?.system?.activities?.values()
```
This replaces the older `item.data.data.activation` structure. Ensure any modifications maintain compatibility with the activities API.

## Development Guidelines

### When Making Changes

1. **Timing-Sensitive Code**: Any changes to the token selection hook should maintain the debounce pattern to prevent race conditions.

2. **Hotbar Updates**: Always use bulk updates and clone the hotbar object before modification:
   ```javascript
   const update = foundry.utils.deepClone(game.user.hotbar);
   ```

3. **Macro Cleanup**: Always clean up existing macros before creating new ones to prevent orphaned macros.

4. **Logging**: Use the `log()` function for debugging. Logs are prefixed with `jay-macros |`.

### Testing Considerations

When testing changes:
- Test rapid token selection (select 3-5 tokens quickly)
- Test token deselection
- Test with tokens that have many items
- Test with tokens that have favorites configured
- Test with different activation type settings
- Test with both GM and player accounts
- Verify macro cleanup works correctly

### Common Pitfalls

1. **Don't remove the debounce**: The 100ms delay is necessary to batch rapid selections
2. **Don't process tokens individually**: Always process `canvas.tokens.controlled` as a group
3. **Don't skip macro cleanup**: Always clean up before creating new macros
4. **Don't forget the work queue**: All async operations should use `workQueue = workQueue.then(...)`

## Future Enhancement Ideas

- Configurable debounce delay setting
- Support for other game systems beyond D&D 5e
- Customizable macro command templates
- Per-user hotbar page assignment
- Macro slot priority/ordering options
- Integration with other macro management modules

## Debugging

Enable console logging to see detailed operation logs:
- Token selections/deselections
- Items found for each token
- Favorites usage
- Macro creation and slot assignment
- Hotbar updates

All logs are prefixed with `jay-macros |` for easy filtering.

## API Compatibility Notes

### Foundry v13 APIs Used
All APIs are compatible with Foundry v13:
- `game.settings.register()` - Settings registration
- `game.user.getHotbarMacros()` - Get current hotbar state
- `game.user.update()` - Update hotbar assignments
- `Macro.create()` - Create macro documents
- `Macro.deleteDocuments()` - Delete macro documents
- `canvas.tokens.controlled` - Get selected tokens
- `foundry.utils.deepClone()` - Deep clone objects

### D&D 5e v4.0+ APIs Used
- `item.system.activities` - New activities system
- `actor.system.favorites` - Character favorites
- `item.getRelativeUUID()` - Relative UUID for favorites

## Support & Contributing

- **Issues**: https://github.com/jstapels/jay-macros/issues
- **Repository**: https://github.com/jstapels/jay-macros
- **License**: See LICENSE file in repository

---

**Last Updated**: 2025-10-20
**Module Version**: 1.0.6
**Foundry Compatibility**: v13
**D&D 5e Compatibility**: v5.0
