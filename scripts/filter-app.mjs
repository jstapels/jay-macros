const MODULE_ID = 'jay-macros';

/**
 * Application for the filter UI buttons (V2Application with Handlebars)
 */
export class FilterApplication extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor(options = {}) {
    super(options);
    this.collectedItems = [];
    this.currentFilter = null;
    console.log(`${MODULE_ID} | FilterApplication constructor called`);
  }

  static DEFAULT_OPTIONS = {
    id: 'jay-macros-filters',
    tag: 'div',
    window: {
      frame: false,
      positioned: false,
    },
    position: {},
    classes: ['jay-macros-filter-container'],
  };

  static PARTS = {
    buttons: {
      template: 'modules/jay-macros/templates/filter-buttons.hbs',
    }
  };

  _onRender(context, options) {
    super._onRender(context, options);
    console.log(`${MODULE_ID} | FilterApplication rendered, element:`, this.element);
    console.log(`${MODULE_ID} | Element classes:`, this.element?.className);
    console.log(`${MODULE_ID} | Element style:`, this.element?.style.cssText);
  }

  async _prepareContext(options) {
    console.log(`${MODULE_ID} | FilterApplication _prepareContext called, collectedItems:`, this.collectedItems.length);

    const filters = [
      { id: null, label: 'All', icon: 'fas fa-list' },
      { id: 'action', label: 'Actions', icon: 'fas fa-fist-raised' },
      { id: 'bonus', label: 'Bonus', icon: 'fas fa-bolt' },
      { id: 'reaction', label: 'Reactions', icon: 'fas fa-shield-alt' },
      { id: 'spell', label: 'Spells', icon: 'fas fa-magic' },
    ];

    const buttons = filters.map(filter => {
      const filteredItems = this._filterItems(filter.id);
      const count = filteredItems.length;
      return {
        ...filter,
        filterId: filter.id ?? 'all',
        count,
        isActive: this.currentFilter === filter.id,
        isDisabled: count === 0
      };
    });

    const context = {
      buttons,
      hasItems: this.collectedItems.length > 0
    };

    console.log(`${MODULE_ID} | FilterApplication _prepareContext returning:`, context);
    return context;
  }

  _filterItems(filter) {
    if (!filter) return this.collectedItems;

    if (filter === 'spell') {
      return this.collectedItems.filter(item => item?.type === 'spell');
    }

    return this.collectedItems.filter(item => {
      if (!item?.system?.activities?.size) return false;
      const firstActivity = item.system.activities.values().next().value;
      return firstActivity?.activation?.type === filter;
    });
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    console.log(`${MODULE_ID} | _attachPartListeners called with partId:`, partId);
    console.log(`${MODULE_ID} | htmlElement:`, htmlElement);

    if (partId === 'buttons') {
      console.log(`${MODULE_ID} | FilterApplication attaching listeners to buttons part`);

      const buttons = htmlElement.querySelectorAll('.jay-macros-filter-button');
      console.log(`${MODULE_ID} | Found ${buttons.length} filter buttons`, buttons);

      buttons.forEach((button, index) => {
        console.log(`${MODULE_ID} | Attaching click listener to button ${index}:`, button);
        button.addEventListener('click', this._onFilterClick.bind(this));
        // Also add a test listener to verify events work
        button.addEventListener('click', () => {
          console.log(`${MODULE_ID} | BUTTON ${index} CLICKED!`);
        });
      });
    }
  }

  async _onFilterClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const filterValue = button.dataset.filter;
    const filter = filterValue === 'all' ? null : filterValue;

    console.log(`${MODULE_ID} | Filter button clicked: ${filter ?? 'all'}`);

    this.currentFilter = filter;

    // Trigger the filter change callback if provided
    if (this.options.onFilterChange) {
      console.log(`${MODULE_ID} | Calling onFilterChange callback`);
      await this.options.onFilterChange(filter);
    }

    // Re-render to update active states
    this.render();
  }

  updateItems(items) {
    console.log(`${MODULE_ID} | FilterApplication updateItems called with ${items.length} items`);
    this.collectedItems = items;
    this.render();
  }

  setFilter(filter) {
    console.log(`${MODULE_ID} | FilterApplication setFilter called: ${filter ?? 'all'}`);
    this.currentFilter = filter;
    this.render();
  }
}
