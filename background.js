// ====== Utility Functions ======

function extractRepoBase(url) {
  url = url.split(/[?#]/)[0];
  if (/github\.com\/search/.test(url)) return null;
  if (/github\.com\/orgs/.test(url)) return null;
  if (/github\.com\/login/.test(url)) return null;
  const repoMatch = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  return repoMatch ? repoMatch[1] : null;
}

function extractOrgName(url) {
  url = url.split(/[?#]/)[0];
  if (/github\.com\/search/.test(url)) return null;
  if (/github\.com\/orgs/.test(url)) return null;
  if (/github\.com\/login/.test(url)) return null;
  const orgMatch = url.match(/github\.com\/([^\/]+)\/?$/);
  return orgMatch ? orgMatch[1] : null;
}

function shouldIncludeRepo(repo, allowedUsers) {
  if (!allowedUsers || allowedUsers.length === 0) return true;
  const owner = repo.split("/")[0];
  return allowedUsers.some(
    (user) => user.toLowerCase() === owner.toLowerCase()
  );
}

function saveRepositories(entries) {
  chrome.storage.local.set({ repositories: entries });
}

function saveRecentSelections(repoPath) {
  chrome.storage.local.get(["recentSelections"], (result) => {
    const recent = result.recentSelections || [];
    const newRecent = [repoPath, ...recent.filter((p) => p !== repoPath)].slice(
      0,
      5
    );
    chrome.storage.local.set({ recentSelections: newRecent });
  });
}

function capitalize(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function generateEntries(org, repos = [], githubUsername) {
  const entries = [];

  // Org-level entries
  entries.push(
    { searchTerm: [`${org}`], url: `/${org}`, displayName: capitalize(org) },
    {
      searchTerm: [`${org}/search`],
      url: `/search?q=org:${org} %s`,
      searchPlaceholder: "Search in org",
      displayName: `${capitalize(org)} -> Search`,
      displayTemplate: `${capitalize(org)} -> Search for "%s"`,
    },
    {
      searchTerm: [`${org}/repositories`],
      url: `/orgs/${org}/repositories?q=%s`,
      searchPlaceholder: "Search repositories in org",
      displayName: `${capitalize(org)} -> Repositories`,
      displayTemplate: `${capitalize(org)} -> Repositories "%s"`,
    }
  );

  // Repo-level entries
  repos.forEach((repo) => {
    const fullRepo = `${org}/${repo}`;
    entries.push(
      {
        searchTerm: [fullRepo],
        url: `/${fullRepo}`,
        displayName: fullRepo,
        type: "repo",
      },
      {
        searchTerm: [
          `${fullRepo}/pulls`,
          `${fullRepo}/pr`,
          `${fullRepo}/pull request`,
        ],
        url: `/${fullRepo}/pulls`,
        displayName: `${fullRepo} -> PR`,
      },
      {
        searchTerm: [
          `${fullRepo}/pulls/search`,
          `${fullRepo}/pr/search`,
          `${fullRepo}/pull request search`,
        ],
        url: `/${fullRepo}/pulls?q=%s`,
        displayName: `${fullRepo} -> PR Search`,
        searchPlaceholder: "Search PRs",
        displayTemplate: `${fullRepo} -> Search PRs for "%s"`,
      },
      {
        searchTerm: [`${fullRepo}/issues`],
        url: `/${fullRepo}/issues`,
        displayName: `${fullRepo} -> Issues`,
      },
      {
        searchTerm: [`${fullRepo}/issues/search`],
        url: `/${fullRepo}/issues?q=%s`,
        displayName: `${fullRepo} -> Issues Search`,
        searchPlaceholder: "Search Issues",
        displayTemplate: `${fullRepo} -> Search Issues for "%s"`,
      },
      {
        searchTerm: [`${fullRepo}/commits`],
        url: `/${fullRepo}/commits/%s`,
        searchPlaceholder: "Branch name",
        displayName: `${fullRepo} -> Commits by branch`,
        displayTemplate: `${fullRepo} -> Commits by branch "%s"`,
      },
      {
        searchTerm: [`${fullRepo}/branches`],
        url: `/${fullRepo}/tree/%s`,
        searchPlaceholder: "Branch name",
        displayName: `${fullRepo} -> Branches`,
        displayTemplate: `${fullRepo} -> Branches "%s"`,
      },
      {
        searchTerm: [`${fullRepo}/actions`],
        url: `/${fullRepo}/actions`,
        displayName: `${fullRepo} -> Actions`,
      },
      {
        searchTerm: [`${fullRepo}/search`],
        url: `/search?q=repo:${fullRepo} %s`,
        searchPlaceholder: "Search in repo",
        displayName: `${fullRepo} -> Search`,
        displayTemplate: `${fullRepo} -> Search for "%s"`,
      }
    );

    if (githubUsername) {
      entries.push(
        {
          searchTerm: [
            `${fullRepo}/pulls/my`,
            `${fullRepo}/pr/my`,
            `${fullRepo}/my pull requests`,
            `${fullRepo}/my PRs`,
          ],
          url: `/${fullRepo}/pulls/${githubUsername}`,
          displayName: `${fullRepo} -> My PRs`,
          displayTemplate: `${fullRepo} -> My PRs`,
        },
      );
    }
  });


  return entries;
}

// ====== Main Functions ======

function updateRepositories(forceUpdate = false) {
  if (forceUpdate) chrome.storage.local.remove(["repositories"]);

  chrome.storage.local.get(["allowedUsers", "githubUsername"], (settings) => {
    const allowedUsers = settings.allowedUsers || [];
    const githubUsername = settings.githubUsername;
    const orgs = new Set();
    const reposByOrg = {};

    chrome.history.search(
      { text: "github.com", startTime: 0, maxResults: 10000 },
      (historyItems) => {
        historyItems.forEach((item) => {
          const url = item.url;
          const org = extractOrgName(url);
          if (org && shouldIncludeRepo(org, allowedUsers)) {
            orgs.add(org);
          }

          const repo = extractRepoBase(url);
          if (repo && shouldIncludeRepo(repo, allowedUsers)) {
            const [orgName, repoName] = repo.split("/");
            if (!reposByOrg[orgName]) reposByOrg[orgName] = new Set();
            reposByOrg[orgName].add(repoName);
          }
        });

        // Generate structured entries
        let entries = [];
        orgs.forEach((org) => {
          const repos = Array.from(reposByOrg[org] || []);
          entries.push(...generateEntries(org, repos, githubUsername));
        });

        // Deduplicate by key (url + primary search term)
        const seen = new Set();
        const uniqueEntries = entries.filter((entry) => {
          const key = `${entry.url}|${entry.searchTerm[0].toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Save the array of unique objects
        saveRepositories(uniqueEntries);
      }
    );
  });
}

function handleTabUpdate(tabId, changeInfo) {
  if (!changeInfo.url) return;

  chrome.storage.local.get(["repositories", "allowedUsers", "githubUsername"], (result) => {
    const allowedUsers = result.allowedUsers || [];
    const org = extractOrgName(changeInfo.url);
    const repo = extractRepoBase(changeInfo.url);
    const githubUsername = result.githubUsername;
    const reposByOrg = {};

    if (org && shouldIncludeRepo(org, allowedUsers)) {
      if (!reposByOrg[org]) reposByOrg[org] = new Set();
    }

    if (repo && shouldIncludeRepo(repo, allowedUsers)) {
      const [orgName, repoName] = repo.split("/");
      if (!reposByOrg[orgName]) reposByOrg[orgName] = new Set();
      reposByOrg[orgName].add(repoName);
    }

    const storedRepos = result.repositories || []; // 🔥 Treat as array
    let newEntries = [];
    Object.keys(reposByOrg).forEach((orgName) => {
      const repos = Array.from(reposByOrg[orgName]);
      newEntries.push(...generateEntries(orgName, repos, githubUsername));
    });
    const combined = [...storedRepos, ...newEntries];

    // Deduplicate
    const seen = new Set();
    const uniqueEntries = combined.filter((entry) => {
      const key = `${entry.url}|${entry.searchTerm[0].toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    saveRepositories(uniqueEntries);
  });
}

// ====== Omnibox Search Functionality ======

function filterRepositoriesForOmnibox(repositories, query) {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const genericTerms = [
    "search",
    "issues",
    "pr",
    "pull requests",
    "actions",
    "commits",
    "branches",
  ];

  const matches = repositories
    .map((entry) => {
      const combinedText = `${entry.displayName.toLowerCase()} ${entry.searchTerm
        .join(" ")
        .toLowerCase()}`;
      const allMatch = queryTerms.every((qt) => combinedText.includes(qt));
      if (!allMatch) return null;

      // Scoring
      let score = 0;
      if (entry.displayName.toLowerCase() === query.toLowerCase()) score += 100;
      if (entry.displayName.toLowerCase().startsWith(query.toLowerCase()))
        score += 50;
      if (
        genericTerms.some((term) =>
          entry.displayName.toLowerCase().includes(term)
        )
      )
        score -= 30;
      score -= entry.displayName.length;

      return { entry, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.entry);

  return matches;
}

// Store entry data temporarily
const omniboxEntries = new Map();

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  chrome.storage.local.get(["repositories"], (result) => {
    const repositories = result.repositories || [];
    const entries = filterRepositoriesForOmnibox(repositories, text);

    const suggestions = entries.slice(0, 10).map((entry) => {
      let description = entry.displayName;
      description = entry.displayName.replace("->", "→");

      // Escape special characters in description
      description = description
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/->/g, "→");

      const content = entry.url.includes('%s') 
                ? `https://github.com${entry.url.replace('%s', "")}`
                : `https://github.com${entry.url}`;

      omniboxEntries.set(content, entry);

      return {
        content: content,
        deletable: false,
        description: description,
      };
    });

    suggest(suggestions);
  });
});

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  // Direct URL case
  if (text.startsWith("https://github.com")) {
    chrome.tabs.update({ url: text });
    const entry = omniboxEntries.get(text);
    if (entry) {
      chrome.storage.local.get(["recentSelections"], (res) => {
        const recent = res.recentSelections || [];
        const newEntry = {
          displayName: entry.displayName,
          url: text,
        };
        const newRecent = [
          newEntry,
          ...recent.filter((p) => p.url !== newEntry.url),
        ].slice(0, 5);
        chrome.storage.local.set({ recentSelections: newRecent });
      });
    }
    return;
  }

  // Search case
  if (text.startsWith("{")) {
    const contextUrl =
      chrome.runtime.getURL("input.html") +
      `?context=${encodeURIComponent(text)}`;
    chrome.tabs.update({ url: contextUrl, highlighted: false });
  }
});

// Handle search completion from input.html
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "completeSearch") {
    chrome.tabs.update(sender.tab.id, { url: message.url });
    chrome.storage.local.get(["recentSelections"], (res) => {
      const recent = res.recentSelections || [];
      const newEntry = {
        displayName: message.displayName,
        url: message.url,
      };
      const newRecent = [
        newEntry,
        ...recent.filter((p) => p.url !== newEntry.url),
      ].slice(0, 5);
      chrome.storage.local.set({ recentSelections: newRecent });
    });
    sendResponse({ success: true });
  }
  return true;
});

// ====== Event Listeners ======

chrome.tabs.onUpdated.addListener(handleTabUpdate);
chrome.runtime.onInstalled.addListener(() => updateRepositories(false));
setInterval(() => updateRepositories(false), 3600000);

// Add message listener for refreshRepositories and addRecentSelection
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "refreshRepositories") {
    updateRepositories(true);
    sendResponse({ success: true });
  } else if (message.action === "addRecentSelection") {
    saveRecentSelections(message.repoPath);
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async responses
});

// Export functions for testing
if (typeof global !== 'undefined' && global.jest) {
  global.extractRepoBase = extractRepoBase;
  global.extractOrgName = extractOrgName;
  global.shouldIncludeRepo = shouldIncludeRepo;
  global.capitalize = capitalize;
  global.generateEntries = generateEntries;
  global.saveRepositories = saveRepositories;
  global.saveRecentSelections = saveRecentSelections;
  global.filterRepositoriesForOmnibox = filterRepositoriesForOmnibox;
  global.updateRepositories = updateRepositories;
  global.handleTabUpdate = handleTabUpdate;
}
