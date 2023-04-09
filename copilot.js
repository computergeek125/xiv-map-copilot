let settings = new Map([
    ["data_url", null],
    ["server_info", null],
    ["light_mode", false],
    ["flag_font_size", 20],
    ["flag_mark_size", 20],
    ["flag_margin_overflow", false],
]);
let sticky_settings = [
    "debug_",
];
const map_pin_re_strict = new RegExp(/^(?:\[\d\d?:\d\d\])?(?:\[[\w\d]+\])?[\(<]\W?\W?([\w'\- ]+)[\)>].+\ue0bb([\w'\- ]+) \( (\d+\.\d+)  , (\d+\.\d+) \)/u);
const map_pin_re_loose = new RegExp(/(?:\[[\w\d]+\])?[\(<]\W?\W?([\w'\- ]+)[\)>].+\ue0bb([\w'\- ]+) \( (\d+\.\d+) +, (\d+\.\d+) \)/u);
let user_settings = new Map();
const session_cache = new Object_Cache(sessionStorage, "session_cache");
let map_index;
let xfc = new XIV_FlagClusterinator(map_index, settings, session_cache);
let wp;
const player_flag_list = new Map();

async function init() {
    try {
        for (const s in settings_preload) {
            settings.set(s, settings_preload[s]);
        }
    } catch (e) {
        console.log(`noncritical problem preloading settings: ${e} <-- if this says that settings_preload is not defined, you (likely) do not have any issues`);
    }
    try {
        const local_settings_str = localStorage.getItem("settings");
        let local_settings;
        if (local_settings_str) {
            console.log("Loading local settings");
            local_settings = new Map(Object.entries(JSON.parse(local_settings_str)));
            console.log(local_settings);
            for (const s of local_settings.keys()) {
                console.log(`local: setting ${s} -> ${local_settings.get(s)}`);
                user_settings.set(s, local_settings.get(s));
            }
        } else {
            console.log("Local settings empty (nothing to load there)");
        }
    } catch (e) {
        console.log(`noncritical problem loading local settings: ${e} <-- if you are using this locally (as in, not on a website), this error might be able to be ignored`);
    }
    try {
        const session_settings_str = sessionStorage.getItem("settings");
        let session_settings;
        if (session_settings_str) {
            console.log("Loading session settings");
            session_settings = new Map(Object.entries(JSON.parse(session_settings_str)));
            console.log(session_settings);
            for (const s of session_settings.keys()) {
                console.log(`session: setting ${s} -> ${session_settings.get(s)}`);
                user_settings.set(s, session_settings.get(s));
            }
        } else {
            console.log("Session settings empty (nothing to load there)");
        }
    } catch (e) {
        console.log(`noncritical problem loading session settings: ${e} <-- if you are using this locally (as in, not on a website), this error might be able to be ignored`);
    }
    console.log("Loaded aggregate user settings:", settings);
    for (const s of user_settings.keys()) {
        settings.set(s, user_settings.get(s));
    }
    load_settings_page();
    if (settings.get("light_mode")) {
        document.documentElement.setAttribute('data-bs-theme','light');
    } else {
        document.documentElement.setAttribute('data-bs-theme','dark');
    }
    if (settings.get("data_url")) {
        await load_data(settings.get("data_url"));
    }
    if (settings.get("session_cache")) {
        try {
            console.log("Loading session cache");
            session_cache.load();
            console.log(session_cache.cache_data);
        } catch (e) {
            console.log(`noncritical problem loading session cache: ${e} <-- if you are using this locally (as in, not on a website), this error might be able to be ignored`);
        }
        xfc.cache_merge();
        const map_selector = document.getElementById("map-list-selectable");
        map_selector.innerHTML = "";
        for (const new_flag of xfc.flags.values()) {
            const new_flag_opt = document.createElement("option");
            new_flag_opt.text = new_flag.toString();
            map_selector.add(new_flag_opt);
            console.log(`Regenerated flag ${new_flag}`);
        }
        nickname_display();
    } else {
        session_cache.erase();
    }
    document.getElementById("setting-parser-flag-regex-strict-regex").textContent = map_pin_re_strict;
    document.getElementById("setting-parser-flag-regex-loose-regex").textContent = map_pin_re_loose;
    switch (settings.get("flag_regex")) {
        default:
        case "strict":
            settings.set("map_pin_re", map_pin_re_strict);
            break;
        case "loose":
            settings.set("map_pin_re", map_pin_re_loose);
            break;
    }
}

async function load_data(url=null) {
    const data_loader = document.getElementById('data-loader');
    let data_url;
    if (url == null) {
        data_url = new URL(document.getElementById("data-location").value);
    } else {
        data_url = new URL(url);
    }
    if (data_url.pathname.slice(-1) != "/") {
        data_url += "/";
    }
    map_index_url = new URL("index.json", data_url)
    map_index = await fetchJSON(map_index_url);
    console.log(`Loaded map index from ${map_index_url}, resetting tabs async and building data structures`);
    xfc.reset_maps();
    reset_tabs_promise = resetTabs(data_url);
    if (settings.get("server_info")) {
        wp = new XIV_WorldParser(settings.get("server_info"));
        await wp.init();
    } else {
        try {
            wp = new XIV_WorldParser(new URL("servers.json", data_url));
            wp.init();
        } catch (e) {
            if (e instanceof TypeError) {
                wp = new XIV_WorldParser("./servers.json");
                wp.init()
            } else {
                throw new e;
                return;
            }
        }
    }
    xfc.wp = wp
    if (data_loader != null) {
        data_loader.remove();
    }
    
    reset_tabs_promise.then(
        (value) => {
            console.log("Finished resetting tabs");
        },
        /*(reason) => {
            console.log(`Failed to reset tabs: ${reason}`);
        }*/
    );
    xfc.reload_flags();
}

async function resetTabs(data_url) {
    // button template: <button class="nav-link" id="expac-tabs-replaceme-button" data-bs-theme="dark" data-bs-toggle="pill" data-bs-target="#expac-tabs-replaceme-content" type="button" role="tab" aria-controls="expac-tabs-replaceme-content" aria-selected="false">ReplaceMe</button>'
    // content template: <div class="tab-pane fade" id="expac-tabs-replaceme-content" role="tabpanel" aria-labelledby="expac-tabs-replaceme-button">ReplaceMe Data</div>
    const expac_tabs_buttons = document.getElementById('expac-tabs-buttons');
    const expac_tabs_content = document.getElementById('expac-tabs-content');
    const preserved_child_names = [
        "setting-tabs-maps",
        "setting-tabs-nicknames",
        "setting-tabs-settings",
    ]
    let preserved_child_tabs = [];
    let preserved_child_content = [];
    for (const c of preserved_child_names) {
        c_tab = document.getElementById(`${c}-button`);
        c_tab.classList.remove("active");
        c_content = document.getElementById(`${c}-content`)
        c_content.classList.remove("show", "active");
        preserved_child_tabs.push(c_tab);
        preserved_child_content.push(c_content);
    }
    expac_tabs_buttons.innerHTML = "";
    expac_tabs_content.innerHTML = "";
    //const img_url_base = new URL(index_url);
    //img_url_base.pathname.split('/').slice(0,-1).join("/");
    const img_url_base = new URL(data_url);
    for (const e in map_index['expansions']) {
        const e_id = e;
        const e_button_id  = `expac-tabs-${e_id}-button`;
        const e_content_id = `expac-tabs-${e_id}-content`;
        console.log(`Loading expansion ${e}...`);
        const e_name = sanitizeHTML(map_index['expansions'][e]['name']);
        const e_button = document.createElement('button');
        e_button.setAttribute(            "id", e_button_id);
        e_button.setAttribute(         "class", "nav-link");
        //e_button.setAttribute( "data-bs-theme", "dark");
        e_button.setAttribute("data-bs-toggle", "pill");
        e_button.setAttribute("data-bs-target", `#${e_content_id}`);
        e_button.setAttribute(          "type", "button");
        e_button.setAttribute(          "role", "tab");
        e_button.setAttribute( "aria-controls", e_content_id);
        e_button.setAttribute( "aria-selected", false);
        e_button.innerText = e_name;
        const e_content = document.createElement('div');
        e_content.setAttribute(          "class", "tab-pane fade h-100 w-100");
        e_content.setAttribute(             "id", e_content_id);
        e_content.setAttribute(           "role", "tabpanel");
        e_content.setAttribute("aria-labelledby", e_button_id);
        e_content.setAttribute(          "style", "position: relative;");
        const e_tabstrip = document.createElement("div")
        // tabstrip: <ul class="nav nav-tabs" id="myTab" role="tablist">
        e_tabstrip.setAttribute(        "class", "nav nav-tabs");
        e_tabstrip.setAttribute(           "id", `expac-tabs-${e_id}-tabstrip`);
        //e_tabstrip.setAttribute("data-bs-theme", "dark");
        e_tabstrip.setAttribute(         "role", "tablist");
        // tab content: <div class="tab-content" id="myTabContent">
        const e_tabcontent = document.createElement("div");
        e_tabcontent.setAttribute(        "class", "tab-content h-100 w-100");
        e_tabcontent.setAttribute(           "id", `expac-tabs-${e_id}-tabcontent`);
        //e_tabcontent.setAttribute("data-bs-theme", "dark");
        e_tabcontent.setAttribute(        "style", "position: relative;");
        for (let mx=0; mx<map_index['expansions'][e]["maps"].length; mx++) {
            m = map_index['expansions'][e]["maps"][mx]
            console.log(`Loading map ${m}...`)
            const map_info = map_index["map_info"][m];
            const map_id = m.replaceAll("/", ":");
            //console.log(map_info);
            const map_name = map_info["name"];
            const xma = new XIV_MapArea(e, m, map_info, settings);
            const map_button_id =  `expac-tabs-${e_id}-map-${map_id}-tab`;
            const map_content_id = `expac-tabs-${e_id}-map-${map_id}-content`;
            // tab: <li class="nav-item" role="presentation">
            //        <button class="nav-link active" id="home-tab" data-bs-toggle="tab" data-bs-target="#home-tab-pane" type="button" role="tab" aria-controls="home-tab-pane" aria-selected="true">Home</button>
            //      </li>
            const map_tab_li = document.createElement("li")
            map_tab_li.setAttribute("class", "nav-item");
            map_tab_li.setAttribute( "role", "presentation");
            const map_tab_btn = document.createElement("button");
            map_tab_btn.setAttribute(        "class", "nav-link");
            map_tab_btn.setAttribute(           "id", map_button_id);
            map_tab_btn.setAttribute("data-bs-toggle", "tab");
            map_tab_btn.setAttribute("data-bs-target", `#${map_content_id}`);
            map_tab_btn.setAttribute(          "type", "button");
            map_tab_btn.setAttribute(          "role", "tab");
            map_tab_btn.setAttribute( "aria-controls", map_content_id);
            map_tab_btn.setAttribute( "aria-selected", false);
            //map_tab_btn.addEventListener("click", click_test);
            map_tab_btn.innerText = map_name
            map_tab_li.appendChild(map_tab_btn);
            // tab content: <div class="tab-pane fade show active" id="home-tab-pane" role="tabpanel" aria-labelledby="home-tab" tabindex="0">...</div>
            const map_content = document.createElement("div");
            map_content.setAttribute(          "class", "tab-pane fade h-100 w-100");
            map_content.setAttribute(             "id", map_content_id);
            map_content.setAttribute(           "role", "tabpanel");
            map_content.setAttribute("aria-labelledby", map_button_id);
            map_content.setAttribute(          "style", "position: relative;");
            map_content.setAttribute(       "tabindex", 0);

            const map_img_id = `map-${e_id}-${map_id}-image`;
            //const map_svg_id = `map-${e_id}-${map_id}-canvas`;
            const map_svg_id = `map-${e_id}-${map_id}-image-overlay`;
            const map_img_relpath = `${e}/${m}/${map_info["filename"]}`;
            const map_img_url = new URL(map_img_relpath, img_url_base);
            //console.log(`${map_img_relpath} | ${map_img_url}`);
            const map_img = document.createElement("img");
            map_img.setAttribute(   "id", map_img_id);
            map_img.setAttribute("class", "img-fluid mh-100 mw-100");
            map_img.setAttribute("style", "position: absolute;");
            map_img.setAttribute(  "src", map_img_url);
            map_img.addEventListener("load", img_resize_svg)

            const map_svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            map_svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
            map_svg.setAttribute(   "id", map_svg_id);
            map_svg.setAttribute("class", "img-fluid mh-100 mw-100");
            map_svg.setAttribute("style", "position: absolute");
            map_svg.setAttribute("viewBox", `0 0 1177 1177`);
            xma.svg = map_svg;

            //test_cross = gen_svg_cross(100, 100, 50);
            //map_svg.appendChild(test_cross);

            //const map_image = document.createElementNS("http://www.w3.org/2000/svg", "image");
            //map_image.setAttribute(  "id", map_img_id);
            //map_image.setAttribute("href", map_img_url);
            
            //map_svg.appendChild(map_image);

            map_content.appendChild(map_img);
            map_content.appendChild(map_svg);
            e_tabstrip.appendChild(map_tab_li);
            e_tabcontent.appendChild(map_content);

            xfc.add_map_area(xma);
        }
        e_tabstrip.firstElementChild.firstElementChild.classList.add("active");
        e_tabstrip.firstElementChild.setAttribute("aria-selected", true);
        e_tabcontent.firstElementChild.classList.add("show", "active");
        e_content.appendChild(e_tabstrip);
        e_content.appendChild(e_tabcontent);
        console.log("Applying loaded data to HTML document... (hi-res images may take some time on slower internet connections)")
        expac_tabs_buttons.appendChild(e_button);
        expac_tabs_content.appendChild(e_content);
    }
    for (const c of preserved_child_tabs) {
        expac_tabs_buttons.appendChild(c);
    }
    for (const c of preserved_child_content) {
        expac_tabs_content.appendChild(c);
    }
    expac_tabs_buttons.firstElementChild.classList.add("active");
    expac_tabs_buttons.firstElementChild.setAttribute("aria-selected", true);
    expac_tabs_content.firstElementChild.classList.add("show", "active");
}

function focus_click(e, target) {
    document.getElementById(target).focus();
}

function focus_enter(e, target) {
    if (e.which == 13) {
        document.getElementById(target).focus();
    }
}

function map_keyup(e) {
    if (e.which == 13) {
        map_add_flag();
    }
}

function map_flag_display() {
    const map_selector = document.getElementById("map-list-selectable");
    map_selector.innerHTML = "";
    const index = Array.from(xfc.flags.keys());
    for (const i of index) {
        const map_opt = document.createElement("option");
        map_opt.text = `${i}`;
        map_selector.add(map_opt);
    }
}

function _map_add_flag(map_string) {
    const map_selector = document.getElementById("map-list-selectable");
    if (map_string) {
        try {
            new_flag = xfc.add_map_flag(map_string);
            if (new_flag) {
                new_flag_opt = document.createElement("option");
                new_flag_opt.text = new_flag.toString();
                map_selector.add(new_flag_opt);
                console.log(`Added flag ${new_flag}`);
            } else {
                console.log(`Failed to add flag for ${map_string}`);
            }
        } catch (e) {
            if (e instanceof XIV_ParseError) {
                console.error(`Failed to parse ${map_string} with error ${e}`);
            } else {
                throw e;
            }
        }
    } else {
        console.log("Refusing to parse empty string");
    }
}

function _map_remove_flag(map_string) {
    if (map_string) {
        console.log(`Attempting to remove ${map_string}`);
        xfc.remove_map_flag(map_string);
    } else {
        console.log("Refusing to remove empty string");
    }
}

function map_add_flag() {
    const input_map_element = document.getElementById("input-new-map-string");
    const map_string = input_map_element.value;
    _map_add_flag(map_string);
    input_map_element.value = "";
}

function map_bulk_import() {
    const input_bulk_element = document.getElementById('input-new-map-bulk');
    const input_bulk_value = input_bulk_element.value.split("\n");
    for (const line of input_bulk_value) {
        _map_add_flag(line);
    }
    input_bulk_element.value = "";
}

function map_select_move_up() {
    const map_selector = document.getElementById("map-list-selectable");
    idx = map_selector.selectedIndex;
    if (idx >= 0) {
        xfc.switch_map_positions(idx, idx-1);
        map_flag_display();
        map_selector.selectedIndex = idx-1;
    }
}

function map_select_move_down() {
    const map_selector = document.getElementById("map-list-selectable");
    idx = map_selector.selectedIndex;
    if (idx >= 0) {
        xfc.switch_map_positions(idx, idx+1);
        map_flag_display();
        map_selector.selectedIndex = idx+1;
    }
}

function map_remove_selected() {
    const map_selector = document.getElementById("map-list-selectable");
    const selected_map = map_selector.value;
    _map_remove_flag(selected_map);
    map_selector.remove(map_selector.selectedIndex);
}

function map_clear_all() {
    const map_selector = document.getElementById("map-list-selectable");
    for (let i=map_selector.options.length-1; i>=0; i--) {
        const selected_map = map_selector.options[i].value;
        _map_remove_flag(selected_map);
        map_selector.remove(i);
    }
}

function nickname_keyup(e) {
    if (e.which == 13) {
        nickname_add();
    }
}

function nickname_display() {
    const nickname_selector = document.getElementById("nickname-list-selectable");
    nickname_selector.innerHTML = "";
    const index = xfc.nicknames.sorted_by_char_name();
    for (const i of index) {
        const new_nickname_opt = document.createElement("option");
        new_nickname_opt.text = `${i} --> ${xfc.nicknames.get_nickname(i)}`;
        new_nickname_opt.setAttribute("nickname_hash", i);
        nickname_selector.add(new_nickname_opt);
    }
}

function nickname_add() {
    const input_name_element = document.getElementById("input-new-nickname-name");
    const input_world_element = document.getElementById("input-new-nickname-world");
    const input_nickname_element = document.getElementById("input-new-nickname-nickname");
    const char_string = input_name_element.value;
    const world_name = input_world_element.value;
    const nickname_name = input_nickname_element.value;
    const char_name = xfc.set_nickname(char_string, world_name, nickname_name);
    if (char_name) {
        input_name_element.value = "";
        input_world_element.value = "";
        input_nickname_element.value = "";
        nickname_display();
    }
}

function nickname_remove_selected() {
    const nickname_selector = document.getElementById("nickname-list-selectable");
    const selected_nickname = nickname_selector.selectedIndex;
    const nickname_hash = nickname_selector.children[selected_nickname].getAttribute("nickname_hash");
    xfc.remove_nickname(nickname_hash);
    nickname_display();
}

function nickname_clear_all() {
    const nickname_selector = document.getElementById("nickname-list-selectable");
    for (let i=nickname_selector.options.length-1; i>=0; i--) {
        const selected_nickname = nickname_selector.options[i].value;
        xfc.remove_nickname(selected_nickname);
    }
    nickname_display();
}


const settings_list = [
    ["text", "setting-data-url",         "data_url"],
    ["text", "setting-home-world",       "home_world"],
    ["bool", "setting-home-world-hide",  "home_world_hide"],
    ["bool", "setting-session-cache",    "session_cache"],
    ["int",  "setting-flag-font-size",   "flag_font_size"],
    ["int",  "setting-flag-mark-size",   "flag_mark_size"],
    ["bool", "setting-flag-margin-over", "flag_margin_overflow"],
    ["radio","setting-parser-flag-regex","flag_regex"],
];
const settings_radios = new Map(Object.entries(
{
    "setting-parser-flag-regex": new Map(Object.entries({
        "setting-parser-flag-regex-default": null,
        "setting-parser-flag-regex-strict":  "strict",
        "setting-parser-flag-regex-loose":   "loose",
    })),
}));
const settings_radios_reverse = new Map();
settings_radios.forEach((value, key, map) => {
    const rev_item = new Map();
    value.forEach((value, key, map) => {
        rev_item.set(value, key);
    });
    settings_radios_reverse.set(key, rev_item);
});
function get_settings_page_data() {
    const settings_page = new Map();
    for (const s of settings_list) {
        let value = null;
        switch (s[0]) {
            case "text":
                value = document.getElementById(s[1]).value;

                if (value == "") {
                    value = null;
                }
                break;
            case "int":
                value = document.getElementById(s[1]).value;
                if (value == "") {
                    value = null;
                } else {
                    value = parseInt(value);
                }
                break;
            case "float":
                value = document.getElementById(s[1]).value;
                if (value == "") {
                    value = null;
                } else {
                    value = parseFloat(value);
                }
            case "radio":
                const elements = document.getElementsByName(s[1]);
                const radio_map = settings_radios.get(s[1]);
                for (const e of elements) {
                    if (e.checked) {
                        value = radio_map.get(e.id);
                        break;
                    }
                }
                break;
            case "bool":
                value = document.getElementById(s[1]).checked;
                break;
            default:
                console.error(`Unexpected setting type ${s[0]} for ${s[1]} -> ${s[2]}`);
                value = null;
        }
        if (value != null) {
            settings_page.set(s[2], value);
        }
    }
    const light_mode = document.documentElement.getAttribute('data-bs-theme') == 'light';
    settings_page.set("light_mode", light_mode);

    return settings_page;
}

function load_settings_page() {
    for (const s of settings_list) {
        switch (s[0]) {
            case "text":
            case "int":
            case "float":
                if (user_settings.get(s[2])) {
                    document.getElementById(s[1]).value = user_settings.get(s[2]);
                }
                break;
            case "radio":
                if (user_settings.get(s[2])) {
                    const radio_rmap = settings_radios_reverse.get(s[1]);
                    document.getElementById(radio_rmap.get(user_settings.get(s[2]))).checked = true;
                }
                break;
            case "bool":
                if (user_settings.get(s[2])) {
                    document.getElementById(s[1]).checked = user_settings.get(s[2]);
                }
                break;
            default:
                console.error(`Unexpected setting type ${s[0]} for ${s[1]} -> ${s[2]}`);
                value = null;
        }
    }
}

function get_settings_data() {
    const settings_data = get_settings_page_data();
    for (const s of sticky_settings) {
        for (const [k,v] of settings.entries()) {
            console.log(s,k,v);
            if (k.startsWith(s)) {
                settings_data.set(k, v);
            }
        }
    }
    console.log(settings_data);
    return settings_data;
}

function apply_settings() {
    const settings_data = Object.fromEntries(get_settings_data());
    sessionStorage.setItem("settings", JSON.stringify(settings_data));
    init();
}

function persist_settings() {
    const settings_data = Object.fromEntries(get_settings_data());
    localStorage.setItem("settings", JSON.stringify(settings_data));
    init();
}

function _data_export() {
    let settings_export = {};
    settings_export["settings"] = Object.fromEntries(user_settings);
    settings_export["user_data"] = Object.fromEntries(session_cache.cache_data);
    return settings_export;
}

function update_settings_page(spacing=4) {
    const de = _data_export();
    settings_export_node = document.getElementById("settings-export-data");
    settings_export_node.textContent = JSON.stringify(de, null, 4);
}

function _data_import(data) {
    let settings_data;
    if (data.hasOwnProperty("settings")) {
        settings_data = new Map(Object.entries(data["settings"]));
    } else {
        settings_data = new Map();
    }
    const settings_existing = get_settings_data();
    const settings_merged = new Map([...settings_existing, ...settings_data]);
    console.log("loaded settings from import", settings_merged)
    let user_data;
    if (data.hasOwnProperty("user_data")) {
        user_data = new Map(Object.entries(data["user_data"]));
    } else {
        user_data = new Map();
    }
    console.log("loaded user_data from import", user_data)
    let flags;
    if (user_data.has("flags")) {
        flags = new Map(Object.entries(user_data.get("flags")));
    } else {
        flags = new Map();
    }
    for (const f of flags.values()) {
        xfc.add_map_flag(new Map(Object.entries(f)));
    }
    map_flag_display();
    let nicknames;
    if (user_data.has("nicknames")) {
        nicknames = new Map(Object.entries(user_data.get("nicknames")));
    } else {
        nicknames = new Map();
    }
    for (const [c,n] of nicknames.entries()) {
        xfc.nicknames.cache_import_name(c, n);
    }
    nickname_display();
    const settings_object = Object.fromEntries(settings_merged.entries());
    sessionStorage.setItem("settings", JSON.stringify(settings_object));
    init();
}

function user_data_import() {
    const sid = document.getElementById("settings-import-data");
    _data_import(JSON.parse(sid.textContent));
}

async function user_data_import_file() {
    const udif = document.getElementById("settings-import-data-file");
    const text_data = await udif.files[0].text();
    const sid = document.getElementById("settings-import-data");
    sid.textContent = text_data;
}

function user_data_select_file() {
    const udif = document.getElementById("settings-import-data-file");
    udif.click();
}

function reset_settings() {
    localStorage.clear();
    sessionStorage.clear();
    init();
}