"use strict";

const utils = require("./utils");
const cheerio = require("cheerio");
const log = require("npmlog");
const fs = require("fs");
const path = require("path");

log.maxRecordSize = 100;
let checkVerified = null;

const BOOLEAN_OPTIONS = new Set([
    'online', 'selfListen', 'listenEvents', 'updatePresence', 
    'forceLogin', 'autoMarkDelivery', 'autoMarkRead', 'listenTyping', 
    'autoReconnect', 'emitReady'
]);

// Anti-bot basic delay tool (fait penser à un humain qui clique)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const humanDelay = () => sleep(Math.floor(Math.random() * 800) + 400);

function setOptions(globalOptions, options = {}) {
    Object.keys(options).forEach(key => {
        if (BOOLEAN_OPTIONS.has(key)) {
            globalOptions[key] = Boolean(options[key]);
            return;
        }

        switch (key) {
            case 'pauseLog':
                options.pauseLog ? log.pause() : log.resume();
                break;
            case 'logLevel':
                log.level = options.logLevel;
                globalOptions.logLevel = options.logLevel;
                break;
            case 'logRecordSize':
                log.maxRecordSize = options.logRecordSize;
                globalOptions.logRecordSize = options.logRecordSize;
                break;
            case 'pageID':
                globalOptions.pageID = String(options.pageID);
                break;
            case 'userAgent':
                globalOptions.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
                break;
            case 'proxy':
                if (typeof options.proxy !== "string") {
                    delete globalOptions.proxy;
                    utils.setProxy();
                } else {
                    globalOptions.proxy = options.proxy;
                    utils.setProxy(globalOptions.proxy);
                }
                break;
            default:
                log.warn("setOptions", `Option non reconnue ignorée : ${key}`);
                break;
        }
    });
}

