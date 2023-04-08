/**
 * Grabs a JSON file from the interwebs
 * @param  {String} infile  The file to download
 * @return {json}   json    The processed object
 */
async function fetchJSON(infile) {
    const response = await fetch(infile);
    const json = await response.json();
    return json;
}

/**
 * Sanitize and encode all HTML in a user-submitted string
 * https://portswigger.net/web-security/cross-site-scripting/preventing
 * From: https://gomakethings.com/how-to-sanitize-third-party-content-with-vanilla-js-to-prevent-cross-site-scripting-xss-attacks/
 * @param  {String} str  The user-submitted string
 * @return {String} str  The sanitized string
 */
function sanitizeHTML(str) {
    return str.replace(/[^\w. ]/gi, function (c) {
        return '&#' + c.charCodeAt(0) + ';';
    });
}

/**
 * Generate an SVG polygon in the shape of an X
 * @param {Integer} x      X-position of the center
 * @param {Integer} y      Y-position of the center
 * @param {Integer} r      X/Y radius of the cross
 * @param {String}  f      Fill color of polygon (default = red)
 * @param {Float}   r_edge Edge offset as a decimal percentage of `r` - so 0.1 == 10%
 * @return {Object} cross  An SVG polygon cross that can be appended to an <svg> element
 */
function gen_svg_cross(x, y, r, f="red", r_edge=0.25) {
    // cross: <polygon points="5 0, 25 20, 45 0, 50 5, 30 25, 50 45, 45 50, 25 30, 5 50, 0 45, 20 25, 0 5" fill="red" />
    //const cross_template = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    //cross_template.setAttribute("points", "5 0, 25 20, 45 0, 50 5, 30 25, 50 45, 45 50, 25 30, 5 50, 0 45, 20 25, 0 5");
    //cross_template.setAttribute("fill", "red");
    edge = r*r_edge;
    offset = r-edge;
    lr = Math.round(x-r);
    lo = Math.round(x-offset);
    le = Math.round(x-edge);
    tr = Math.round(y-r);
    to = Math.round(y-offset);
    te = Math.round(y-edge);
    rr = Math.round(x+r);
    ro = Math.round(x+offset);
    re = Math.round(x+edge);
    br = Math.round(y+r);
    bo = Math.round(y+offset);
    be = Math.round(y+edge);
    

    const cross = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    //                            top left T    center T     top right T   top right R   center R     bot right R   bot right B   center B     bot left B    bot left L    center L     top left L
    cross.setAttribute("points", `${lo} ${tr},  ${x} ${te},  ${ro} ${tr},  ${rr} ${to},  ${re} ${y},  ${rr} ${bo},  ${ro} ${br},  ${x} ${be},  ${lo} ${br},  ${lr} ${bo},  ${le} ${y},  ${lr} ${to}`)
    cross.setAttribute("fill", f);
    return cross
}

function img_resize_svg(e) {
    map_img = e.target;
    map_svg_id = `${map_img.id}-overlay`;
    map_svg = document.getElementById(map_svg_id);
    const mi_w = map_img.naturalWidth;
    const mi_h = map_img.naturalHeight;
    map_svg.setAttribute("viewBox", `0 0 ${mi_w} ${mi_h}`)

    console.log(`Resized ${map_svg_id} to ${mi_w}x${mi_h}`);
}

function jedi_sith() {
    if (document.documentElement.getAttribute('data-bs-theme') == 'dark') {
        document.documentElement.setAttribute('data-bs-theme','light')
    }
    else {
        document.documentElement.setAttribute('data-bs-theme','dark')
    }
}

