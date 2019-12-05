# eveswag - EVE Swagger Interface generator

Originally developed for [LittleUFO](https://gitlab.com/airships/ufo), but departed as a stand-alone module, this module offers:
* **Async**  
  Say goodbye to callback hell.
* **Lightweight**  
  One file, one prerequisite.
* **No limits in tokens**  
  Aimed towards big projects, every scoped call can take its own auth token.
* **Scopes**  
  Every call gets checked against provided list of scopes, so you don't have to worry about it.
* **Endpoints status**  
  You can always view the status of endpoints without delay.
* **Error tolerance**  
  It can avoid some errors often happening on ESI by making multiple attempts where it is safe (bad gateway, timeout, etc), and presents errors in a readable format as possible.
* **Avoidance of endpoints with red status**  
  As an optional feature, it helps you to deal with problematic endpoints.
* **Endpoint upgrade notifications**  
  When some endpoint will soon be upgraded or deprecated, module will show a message about it.

And, as it was said before, this module is a part of a big active project, so it will receive a constant updates.


## Usage

Install with  
`npm install eveswag`

Usage example:
```js
const eveswag = require("./eveswag");

// Create an instance with your project and your own name, as ESI recommends
const esi = new eveswag({
    useragent: "My awesome EVE project (by EveName)"
});

// Load current specifications from a server
await esi.loadFromRemote();

// Get and display status
let resp = await esi.apis.Status.get_status();
console.log("Pilots online:", resp.body.players);
```

## Reference

### new eveswag(config)
A constructor.

Provide config as an object with:
* `useragent` (**required**) - ESI-compliant user agent
* `proxy` - String or boolean (to use environment) (default: null)
* `allowred` (boolean) - Allow calling an endpoint when its status is red *(default: false)*
* `host` - Host to download specs from, that will be replaced by specs and used for requests *(default: "https://esi.evetech.net")*
* `version` - ESI specs version *(default: "latest")*
* `datasource` - Datasource *(default: "tranquility")*
* `language` - Language *(default: "en-us")*
* `logger` - Object with two console.log-like functions: `{ log: simple log, logw: log with writing to a file }` *(default: fallback to console.log)*
* `report` - Function to report calls into like `report("direct", "get_status")` or `report("error", "get_status")`, because this class has a fallback mechanism and may retry some failed calls

All of these may be modified later as a class properties.

#### loadFile(file)
Loads ESI specs from a file.

#### await loadFromRemote()
Loads ESI specs frim a web.

#### loadScheme(scheme)
Loads specs from a string or an object.

#### apis
Categorised API to call to.

Format:
```js
await eveswag.apis.Category.operation_id(params, token, scopes)
```
...where:
* `params` - Object with parameters to send to ESI
* `token` - If endpoint requires a scope, provide an access token
* `scopes` - Scopes list for that token

#### list
Categorised API list with scopes and their current status.

Format:
```json
{
    "Category": {
        "operation_id": {
            "scope": "esi.scope" | null,
            "status": "green" | "yellow" | "red"
        },
        ...
    },
    ...
}
```

#### await health(operation_id)
Checks health of an endpoint.

Returns: `0` = green, `1` = yellow, `2` = red

> This function gets called on every API call as well.  
> And it will refresh ESI status if the time has come.
> To view a delayed status, use `list` instead


### TODO

* Option to flatten `apis` and `list` (w/o categories, only operation ids)
* Generate a jsDoc page.

Transfer from LittleUFO:
* Cache handling
* Notifications parser
* SSO login and token refreshing maybe?
