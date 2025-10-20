const MODULE_ID = 'jay-macros';

// Setting keys
const SETTING_HOTBAR_PAGE = 'hotbarPage';
const SETTING_ONLY_GMS = 'onlyGMs';
const SETTING_ACTIVATION_ACTION = 'action';
const SETTING_ACTIVATION_BONUS = 'bonus';
const SETTING_ACTIVATION_REACTION = 'reaction';
const SETTING_ACTIVATION_SPECIAL = 'special';
const SETTING_ACTIVATION_NONE = 'none';
const SETTING_ACTIVATION_EMPTY = 'empty';
const SETTING_EXPERIMENTAL_FILTERS = 'experimentalFilters';

const ACTION_LOOKUP = new Map([
  [SETTING_ACTIVATION_ACTION, 'action'],
  [SETTING_ACTIVATION_BONUS, 'bonus'],
  [SETTING_ACTIVATION_REACTION, 'reaction'],
  [SETTING_ACTIVATION_SPECIAL, 'special'],
  [SETTING_ACTIVATION_NONE, 'none'],
]);

let workQueue = Promise.resolve();
let updateTimeout = null;
let currentFilter = null; // Track the currently active filter
let collectedItems = []; // Store items from selected tokens for filtering

/**
 * Log to the console.
 *
 * @param  {...any} args log parameters
 */
const log = (...args) => {
  // eslint-disable-next-line no-console
  console.log(`${MODULE_ID} |`, ...args);
};


/**
 * Check if an item is "usable" based on the type of action action that is required to use it.
 * Note: This is specific to the dnd5e system.
 * 
 * @param {Item} item the item to check.
 * @returns 
 */
const isItemAction = (item) => {
  if (!item?.system?.activities?.size) {
    return game.settings.get(MODULE_ID, SETTING_ACTIVATION_EMPTY);
  }

  const allowedActions = ACTION_LOOKUP.entries()
    .filter(([k]) => game.settings.get(MODULE_ID, k))
    .map(([, v]) => v);
  const actionTypes = [...allowedActions];
  return item?.system?.activities?.values()
    .some((a) => a?.activation?.type && actionTypes.includes(a.activation.type))
    ?? false;
};

const createMacroData = (item) => {
  return {
    type: "script",
    scope: "actor",
    name: item.name,
    img: item.img,
    command: `(await fromUuid("${item.uuid}"))?.use()`,
    flags: { [MODULE_ID]: { autoMacro: true } },
  };
};

/**
 * Get the activation type of an item.
 * @param {Item} item the item to check
 * @returns {string|null} the activation type (action, bonus, reaction, special, none) or null
 */
const getItemActivationType = (item) => {
  if (!item?.system?.activities?.size) {
    return 'empty';
  }

  // Get the first activity's activation type
  const firstActivity = item.system.activities.values().next().value;
  return firstActivity?.activation?.type ?? 'none';
};

/**
 * Check if an item is a spell.
 * @param {Item} item the item to check
 * @returns {boolean} true if the item is a spell
 */
const isSpell = (item) => {
  return item?.type === 'spell';
};

/**
 * Filter items based on the current filter.
 * @param {Array} items the items to filter
 * @param {string} filter the filter type (action, bonus, reaction, spell, or null for all)
 * @returns {Array} the filtered items
 */
const filterItemsByType = (items, filter) => {
  if (!filter) return items;

  if (filter === 'spell') {
    return items.filter(isSpell);
  }

  return items.filter(item => getItemActivationType(item) === filter);
};

/**
 * Build the filter button HTML.
 * @returns {string} The HTML string for the filter UI
 */
const buildFilterHTML = () => {
  if (!collectedItems.length) {
    return '';
  }

  // Define filter buttons
  const filters = [
    { id: null, label: 'All', icon: 'fas fa-list' },
    { id: 'action', label: 'Actions', icon: 'fas fa-fist-raised' },
    { id: 'bonus', label: 'Bonus', icon: 'fas fa-bolt' },
    { id: 'reaction', label: 'Reactions', icon: 'fas fa-shield-alt' },
    { id: 'spell', label: 'Spells', icon: 'fas fa-magic' },
  ];

  let buttonsHTML = '';

  for (const filter of filters) {
    const filteredItems = filterItemsByType(collectedItems, filter.id);
    const count = filteredItems.length;
    const isActive = currentFilter === filter.id;
    const isDisabled = count === 0;

    const activeClass = isActive ? ' active' : '';
    const disabledClass = isDisabled ? ' disabled' : '';
    const disabledAttr = isDisabled ? ' disabled' : '';
    const countText = count > 0 ? ` <span class="count">(${count})</span>` : '';

    buttonsHTML += `
      <button class="jay-macros-filter-button${activeClass}${disabledClass}"
              data-filter="${filter.id ?? 'all'}"${disabledAttr}>
        <i class="${filter.icon}"></i> ${filter.label}${countText}
      </button>
    `;
  }

  return `<div id="jay-macros-filters" class="jay-macros-filter-container">${buttonsHTML}</div>`;
};

