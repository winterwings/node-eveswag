const request = require("request");

/**
 * @typicalname ~
 * @author Shyaltii (in-EVE)
 * @license MIT
 */
class eveswag {
    /**
     * EVE Swagger Interface
     *
     * After new instance is created, call either {@link #eveswagloadfile loadFile(file)}, {@link #eveswagloadremote loadRemote()} or {@link #eveswagloadscheme loadScheme(scheme)},
     * and then use {@link #eveswagapis apis}.Category.operation_name() to call an endpoint,
     * {@link #eveswaglist list} to see all endpoints mapping along with their required scopes and status,
     * and {@link #eveswaginfo info} to see the scheme information.
     *
     * Useful links:
     * https://esi.evetech.net/ https://docs.esi.evetech.net/
     *
     * @param {Object} cfg Configuration
     * @param {string} cfg.userAgent ESI-compliant user agent
     * @param {boolean} [cfg.allowYellow=true] Allow calling an endpoint when its status is yellow
     * @param {boolean} [cfg.allowRed=false] Allow calling an endpoint when its status is red
     * @param {number} [cfg.statusRefresh=300] Specifies status refresh interval
     * @param {string} [cfg.host=https://esi.evetech.net] Host to download specs from, that will be replaced by specs and used for requests
     * @param {string} [cfg.version=latest] ESI specs version
     * @param {string} [cfg.datasource=tranquility] Datasource
     * @param {string} [cfg.language=en-us] Language
     * @param {string|boolean} [cfg.proxy=false] String ("http://127.0.0.1:3080") or boolean (true - to use environment, false - to disable)
     * @param {function} [cfg.log=fallback to console.log] console.log-like function with first parameter meaning the type of a message - "info" or "warning"
     * @param {function} [cfg.report=stub] Function to report calls into: report("direct", "get_status") or report("error", "get_status"), because this class has a fallback mechanism and may retry some failed calls
     *
     * @example
     * const eveswag = require("eveswag");
     *
     * // Create an instance with your project and your own name, as ESI recommends
     * const esi = new eveswag({
     *     userAgent: "My awesome EVE project (by EveName)"
     * });
     *
     * // Load current specifications from a server
     * await esi.loadRemote();
     *
     * // Get status and display online players count
     * let resp = await esi.apis.Status.get_status();
     * console.log("Pilots online:", resp.body.players);
     */
    constructor(cfg={}) {
        if (!cfg.userAgent)
            throw { err: "error", error: "cfg.userAgent must be specified" };

        /** console.log-like function with first parameter meaning the type of a message - "info" or "warning"
         * @public
         * @type {function}
         * @default console.log fallback
         */
        this.log = cfg.log || function (type, ...args) {
            console.log.apply(this, ["[" + type + "]", ...args]);
        };

        /** Function to report calls into: `report("direct", "get_status")` or `report("error", "get_status")`, because this class has a fallback mechanism and may retry some failed calls
         * @public
         * @type {function}
         * @default stub
         */
        this.report = cfg.report || function(){};

        /** ESI-compliant user agent
         * @public
         * @type {string}
         */
        this.userAgent = cfg.userAgent;

        /** String ("http://127.0.0.1:3080") or boolean (true - to use environment, false - to disable)
         * @public
         * @type {string|boolean}
         * @default false
         */
        this.proxy = cfg.proxy || false;

        /** Host to download specs from, that will be replaced by specs and used for requests
         * @public
         * @type {string}
         * @default https://esi.evetech.net
         */
        this.host = cfg.host || "https://esi.evetech.net";

        /** ESI specs version.
         * @public
         * @type {string}
         * @default latest
         */
        this.version = cfg.version || "latest";

        /** Datasource.
         * @public
         * @type {string}
         * @default tranquility
         */
        this.datasource = cfg.datasource || "tranquility";

        /** Language.
         * @public
         * @type {string}
         * @default en-us
         */
        this.language = cfg.language || "en-us";

        /** Allow calling an endpoint when its status is yellow.
         * @public
         * @type {boolean}
         * @default true
         */
        this.allowYellow = typeof cfg.allowYellow !== "undefined" ? !!cfg.allowYellow : true;

        /** Allow calling an endpoint when its status is red.
         * @public
         * @type {boolean}
         * @default false
         */
        this.allowRed = !!cfg.allowRed;

        /** Specifies status refresh interval.
         * @public
         * @type {boolean}
         * @default 300
         */
        this.statusRefresh = cfg.statusRefresh || 300;

        /** If specified, we're softlocked by ESI until this time in epoch.
         * You may reset this property to null to force new calls earlier.
         * @type {null|number}
         * @default null
         */
        this.lockuntil = null;

        /** Object with scheme information.
         * @public
         * @readonly
         * @type {Object.<string, any>}
         */
        this.info = Object.freeze({});

        /** Categorised API list with scopes and their current status.
         * (Categories are defined for every operation by ESI tags.)
         *
         * Structure:
         * ```json
         * {
         *     "Category": {
         *         "operation_id": {
         *             "scope": "esi.scope-name.v1" | null,
         *             "status": "unknown" | "green" | "yellow" | "red"
         *         },
         *         ...
         *     },
         *     ...
         * }
         * ```
         * @see {@link #eveswagtlistoperation tListOperation}
         * @public
         * @readonly
         * @type {Object.<string, Object.<string, tListOperation>>}
         */
        this.list = Object.freeze({});

        /** Categorised API list to call to.
         * (Categories are defined for every operation by ESI tags.)
         *
         * Call with:
         * ```js
         * await eveswag.apis.Category.operation_id([params: Object], [token: string], [scopes: string | string[]])
         * // params = object { character_id: 978869108 }
         * // token = access token
         * // scopes = list of scopes for this token: whitespace separated list or an array
         * ```
         *
         * Structure:
         * ```json
         * {
         *     "Category": {
         *         "operation_id": async function(),
         *         ...
         *     },
         *     ...
         * }
         * ```
         * @see {@link #eveswagtcalloperation fCallOperation}
         * @public
         * @readonly
         * @type {Object.<string, Object.<string, fCallOperation>>}
         */
        this.apis = Object.freeze({});
    }

