
// ===== MOCK SETUP =====

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  history: {
    search: jest.fn()
  },
  tabs: {
    onUpdated: {
      addListener: jest.fn()
    },
    update: jest.fn()
  },
  runtime: {
    onInstalled: {
      addListener: jest.fn()
    },
    onMessage: {
      addListener: jest.fn()
    },
    getURL: jest.fn()
  },
  omnibox: {
    onInputChanged: {
      addListener: jest.fn()
    },
    onInputEntered: {
      addListener: jest.fn()
    }
  }
};

// Mock global functions
global.setInterval = jest.fn();

// Set Jest environment marker
global.jest = true;

// Import the background script functions
require('../background.js');

// Capture event listeners before any tests run (they get cleared by clearAllMocks)
const messageListeners = chrome.runtime.onMessage.addListener.mock.calls.map(call => call[0]);
const omniboxInputChangeListener = chrome.omnibox.onInputChanged.addListener.mock.calls[0][0];
const omniboxInputEnteredListener = chrome.omnibox.onInputEntered.addListener.mock.calls[0][0];
const tabUpdateListener = chrome.tabs.onUpdated.addListener.mock.calls[0][0];
const installedListener = chrome.runtime.onInstalled.addListener.mock.calls[0][0];

// Capture initial call counts for validation
const initialEventListenerCounts = {
  tabsOnUpdated: chrome.tabs.onUpdated.addListener.mock.calls.length,
  runtimeOnInstalled: chrome.runtime.onInstalled.addListener.mock.calls.length,
  runtimeOnMessage: chrome.runtime.onMessage.addListener.mock.calls.length,
  omniboxOnInputChanged: chrome.omnibox.onInputChanged.addListener.mock.calls.length,
  omniboxOnInputEntered: chrome.omnibox.onInputEntered.addListener.mock.calls.length,
  setIntervalCalls: setInterval.mock.calls.length
};

// ===== UTILITY FUNCTION TESTS =====

describe('Utility Functions', () => {
  describe('extractRepoBase', () => {
    test('should extract valid repository paths', () => {
      expect(extractRepoBase('https://github.com/facebook/react')).toBe('facebook/react');
      expect(extractRepoBase('https://github.com/microsoft/vscode/issues/123')).toBe('microsoft/vscode');
      expect(extractRepoBase('https://github.com/google/chrome?tab=readme')).toBe('google/chrome');
    });

    test('should return null for invalid URLs', () => {
      expect(extractRepoBase('https://github.com/search?q=test')).toBeNull();
      expect(extractRepoBase('https://github.com/orgs/facebook')).toBeNull();
      expect(extractRepoBase('https://github.com/login')).toBeNull();
    });

    test('should handle URLs with fragments and query parameters', () => {
      expect(extractRepoBase('https://github.com/facebook/react#readme')).toBe('facebook/react');
      expect(extractRepoBase('https://github.com/facebook/react?tab=issues&q=bug')).toBe('facebook/react');
    });
  });

  describe('extractOrgName', () => {
    test('should extract organization names from URLs', () => {
      expect(extractOrgName('https://github.com/facebook')).toBe('facebook');
      expect(extractOrgName('https://github.com/microsoft/')).toBe('microsoft');
      expect(extractOrgName('https://github.com/google')).toBe('google');
    });

    test('should return null for invalid URLs', () => {
      expect(extractOrgName('https://github.com/search?q=test')).toBeNull();
      expect(extractOrgName('https://github.com/orgs/facebook')).toBeNull();
      expect(extractOrgName('https://github.com/facebook/react')).toBeNull();
    });

    test('should handle URLs with query parameters and fragments', () => {
      expect(extractOrgName('https://github.com/facebook?tab=repositories')).toBe('facebook');
      expect(extractOrgName('https://github.com/microsoft#section')).toBe('microsoft');
    });
  });

  describe('shouldIncludeRepo', () => {
    test('should return true when no allowed users specified', () => {
      expect(shouldIncludeRepo('facebook/react', [])).toBe(true);
      expect(shouldIncludeRepo('microsoft/vscode', null)).toBe(true);
      expect(shouldIncludeRepo('google/chrome', undefined)).toBe(true);
    });

    test('should return true when repo owner is in allowed users', () => {
      const allowedUsers = ['facebook', 'microsoft', 'google'];
      expect(shouldIncludeRepo('facebook/react', allowedUsers)).toBe(true);
      expect(shouldIncludeRepo('Microsoft/TypeScript', allowedUsers)).toBe(true);
    });

    test('should return false when repo owner is not in allowed users', () => {
      const allowedUsers = ['facebook', 'microsoft'];
      expect(shouldIncludeRepo('google/chrome', allowedUsers)).toBe(false);
      expect(shouldIncludeRepo('apple/swift', allowedUsers)).toBe(false);
    });

    test('should handle case-insensitive matching', () => {
      const allowedUsers = ['Facebook', 'MICROSOFT'];
      expect(shouldIncludeRepo('facebook/react', allowedUsers)).toBe(true);
      expect(shouldIncludeRepo('microsoft/vscode', allowedUsers)).toBe(true);
    });
  });

  describe('capitalize', () => {
    test('should capitalize first letter', () => {
      expect(capitalize('facebook')).toBe('Facebook');
      expect(capitalize('microsoft')).toBe('Microsoft');
      expect(capitalize('a')).toBe('A');
    });

    test('should handle empty strings', () => {
      expect(capitalize('')).toBe('');
    });

    test('should not affect already capitalized strings', () => {
      expect(capitalize('Facebook')).toBe('Facebook');
      expect(capitalize('MICROSOFT')).toBe('MICROSOFT');
    });
  });
});

