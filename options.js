// Load saved settings
document.addEventListener('DOMContentLoaded', function () {
    chrome.storage.local.get(['allowedUsers'], function (result) {
        const textarea = document.getElementById('allowedUsers');
        if (result.allowedUsers) {
            textarea.value = result.allowedUsers.join('\n');
        }
    });
});

// Save settings
document.getElementById('save').addEventListener('click', function () {
    const textarea = document.getElementById('allowedUsers');
    const users = textarea.value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    chrome.storage.local.set({
        allowedUsers: users
    }, function () {
        showStatus("save-status", 'Settings saved!', 'success');
        chrome.runtime.sendMessage({ action: 'refreshRepositories' });
    });
});

// Reset and rescan
document.getElementById('reset').addEventListener('click', async function () {
    showStatus('reset-status', 'Clearing history and starting fresh scan...', 'info');
    chrome.runtime.sendMessage({ action: 'refreshRepositories' });
    setTimeout(() => {
        showStatus('reset-status', 'Reset complete! Repository list has been refreshed.', 'success');
    }, 2000);
});

// // Show repositories data
// document.getElementById('showData').addEventListener('click', function () {
//     chrome.storage.local.get(['repositories'], function (result) {
//         const dataOutput = document.getElementById('dataOutput');
//         const showDataLabel = document.getElementById('showDataLabel');
//         if (dataOutput.style.display === 'block') {
//             dataOutput.style.display = 'none';
//             showDataLabel.textContent = 'Show Repositories Data';
//             return;
//         }
//         if (result.repositories && result.repositories.length > 0) {
//             dataOutput.textContent = JSON.stringify(result.repositories, null, 2);
//             dataOutput.style.display = 'block';
//         } else {
//             dataOutput.textContent = 'No repositories data found.';
//             dataOutput.style.display = 'block';
//         }
//         showDataLabel.textContent = 'Hide Repositories Data';
//     });
// });

// // Show recent selections as JSON
// document.getElementById('showRecent').addEventListener('click', function() {
//   chrome.storage.local.get(['recentSelections'], function(result) {
//     const recentOutput = document.getElementById('recentOutput');
//     const showRecentLabel = document.getElementById('showRecentLabel');
//     if (recentOutput.style.display === 'block') {
//         recentOutput.style.display = 'none';
//         showRecentLabel.textContent = 'Show Recent Selections';
//         return;
//     }
//     if (result.recentSelections && result.recentSelections.length > 0) {
//         recentOutput.textContent = JSON.stringify(result.recentSelections, null, 2);
//         recentOutput.style.display = 'block';
//     } else {
//         recentOutput.textContent = 'No recent selections found.';
//         recentOutput.style.display = 'block';
//     }
//     showRecentLabel.textContent = 'Hide Recent Selections';
//   });
// });


document.getElementById('dataAccordionHeader').addEventListener('click', function () {
    const content = document.getElementById('dataOutput');
    const isVisible = content.classList.toggle('visible');
    if (isVisible) {
        chrome.storage.local.get(['repositories'], function (result) {
            if (result.repositories && result.repositories.length > 0) {
                content.textContent = JSON.stringify(result.repositories, null, 2);
            } else {
                content.textContent = 'No repositories data found.';
            }
        });
    }
});

document.getElementById('recentAccordionHeader').addEventListener('click', function () {
    const content = document.getElementById('recentOutput');
    const isVisible = content.classList.toggle('visible');
    if (isVisible) {
        chrome.storage.local.get(['recentSelections'], function (result) {
            if (result.recentSelections && result.recentSelections.length > 0) {
                content.textContent = JSON.stringify(result.recentSelections, null, 2);
            } else {
                content.textContent = 'No recent selections found.';
            }
        });
    }
});


document.getElementById('clearRecent').addEventListener('click', function () {
    if (confirm('Are you sure you want to clear recent selections?')) {
        chrome.storage.local.set({ recentSelections: [] }, function () {
            showStatus('history-status', 'Recent selections cleared!', 'success');
            document.getElementById('recentOutput').textContent = 'No recent selections found.';
        });
    }
});

// Helper function to show status messages
function showStatus(statusClass, message, className) {
    const status = document.getElementById(statusClass);
    status.textContent = message;
    status.className = className;

    setTimeout(function () {
        status.textContent = '';
        status.className = '';
    }, 2000);
}
