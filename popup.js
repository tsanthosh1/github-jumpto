function filterRepositories(repositories, query) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const genericTerms = ['search', 'issues', 'pr', 'pull requests', 'actions', 'commits', 'branches'];

    const matches = repositories
        .map(entry => {
            const combinedText = `${entry.displayName.toLowerCase()} ${entry.searchTerm.join(' ').toLowerCase()}`;

            // Check if all query terms are present
            const allMatch = queryTerms.every(qt => combinedText.includes(qt));
            if (!allMatch) return null;

            // Scoring
            let score = 0;
            if (entry.displayName.toLowerCase() === query.toLowerCase()) score += 100;
            if (entry.displayName.toLowerCase().startsWith(query.toLowerCase())) score += 50;
            if (genericTerms.some(term => entry.displayName.toLowerCase().includes(term))) score -= 30;
            score -= entry.displayName.length;

            return { entry, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .map(item => item.entry);

    return matches;
}

document.getElementById('clear-recent').addEventListener('click', async function () {
    chrome.storage.local.set({ recentSelections: [] }, function () {
        document.getElementById('recent-container').style.visibility = 'hidden';
    });
});

document.getElementById('open-shortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');
    const suggestionsDiv = document.getElementById('suggestions');
    const settingsLink = document.getElementById('settings-link');
    const recentContainer = document.getElementById('recent-container');

    settingsLink.addEventListener('click', function (e) {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
        window.close();
    });

    searchInput.focus();

    displayRecentSelections();
    function displayRecentSelections() {
        recentContainer.style.display = 'block';
        chrome.storage.local.get(['recentSelections'], (res) => {
            const recent = res.recentSelections || [];
            const container = document.getElementById('recent');
            container.innerHTML = '';

            if (recent.length === 0) {
                container.textContent = 'No recent selections found.';
                recentContainer.style.visibility = 'hidden';
                return;
            }

            recent.forEach(item => {
                const div = document.createElement('div');
                div.className = 'recent-item';
                const content = item.displayName || item.url.replace('https://github.com', '');

                if (content.includes('->')) {
                    const [lhs, rhs] = content.split('->').map(s => s.trim());
                    div.innerHTML = `${lhs} <span class="rhs">&rarr; ${rhs}</span>`;
                } else {
                    div.textContent = content;
                }


                div.dataset.url = item.url;

                // Make focusable and keyboard accessible
                div.setAttribute('tabindex', '0');
                div.setAttribute('role', 'button');

                container.appendChild(div);
            });

            // Click handler
            container.addEventListener('click', (e) => {
                const target = e.target.closest('.recent-item');
                if (target) {
                    window.open(target.dataset.url, '_blank');
                    window.close();
                }
            });

            // Keyboard handler
            container.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('recent-item')) {
                    e.preventDefault();
                    window.open(e.target.dataset.url, '_blank');
                    window.close();
                }
            });
        });
    }




    const svgIcons = {
        org: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v12H2z"/></svg>`,
        repo: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2h8v12H4z"/></svg>`,
        search: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="6" cy="6" r="5"/><line x1="10" y1="10" x2="15" y2="15" stroke="currentColor" stroke-width="2"/></svg>`,
        pr: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3v10M11 3v10M5 3h6"/></svg>`,
        issues: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6"/></svg>`,
        commits: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="3"/></svg>`,
        branches: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3v4h6V3H5zM5 9v4h6V9H5z"/></svg>`,
        actions: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7"/></svg>`,
        default: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect width="16" height="16"/></svg>`
    };


    chrome.storage.local.get(['repositories'], function (result) {
        const repositories = result.repositories || [];

        searchInput.addEventListener('input', function () {

            const query = this.value.toLowerCase().trim();
            suggestionsDiv.innerHTML = '';

            if (query !== '' && query && query.length > 0) {
                recentContainer.style.display = 'none';

                const entries = filterRepositories(repositories, query);
                entries.slice(0, 10).forEach(entry => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'suggestion-wrapper';

                    const suggestion = document.createElement('div');
                    suggestion.className = 'suggestion';
                    suggestion.dataset.url = entry.url;
                    suggestion.dataset.placeholder = entry.searchPlaceholder || '';
                    suggestion.dataset.searchTerm = entry.searchTerm.join(',');
                    if (entry.displayTemplate) {
                        suggestion.dataset.displayTemplate = entry.displayTemplate;
                    }
                    suggestion.dataset.displayName = entry.displayName;

                    // Customize displayName with arrow and styling
                    if (entry.displayName.includes('->')) {
                        const [lhs, rhs] = entry.displayName.split('->').map(s => s.trim());
                        suggestion.innerHTML = `${lhs} <span class="rhs">&rarr; ${rhs}</span>`;
                    } else {
                        suggestion.textContent = entry.displayName;
                    }

                    wrapper.appendChild(suggestion);
                    suggestionsDiv.appendChild(wrapper);
                });
                ;

            } else {
                // suggestionsDiv.innerHTML = '<div class="no-suggestions">Type to search repositories...</div>';
                displayRecentSelections();
            }
        });

        let activeSearchInput = null;

        // Handle keyboard navigation and Enter key
        document.addEventListener('keydown', function (e) {
            if (activeSearchInput && document.activeElement === activeSearchInput) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const inputVal = activeSearchInput.value.trim();
                    const parent = activeSearchInput.closest('.suggestion-wrapper');
                    const urlTemplate = parent.querySelector('.suggestion').dataset.url;
                    const displayTemplate = parent.querySelector('.suggestion').dataset.displayTemplate;
                    const displayName = parent.querySelector('.suggestion').dataset.displayName;
                    const url = urlTemplate.replace('%s', encodeURIComponent(inputVal));
                    chrome.storage.local.get(['recentSelections'], (res) => {
                        const recent = res.recentSelections || [];

                        // Replace %s if present, else use as is
                        const finalDisplayName = displayTemplate?.replace('%s', inputVal) || displayName;

                        const finalUrl = `https://github.com${url}`;
                        const newEntry = {
                            displayName: finalDisplayName,
                            url: finalUrl
                        };

                        // Remove duplicates and limit recent items to 5
                        const newRecent = [newEntry, ...recent.filter(p => p.url !== newEntry.url)].slice(0, 5);

                        chrome.storage.local.set({ recentSelections: newRecent }, () => {
                            window.open(finalUrl, '_blank');
                            window.close();
                        });
                    });

                    return;
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    const wrapper = activeSearchInput.closest('.suggestion-wrapper');
                    if (wrapper) wrapper.removeChild(activeSearchInput);
                    activeSearchInput = null;
                    searchInput.focus();
                    return;
                }
                return;
            }

            const suggestions = Array.from(document.querySelectorAll('.suggestion'));
            const selected = document.querySelector('.suggestion.selected');
            let index = suggestions.indexOf(selected);

            if (e.key === 'ArrowDown' || e.key === 'Tab') {
                e.preventDefault();
                if (selected) selected.classList.remove('selected');
                index = (index + 1) % suggestions.length;
                suggestions[index]?.classList.add('selected');
                suggestions[index]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selected) selected.classList.remove('selected');
                index = (index - 1 + suggestions.length) % suggestions.length;
                suggestions[index]?.classList.add('selected');
                suggestions[index]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && selected) {
                e.preventDefault();
                handleSuggestion(selected);
            }
        });

        let recentIndex = -1;

        document.addEventListener('keydown', function (e) {
            // Handle suggestions first (existing logic) ...
            // Then handle recent-items navigation

            const recentItems = Array.from(document.querySelectorAll('.recent-item'));

            if (recentItems.length > 0 && recentContainer.style.display !== 'none') {
                if (e.key === 'ArrowDown' || e.key === 'Tab') {
                    e.preventDefault();
                    // Remove previous highlight
                    if (recentIndex >= 0 && recentItems[recentIndex]) {
                        recentItems[recentIndex].classList.remove('selected');
                    }

                    recentIndex = (recentIndex + 1) % recentItems.length;
                    recentItems[recentIndex].classList.add('selected');
                    recentItems[recentIndex].focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (recentIndex >= 0 && recentItems[recentIndex]) {
                        recentItems[recentIndex].classList.remove('selected');
                    }

                    recentIndex = (recentIndex - 1 + recentItems.length) % recentItems.length;
                    recentItems[recentIndex].classList.add('selected');
                    recentItems[recentIndex].focus();
                } else if ((e.key === 'Enter' || e.key === ' ') && recentIndex >= 0) {
                    e.preventDefault();
                    const selectedItem = recentItems[recentIndex];
                    if (selectedItem) {
                        window.open(selectedItem.dataset.url, '_blank');
                        window.close();
                    }
                }
            }
        });


        // Handle clicks
        suggestionsDiv.addEventListener('click', function (e) {
            const suggestion = e.target.closest('.suggestion');
            if (suggestion) handleSuggestion(suggestion);
        });

        // Handle placeholder prompt and redirection
        function handleSuggestion(suggestion) {
            const url = suggestion.dataset.url;
            const placeholder = suggestion.dataset.placeholder;
            const displayName = suggestion.textContent;

            if (url.includes('%s')) {
                // Show input prompt for the placeholder
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'search-term-input active';
                input.placeholder = placeholder || 'Enter value...';
                activeSearchInput = input;
                const wrapper = suggestion.closest('.suggestion-wrapper');
                wrapper.appendChild(input);
                input.focus();
            } else {
                // Direct open
                chrome.storage.local.get(['recentSelections'], (res) => {
                    const recent = res.recentSelections || [];

                    const finalUrl = `https://github.com${url}`;  // Your computed URL
                    const displayName = suggestion.dataset.displayName || url; // Optional: Use displayName from entry, or fallback to url
                    const displayTemplate = suggestion.dataset.displayTemplate || displayName; // Optional: Use displayTemplate for %s

                    // Replace %s in display name if needed
                    const finalDisplayName = displayTemplate.includes('%s') && userInput
                        ? displayTemplate.replace('%s', userInput)
                        : displayName;

                    // Create the new recent entry
                    const newEntry = {
                        displayName: finalDisplayName,
                        url: finalUrl
                    };

                    // Add new entry to recent, remove duplicates, limit to 5
                    const newRecent = [newEntry, ...recent.filter(item => item.url !== finalUrl)].slice(0, 5);

                    chrome.storage.local.set({ recentSelections: newRecent }, () => {
                        window.open(finalUrl, '_blank');
                        window.close();
                    });
                });

            }
        }

    });
});