// ===== GENERATE ENTRIES TESTS =====

describe('generateEntries', () => {
  test('should generate org-level entries', () => {
    const entries = generateEntries('facebook', []);
    
    expect(entries).toContainEqual({
      searchTerm: ['facebook'],
      url: '/facebook',
      displayName: 'Facebook'
    });

    expect(entries).toContainEqual({
      searchTerm: ['facebook/search'],
      url: '/search?q=org:facebook %s',
      searchPlaceholder: 'Search in org',
      displayName: 'Facebook -> Search',
      displayTemplate: 'Facebook -> Search for "%s"'
    });

    expect(entries).toContainEqual({
      searchTerm: ['facebook/repositories'],
      url: '/orgs/facebook/repositories?q=%s',
      searchPlaceholder: 'Search repositories in org',
      displayName: 'Facebook -> Repositories',
      displayTemplate: 'Facebook -> Repositories "%s"'
    });
  });

  test('should generate repo-level entries', () => {
    const entries = generateEntries('facebook', ['react']);
    
    // Should include basic repo entry
    expect(entries).toContainEqual({
      searchTerm: ['facebook/react'],
      url: '/facebook/react',
      displayName: 'facebook/react',
      type: 'repo'
    });

    // Should include PR entries
    expect(entries).toContainEqual({
      searchTerm: ['facebook/react/pulls', 'facebook/react/pr', 'facebook/react/pull request'],
      url: '/facebook/react/pulls',
      displayName: 'facebook/react -> PR'
    });

    // Should include issues entries
    expect(entries).toContainEqual({
      searchTerm: ['facebook/react/issues'],
      url: '/facebook/react/issues',
      displayName: 'facebook/react -> Issues'
    });

    // Should include search entry
    expect(entries).toContainEqual({
      searchTerm: ['facebook/react/search'],
      url: '/search?q=repo:facebook/react %s',
      searchPlaceholder: 'Search in repo',
      displayName: 'facebook/react -> Search',
      displayTemplate: 'facebook/react -> Search for "%s"'
    });
  });

  test('should handle multiple repositories', () => {
    const entries = generateEntries('facebook', ['react', 'create-react-app']);
    
    const repoEntries = entries.filter(entry => entry.type === 'repo');
    expect(repoEntries).toHaveLength(2);
    expect(repoEntries.map(e => e.displayName)).toContain('facebook/react');
    expect(repoEntries.map(e => e.displayName)).toContain('facebook/create-react-app');
  });
});

// ===== STORAGE FUNCTIONS TESTS =====