    /** Loads specs from a file.
     * @param {string} file Path to a scheme file
     */
    loadFile(file) {
        let scheme = require("fs").readFileSync(file, "utf8");
        loadScheme(this, scheme);
    }

    /** Downloads specs from web and calls this.load with them.
     * @async
     */
    async loadRemote() {
        this.log("info", "Loading ESI specs from a remote resource...");
        let spec = await requestPromise({
            method: "GET",
            url: this.host + "/" + this.version + "/swagger.json?datasource=" + this.datasource,
            json: true
        });
        loadScheme(this, spec.body);
    }

    /** Generates all of the available endpoints and creates this.apis and this.list.
     * It also triggers refresh of status list.
     * @param {Object|string} scheme EVE Swagger Interface specs
     */
    loadScheme(scheme) {
        loadScheme(this, scheme);
    }

    /** Checks health of an endpoint.
     * > This function gets called on every API call as well.  
     * > And it will refresh ESI status if the time has come.
     * > To view a delayed status, use `list` instead
     * @param {string} [op] Operation ID
     * @returns {0|1|2} -1 = unknown, 0 = green, 1 = yellow, 2 = red
     */
    async health(op) {
        await healthGet(this);
        if (!op || !this.healthData.hasOwnProperty(op))
            return -1;
        return this.healthData[op];
    }
}


/** Operation details inside {@link #eveswaglist eveswag.list}
 * @virtual
 * @memberof eveswag
 * @typedef {Object} tListOperation
 * @property {null|string} scope Scope used by this endpoint.
 * @property {"unknown"|"green"|"yellow"|"red"} status Current status of this endpoint.
 */

/** Thrown error
 * @virtual
 * @memberof eveswag
 * @typedef {Object} tError
 * @property {"error"|"server"|"esi_status"|"scope_missing"} err Short error name
 * @property {string} error Error description
 */


/** Current time in epoch.
 * @private
 * @returns {number} Time in epoch
 */
function epoch() {
    return Math.trunc((new Date()).getTime() / 1000);
}

