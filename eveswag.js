const request = require("request");

/**
 * EVE Swagger Interface generator
 * @package eveswag
 * @author Shyaltii (in-EVE)
 * @license MIT
 */
class eveswag {
    // https://esi.evetech.net/ https://docs.esi.evetech.net/
    /**
     * EVE Swagger Interface generator.
     * After new instance is created, call either loadFile(file), loadFromRemote() or loadScheme(scheme),
     * and then use this.apis.Category.operation_name() to call an endpoint,
     * this.list to see all endpoints mapping along with their required scopes and status,
     * and this.info to see the scheme information.
     * @param {object} cfg Configuration
     * @param {string} cfg.useragent ESI-compliant user agent
     * @param {string|boolean} [cfg.proxy] String or boolean (to use environment) (default: null)
     * @param {boolean} [cfg.allowred] Allow calling an endpoint when its status is red (default: false)
     * @param {string} [cfg.host] Host to download specs from, that will be replaced by specs and used for requests (default: "https://esi.evetech.net")
     * @param {string} [cfg.version] ESI specs version (default: "latest")
     * @param {string} [cfg.datasource] Datasource (default: "tranquility")
     * @param {string} [cfg.language] Language (default: "en-us")
     * @param {object} [cfg.log] console.log-like function with first parameter meaning the type of a message - "info" or "warning" (default: fallback to console.log)
     * @param {function} [cfg.report] Function to report calls into: report("direct", "get_status") or report("error", "get_status"), because this class has a fallback mechanism and may retry some failed calls (default: stub)
     * @throws {object} { err: "error|server|esi_status|scope_missing", error: "Error description" }
     */
    constructor(cfg={}) {
        if (!cfg.useragent)
            throw { err: "error", error: "useragent must be specified" };

        this.log = cfg.log || function (type, ...args) {
            console.log.apply(this, ["[" + type + "]", ...args]);
        };
        this.report = cfg.report || function(){};

        this.useragent = cfg.useragent + " (eveswag)";
        this.proxy = cfg.proxy || null;

        this.version = cfg.version || "latest";
        this.datasource = cfg.datasource || "tranquility";
        this.language = cfg.language || "en-us";
        this.allowred = !!cfg.allowred;

        this.host = cfg.host || "https://esi.evetech.net";

        this.lockuntil = null;
        this.info = Object.freeze({});
        this.list = Object.freeze({});
        this.apis = Object.freeze({});
    }

    /**
     * Current time in epoch.
     */
    _now() {
        return Math.trunc((new Date()).getTime() / 1000);
    }
    /**
     * Sleeps for a specified delay.
     * @param {int} ms Milliseconds
     * @returns Promise
     */
    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Loads specs from a file.
     * @param {string} file Path to a scheme file
     */
    loadFile(file) {
        let scheme = require("fs").readFileSync(file, "utf8");
        this.loadScheme(scheme);
    }

    /**
     * @async
     * Downloads specs from web and calls this.load with them.
     */
    async loadFromRemote() {
        this.log("info", "Loading ESI specs from a remote resource...");
        let spec = await this._requestPromise({
            method: "GET",
            url: this.host + "/" + this.version + "/swagger.json?datasource=" + this.datasource,
            json: true
        });
        this.loadScheme(spec.body);
    }