describe('Storage Functions', () => {
  // beforeEach(() => {
  //   jest.clearAllMocks();
  // });

  describe('saveRepositories', () => {
    test('should save repositories to chrome storage', () => {
      const entries = [{ searchTerm: ['test'], url: '/test', displayName: 'Test' }];
      
      saveRepositories(entries);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ repositories: entries });
    });
  });

  describe('saveRecentSelections', () => {
    test('should save new recent selection', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ recentSelections: [] });
      });

      saveRecentSelections('facebook/react');

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['recentSelections'], expect.any(Function));
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        recentSelections: ['facebook/react']
      });
    });

    test('should move existing selection to front', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 
          recentSelections: ['microsoft/vscode', 'facebook/react', 'google/chrome'] 
        });
      });

      saveRecentSelections('facebook/react');

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        recentSelections: ['facebook/react', 'microsoft/vscode', 'google/chrome']
      });
    });

    test('should limit recent selections to 5 items', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 
          recentSelections: ['repo1', 'repo2', 'repo3', 'repo4', 'repo5'] 
        });
      });

      saveRecentSelections('newRepo');

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        recentSelections: ['newRepo', 'repo1', 'repo2', 'repo3', 'repo4']
      });
    });
  });
});

// ===== OMNIBOX FILTER TESTS =====

describe('filterRepositoriesForOmnibox', () => {
  const mockRepositories = [
    { searchTerm: ['facebook/react'], displayName: 'facebook/react', url: '/facebook/react' },
    { searchTerm: ['facebook/react/issues'], displayName: 'facebook/react -> Issues', url: '/facebook/react/issues' },
    { searchTerm: ['microsoft/vscode'], displayName: 'microsoft/vscode', url: '/microsoft/vscode' },
    { searchTerm: ['microsoft/vscode/search'], displayName: 'microsoft/vscode -> Search', url: '/microsoft/vscode/search' }
  ];

  test('should filter repositories by query', () => {
    const results = filterRepositoriesForOmnibox(mockRepositories, 'react');
    
    expect(results).toHaveLength(2);
    expect(results.map(r => r.displayName)).toContain('facebook/react');
    expect(results.map(r => r.displayName)).toContain('facebook/react -> Issues');
  });

  test('should handle multi-word queries', () => {
    const results = filterRepositoriesForOmnibox(mockRepositories, 'facebook react');
    
    expect(results).toHaveLength(2);
    expect(results.map(r => r.displayName)).toContain('facebook/react');
    expect(results.map(r => r.displayName)).toContain('facebook/react -> Issues');
  });

  test('should prioritize exact matches', () => {
    const results = filterRepositoriesForOmnibox(mockRepositories, 'facebook/react');
    
    expect(results[0].displayName).toBe('facebook/react');
  });

  test('should return empty array for no matches', () => {
    const results = filterRepositoriesForOmnibox(mockRepositories, 'nonexistent');
    
    expect(results).toHaveLength(0);
  });

  test('should handle case-insensitive matching', () => {
    const results = filterRepositoriesForOmnibox(mockRepositories, 'REACT');
    
    expect(results).toHaveLength(2);
  });
});

// ===== MAIN FUNCTION TESTS =====

describe('Main Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateRepositories', () => {
    test('should force update when requested', () => {
      updateRepositories(true);
      
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['repositories']);
    });

    test('should process history items and generate entries', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ allowedUsers: [] });
      });

      chrome.history.search.mockImplementation((query, callback) => {
        callback([
          { url: 'https://github.com/facebook' },
          { url: 'https://github.com/facebook/react' },
          { url: 'https://github.com/microsoft/vscode/issues/123' }
        ]);
      });

      updateRepositories(false);

      expect(chrome.history.search).toHaveBeenCalledWith(
        { text: 'github.com', startTime: 0, maxResults: 10000 },
        expect.any(Function)
      );
    });
  });

  describe('handleTabUpdate', () => {
    test('should handle new repository URLs', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ repositories: [], allowedUsers: [] });
      });

      handleTabUpdate(1, { url: 'https://github.com/facebook/react' });

      expect(chrome.storage.local.get).toHaveBeenCalledWith(
        ['repositories', 'allowedUsers'],
        expect.any(Function)
      );
    });

    test('should ignore updates without URL changes', () => {
      handleTabUpdate(1, { title: 'New Title' });

      expect(chrome.storage.local.get).not.toHaveBeenCalled();
    });
  });
});

// ===== MESSAGE HANDLER TESTS =====