/** Sleeps for a specified delay.
 * @private
 * @async
 * @param {int} ms Milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/** Generates all of the available endpoints and creates this.apis and this.list.
 * It also triggers refresh of status list.
 * @private
 * @param {ThisType} _this {@link eveswag}
 * @param {Object|string} scheme EVE Swagger Interface specs
 */
function loadScheme(_this, scheme) {
    if (typeof scheme === "string")
        scheme = JSON.parse(scheme);
    else if (typeof scheme === "object")
        scheme = JSON.parse(JSON.stringify(scheme)); // clone it just in case

    _this.esihealth = 0;

    _this.host = scheme.schemes.includes("https") ? "https" : "http"; // idk
    _this.host += "://" + scheme.host;

    let path = "";
    if (scheme.basePath) // when using non-versioned swagger specs
        path = scheme.basePath;

    // build apis
    let apis = {};
    for (let pth in scheme.paths) {
        for (let method in scheme.paths[pth]) {
            let cur = scheme.paths[pth][method];
            let op = cur.operationId;
            let route = {};
            // check if method was implemented
            if (!["get", "post", "put", "delete"].includes(method))
                _this.log("info", op, "has an unexpected method!");
            // save required token scope if any
            if (cur.security && cur.security.length > 0 && cur.security[0].evesso) {
                route.scope = cur.security[0].evesso[0];
                if (cur.security[0].evesso.length > 1) // notify if ccp will change something about scopes
                    _this.log("info", op, "has an unexpected number of scopes!", cur.security[0].evesso);
            }
            // create parameters map
            if (cur.parameters && cur.parameters.length > 0) {
                route.params = {};
                for (let i = 0; i < cur.parameters.length; i++) {
                    if (cur.parameters[i].hasOwnProperty("$ref")) {
                        if (cur.parameters[i]["$ref"].indexOf("#/parameters/") !== 0) {
                            _this.log("info", cur.parameters[i]["$ref"], "is an unexpected reference!");
                            continue;
                        }
                        cur.parameters[i] = scheme.parameters[cur.parameters[i]["$ref"].substring(13)];
                    }
                    route.params[cur.parameters[i].name] = {
                        required: cur.parameters[i].required || false,
                        location: cur.parameters[i].in
                    };
                    if (!["header", "path", "query", "body"].includes(cur.parameters[i].in))
                        _this.log("info", "Unexpected parameter location:", cur.parameters[i].in);
                    // if (cur.parameters[i].in === "body" && op !== "post")
                    //     _this.log("info", "Body parameter in a " + op + " request?");
                }
            }
            // create endpoint function
            route.run = createEndpoint(_this, op, method.toUpperCase(), path + pth, route.scope, route.params);
            // assign to categories
            for (let i = 0; i < cur.tags.length; i++) {
                let tag = cur.tags[i];
                if (!apis.hasOwnProperty(tag))
                    apis[tag] = {};
                apis[tag][op] = route;
            }
        }
    }

    // sort and build
    let cats = Object.keys(apis);
    cats.sort();
    let xapis = {}, xlist = {};
    for (let ci = 0; ci < cats.length; ci++) {
        let cat = cats[ci];
        xapis[cat] = {};
        xlist[cat] = {};
        let ops = Object.keys(apis[cat]);
        ops.sort();
        for (let oi = 0; oi < ops.length; oi++) {
            let op = ops[oi];
            xapis[cat][op] = apis[cat][op].run;
            xlist[cat][op] = createDetails(_this, apis, cat, op);
        }
    }

    // expose all the things
    _this.info = Object.freeze(scheme.info);
    _this.list = Object.freeze(xlist);
    _this.apis = Object.freeze(xapis);

    // reset lock just in case
    _this.lockuntil = null;

    // request a health update
    _this.healthData = {};
    _this.healthDate = 0;
    healthGet(_this);
}

/** Creates details for an endpoint.
 * @private
 * @param {ThisType} _this {@link eveswag}
 * @param {Object} apis Internal API list
 * @param {string} cat Operation category
 * @param {string} op Operation ID
 * @returns {tListOperation} Generated object
 */