/**
 * Handle filter button click.
 * @param {string|null} filter the filter to apply
 */
const handleFilterClick = (filter) => {
  log(`Filter button clicked: ${filter ?? 'all'}`);
  currentFilter = filter;
  log(`Current filter set to: ${currentFilter ?? 'all'}`);
  workQueue = workQueue.then(() => {
    log(`Executing updateMacrosForFilter for filter: ${currentFilter ?? 'all'}`);
    return updateMacrosForFilter();
  });
};

/**
 * Update macros based on the current filter.
 */
const updateMacrosForFilter = async () => {
  // First, clean up existing macros
  await destroyMacros();

  if (!collectedItems.length) {
    log('No items to filter');
    ui.hotbar.render();
    return;
  }

  // Apply filter to collected items
  const filteredItems = filterItemsByType(collectedItems, currentFilter);
  log(`Filtered to ${filteredItems.length} items (filter: ${currentFilter ?? 'all'})`);

  if (!filteredItems.length) {
    log('No items match current filter');
    ui.hotbar.render(); // Update UI to show active filter
    return;
  }

  const hotbarPage = game.settings.get(MODULE_ID, SETTING_HOTBAR_PAGE);
  const freeSlots = game.user.getHotbarMacros(hotbarPage)
    .filter((sm) => !sm.macro)
    .map((sm) => sm.slot);

  const macroData = filteredItems.slice(0, freeSlots.length)
    .map(createMacroData);

  if (!macroData.length) {
    log('No free slots available');
    ui.hotbar.render(); // Update UI to show active filter
    return;
  }

  const macros = await Macro.create(macroData);

  // Update the hotbar in bulk.
  const update = foundry.utils.deepClone(game.user.hotbar);

  for (const macro of macros) {
    const slot = freeSlots.shift();
    log(`Assigning ${macro.name} to hotbar slot ${slot}`);
    update[slot] = macro.id;
  }

  log('Updating hotbar');
  await game.user.update({ hotbar: update }, { diff: false, recursive: false, noHook: true });

  // Trigger hotbar re-render to update filter UI
  ui.hotbar.render();
};

/**
 * Process all currently selected tokens and update the macro bar.
 * This handles multiple selected tokens at once to avoid timing conflicts.
 */
const updateMacrosForSelectedTokens = async () => {
  const selectedTokens = canvas.tokens?.controlled ?? [];

  if (!selectedTokens.length) {
    log('No tokens selected, cleaning up macros');
    collectedItems = [];
    currentFilter = null;
    await destroyMacros();
    ui.hotbar.render();
    return;
  }

  log(`Processing ${selectedTokens.length} selected token(s)`);

  // Collect all items from all selected tokens
  const allItems = [];
  for (const token of selectedTokens) {
    if (!token.actor) continue;

    log(`Processing token: ${token.name}`);
    let items = Array.from(token.actor?.items?.values() ?? []);

    // See if favorites are available
    if (token.actor?.system?.favorites?.length) {
      const favorites = token.actor.system.favorites;

      // Favorites use relative UUIDs
      const itemByRelUuid = (fav) => items.find((i) => i.getRelativeUUID(token.actor) === fav.id);
      const favItems = favorites.filter((fav) => fav.type === 'item')
        .map(itemByRelUuid);
      items = favItems;
      log('Found favorites', favItems.map(i => i?.name));
    }

    // Filter to just usable items
    items = items.filter(isItemAction);
    log('Found usable items', items.map(i => i?.name));
    allItems.push(...items);
  }

  // Store items for filtering
  collectedItems = allItems;

  // Nothing to do if no items
  if (!allItems.length) {
    log('No usable items found');
    currentFilter = null;
    await destroyMacros();
    ui.hotbar.render();
    return;
  }

  // If experimental filters are enabled, create UI and use filter logic
  if (game.settings.get(MODULE_ID, SETTING_EXPERIMENTAL_FILTERS)) {
    log('Using experimental filter mode');
    await updateMacrosForFilter();
    return;
  }

  // Otherwise, use original logic (no filtering)
  currentFilter = null;

  // First, clean up existing macros
  await destroyMacros();

  const hotbarPage = game.settings.get(MODULE_ID, SETTING_HOTBAR_PAGE);
  const freeSlots = game.user.getHotbarMacros(hotbarPage)
    .filter((sm) => !sm.macro)
    .map((sm) => sm.slot);

  const macroData = allItems.slice(0, freeSlots.length)
    .map(createMacroData);

  if (!macroData.length) {
    log('No free slots available');
    return;
  }

  const macros = await Macro.create(macroData);

  // Update the hotbar in bulk.
  const update = foundry.utils.deepClone(game.user.hotbar);

  for (const macro of macros) {
    const slot = freeSlots.shift();
    log(`Assigning ${macro.name} to hotbar slot ${slot}`);
    update[slot] = macro.id;
  }

  log('Updating hotbar');
  await game.user.update({ hotbar: update }, { diff: false, recursive: false, noHook: true });
};


