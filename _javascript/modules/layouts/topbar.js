import { displaySearch } from '../components/search-display';

export function initTopbar() {
  if (!document.getElementById('search-trigger') || !document.getElementById('search-input')) {
    return;
  }

  displaySearch();
}