function createDetails(_this, apis, cat, op) {
    return {
        scope: apis[cat][op].scope || null,
        get status() {
            if (_this.healthData.hasOwnProperty(op)) {
                //return _this.healthData[op];
                switch (_this.healthData[op]) {
                    case 0: return "green";
                    case 1: return "yellow";
                    case 2: return "red";
                }
            }
            //return 0;
            return "unknown";
        }
    };
}

/** Creates an endpoint function.
 * @private
 * @param {ThisType} _this {@link eveswag}
 * @param {string} op Operation ID
 * @param {string} method HTTP method
 * @param {string} path Operation path
 * @param {string} [scope] Operation permission
 * @param {Object.<string, {required: boolean, location: ""}>} [paramap] Operation parameters map
 * @returns {fCallOperation} Prepared call function
 */
function createEndpoint(_this, op, method, path, scope=null, paramap=null) {
    /** Operation call function inside {@link #eveswagapis eveswag.apis}.
     * @async
     * @memberof eveswag
     * @name fCallOperation
     * @param {Object} [params] Requested parameters
     * @param {string} [token] Auth token
     * @param {string|string[]} [scopes] Token scopes in an array or a string list
     * @returns {Promise<Object>} Promise with full response object, flavoured with {@link #eveswagterror tError} parameters if any.  
     * Most likely you will receive something like this:
     * ```js
     * {
     *     headers: { headers object },
     *     body: { json reponse },
     *     ...and some more things
     * }
     * ```
     */
    async function endpoint(params=null, token=null, scopes=null) {
        return await callEndpoint(_this, op, method, path, scope, paramap, params, token, scopes);
    }
    // TODO: maybe do something like this instead of this.list
    // endpoint.prototype.esiop = op;
    // endpoint.prototype.esipath = path;
    // endpoint.prototype.esiscope = scope;
    return endpoint;
}


/** Calls an endpoint.
 * @private
 * @async
 * @param {ThisType} _this {@link eveswag}
 * @param {string} op Operation ID
 * @param {string} method HTTP method
 * @param {string} path Operation path
 * @param {string} [scope] Operation permission
 * @param {Object.<string, {required: boolean, location: ""}>} [paramap] Operation parameters map
 * @param {Object.<string, any>} [params] Requested parameters
 * @param {string} [token] Auth token
 * @param {string|string[]} [scopes] Token scopes in an array or a string list
 * @returns {Object} Server response
 */
async function callEndpoint(_this, op, method, path, scope=null, paramap=null, params=null, token=null, scopes=null) {
    let problem = await _this.health(op);

    if (problem > (!_this.allowRed ? 1 : !_this.allowYellow ? 0 : 2))
        throw { err: "esi_status", error: "Status " + (problem === 1 ? "yellow" : "red") };
    if (scopes) {
        let ok = false;
        if (typeof scopes === "string")
            ok = scopes.indexOf(scope) > -1;
        else
            ok = ok.includes(scope);
        if (!ok)
            throw { err: "scope_missing", error: "Scope " + scope + " is missing from token" };
    }

    let qry = {
        proxy: _this.proxy,
        method,
        url: _this.host + path,
        headers: { "User-Agent": _this.userAgent },
        json: true
    };

    if (!token && params && params.token) { // legacy
        token = params.token;
        delete params.token;
    }
    if (token && scope)
        qry.headers["Authorization"] = "Bearer " + token;

    let prm = {
        datasource: _this.datasource,
        "Accept-Language": _this.language,
        ...params
    };

    if (paramap) {
        let qs = [];
        for (let key in paramap) {
            if (!prm.hasOwnProperty(key) || prm[key] === null) {
                if (paramap[key].required)
                    throw { error: "Parameter " + key + " must be specified." };
                continue;
            }
            let rgx;
            switch (paramap[key].location) {
                case "header":
                    qry.headers[key] = prm[key];
                    break;
                case "path":
                    rgx = new RegExp("\\{" + key + "\\}", "g");
                    if (rgx.test(qry.url))
                        qry.url = qry.url.replace(rgx, prm[key]);
                    break;
                case "query":
                    qs.push(key + "=" + encodeURIComponent(prm[key]));
                    break;
                case "body":
                    if (qry.body)
                        _this.log("info", "Body was set multiple times for " + op + "/" + key + ". Wth?");
                    qry.body = prm[key];
                    break;
            }
        }
        if (qs.length > 0)
            qry.url += "?" + qs.join("&");
    }
    //self.logger.log(qry.url);
    let res = await requestAttempt(_this, op, qry);
    if (res.headers.warning)
        _this.log("warning", "(note) " + op + ":", res.headers.warning, "See https://github.com/esi/esi-issues/blob/master/changelog.md for details");
    //self.logger.log(res);
    return res;
}

