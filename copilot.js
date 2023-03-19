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

async function loadIndex() {
    index_url = new URL(document.getElementById("index-location").value);
    map_index = await fetchJSON(index_url);
    document.getElementById('index-loader').remove();
    console.log(`Loaded map index from ${index_url}`);
    await resetTabs();
}

async function resetTabs() {
    // button template: <button class="nav-link" id="expac-tabs-replaceme-button" data-bs-theme="dark" data-bs-toggle="pill" data-bs-target="#expac-tabs-replaceme-content" type="button" role="tab" aria-controls="expac-tabs-replaceme-content" aria-selected="false">ReplaceMe</button>'
    // content template: <div class="tab-pane fade" id="expac-tabs-replaceme-content" role="tabpanel" aria-labelledby="expac-tabs-replaceme-button">ReplaceMe Data</div>
    const expac_tabs_buttons = document.getElementById('expac-tabs-buttons');
    const expac_tabs_content = document.getElementById('expac-tabs-content');
    expac_tabs_buttons.innerHTML = "";
    expac_tabs_content.innerHTML = "";
    const img_url_base = new URL(index_url)
    img_url_base.pathname.split('/').slice(0,-1).join("/")
    for (const e in map_index['expansions']) {
        const e_id = e;
        const e_button_id  = `expac-tabs-${e_id}-button`;
        const e_content_id = `expac-tabs-${e_id}-content`;
        console.log(`Loading expansion ${e}...`);
        const e_name = sanitizeHTML(map_index['expansions'][e]['name']);
        const e_button = document.createElement('button');
        e_button.setAttribute(            "id", e_button_id);
        e_button.setAttribute(         "class", "nav-link");
        e_button.setAttribute( "data-bs-theme", "dark");
        e_button.setAttribute("data-bs-toggle", "pill");
        e_button.setAttribute("data-bs-target", `#${e_content_id}`);
        e_button.setAttribute(          "type", "button");
        e_button.setAttribute(          "role", "tab");
        e_button.setAttribute( "aria-controls", e_content_id);
        e_button.setAttribute( "aria-selected", false);
        e_button.innerText = e_name;
        const e_content = document.createElement('div');
        e_content.setAttribute(          "class", "tab-pane fade");
        e_content.setAttribute(             "id", e_content_id);
        e_content.setAttribute(           "role", "tabpanel");
        e_content.setAttribute("aria-labelledby", e_button_id);
        const e_tabstrip = document.createElement("div")
        // tabstrip: <ul class="nav nav-tabs" id="myTab" role="tablist">
        e_tabstrip.setAttribute(        "class", "nav nav-tabs");
        e_tabstrip.setAttribute(           "id", `expac-tabs-${e_id}-tabstrip`);
        e_tabstrip.setAttribute("data-bs-theme", "dark");
        e_tabstrip.setAttribute(         "role", "tablist");
        // tab content: <div class="tab-content" id="myTabContent">
        const e_tabcontent = document.createElement("div");
        e_tabcontent.setAttribute(        "class", "tab-content");
        e_tabcontent.setAttribute(           "id", `expac-tabs-${e_id}-tabcontent`);
        e_tabcontent.setAttribute("data-bs-theme", "dark");
        for (let mx=0; mx<map_index['expansions'][e]["maps"].length; mx++) {
            m = map_index['expansions'][e]["maps"][mx]
            console.log(`Loading map ${m}...`)
            const map_info = map_index["map_info"][m];
            const map_id = m.replaceAll("/", ":");
            //console.log(map_info);
            const map_name = sanitizeHTML(map_info["name"]);
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
            map_tab_btn.innerText = map_name
            map_tab_li.appendChild(map_tab_btn);
            // tab content: <div class="tab-pane fade show active" id="home-tab-pane" role="tabpanel" aria-labelledby="home-tab" tabindex="0">...</div>
            const map_content = document.createElement("div");
            map_content.setAttribute(          "class", "tab-pane fade");
            map_content.setAttribute(             "id", map_content_id);
            map_content.setAttribute(           "role", "tabpanel");
            map_content.setAttribute("aria-labelledby", map_button_id);
            map_content.setAttribute(       "tabindex", 0);

            const map_img_relpath = `${e}/${m}/${map_info["filename"]}`;
            const map_img_url = new URL(map_img_relpath, img_url_base);
            //console.log(`${map_img_relpath} | ${map_img_url}`);
            const map_img = document.createElement("img");
            //map_img.setAttribute("style", "height: 100%; width: 100%; object-fit: contain");
            //map_img.setAttribute("style", "height: 100%; width: 100%; object-fit: contain");
            map_img.setAttribute("class", "img-fluid");
            map_img.setAttribute("src", map_img_url);

            map_content.appendChild(map_img);
            e_tabstrip.appendChild(map_tab_li);
            e_tabcontent.appendChild(map_content);
        }
        e_tabstrip.firstElementChild.firstElementChild.setAttribute("class", "nav-link active");
        e_tabstrip.firstElementChild.setAttribute("aria-selected", true);
        e_tabcontent.firstElementChild.setAttribute(      "class", "tab-pane fade show active");
        e_content.appendChild(e_tabstrip);
        e_content.appendChild(e_tabcontent);
        expac_tabs_buttons.appendChild(e_button);
        expac_tabs_content.appendChild(e_content);
    }
    expac_tabs_buttons.firstElementChild.setAttribute(        "class", "nav-link active");
    expac_tabs_buttons.firstElementChild.setAttribute("aria-selected", true);
    expac_tabs_content.firstElementChild.setAttribute(        "class", "tab-pane fade show active");
}

let index_url;
let map_index;