function buildAPI(globalOptions, html, jar) {
    let fb_dtsg = null;
    let irisSeqID = null;

    function extractFromHTML() {
        try {
            const $ = cheerio.load(html);
            
            // Tentative d'extraction du fb_dtsg dans les scripts
            $('script').each((_, script) => {
                if (fb_dtsg) return;
                const scriptText = $(script).html() || '';
                const patterns = [
                    /\["DTSGInitialData",\[\],{"token":"([^"]+)"}]/,
                    /\["DTSGInitData",\[\],{"token":"([^"]+)"/,
                    /"token":"([^"]+)"/,
                    /{\\"token\\":\\"([^\\]+)\\"/,
                    /,\{"token":"([^"]+)"\},\d+\]/,
                    /"async_get_token":"([^"]+)"/,
                    /"dtsg":\{"token":"([^"]+)"/,
                    /DTSGInitialData[^>]+>([^<]+)/
                ];

                for (const pattern of patterns) {
                    const match = scriptText.match(pattern);
                    if (match && match[1]) {
                        try {
                            const possibleJson = match[1].replace(/\\"/g, '"');
                            const parsed = JSON.parse(possibleJson);
                            fb_dtsg = parsed.token || parsed;
                        } catch {
                            fb_dtsg = match[1];
                        }
                        if (fb_dtsg) break;
                    }
                }
            });

            if (!fb_dtsg) {
                fb_dtsg = $('input[name="fb_dtsg"]').val() || null;
            }

            const seqMatches = html.match(/irisSeqID":"([^"]+)"/);
            if (seqMatches?.[1]) {
                irisSeqID = seqMatches[1];
            }

            if (fb_dtsg) {
                log.info("buildAPI", "Jeton fb_dtsg extrait avec succès.");
            } else {
                log.warn("buildAPI", "Impossible de dénicher le fb_dtsg dans la page.");
            }
        } catch (e) {
            log.error("buildAPI", "Erreur lors du parsing du HTML :", e.message);
        }
    }

    extractFromHTML();

    const cookies = jar.getCookies("https://www.facebook.com");
    const userCookie = cookies.find(c => c.cookieString().startsWith("c_user="));
    const altUserCookie = cookies.find(c => c.cookieString().startsWith("i_user="));

    if (!userCookie && !altUserCookie) {
        return log.error('login', "Aucune session valide (c_user/i_user introuvable). Vérifie ton AppState.");
    }

    if (html.includes("/checkpoint/block/?next")) {
        return log.error('login', "Compte bloqué ou AppState expiré (Checkpoint détecté).");
    }

    const userID = (altUserCookie || userCookie).cookieString().split("=")[1];

    if (checkVerified) {
        clearInterval(checkVerified);
        checkVerified = null;
    }

    const clientID = (Math.random() * 2147483648 | 0).toString(16);
    let mqttEndpoint = `wss://edge-chat.facebook.com/chat?region=prn&sid=${userID}`;
    let region = "PRN";

    try {
        const endpointMatch = html.match(/"endpoint":"([^"]+)"/);
        if (endpointMatch?.[1]) {
            mqttEndpoint = endpointMatch[1].replace(/\\\//g, '/');
            const url = new URL(mqttEndpoint);
            region = url.searchParams.get('region')?.toUpperCase() || "PRN";
        }
    } catch {
        log.info('buildAPI', 'Utilisation du serveur MQTT par défaut.');
    }

    log.info('login', `Connecté en tant que ID: ${userID} [Region: ${region}]`);

    const ctx = {
        userID,
        jar,
        clientID,
        globalOptions,
        loggedIn: true,
        access_token: 'NONE',
        clientMutationId: 0,
        mqttClient: undefined,
        lastSeqId: irisSeqID,
        syncToken: undefined,
        mqttEndpoint,
        region,
        firstListen: true,
        fb_dtsg,
        req_ID: 0,
        callback_Task: {},
        wsReqNumber: 0,
        wsTaskNumber: 0,
        reqCallbacks: {}
    };

    const defaultFuncs = utils.makeDefaults(html, userID, ctx);

    const api = {
        setOptions: setOptions.bind(null, globalOptions),
        getAppState: () => utils.getAppState(jar),
        postFormData: (url, body) => defaultFuncs.postFormData(url, ctx.jar, body),
        getFreshDtsg: async () => {
            try {
                const res = await defaultFuncs.get('https://www.facebook.com/', jar, null, globalOptions);
                const $ = cheerio.load(res.body);
                let newDtsg = null;

                $('script').each((_, script) => {
                    if (newDtsg) return;
                    const match = ($(script).html() || '').match(/"token":"([^"]+)"/);
                    if (match?.[1]) newDtsg = match[1];
                });

                return newDtsg || $('input[name="fb_dtsg"]').val() || null;
            } catch (e) {
                log.error("getFreshDtsg", "Échec du rafraîchissement du token :", e.message);
                return null;
            }
        }
    };

    // Chargement dynamique des modules du dossier /src/
    const srcPath = path.join(__dirname, 'src');
    if (fs.existsSync(srcPath)) {
        fs.readdirSync(srcPath)
            .filter(file => file.endsWith('.js'))
            .forEach(file => {
                const moduleName = file.replace('.js', '');
                api[moduleName] = require(path.join(srcPath, file))(defaultFuncs, api, ctx);
            });
    }

    api.listen = api.listenMqtt;

    return { ctx, defaultFuncs, api };
}

