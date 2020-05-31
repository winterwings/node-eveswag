# [eveswag](https://gitlab.com/airships/node-eveswag) - EVE Swagger Interface

Originally developed for [LittleUFO](https://gitlab.com/airships/ufo) as a `swagger-client` replacement, but departed to be stand-alone, this module offers:
* **No limits in tokens**  
  Aimed towards big projects with lots of users, every auth-protected call can take its own auth token and scopes list.
* **Scopes**  
  Every auth-protected call is checked against provided list of scopes, so you don't have to worry about it.
* **Endpoints status**  
  You can always view status of the endpoints without delay.
* **Error tolerance**  
  It can avoid many known errors often happening on ESI by making multiple attempts where it is safe (bad gateway, timeout, etc), and presents errors in a readable format.
* **Avoidance of endpoints with yellow/red status**  
  As an optional feature, it helps you to deal with problematic endpoints.
* **Endpoint upgrade notifications**  
  When some endpoint will soon be upgraded or deprecated, module notify about it in a log.
* **Async**  
  Say goodbye to callback hell.
* **Lightweight**  
  One file, one prerequisite.

And, as it was said before, this module is a part of a big active project, so it will receive a constant updates.


## Installation

Install with  
`npm install eveswag --production` (to skip development dependencies)

For development purposes:  
`npm install eveswag`


See usage example in a constructor description.


# Reference

<a name="eveswag"></a>

## eveswag
**Kind**: global class  
**Author**: Shyaltii (in-EVE)  
**License**: MIT  

* [eveswag](#eveswag)
    * [new eveswag(cfg)](#new_eveswag_new)
    * _instance_
        * [.log](#eveswag+log) : <code>function</code>
        * [.report](#eveswag+report) : <code>function</code>
        * [.userAgent](#eveswag+userAgent) : <code>string</code>
        * [.proxy](#eveswag+proxy) : <code>string</code> \| <code>boolean</code>
        * [.host](#eveswag+host) : <code>string</code>
        * [.version](#eveswag+version) : <code>string</code>
        * [.datasource](#eveswag+datasource) : <code>string</code>
        * [.language](#eveswag+language) : <code>string</code>
        * [.allowYellow](#eveswag+allowYellow) : <code>boolean</code>
        * [.allowRed](#eveswag+allowRed) : <code>boolean</code>
        * [.statusRefresh](#eveswag+statusRefresh) : <code>boolean</code>
        * [.lockuntil](#eveswag+lockuntil) : <code>null</code> \| <code>number</code>
        * [.info](#eveswag+info) : <code>Object.&lt;string, any&gt;</code>
        * [.list](#eveswag+list) : <code>Object.&lt;string, Object.&lt;string, tListOperation&gt;&gt;</code>
        * [.apis](#eveswag+apis) : <code>Object.&lt;string, Object.&lt;string, fCallOperation&gt;&gt;</code>
        * [.loadFile(file)](#eveswag+loadFile)
        * [.loadRemote()](#eveswag+loadRemote)
        * [.loadScheme(scheme)](#eveswag+loadScheme)
        * [.health([op])](#eveswag+health) ⇒ <code>0</code> \| <code>1</code> \| <code>2</code>
    * _static_
        * [.fCallOperation](#eveswag.fCallOperation) ⇒ <code>Promise.&lt;Object&gt;</code>
        * *[.tListOperation](#eveswag.tListOperation) : <code>Object</code>*
        * *[.tError](#eveswag.tError) : <code>Object</code>*

<a name="new_eveswag_new"></a>

### new eveswag(cfg)
EVE Swagger InterfaceAfter new instance is created, call either [loadFile(file)](#eveswagloadfile), [loadRemote()](#eveswagloadremote) or [loadScheme(scheme)](#eveswagloadscheme),and then use [apis](#eveswagapis).Category.operation_name() to call an endpoint,[list](#eveswaglist) to see all endpoints mapping along with their required scopes and status,and [info](#eveswaginfo) to see the scheme information.Useful links:https://esi.evetech.net/ https://docs.esi.evetech.net/


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| cfg | <code>Object</code> |  | Configuration |
| cfg.userAgent | <code>string</code> |  | ESI-compliant user agent |
| [cfg.allowYellow] | <code>boolean</code> | <code>true</code> | Allow calling an endpoint when its status is yellow |
| [cfg.allowRed] | <code>boolean</code> | <code>false</code> | Allow calling an endpoint when its status is red |
| [cfg.statusRefresh] | <code>number</code> | <code>300</code> | Specifies status refresh interval |
| [cfg.host] | <code>string</code> | <code>&quot;https://esi.evetech.net&quot;</code> | Host to download specs from, that will be replaced by specs and used for requests |
| [cfg.version] | <code>string</code> | <code>&quot;latest&quot;</code> | ESI specs version |
| [cfg.datasource] | <code>string</code> | <code>&quot;tranquility&quot;</code> | Datasource |
| [cfg.language] | <code>string</code> | <code>&quot;en-us&quot;</code> | Language |
| [cfg.proxy] | <code>string</code> \| <code>boolean</code> | <code>false</code> | String ("http://127.0.0.1:3080") or boolean (true - to use environment, false - to disable) |
| [cfg.log] | <code>function</code> | <code>fallback to console.log</code> | console.log-like function with first parameter meaning the type of a message - "info" or "warning" |
| [cfg.report] | <code>function</code> | <code>stub</code> | Function to report calls into: report("direct", "get_status") or report("error", "get_status"), because this class has a fallback mechanism and may retry some failed calls |

**Example**  
```js
const eveswag = require("eveswag");// Create an instance with your project and your own name, as ESI recommendsconst esi = new eveswag({    userAgent: "My awesome EVE project (by EveName)"});// Load current specifications from a serverawait esi.loadRemote();// Get status and display online players countlet resp = await esi.apis.Status.get_status();console.log("Pilots online:", resp.body.players);
```
<a name="eveswag+log"></a>

### ~.log : <code>function</code>
console.log-like function with first parameter meaning the type of a message - "info" or "warning"

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>console.log fallback</code>  
**Access**: public  
<a name="eveswag+report"></a>

### ~.report : <code>function</code>
Function to report calls into: `report("direct", "get_status")` or `report("error", "get_status")`, because this class has a fallback mechanism and may retry some failed calls

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>stub</code>  
**Access**: public  
<a name="eveswag+userAgent"></a>

### ~.userAgent : <code>string</code>
ESI-compliant user agent

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Access**: public  
<a name="eveswag+proxy"></a>

### ~.proxy : <code>string</code> \| <code>boolean</code>
String ("http://127.0.0.1:3080") or boolean (true - to use environment, false - to disable)

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>&quot;false&quot;</code>  
**Access**: public  
<a name="eveswag+host"></a>

### ~.host : <code>string</code>
Host to download specs from, that will be replaced by specs and used for requests

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>&quot;https://esi.evetech.net&quot;</code>  
**Access**: public  
<a name="eveswag+version"></a>

### ~.version : <code>string</code>
ESI specs version.

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>&quot;latest&quot;</code>  
**Access**: public  
<a name="eveswag+datasource"></a>

### ~.datasource : <code>string</code>
Datasource.

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>&quot;tranquility&quot;</code>  
**Access**: public  
<a name="eveswag+language"></a>

### ~.language : <code>string</code>
Language.

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>&quot;en-us&quot;</code>  
**Access**: public  
<a name="eveswag+allowYellow"></a>

### ~.allowYellow : <code>boolean</code>
Allow calling an endpoint when its status is yellow.

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>true</code>  
**Access**: public  
<a name="eveswag+allowRed"></a>

### ~.allowRed : <code>boolean</code>
Allow calling an endpoint when its status is red.

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>false</code>  
**Access**: public  
<a name="eveswag+statusRefresh"></a>

### ~.statusRefresh : <code>boolean</code>
Specifies status refresh interval.

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>300</code>  
**Access**: public  
<a name="eveswag+lockuntil"></a>

### ~.lockuntil : <code>null</code> \| <code>number</code>
If specified, we're softlocked by ESI until this time in epoch.You may reset this property to null to force new calls earlier.

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Default**: <code>null</code>  
<a name="eveswag+info"></a>

### ~.info : <code>Object.&lt;string, any&gt;</code>
Object with scheme information.

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Access**: public  
**Read only**: true  
<a name="eveswag+list"></a>

### ~.list : <code>Object.&lt;string, Object.&lt;string, tListOperation&gt;&gt;</code>
Categorised API list with scopes and their current status.(Categories are defined for every operation by ESI tags.)Structure:```json{    "Category": {        "operation_id": {            "scope": "esi.scope-name.v1" | null,            "status": "unknown" | "green" | "yellow" | "red"        },        ...    },    ...}```

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Access**: public  
**Read only**: true  
**See**: [tListOperation](#eveswagtlistoperation)  
<a name="eveswag+apis"></a>

### ~.apis : <code>Object.&lt;string, Object.&lt;string, fCallOperation&gt;&gt;</code>
Categorised API list to call to.(Categories are defined for every operation by ESI tags.)Call with:```jsawait eveswag.apis.Category.operation_id([params: Object], [token: string], [scopes: string | string[]])// params = object { character_id: 978869108 }// token = access token// scopes = list of scopes for this token: whitespace separated list or an array```Structure:```json{    "Category": {        "operation_id": async function(),        ...    },    ...}```

**Kind**: instance property of [<code>eveswag</code>](#eveswag)  
**Access**: public  
**Read only**: true  
**See**: [fCallOperation](#eveswagtcalloperation)  
<a name="eveswag+loadFile"></a>

### ~.loadFile(file)
Loads specs from a file.

**Kind**: instance method of [<code>eveswag</code>](#eveswag)  

| Param | Type | Description |
| --- | --- | --- |
| file | <code>string</code> | Path to a scheme file |

<a name="eveswag+loadRemote"></a>

### ~.loadRemote()
Downloads specs from web and calls this.load with them.

**Kind**: instance method of [<code>eveswag</code>](#eveswag)  
<a name="eveswag+loadScheme"></a>

### ~.loadScheme(scheme)
Generates all of the available endpoints and creates this.apis and this.list.It also triggers refresh of status list.

**Kind**: instance method of [<code>eveswag</code>](#eveswag)  

| Param | Type | Description |
| --- | --- | --- |
| scheme | <code>Object</code> \| <code>string</code> | EVE Swagger Interface specs |

<a name="eveswag+health"></a>

### ~.health([op]) ⇒ <code>0</code> \| <code>1</code> \| <code>2</code>
Checks health of an endpoint.> This function gets called on every API call as well.  > And it will refresh ESI status if the time has come.> To view a delayed status, use `list` instead

**Kind**: instance method of [<code>eveswag</code>](#eveswag)  
**Returns**: <code>0</code> \| <code>1</code> \| <code>2</code> - -1 = unknown, 0 = green, 1 = yellow, 2 = red  

| Param | Type | Description |
| --- | --- | --- |
| [op] | <code>string</code> | Operation ID |

<a name="eveswag.fCallOperation"></a>

### eveswag.fCallOperation ⇒ <code>Promise.&lt;Object&gt;</code>
Operation call function inside [eveswag.apis](#eveswagapis).

**Kind**: static property of [<code>eveswag</code>](#eveswag)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - Promise with full response object, flavoured with [tError](#eveswagterror) parameters if any.  Most likely you will receive something like this:```js{    headers: { headers object },    body: { json reponse },    ...and some more things}```  

| Param | Type | Description |
| --- | --- | --- |
| [params] | <code>Object</code> | Requested parameters |
| [token] | <code>string</code> | Auth token |
| [scopes] | <code>string</code> \| <code>Array.&lt;string&gt;</code> | Token scopes in an array or a string list |

<a name="eveswag.tListOperation"></a>

### *eveswag.tListOperation : <code>Object</code>*
Operation details inside [eveswag.list](#eveswaglist)

**Kind**: static abstract typedef of [<code>eveswag</code>](#eveswag)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| scope | <code>null</code> \| <code>string</code> | Scope used by this endpoint. |
| status | <code>&quot;unknown&quot;</code> \| <code>&quot;green&quot;</code> \| <code>&quot;yellow&quot;</code> \| <code>&quot;red&quot;</code> | Current status of this endpoint. |

<a name="eveswag.tError"></a>

### *eveswag.tError : <code>Object</code>*
Thrown error

**Kind**: static abstract typedef of [<code>eveswag</code>](#eveswag)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| err | <code>&quot;error&quot;</code> \| <code>&quot;server&quot;</code> \| <code>&quot;esi\_status&quot;</code> \| <code>&quot;scope\_missing&quot;</code> | Short error name |
| error | <code>string</code> | Error description |



## Changelog

#### 0.2.1
Scopes detection mistake fix.

#### 0.2.0
Refactoring, consistency, jsDoc.

New:
* `cfg.allowYellow`
* `cfg.statusRefresh`

Breaking changes:
* `cfg.useragent` renamed to `cfg.userAgent`
* `cfg.allowred` renamed to `cfg.allowRed`
* `loadFromRemote` renamed to `loadRemote`
* `log` is no longer object but a function


#### 0.1.2
Improved error detection and implemented ESI error reader with a softlock.


#### 0.1.1
On requests, `scopes` can take an array.


#### 0.1.0
Initial release.


## TODO

* Option to flatten `apis` and `list` (w/o categories, only operation ids)

Transfer from LittleUFO:
* Cache handling
* Notifications parser to natively present a baked json instead of yaml
* SSO pipeline maybe?


## Contacts

Discord: Rainicorn#4886  
EVE: Shyaltii  
ISK donations appreciated ♥