const destroyMacros = async () => {
  const hotbarPage = game.settings.get(MODULE_ID, SETTING_HOTBAR_PAGE);
  const macroIds = game.user.getHotbarMacros(hotbarPage)
    .filter((sm) => sm.macro?.getFlag(MODULE_ID, 'autoMacro'))
    .map((sm) => sm.macro.id);

  log('Cleaning macros', macroIds);
  await Macro.deleteDocuments(macroIds);
};

/**
 * Debounced update function that batches rapid token selections.
 * This prevents the macro bar from getting jumbled when selecting multiple tokens quickly.
 */
const scheduleUpdate = () => {
  // Clear any existing timeout
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }

  // Schedule a new update after a short delay
  updateTimeout = setTimeout(() => {
    workQueue = workQueue.then(() => updateMacrosForSelectedTokens());
    updateTimeout = null;
  }, 100); // 100ms debounce delay
};

const controlTokenHook = async (token, selected) => {
  const onlyGms = game.settings.get(MODULE_ID, SETTING_ONLY_GMS);
  if (onlyGms && !game.user.isGM) return;

  log(`Token ${token.name} ${selected ? 'selected' : 'deselected'}`);

  // Schedule an update - this will be debounced if multiple tokens are selected quickly
  scheduleUpdate();
};

const initHook = () => {
  log('Initialize settings');

  game.settings.register(MODULE_ID, SETTING_HOTBAR_PAGE, {
    name: game.i18n.localize(`${MODULE_ID}.settings.selectHotbarPage.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.selectHotbarPage.hint`),
    scope: 'world',
    config: true,
    requiresReload: true,
    type: Number,
    choices: {
      1: "1",
      2: "2",
      3: "3",
      4: "4",
      5: "5",
    },
    default: 5,
  });
  game.settings.register(MODULE_ID, SETTING_ONLY_GMS, {
    name: game.i18n.localize(`${MODULE_ID}.settings.onlyGMs.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.onlyGMs.hint`),
    scope: 'world',
    config: true,
    requiresReload: true,
    type: Boolean,
    default: false,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_ACTION, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationAction.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationAction.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_BONUS, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationBonus.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationBonus.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_REACTION, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationReaction.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationReaction.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_SPECIAL, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationSpecial.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationSpecial.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_NONE, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationNone.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationNone.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: false,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_EMPTY, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationEmpty.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationEmpty.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: false,
  });
  game.settings.register(MODULE_ID, SETTING_EXPERIMENTAL_FILTERS, {
    name: game.i18n.localize(`${MODULE_ID}.settings.experimentalFilters.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.experimentalFilters.hint`),
    scope: 'world',
    config: true,
    requiresReload: true,
    type: Boolean,
    default: false,
  });
};

/**
 * Called when Foundry is ready to go.
 */
const readyHook = () => {
  log('Ready');
  Hooks.on('controlToken', controlTokenHook);
  Hooks.on('renderHotbar', renderHotbarHook);
};

/**
 * Hook for when the hotbar renders - inject filter UI.
 */
const renderHotbarHook = (app, html, data) => {
  if (!game.settings.get(MODULE_ID, SETTING_EXPERIMENTAL_FILTERS)) {
    return;
  }

  log('renderHotbar hook triggered');

  // Remove any existing filter UI
  const existingFilter = html.querySelector('#jay-macros-filters');
  if (existingFilter) {
    existingFilter.remove();
  }

  // Build and inject new filter UI if we have items
  const filterHTML = buildFilterHTML();
  if (filterHTML) {
    log('Injecting filter UI into hotbar');
    html.insertAdjacentHTML('beforebegin', filterHTML);

    // Get the newly inserted filter container
    const filterContainer = html.previousElementSibling;
    if (filterContainer && filterContainer.id === 'jay-macros-filters') {
      // Attach click handlers to all filter buttons
      const buttons = filterContainer.querySelectorAll('.jay-macros-filter-button');
      buttons.forEach(button => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          event.preventDefault();
          const filterValue = event.currentTarget.dataset.filter;
          const filter = filterValue === 'all' ? null : filterValue;
          log(`Filter button clicked: ${filter ?? 'all'}`);
          handleFilterClick(filter);
        });
      });

      // Prevent mouse events from propagating to canvas
      filterContainer.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });
      filterContainer.addEventListener('mouseup', (event) => {
        event.stopPropagation();
      });
    }
  }
};

Hooks.once('init', initHook);
Hooks.once('ready', readyHook);