/** ESI error limit checker. If you hit the error limit, everything will be softlocked for some time.
 * @private
 * @param {ThisType} _this {@link eveswag}
 * @param {any} [resp] Server response object. Won't throw error if it is specified
 * @param {string} [err] Error message
 */
function checkErrorCount(_this, resp=null, err=null) {
    let errmsg = "Too many errors. ESI is locked for";
    if (err && err.indexOf(errmsg) > -1)
        return;

    if (resp && resp.headers &&
        resp.headers.hasOwnProperty("x-esi-error-limit-remain")
        && /^\d+$/.test(resp.headers["x-esi-error-limit-remain"])
        && resp.headers["x-esi-error-limit-remain"] * 1 <= 2
    )
        _this.lockuntil = epoch() + resp.headers["x-esi-error-limit-reset"] * 60;
    if (err && err.indexOf("This software has exceeded the error limit for ESI") > -1)
        _this.lockuntil = epoch() + 60;

    if (_this.lockuntil && _this.lockuntil > epoch()) {
        if (!resp)
            throw { err: "error", error: errmsg + " " + Math.ceil((_this.lockuntil - epoch()) / 60) + " min" };
    } else {
        _this.lockuntil = null;
    }
}

/** Attempts to fullfill a request with retry mechanism.
 * @private
 * @async
 * @param {ThisType} _this {@link eveswag}
 * @param {string} op Operation ID
 * @param {Object.<string, any>} opts Request options
 * @param {number} [retry] Retry attempts limit
 * @param {number} [_attempt] Retry counter, growing the delay between attempts
 * @returns {Object} Server response
 * @throws {tError}
 */
async function requestAttempt(_this, op, opts, retry=3, _attempt=1) {
    let resp;
    try {
        checkErrorCount(_this);
        _this.report("direct", op);
        resp = await requestPromise(opts);
        checkErrorCount(_this, resp);
    } catch (err) {
        if (!err || !err.err || err.err !== "error")
            _this.report("error", op);
        let error = {
            err: err && err.err ? err.err : "error",
            error: (err && err.error ? err.error : JSON.stringify(err))
                + (err && err.headers ? " [Error limit left: " + err.headers["x-esi-error-limit-remain"] + "]" : "")
        };

        checkErrorCount(_this, null, error.error);

            // invalid requests:
        if (error.error.indexOf("Invalid body") > -1
            || error.error.indexOf("failed to coerce value") > -1)
            throw error;

        // old star_id bug https://github.com/esi/esi-issues/issues/532
        // the issue was closed in winter'18, but I still encountered it in summer'18
        // NOTE: the solution is legacy of a previously used swagger-client, so it might not work well
        if (error.error.indexOf("'star_id'") > -1) {
            _this.log("warning", "TODO: Revise star_id bug:", JSON.stringify(err)); // if it will ever happen again
            return {
                headers: { expires: epoch() + 1*60*60 }, // fake the expiration date
                body: err.response.body.response
            };
        }

        if (!_attempt)
            _attempt = 0;
        if (_attempt >= retry) // number of retries
            throw error;

        // if it's a timeout or error
        if (error.error.indexOf("Timeout") > -1
            || error.error.indexOf("ENOTFOUND") > -1
            || error.error.indexOf("ECONNRESET") > -1 // TODO: there's also ECONNsomethingelse
            || error.error.indexOf("EAI_AGAIN") > -1
            || error.error.indexOf("Bad Gateway") > -1
            || error.error.indexOf("Service Unavailable") > -1
            || error.error.indexOf("Failed to fetch access data") > -1
            || error.error.indexOf("no JWK available for datasource") > -1 // nasty SSO error. it may or may not go away on a next call
        ) {
            //_this.log("info", "Timeout/fail on " + op + ". Retrying...", _retry);
            if (_attempt > 0)
                await sleep(_attempt * 500);
            if (error.error.indexOf("no JWK available for datasource") > -1)
                _attempt = retry; // give it only one retry
            return await requestAttempt(_this, op, opts, retry, _attempt++);
        }

        throw error;
    }
    return resp;
}