function makeLogin(jar, email, password, loginOptions, callback) {
    return async function (res) {
        try {
            await humanDelay();
            const html = res.body;
            const $ = cheerio.load(html);

            const formInputs = [];
            $("#login_form input").each((_, v) => {
                const name = $(v).attr("name");
                const val = $(v).val();
                if (name && val) formInputs.push({ val, name });
            });

            const form = utils.arrToForm(formInputs);
            form.lsd = utils.getFrom(html, "[\"LSD\",[],{\"token\":\"", "\"}");
            form.lgndim = Buffer.from(JSON.stringify({ w: 1440, h: 900, aw: 1440, ah: 834, c: 24 })).toString('base64');
            form.email = email;
            form.pass = password;
            form.default_persistent = '0';
            form.lgnrnd = utils.getFrom(html, "name=\"lgnrnd\" value=\"", "\"");
            form.locale = 'en_US';
            form.timezone = '240';
            form.lgnjs = Math.floor(Date.now() / 1000);

            log.info("login", "Envoi des identifiants...");
            
            const loginRes = await utils.post(
                "https://www.facebook.com/login/device-based/regular/login/?login_attempt=1&lwv=110",
                jar,
                form,
                loginOptions
            );
            
            await utils.saveCookies(jar)(loginRes);
            const { headers } = loginRes;

            if (!headers.location) {
                throw new Error("Échec de l'authentification : Identifiants incorrects.");
            }

            if (headers.location.includes('/checkpoint/')) {
                log.warn("login", "Sécurité Facebook (2FA / Checkpoint) détectée.");
                throw new Error("Authentification 2FA requise ou compte sous vérification.");
            }

            await utils.get('https://www.facebook.com/', jar, null, loginOptions);
            return await utils.saveCookies(jar);
        } catch (error) {
            callback(error);
        }
    };
}

function loginHelper(appState, email, password, globalOptions, callback) {
    const jar = utils.getJar();
    let mainPromise;

    if (appState) {
        try {
            const parsedState = typeof appState === "string" ? JSON.parse(appState) : appState;
            parsedState.forEach(c => {
                const cookieStr = `${c.key}=${c.value}; expires=${c.expires}; domain=${c.domain}; path=${c.path || '/'};`;
                jar.setCookie(cookieStr, "https://" + c.domain.replace(/^\./, ''));
            });

            mainPromise = utils.get('https://www.facebook.com/', jar, null, globalOptions, { noRef: true })
                .then(utils.saveCookies(jar));
        } catch (e) {
            return callback(new Error("Format de l'AppState invalide. Impossible de le parser."));
        }
    } else {
        mainPromise = utils.get("https://www.facebook.com/", null, null, globalOptions, { noRef: true })
            .then(utils.saveCookies(jar))
            .then(makeLogin(jar, email, password, globalOptions, callback))
            .then(() => utils.get('https://www.facebook.com/', jar, null, globalOptions).then(utils.saveCookies(jar)));
    }

    const handleRedirect = (res) => {
        const redirectMatch = /<meta http-equiv="refresh" content="0;url=([^"]+)[^>]+>/.exec(res.body);
        if (redirectMatch?.[1]) {
            return utils.get(redirectMatch[1], jar, null, globalOptions).then(utils.saveCookies(jar));
        }
        return res;
    };

    let api;
    mainPromise
        .then(handleRedirect)
        .then(res => {
            const { api: builtApi } = buildAPI(globalOptions, res.body, jar);
            api = builtApi;
            return res;
        })
        .then(() => {
            log.info('login', 'Connexion établie avec succès.');
            callback(null, api);
        })
        .catch(err => {
            log.error('login', 'Erreur pendant la procédure de connexion.');
            callback(err);
        });
}

function login(loginData, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    const globalOptions = {
        selfListen: false,
        listenEvents: true,
        listenTyping: false,
        updatePresence: false,
        forceLogin: false,
        autoMarkDelivery: false,
        autoMarkRead: false,
        autoReconnect: true,
        logRecordSize: 100,
        online: false,
        emitReady: false,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    };

    let prCallback = null;
    let returnPromise = null;

    if (typeof callback !== "function") {
        returnPromise = new Promise((resolve, reject) => {
            prCallback = (err, api) => err ? reject(err) : resolve(api);
        });
        callback = prCallback;
    }

    if (loginData.email && loginData.password) {
        setOptions(globalOptions, { logLevel: "silent", forceLogin: true });
        loginHelper(loginData.appState, loginData.email, loginData.password, globalOptions, callback);
    } else if (loginData.appState) {
        setOptions(globalOptions, options);
        loginHelper(loginData.appState, loginData.email, loginData.password, globalOptions, callback);
    } else {
        callback(new Error("Veuillez fournir un appState ou un identifiant/mot de passe."));
    }

    return returnPromise;
}

module.exports = login;
                        