describe('Message Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle refreshRepositories message', () => {
    const mockSender = { tab: { id: 1 } };
    const mockSendResponse = jest.fn();
    
    // Use the captured message listener (second listener for refreshRepositories)
    const messageListener = messageListeners[1];
    
    messageListener(
      { action: 'refreshRepositories' }, 
      mockSender, 
      mockSendResponse
    );

    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('should handle addRecentSelection message', () => {
    const mockSender = { tab: { id: 1 } };
    const mockSendResponse = jest.fn();
    
    const messageListener = messageListeners[1];
    
    messageListener(
      { action: 'addRecentSelection', repoPath: 'facebook/react' }, 
      mockSender, 
      mockSendResponse
    );

    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('should handle completeSearch message', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ recentSelections: [] });
    });

    const mockSender = { tab: { id: 1 } };
    const mockSendResponse = jest.fn();
    
    const messageListener = messageListeners[0];
    
    messageListener(
      { 
        action: 'completeSearch', 
        url: 'https://github.com/facebook/react',
        displayName: 'facebook/react'
      }, 
      mockSender, 
      mockSendResponse
    );

    expect(chrome.tabs.update).toHaveBeenCalledWith(1, { 
      url: 'https://github.com/facebook/react' 
    });
    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
  });
});

// ===== OMNIBOX HANDLER TESTS =====

describe('Omnibox Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle omnibox input changes', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ 
        repositories: [
          { searchTerm: ['facebook/react'], displayName: 'facebook/react', url: '/facebook/react' }
        ] 
      });
    });

    const mockSuggest = jest.fn();
    
    omniboxInputChangeListener('react', mockSuggest);

    expect(chrome.storage.local.get).toHaveBeenCalledWith(['repositories'], expect.any(Function));
  });

  test('should handle omnibox input entered with direct URL', () => {
    omniboxInputEnteredListener('https://github.com/facebook/react', 'currentTab');

    expect(chrome.tabs.update).toHaveBeenCalledWith({ 
      url: 'https://github.com/facebook/react' 
    });
  });

  test('should handle omnibox input entered with search context', () => {
    chrome.runtime.getURL.mockReturnValue('chrome-extension://id/input.html');
    
    omniboxInputEnteredListener('{"search": "test"}', 'currentTab');

    expect(chrome.runtime.getURL).toHaveBeenCalledWith('input.html');
    expect(chrome.tabs.update).toHaveBeenCalledWith({ 
      url: expect.stringContaining('input.html?context='),
      highlighted: false
    });
  });
});

// ===== INTEGRATION TESTS =====

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize extension properly', () => {
    // Verify event listeners are registered using captured counts
    expect(initialEventListenerCounts.tabsOnUpdated).toBe(1);
    expect(initialEventListenerCounts.runtimeOnInstalled).toBe(1);
    expect(initialEventListenerCounts.runtimeOnMessage).toBe(2);
    expect(initialEventListenerCounts.omniboxOnInputChanged).toBe(1);
    expect(initialEventListenerCounts.omniboxOnInputEntered).toBe(1);
    expect(initialEventListenerCounts.setIntervalCalls).toBe(1);
  });

  test('should handle full workflow from URL to omnibox suggestion', () => {
    // Mock storage responses
    chrome.storage.local.get
      .mockImplementationOnce((keys, callback) => {
        callback({ allowedUsers: [] });
      })
      .mockImplementationOnce((keys, callback) => {
        callback({ 
          repositories: [
            { 
              searchTerm: ['facebook/react'], 
              displayName: 'facebook/react', 
              url: '/facebook/react' 
            }
          ] 
        });
      });

    // Mock history response
    chrome.history.search.mockImplementation((query, callback) => {
      callback([{ url: 'https://github.com/facebook/react' }]);
    });

    // Test repository update
    updateRepositories(false);

    // Test omnibox filtering
    const mockSuggest = jest.fn();
    
    omniboxInputChangeListener('react', mockSuggest);

    expect(chrome.history.search).toHaveBeenCalled();
    expect(chrome.storage.local.get).toHaveBeenCalledTimes(2);
  });
});

// ===== TEST UTILITIES =====

describe('Test Setup Validation', () => {
  test('should have all required Chrome API mocks', () => {
    expect(chrome.storage.local.get).toBeDefined();
    expect(chrome.storage.local.set).toBeDefined();
    expect(chrome.history.search).toBeDefined();
    expect(chrome.tabs.onUpdated.addListener).toBeDefined();
    expect(chrome.runtime.onInstalled.addListener).toBeDefined();
    expect(chrome.omnibox.onInputChanged.addListener).toBeDefined();
    expect(chrome.omnibox.onInputEntered.addListener).toBeDefined();
  });
});