/** Makes a request and produce a proper error message if something goes wrong.
 * @private
 * @param {Object.<string, any>} opts Request options.
 * @returns {Promise<Object>} Promise with server response
 * @throws {tError}
 */
function requestPromise(opts) {
    if (opts && opts.headers && opts.headers["User-Agent"])
        opts.headers["User-Agent"] += " (eveswag)";
    return new Promise((resolve, reject) => {
        request(opts, (error, resp, body) => {
            if (error
                || (resp.body && resp.body.error)
                || (resp.data && resp.data.payload && resp.data.payload.error)
                || (typeof body === "string" && body.indexOf("<h1>502 Bad Gateway</h1>"))
            ) {
                if (!resp)
                    resp = {};
                resp.err = "server";
                resp.error = (error
                    || (resp.body && resp.body.error ? resp.body.error : null)
                    // FIXME: is this still needed?
                    //|| (resp.data && resp.data.payload && resp.data.payload.error ? resp.data.payload.error : null)
                    || (typeof body === "string" && body.indexOf("<h1>502 Bad Gateway</h1>") ? "Bad Gateway" : null)
                );
                // statusCode: 403,
                // statusMessage: 'Forbidden',
                reject(resp);
            } else {
                resolve(resp);
            }
        });
    });
}

/** Loads health details on interval.
 * Note: Status saved per instance because instance can interact with different datasources.
 * @private
 * @async
 * @param {ThisType} _this {@link eveswag}
 */
async function healthGet(_this) {
    let now = epoch(),
        interval = _this.statusRefresh,
        res;
    if (_this.healthDate + interval > now)
        return;
    _this.healthDate = now;
    try {
        res = await requestPromise({
            proxy: _this.proxy,
            method: "GET",
            url: _this.host + "/status.json?version=" + _this.version.replace(/^_/, ""),
            headers: { "User-Agent": _this.userAgent },
            json: true
        });
        if (res)
            res = res.body;
        if (res && typeof res !== "object") {
            _this.log("info", "ESI health parse error");
            res = null;
        }
    } catch (err) {
        _this.log("info", "ESI health fetch error");
        res = null;
    }
    if (!res) {
        // as a failback, assume 100% health, because sometimes this endpoint does not respond properly
        res = {};
        _this.esihealth = 100;
        _this.healthDate = 0; // will force retry on a next call
        _this.log("info", "ESI health is unknown");
        return;
    }
    _this.healthData = {};
    _this.esihealth = 0;
    if (res) {
        let cnt = 0;
        for (let i = 0; i < res.length; i++) {
            if (!res[i].tags || res[i].tags.length < 1)
                continue;
            res[i].func = res[i].method + res[i].route.replace(/\/$|[{}]/g, "").replace(/\//g, "_");
            _this.healthData[res[i].func] =
                res[i].status === "green" ? 0 :
                res[i].status === "yellow" ? 1 :
                res[i].status === "red" ? 2 :
                0;
            cnt++;
            _this.esihealth += 0.5 * _this.healthData[res[i].func];
            // if (_this.healthData[res[i].func])
            //     _this.esihealth += 1;
            //_this.log("info", _this.healthData[res[i].func], res[i].category, res[i].func);
        }
        _this.esihealth = 100 - Math.round(_this.esihealth / cnt * 100);
        if (_this.esihealth !== _this.esihealth)
            _this.esihealth = 0;
    } else {
        _this.healthDate = 0;
    }
    _this.log("info", "ESI health is " + _this.esihealth + "%");
}


module.exports = eveswag;