const frens = [
    "Alka Zolka",
    "Alianne Vellegrance",
    "Alisaie Leveilleur",
    "Almet",
    "Alphinaud Leveilleur",
    "Arenvald Lentinus",
    "Arya Gastaurknan",
    "Brayflox Alltalks",
    "Broken Mountain",
    "Steelarm Cerigg",
    "Cid Garlond",
    "Cirina Mol",
    "Chuchuto Chuto",
    "Coultenet Dailebaure",
    "Curious Gorge",
    "Cymet",
    "Dorgono Qerel",
    "Eschiva Keyes",
    "Estinien Wyrmblood",
    "Fran Eruyt",
    "F'lhaminn Qesh",
    "Giott",
    "Gosetsu Everfall",
    "Granson",
    "G'raha Tia",
    "Hamon Holyfist",
    "Haurchefant Greystone",
    "Hoary Boulder",
    "Jacke Swallow",
    "Koh Rabntah",
    "K'lyhia",
    "Lalah Jinjahl",
    "Lalai Lai",
    "Leih Aliapoh",
    "Leveva Byrde",
    "Lilja Sjasaris",
    "Loonh Gah",
    "Lue-Reeq",
    "Lyna",
    "Krile Baldesion",
    "Makoto Obinata",
    "Mikoto Jinba",
    "Minfilia Warde",
    "M'naago Rahz",
    "Moenbryda Wilfsunnwyn",
    "Oboro Torioi",
    "Ocher Boulder",
    "Ogul Khatayin",
    "Papalymo Totolymo",
    "Pipin Tarupin",
    "Radovan",
    "Ranaa Mihgo",
    "Riol Forrest",
    "Rhesh Polaali",
    "Sadu Dotharl",
    "Sidurgu Orl",
    "Sophie",
    "Stacia Myste",
    "Sylphie Webb",
    "Tataru Taru",
    "Thancred Waters",
    "Tsubame Oshidari",
    "Uimet",
    "Urianger Augurelt",
    "V'kebbe",
    "X'rhun Tia",
    "Yugiri Mistwalker",
    "Yuki Yatsurugi",
    "Y'shtola Rhul",
    "Y'mhitra Rhul",
    "Yda Hext",
    ]

function name_a_friend(chance=0.25) {
    let name;
    let applied;
    let world;
    const date = new Date();
    const rname = frens[Math.floor(Math.random() * frens.length)];
    let rworld;
    if (wp.reverse_servers) {
        const wrc = Array.from(wp.reverse_servers.keys());
        rworld = wrc[Math.floor(Math.random() * wrc.length)];
    } else {
        rworld = "Diabolos";
    }
    if (Math.random() <= chance ){
        // [21:42] (Warrior Oflight) >The Ruby Sea ( 5.3  , 14.8 )
        name = rname;
        world = rworld;
        applied = "APPLIED";
    } else {
        name = "W'arrior O'light";
        world = "Diabolos";
        applied = "default";
    }
    if (settings.get("debug_frens")) {
        console.log(applied, rname);
    }
    document.getElementById("input-new-nickname-name").placeholder = name;
    document.getElementById("input-new-nickname-world").placeholder = world;
    const data = `[${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}] ${name} >The Ruby Sea ( 5.3  , 14.8 )`;
    document.getElementById("input-new-map-string").placeholder = data;
}

class Object_Cache {
    constructor(storage_backend, storage_key) {
        this.storage_backend = storage_backend;
        this.storage_key = storage_key;
        this.cache_data = new Map();
    }

    get(item_name) {
        return this.cache_data.get(item_name);
    }

    set(item_name, value) {
        if (settings.get("debug_cache")) {
            console.log("Setting", item_name, "->", value);
        }
        this.cache_data.set(item_name, value);
        this.write();
    }

    has(item_name) {
        return this.cache_data.has(item_name);
    }

    load() {
        const backend_data = this.storage_backend.getItem(this.storage_key);
        if (settings.get("debug_cache")) {
            console.log("Acquired backend data", backend_data);
        }
        if (backend_data) {
            const cache_temp = new Map()
            this.backend_obj = JSON.parse(backend_data);
            for (const [k,v] of Object.entries(this.backend_obj)) {
                if (settings.get("debug_cache")) {
                    console.log("Reading value", k, "->", v);
                }
                cache_temp.set(k, v);
            }
            this.cache_data = cache_temp;
        } else {
            if (settings.get("debug_cache")) {
                console.log("Backend map empty, starting fresh");
            }
            this.cache_data = new Map();
        }
    }

    write() {
        if (settings.get("debug_cache")) {
            console.log("Writing", this.cache_data);
        }
        this.storage_backend.setItem(this.storage_key, JSON.stringify(Object.fromEntries(this.cache_data)))
    }

    erase() {
        sessionStorage.removeItem(this.storage_key);
        this.cache_data.clear();
    }
}

function download_object_as_json(export_obj, export_name, spacing=4) {
    // modified from https://stackoverflow.com/a/30800715
    const data_str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(export_obj, null, spacing));
    const download_anchor_node = document.createElement('a');
    download_anchor_node.setAttribute("href",     data_str);
    download_anchor_node.setAttribute("download", export_name);
    download_anchor_node.style.display = "none";
    document.body.appendChild(download_anchor_node); // required for firefox
    download_anchor_node.click();
    download_anchor_node.remove();
}