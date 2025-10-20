const MODULE_ID = 'jay-macros';

/**
 * Application for the filter UI buttons
 */
export class FilterApplication extends Application {
  constructor(options = {}) {
    super(options);
    this.collectedItems = [];
    this.currentFilter = null;
    console.log(`${MODULE_ID} | FilterApplication constructor called`);
  }

  static get defaultOptions() {
    const options = foundry.utils.mergeObject(super.defaultOptions, {
      id: 'jay-macros-filters',
      template: 'modules/jay-macros/templates/filter-buttons.hbs',
      popOut: false,
      minimizable: false,
      resizable: false,
      classes: ['jay-macros-filter-container']
    });
    console.log(`${MODULE_ID} | FilterApplication defaultOptions:`, options);
    return options;
  }

  async _renderInner(data) {
    console.log(`${MODULE_ID} | FilterApplication _renderInner called with data:`, data);
    try {
      const html = await super._renderInner(data);
      console.log(`${MODULE_ID} | FilterApplication template rendered, HTML:`, html);
      return html;
    } catch (error) {
      console.error(`${MODULE_ID} | Error rendering template:`, error);
      throw error;
    }
  }

  _injectHTML(html) {
    console.log(`${MODULE_ID} | FilterApplication _injectHTML called`);
    const hotbar = document.getElementById('hotbar');
    if (hotbar && hotbar.parentElement) {
      hotbar.parentElement.insertBefore(html[0], hotbar);
      console.log(`${MODULE_ID} | FilterApplication HTML injected before hotbar`);
    } else {
      console.error(`${MODULE_ID} | Could not find hotbar for injection`);
      super._injectHTML(html);
    }
    this._element = html;
  }

  getData(options = {}) {
    console.log(`${MODULE_ID} | FilterApplication getData called, collectedItems:`, this.collectedItems.length);

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

    const data = {
      buttons,
      hasItems: this.collectedItems.length > 0
    };

    console.log(`${MODULE_ID} | FilterApplication getData returning:`, data);
    return data;
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

  activateListeners(html) {
    super.activateListeners(html);
    console.log(`${MODULE_ID} | FilterApplication activateListeners called, html:`, html);

    const buttons = html.find('.jay-macros-filter-button');
    console.log(`${MODULE_ID} | Found ${buttons.length} filter buttons`);

    buttons.on('click', this._onFilterClick.bind(this));
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
