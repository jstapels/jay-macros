import { MODULE_ID } from './main.mjs';

/**
 * Application for the filter UI buttons
 */
export class FilterApplication extends Application {
  constructor(options = {}) {
    super(options);
    this.collectedItems = [];
    this.currentFilter = null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'jay-macros-filters',
      template: 'modules/jay-macros/templates/filter-buttons.hbs',
      popOut: false,
      minimizable: false,
      resizable: false,
      classes: ['jay-macros-filter-container']
    });
  }

  getData(options = {}) {
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

    return {
      buttons,
      hasItems: this.collectedItems.length > 0
    };
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

    html.find('.jay-macros-filter-button').on('click', this._onFilterClick.bind(this));
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
      await this.options.onFilterChange(filter);
    }

    // Re-render to update active states
    this.render();
  }

  updateItems(items) {
    this.collectedItems = items;
    this.render();
  }

  setFilter(filter) {
    this.currentFilter = filter;
    this.render();
  }
}
