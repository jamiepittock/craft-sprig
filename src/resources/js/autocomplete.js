const COMPLETION_KEY = '__completions';
const AUTOCOMPLETE_CONTROLLER_ENDPOINT = 'sprig/autocomplete/index';
const AUTOCOMPLETE_CACHE_KEY = 'sprig-autocomplete-cache';
const AUTOCOMPLETE_CACHE_DURATION = 60 * 1000;

/**
 * Store a value in local storage via a key, and with a duration in TTL
 *
 * @param key
 * @param value
 * @param ttl
 */
function setWithExpiry(key, value, ttl) {
    const now = new Date()
    // `item` is an object which contains the original value
    // as well as the time when it's supposed to expire
    const item = {
        value: value,
        expiry: now.getTime() + ttl,
    }
    localStorage.setItem(key, JSON.stringify(item))
}

/**
 * Retireve a value from local storage
 *
 * @param key
 * @returns {null|*}
 */
function getWithExpiry(key) {
    const itemStr = localStorage.getItem(key)
    // if the item doesn't exist, return null
    if (!itemStr) {
        return null
    }
    const item = JSON.parse(itemStr)
    const now = new Date()
    // compare the expiry time of the item with the current time
    if (now.getTime() > item.expiry) {
        // If the item is expired, delete the item from storage
        // and return null
        localStorage.removeItem(key)
        return null
    }
    return item.value
}

/**
 * Register completion items with the Monaco editor, for the Twig language
 *
 * @param completionItems
 */
function addCompletionItemsToMonaco(completionItems) {
    monaco.languages.registerCompletionItemProvider('twig', {
        triggerCharacters: ['.', '('],
        provideCompletionItems: function(model, position, token) {
            var result = [];
            // Get the last word the user has typed
            const currentLine = model.getValueInRange({startLineNumber: position.lineNumber, startColumn: 0, endLineNumber: position.lineNumber, endColumn: position.column});
            const currentWords = currentLine.replace("\t", "").split(" ");
            const currentWord = currentWords[currentWords.length - 1];
            const isSubProperty = currentWord.charAt(currentWord.length - 1) == ".";
            let currentItems = completionItems;
            // If the last character typed is a period, then we need to look up a sub-property of the completionItems
            if (isSubProperty) {
                // Is a sub-property, get a list of parent properties
                var parents = currentWord.substring(0, currentWord.length - 1).split(".");
                currentItems = completionItems[parents[0]];
                // Loop through all the parents to traverse the completion items and find the current one
                for (var i = 1; i < parents.length; i++) {
                    if (currentItems.hasOwnProperty(parents[i])) {
                        currentItems = currentItems[parents[i]];
                    } else {
                        return result;
                    }
                }
            }
            // Get all the child properties
            for (let item in currentItems) {
                if (currentItems.hasOwnProperty(item) && !item.startsWith("__")) {
                    const completionItem = currentItems[item][COMPLETION_KEY];
                    if (completionItem !== undefined) {
                        // Add to final results
                        result.push(completionItem);
                    }
                }
            }

            return {
                suggestions: result
            };
        }
    });
}

function addHoverHandlerToMonaco(completionItems) {
    monaco.languages.registerHoverProvider('twig', {
        provideHover: function (model, position) {
            let result = {};
            const currentLine = model.getValueInRange({startLineNumber: position.lineNumber, startColumn: 0, endLineNumber: position.lineNumber, endColumn: model.getLineMaxColumn(position.lineNumber) });
            const currentWord = model.getWordAtPosition(position);
            let searchLine = currentLine.substring(0, currentWord.endColumn -1)
            let isSubProperty = false;
            let currentItems = completionItems;
            for (var i = searchLine.length; i >= 0; i--) {
                if (searchLine[i] === ' ') {
                    searchLine = currentLine.substring(i, searchLine.length);
                    break;
                }
            }
            if (searchLine.includes('.')) {
                isSubProperty = true;
            }
            if (isSubProperty) {
                // Is a sub-property, get a list of parent properties
                var parents = searchLine.substring(0, searchLine.length).split(".");
                console.log(parents[0]);
                console.log(completionItems[parents[0]]);
                currentItems = completionItems[parents[0]];
                console.log(currentItems);
                // Loop through all the parents to traverse the completion items and find the current one
                for (var i = 1; i < parents.length; i++) {
                    if (currentItems.hasOwnProperty(parents[i])) {
                        currentItems = currentItems[parents[i]];
                    } else {
                        return result;
                    }
                }
            }

            if (currentItems[currentWord.word] !== undefined) {
                const completionItem = currentItems[currentWord.word][COMPLETION_KEY];
                if (completionItem !== undefined) {
                    return {
                        range: new monaco.Range(position.lineNumber, currentWord.startColumn, position.lineNumber, currentWord.endColum),
                        contents: [
                            {value: completionItem.label},
                            {value: completionItem.detail},
                        ]
                    }
                }
            }

            return result;
        }
    });
}

/**
 * Fetch the autocompletion items from local storage, or from the endpoint if they aren't cached in local storage
 */
function getCompletionItemsFromEndpoint() {
    // Try to get the completion items from local storage
    var completionItems = getWithExpiry(AUTOCOMPLETE_CACHE_KEY);
    if (completionItems !== null) {
        addCompletionItemsToMonaco(completionItems);
        addHoverHandlerToMonaco(completionItems);

        return;
    }
    // Ping the controller endpoint
    let request = new XMLHttpRequest();
    request.open('GET', Craft.getActionUrl(AUTOCOMPLETE_CONTROLLER_ENDPOINT), true);
    request.onload = function () {
        if (request.status >= 200 && request.status < 400) {
            completionItems = JSON.parse(request.responseText);
            setWithExpiry(AUTOCOMPLETE_CACHE_KEY, completionItems, AUTOCOMPLETE_CACHE_DURATION);
            addCompletionItemsToMonaco(completionItems);
            addHoverHandlerToMonaco(completionItems);
        } else {
            console.log('Autocomplete endpoint failed with status ' + request.status)
        }
    };
    request.send();
}

// Make it go
getCompletionItemsFromEndpoint();
