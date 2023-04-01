let settings = {
    "data_url": null,
    "server_info": null,
    "light_mode": false,
};
let user_settings = new Map();
let session_cache = new Map();
let map_index;
let xfc = new XIV_FlagClusterinator(map_index);
let wp;
const player_flag_list = new Map();

async function init() {
    try {
        for (const s in settings_preload) {
            settings[s] = settings_preload[s];
        }
    } catch (e) {
        console.log(`noncritical problem preloading settings: ${e} <-- if this says that settings_preload is not defined, you (likely) do not have any issues`);
    }
    try {
        const local_settings_str = localStorage.getItem("settings");
        let local_settings;
        if (local_settings_str) {
            console.log("Loading local settings");
            local_settings = JSON.parse(local_settings_str)
            console.log(local_settings);
        } else {
            console.log("Local settings empty (nothing to load there)")
        }
        for (const s in local_settings) {
            user_settings[s] = local_settings[s];
        }
    } catch (e) {
        console.log(`noncritical problem loading local settings: ${e} <-- if you are using this locally (as in, not on a website), this error can be ignored`);
    }
    try {
        const session_settings_str = sessionStorage.getItem("settings");
        let session_settings;
        if (session_settings_str) {
            console.log("Loading session settings");
            session_settings = JSON.parse(session_settings_str);
            console.log(session_settings);
        } else {
            console.log("Session settings empty (nothing to load there)");
        }
        for (const s in session_settings) {
            user_settings[s] = session_settings[s];
        }
    } catch (e) {
        console.log(`noncritical problem loading session settings: ${e} <-- if you are using this locally (as in, not on a website), this error can be ignored`);
    }
    console.log("Loaded aggregate user settings:", settings["light_mode"]);
    for (const s in user_settings) {
        settings[s] = user_settings[s];
    }
    load_settings_page();
    if (settings["light_mode"]) {
        document.documentElement.setAttribute('data-bs-theme','light');
    } else {
        document.documentElement.setAttribute('data-bs-theme','dark');
    }
    if (settings["data_url"]) {
        await load_data(settings["data_url"]);
    }
    if (settings["session_cache"]) {
        try {
            const session_cache_str = sessionStorage.getItem("session_cache");
            let session_cache;
            if (session_cache_str) {
                console.log("Loading session cache");
                session_cache = JSON.parse(session_cache_str);
                console.log(session_settings);
            } else {
                console.log("Session cache empty (nothing to load there)");
            }
            console.log(`Loaded session cache: ${session_cache}`);
        } catch (e) {
            console.log(`noncritical problem loading session cache: ${e} <-- if you are using this locally (as in, not on a website), this error can be ignored`);
        }
    } else {
        sessionStorage.removeItem("session_cache");
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
    xfc.clear()
    reset_tabs_promise = resetTabs(data_url);
    if (settings["server_info"]) {
        wp = new XIV_WorldParser(settings["server_info"]);
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
}

async function resetTabs(data_url) {
    // button template: <button class="nav-link" id="expac-tabs-replaceme-button" data-bs-theme="dark" data-bs-toggle="pill" data-bs-target="#expac-tabs-replaceme-content" type="button" role="tab" aria-controls="expac-tabs-replaceme-content" aria-selected="false">ReplaceMe</button>'
    // content template: <div class="tab-pane fade" id="expac-tabs-replaceme-content" role="tabpanel" aria-labelledby="expac-tabs-replaceme-button">ReplaceMe Data</div>
    const expac_tabs_buttons = document.getElementById('expac-tabs-buttons');
    const expac_tabs_content = document.getElementById('expac-tabs-content');
    preserved_child_names = [
        "setting-tabs-maps",
        "setting-tabs-settings",
    ]
    preserved_child_tabs = [];
    preserved_child_content = [];
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
            const xma = new XIV_MapArea(e, m, map_info);
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

function _map_add_flag(map_string) {
    map_selector = document.getElementById("map-list-selectable");
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
    input_map_element = document.getElementById("input-new-map-string");
    map_string = input_map_element.value;
    _map_add_flag(map_string);
    input_map_element.value = "";
}

function map_bulk_import() {
    input_bulk_element = document.getElementById('input-new-map-bulk');
    input_bulk_value = input_bulk_element.value.split("\n");
    for (const line of input_bulk_value) {
        _map_add_flag(line);
    }
    input_bulk_element.value = "";
}

function map_select_move_up() {

}

function map_select_move_down() {

}

function map_remove_selected() {
    map_selector = document.getElementById("map-list-selectable");
    selected_map = map_selector.value;
    _map_remove_flag(selected_map);
    map_selector.remove(map_selector.selectedIndex);
}

function map_clear_all() {
    map_selector = document.getElementById("map-list-selectable");
    for (let i=map_selector.options.length-1; i>=0; i--) {
        selected_map = map_selector.options[i].value;
        _map_remove_flag(selected_map);
        map_selector.remove(i);
    }
}

function get_settings_page_json() {
    const settings_page = new Map();
    light_mode = document.documentElement.getAttribute('data-bs-theme') == 'light';
    data_url = document.getElementById("setting-preload-map-data").value;
    session_cache = document.getElementById("setting-session-cache").checked;

    settings_page["light_mode"] = light_mode;
    if (data_url) {
        settings_page["data_url"] = data_url;
    }
    settings_page["session_cache"] = session_cache;

    return settings_page;
}

function load_settings_page() {
    if (user_settings["data_url"]) {
        document.getElementById("setting-preload-map-data").value = user_settings["data_url"];
    }
    if (user_settings["session_cache"]) {
        document.getElementById("setting-session-cache").checked = user_settings["session_cache"];
    }
}

function apply_settings() {
    const settings_page = get_settings_page_json();
    sessionStorage.setItem("settings", JSON.stringify(settings_page));
    init();
}

function persist_settings() {
    const settings_page = get_settings_page_json();
    localStorage.setItem("settings", JSON.stringify(settings_page));
    init();
}

function reset_settings() {
    localStorage.clear();
    sessionStorage.clear();
}