    /**
     * Generates all of the available endpoints and creates this.apis and this.list.
     * @param {object|string} scheme EVE Swagger Interface specs
     */
    loadScheme(scheme) {
        if (typeof scheme === "string")
            scheme = JSON.parse(scheme);
        else if (typeof scheme === "object")
            scheme = JSON.parse(JSON.stringify(scheme)); // clone it just in case

        this.esihealth = 0;

        this.host = scheme.schemes.includes("https") ? "https" : "http"; // idk
        this.host += "://" + scheme.host;

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
                    this.log("info", op, "has an unexpected method!");
                // save required token scope if any
                if (cur.security && cur.security.length > 0 && cur.security[0].evesso) {
                    route.scope = cur.security[0].evesso[0];
                    if (cur.security[0].evesso.length > 1) // notify if ccp will change something about scopes
                        this.log("info", op, "has an unexpected number of scopes!", cur.security[0].evesso);
                }
                // create parameters map
                if (cur.parameters && cur.parameters.length > 0) {
                    route.params = {};
                    for (let i = 0; i < cur.parameters.length; i++) {
                        if (cur.parameters[i].hasOwnProperty("$ref")) {
                            if (cur.parameters[i]["$ref"].indexOf("#/parameters/") !== 0) {
                                this.log("info", cur.parameters[i]["$ref"], "is an unexpected reference!");
                                continue;
                            }
                            cur.parameters[i] = scheme.parameters[cur.parameters[i]["$ref"].substring(13)];
                        }
                        route.params[cur.parameters[i].name] = {
                            required: cur.parameters[i].required || false,
                            location: cur.parameters[i].in
                        };
                        if (!["header", "path", "query", "body"].includes(cur.parameters[i].in))
                            this.log("info", "Unexpected parameter location:", cur.parameters[i].in);
                        // if (cur.parameters[i].in === "body" && op !== "post")
                        //     this.log("info", "Body parameter in a " + op + " request?");
                    }
                }
                // create endpoint function
                route.run = this._createEndpoint(this, op, method.toUpperCase(), path + pth, route.scope, route.params);
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
                xlist[cat][op] = this._createDetails(this, apis, cat, op);
            }
        }

        // expose all the things
        this.info = Object.freeze(scheme.info);
        this.list = Object.freeze(xlist);
        this.apis = Object.freeze(xapis);

        // reset lock just in case
        this.lockuntil = null;

        // request a health update
        this.healthData = {};
        this.healthDate = 0;
        this._healthGet();
    }

    /**
     * @private
     * Creates an endpoint.
     * @param {ThisType} _this this
     * @param {string} op Operation ID
     * @param {string} method HTTP method
     * @param {string} path Operation path
     * @param {string} scope Operation permission
     * @param {object} paramap Operation parameters map
     * @returns Generated function
     */
    _createEndpoint(_this, op, method, path, scope=null, paramap=null) {
        async function endpoint(params=null, token=null, scopes=null) {
            return await _this._callEndpoint(_this, op, method, path, scope, paramap, params, token, scopes);
        }
        // TODO: do this somehow instead of this.list
        // endpoint.prototype.esiop = op;
        // endpoint.prototype.esipath = path;
        // endpoint.prototype.esiscope = scope;
        return endpoint;
    }

    /**
     * @private
     * Creates details for an endpoint.
     * @param {ThisType} _this this
     * @param {object} apis Internal API list
     * @param {string} cat Operation category
     * @param {string} op Operation ID
     * @returns Generated object
     */
    _createDetails(_this, apis, cat, op) {
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

    /**
     * @private
     * @async
     * Calls an endpoint.
     * @param {ThisType} _this this
     * @param {string} op Operation ID
     * @param {string} method HTTP method
     * @param {string} path Operation path
     * @param {string} scope Operation permission
     * @param {object} paramap Operation parameters map
     * @param {object} params Requested parameters
     * @param {string} token Auth token
     * @param {string|array} scopes Token scopes in an array or a string list
     * @returns Server response
     */
    async _callEndpoint(_this, op, method, path, scope=null, paramap=null, params=null, token=null, scopes=null) {
        let problem = await _this.health(op);

        if (!_this.allowred && problem > 1)
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
            headers: { "User-Agent": _this.useragent },
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
        let res = await _this._requestAttempt(op, qry);
        if (res.headers.warning)
            _this.log("warning", "(note) " + op + ":", res.headers.warning, "See https://github.com/esi/esi-issues/blob/master/changelog.md for details");
        //self.logger.log(res);
        return res;
    }

    /**
     * @private
     * ESI error limit checker. If you hit the error limit, everything will be softlocked for some time.
     * @param {object} resp Server response object. Won't throw error if it is specified
     * @param {string} err Error message
     */
    _checkErrorCount(resp=null, err=null) {
        let errmsg = "Too many errors. ESI is locked for";
        if (err && err.indexOf(errmsg) > -1)
            return;

        if (resp && resp.headers &&
            resp.headers.hasOwnProperty("x-esi-error-limit-remain")
            && /^\d+$/.test(resp.headers["x-esi-error-limit-remain"])
            && resp.headers["x-esi-error-limit-remain"] * 1 <= 2
        )
            this.lockuntil = this._now() + resp.headers["x-esi-error-limit-reset"] * 60;
        if (err && err.indexOf("This software has exceeded the error limit for ESI") > -1)
            this.lockuntil = this._now() + 60;

        if (this.lockuntil && this.lockuntil > this._now()) {
            if (!resp)
                throw { err: "error", error: errmsg + " " + Math.ceil((this.lockuntil - this._now()) / 60) + " min" };
        } else {
            this.lockuntil = null;
        }
    }

    /**
     * @private
     * @async
     * Attempts to fullfill a request with retry mechanism.
     * @param {*} op Operation ID
     * @param {*} opts Request options
     * @param {*} retry Retry attempts limit
     * @param {*} _retry Retry counter, growing the delay between attempts
     * @returns Server response
     */
    async _requestAttempt(op, opts, retry=3, _retry=0) {
        let resp;
        try {
            this._checkErrorCount();
            this.report("direct", op);
            resp = await this._requestPromise(opts);
            this._checkErrorCount(resp);
        } catch (err) {
            if (!err || !err.err || err.err !== "error")
                this.report("error", op);
            let error = {
                err: err && err.err ? err.err : "error",
                error: (err && err.error ? err.error : JSON.stringify(err))
                    + (err && err.headers ? " [Error limit left: " + err.headers["x-esi-error-limit-remain"] + "]" : "")
            };

            this._checkErrorCount(null, error.error);

             // invalid requests:
            if (error.error.indexOf("Invalid body") > -1
                || error.error.indexOf("failed to coerce value") > -1)
                throw error;

            // old star_id bug https://github.com/esi/esi-issues/issues/532
            // the issue was closed in winter'18, but I still encountered it in summer'18
            // NOTE: the solution is legacy of a previously used swagger-client, so it might not work well
            if (error.error.indexOf("'star_id'") > -1) {
                this.log("warning", "TODO: Revise star_id bug:", JSON.stringify(err)); // if it will ever happen again
                return {
                    headers: { expires: this._now() + 1*60*60 }, // fake the expiration date
                    body: err.response.body.response
                };
            }

            if (!_retry)
                _retry = 0;
            if (_retry >= retry) // number of retries
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
                //this.log("info", "Timeout/fail on " + op + ". Retrying...", _retry);
                if (_retry > 0)
                    await this._sleep(_retry * 500);
                if (error.error.indexOf("no JWK available for datasource") > -1)
                    _retry = retry; // give it only one retry
                return await this._requestAttempt(op, opts, retry, _retry++);
            }

            throw error;
        }
        return resp;
    }

    /**
     * @private
     * Makes a request and produce a proper error message if something goes wrong.
     * @param {object} opts Request options.
     * @returns Promise with server response
     */
    _requestPromise(opts) {
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

    /**
     * Checks health of an endpoint.
     * @param {string} op Operation ID
     * @returns {int} 0 = green, 1 = yellow, 2 = red
     */
    async health(op) {
        await this._healthGet();
        if (!op)
            return 0;
        if (this.healthData.hasOwnProperty(op))
            return this.healthData[op];
        return 0;
    }

    /**
     * @private
     * Loads health details on interval.
     */
    async _healthGet() {
        let now = this._now(),
            interval = 5*60,
            res;
        if (this.healthDate + interval > now)
            return;
        this.healthDate = now;
        try {
            res = await this._requestPromise({
                proxy: this.proxy,
                method: "GET",
                url: this.host + "/status.json?version=" + this.version.replace(/^_/, ""),
                headers: { "User-Agent": this.useragent },
                json: true
            });
            if (res)
                res = res.body;
            if (res && typeof res !== "object") {
                this.log("info", "ESI health parse error");
                res = null;
            }
        } catch (err) {
            this.log("info", "ESI health fetch error");
            res = null;
        }
        if (!res) {
            // as a failback, assume 100% health, because sometimes this endpoint does not respond properly
            res = {};
            this.esihealth = 100;
            this.healthDate = 0; // will force retry on a next call
            this.log("info", "ESI health is unknown");
            return;
        }
        this.healthData = {};
        this.esihealth = 0;
        if (res) {
            let cnt = 0;
            for (let i = 0; i < res.length; i++) {
                if (!res[i].tags || res[i].tags.length < 1)
                    continue;
                res[i].func = res[i].method + res[i].route.replace(/\/$|[{}]/g, "").replace(/\//g, "_");
                this.healthData[res[i].func] =
                    res[i].status === "green" ? 0 :
                    res[i].status === "yellow" ? 1 :
                    res[i].status === "red" ? 2 :
                    0;
                cnt++;
                this.esihealth += 0.5 * this.healthData[res[i].func];
                // if (this.healthData[res[i].func])
                //     this.esihealth += 1;
                //this.log("info", this.healthData[res[i].func], res[i].category, res[i].func);
            }
            this.esihealth = 100 - Math.round(this.esihealth / cnt * 100);
            if (this.esihealth !== this.esihealth)
                this.esihealth = 0;
        } else {
            this.healthDate = 0;
        }
        this.log("info", "ESI health is " + this.esihealth + "%");
    }
}

module.exports = eveswag;
