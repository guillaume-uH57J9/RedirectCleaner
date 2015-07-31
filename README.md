This is a fork of Redirect cleaner orginally developed by Alexander Bergmann <myaddons@gmx.de>

RedirectCleaner cleans Redirects from Links

Modes:
* Whitelist - Clean all redirects except on sites matching the Whitelist entries.
* Blacklist - Allow all redirects except on sites matching the Blacklist entries.


Whitelist/Blacklist Format Options:
* Comma Separated List - A list of domain names separated by commas. To use a comma separated list you must uncheck the "Regular Expression" checkbox.
* Regular Expression - An expression used for pattern matching against the full url. See [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) for more information. To use a regular expression you must check the "Regular Expression" checkbox.
