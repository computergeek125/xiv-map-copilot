class XIV_WorldParser {
    constructor(server_data_file, settings) {
        this.server_data_file = server_data_file;
        this.settings = settings;
    }
    async init() {
        console.log(`Loading server names from ${this.server_data_file}...`)
        this.datacenter_server = await fetchJSON(this.server_data_file)
        this.reverse_servers = new Map();
        for (const [datacenter, server_list] of Object.entries(this.datacenter_server)) {
            for (const server of server_list) {
                this.reverse_servers.set(server, datacenter);
            }
        }
    }

    name_split(char_name, delim=" ") {
        // https://stackoverflow.com/a/71034785/1778122
        const index = char_name.indexOf(delim);
        if (index === -1) {
            return [char_name, ""];
        }
        return [
            char_name.slice(0, index),
            char_name.slice(index + delim.length),
        ];
    }

    parse_charname(char_name) {
        const first_last = this.name_split(char_name.replaceAll(/\s{2,}/g, " ").trim());
        let sn_idx = null;
        for (const i in first_last[1]) {
            if (first_last[1][i].toUpperCase() == first_last[1][i]) {
                sn_idx = i;
            }
        }
        let last_name;
        let world_name;
        if (sn_idx) {
            last_name = first_last[1].slice(0, sn_idx);
            world_name = first_last[1].slice(sn_idx);
            if (!this.reverse_servers.has(world_name)) {
                last_name = first_last[1];
                world_name = null;
            }
        } else {
            last_name = first_last[1];
            world_name = null;
        }
        if (world_name == null && settings.get("home_world")) {
            world_name = settings.get("home_world");
        }
        //console.log(`${first_last[0]}/${last_name}/${world_name}`);
        return [first_last[0], last_name, world_name];
    }
}

class XIV_MapFlag {
    constructor(char_name, map_name, coords, maps, reverse_lookup, nicknames, settings) {
        this.char_name = char_name;
        this.map_name = map_name;
        this.map_area = reverse_lookup.get(map_name);
        this.map_info = maps.get(this.map_area[0]).get(this.map_area[1]).map_info;
        this.coords = coords;
        this.vector_mark = null;
        this.nicknames = nicknames;
        this.settings = settings;
    }

    static from_mapstr(map_string, world_parser, maps, reverse_lookup, nicknames, settings) {
        const match = map_string.match(settings.get("map_pin_re"));
        if (settings.get("debug_map_flag_re")) {
            console.log("re_match", settings.get("map_pin_re"), match);
        }
        if (match) {
            const char_name = world_parser.parse_charname(match[1]);
            const map_name = match[2];
            const coords = [parseFloat(match[3]), parseFloat(match[4])];
            return new XIV_MapFlag(char_name, map_name, coords, maps, reverse_lookup, nicknames, settings);
        } else {
            throw new XIV_ParseError("Unable to parse map string");
        }
    }

    static from_dict(map_dict, maps, reverse_lookup, nicknames, settings) {
        const char_name = map_dict.get("char_name");
        for (let c=0; c<char_name.length; c++) {
            char_name[c] = char_name[c].replaceAll(/\s{2,}/g, " ").trim();
        }
        const map_name = map_dict.get("map_name").replaceAll(/\s{2,}/g, " ").trim()
        return new XIV_MapFlag(
            char_name,
            map_name,
            map_dict.get("coords"),
            maps,
            reverse_lookup,
            nicknames,
            settings,
        );
    }

    static from_json(map_json, maps, reverse_lookup, nicknames, settings) {
        return XIV_MapFlag.from_dict(new Map(Object.entries(JSON.parse(map_json))), maps, reverse_lookup, nicknames, settings);
    }

    toString() {
        return `${this.get_char_name_str(true)} --> ${this.map_name} @ (${this.coords[0]}, ${this.coords[1]})`;
    }

    to_dict() {
        return new Map([
            ["char_name", this.char_name],
            ["map_name", this.map_name],
            ["coords", this.coords],
        ])
    }

    to_json() {
        return JSON.stringify(Object.fromEntries(this.to_dict()));
    }

    get_char_name_str(full=false) {
        const char_fullname = XIV_NickNameinator.hash_char_name(this.char_name);
        if (full) {
            return char_fullname;
        }
        const nickname = this.nicknames.get_nickname(char_fullname);
        if (nickname) {
            return nickname;
        } else if (this.char_name[2] == null || (this.settings.get("home_world_hide") && this.char_name[2] == this.settings.get("home_world"))) {
            return `${this.char_name[0]} ${this.char_name[1]}`;
        } else {
            return char_fullname;
        }
    }

    generate_vector(svg_parent) {
        if (this.vector_text != null) {
            this.erase_vector()
        }
        const mark_size = this.settings.get("flag_mark_size");
        const coords_rel = this.convert_coords();
        const mw = svg_parent.viewBox.baseVal.width;
        const mh = svg_parent.viewBox.baseVal.height;
        let calibration;
        if (this.map_info["calibration"]) {
            calibration = map_info["calibration"];
        } else {
            calibration = [0, 0];
        }
        const pixel_x = Math.round(mw*coords_rel[0] + calibration[0]);
        const pixel_y = Math.round(mh*coords_rel[1] + calibration[1]);
        this.vector_mark = gen_svg_cross(pixel_x, pixel_y, mark_size);
        svg_parent.appendChild(this.vector_mark);
    }

    erase_vector() {
        if (this.vector_mark) {
            this.vector_mark.remove();
        }
    }
    
    convert_coords() {
        const float_x = (this.coords[0] - this.map_info["ffxiv_xy"]["min"][0]) / (this.map_info["ffxiv_xy"]["max"][0] - this.map_info["ffxiv_xy"]["min"][0]);
        const float_y = (this.coords[1] - this.map_info["ffxiv_xy"]["min"][1]) / (this.map_info["ffxiv_xy"]["max"][1] - this.map_info["ffxiv_xy"]["min"][1]);
        return [float_x, float_y];
    }
}

class XIV_MapFlagCluster {
    constructor(map_fullname, map_info, svg_parent, settings, proximity) {
        this.map_fullname = map_fullname;
        this.map_info = map_info;
        this.settings = settings;
        this.proximity = proximity;
        this.coords = null;
        this.flags = new Map();
        this.names_text = null;
        this.svg_parent = svg_parent;
        this.vector_text = null;
        this.pixel_x = null;
        this.pixel_y = null;
    }

    add_flag(flag_to_add) {
        if (this.map_fullname != flag_to_add.map_name) {
            return false;
        }
        if (this.coords) {
            let fc = flag_to_add.coords;
            //console.log(flag_to_add.char_name_str, fc, this.coords, this.coords[0]-this.proximity, this.coords[0]+this.proximity, "||", this.coords[1]-this.proximity, this.coords[1]+this.proximity);
            const prox_left = this.coords[0]-this.proximity <= fc[0];
            const prox_right = this.coords[0]+this.proximity >= fc[0];
            const prox_top = this.coords[1]-this.proximity <= fc[1];
            const prox_bottom = this.coords[1]+this.proximity >= fc[1];
            if (prox_left && prox_right && prox_top && prox_bottom) {
                this.flags.set(flag_to_add.toString(), flag_to_add);
                flag_to_add.generate_vector(this.svg_parent);
                this.update_vector();
                return true;
            } else {
                return false;
            }
        } else {
            this.coords = flag_to_add.coords;
            this.flags.set(flag_to_add.toString(), flag_to_add);
            flag_to_add.generate_vector(this.svg_parent);
            this.update_vector();
            return true;
        }
    }

    remove_flag(flag_key_name) {
        if (this.flags.has(flag_key_name)) {
            const flag_to_remove = this.flags.get(flag_key_name);
            flag_to_remove.erase_vector();
            this.flags.delete(flag_key_name);
            this.update_vector()
        }
        return this.flags.size;
    }

    update_vector() {
        const label = [`(${this.coords[0]}, ${this.coords[1]})`];
        for (const m of this.flags.values()) {
            label.push(m.get_char_name_str());
        }
        if (this.vector_text == null) {
            const coords_rel = this.convert_coords();
            const font_size = this.settings.get("flag_font_size");
            const mw = this.svg_parent.viewBox.baseVal.width;
            const mh = this.svg_parent.viewBox.baseVal.height;
            let calibration;
            if (this.map_info["calibration"]) {
                calibration = map_info["calibration"];
            } else {
                calibration = [0, 0];
            }
            const pixel_mark_x = Math.round(mw*coords_rel[0] + calibration[0]);
            const pixel_mark_y = Math.round(mh*coords_rel[1] + calibration[1]);
            const mark_size = this.settings.get("flag_mark_size");
            if (coords_rel[0] < 0.88 || !this.settings.get("flag_margin_overflow")) {
                this.pixel_x = pixel_mark_x + mark_size*1.25;
                this.pixel_y = pixel_mark_y - mark_size;
                this.text_anchor = "start";
            } else {
                this.pixel_x = pixel_mark_x - mark_size*1.25;
                this.pixel_y = pixel_mark_y - mark_size;
                this.text_anchor = "end";
            }
            this.vector_text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            this.vector_text.setAttribute("x", this.pixel_x);
            this.vector_text.setAttribute("y", this.pixel_y);
            this.vector_text.style.fontSize = font_size;
            this.vector_text.setAttribute("text-anchor", this.text_anchor);
            this.svg_parent.appendChild(this.vector_text);
        }
        this.vector_text.innerHTML = "";
        for (const l of label) {
            const t = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            t.textContent = l;
            t.setAttribute("x", this.pixel_x);
            t.setAttribute("dy", "1.2em");
            this.vector_text.appendChild(t);
        }
    }

    erase_vector() {
        if (this.vector_text) {
            this.vector_text.remove();
        }
        this.vector_text = null;
        this.pixel_x = null;
        this.pixel_y = null;
    }

    convert_coords() {
        const float_x = (this.coords[0] - this.map_info["ffxiv_xy"]["min"][0]) / (this.map_info["ffxiv_xy"]["max"][0] - this.map_info["ffxiv_xy"]["min"][0]);
        const float_y = (this.coords[1] - this.map_info["ffxiv_xy"]["min"][1]) / (this.map_info["ffxiv_xy"]["max"][1] - this.map_info["ffxiv_xy"]["min"][1]);
        return [float_x, float_y];
    }

    toString() {
        return `${this.map_fullname} (${this.coords[0]}, ${this.coords[1]})`;
    }
}

class XIV_MapArea {
    constructor(expansion, map_key, map_info, settings, proximity=2) {
        this.expansion = expansion;
        this.map_key = map_key;
        this.map_info = map_info;
        this.settings = settings;
        this.proximity = proximity;
        this.svg = null;
        this.flags = new Map();
        this.clusters = [];
    }

    add_flag(flag_to_add) {
        if (this.flags.has(flag_to_add.toString())) {
            console.log(`Refusing to add duplicate map: ${flag_to_add}`);
            return false;
        }
        for (const c of this.clusters) {
            //console.log(c);
            if (c.add_flag(flag_to_add)) {
                this.flags.set(flag_to_add.toString(), c);
                return true;
            }
        }
        const new_cluster = new XIV_MapFlagCluster(this.map_info["name"], this.map_info, this.svg, this.settings, this.proximity);
        new_cluster.add_flag(flag_to_add);
        this.flags.set(flag_to_add.toString(), new_cluster);
        this.clusters.push(new_cluster);
        return true;
    }

    remove_flag(flag_to_remove) {
        const cluster = this.flags.get(flag_to_remove.toString());
        const fc = cluster.remove_flag(flag_to_remove.toString());
        if (fc <= 0) {
            console.log(`Destroying empty cluster at ${cluster}`);
            cluster.erase_vector();
            for (let c=0; c<this.clusters.length; c++) {
                if (this.clusters[c] == cluster) {
                    this.clusters.splice(c, 1);
                }
            }
        }
        this.flags.delete(flag_to_remove.toString())
    }
}

const char_name_re = new RegExp(/([\w\-']+)\s+([\w\-']+)/u);
class XIV_NickNameinator {
    constructor(settings, session_cache) {
        this.settings = settings;
        this.session_cache = session_cache;
        this.forward_lookup = new Map();
        this.reverse_lookup = new Map();
    }

    static hash_char_name(char_name) {
        return `${char_name[0]} ${char_name[1]} \u{1f338} ${char_name[2]}`;
    }

    cache_import_name(k,v) {
        if (Array.isArray(v)) {
            //console.log("nns", v.slice(0,3), v.slice(3,4));
            this._set_nickname(v.slice(0,3), v.slice(3,4)[0]);
        } else {
            const char_world = k.split(" @ ");
            this.set_nickname(char_world[0], char_world[1], v);
        }
    }

    cache_load() {
        //console.log("ncs", this.settings);
        if (this.settings.get("session_cache")) {
            const nickname_cache = this.session_cache.get("nicknames");
            if (nickname_cache) {
                //console.log(nickname_cache);
                for (const [k,v] of Object.entries(nickname_cache)) {
                    //console.log('name ->', k, v);
                    this.cache_import_name(k,v)
                }
            }
        }
    }

    cache_rebuild() {
        this.session_cache.set("nicknames", Object.fromEntries(this.forward_lookup.entries()))
    }

    has(char_hash) {
        return this.forward_lookup.has(char_hash);
    }

    has_rev(nickname) {
        return this.reverse_lookup.has(nickname);
    }

    sorted_by_char_name() {
        return Array.from(this.forward_lookup.keys()).sort()
    }

    sorted_by_nickname() {
        return Array.from(this.reverse_lookup.keys()).sort()
    }

    get_nickname(char_name) {
        let nickname_array;
        if (typeof char_name == "string" || char_name instanceof String) {
            nickname_array = this.forward_lookup.get(char_name);
        } else {
            nickname_array = this.forward_lookup.get(XIV_NickNameinator.hash_char_name(char_name));
        }
        if (nickname_array) {
            return nickname_array[3];
        } else {
            return null;
        }
    }

    get_char_name(nickname) {
        return this.reverse_lookup.get(nickname);
    }

    _set_nickname(char_name, nickname, overwrite=true) {
        const char_name_str = XIV_NickNameinator.hash_char_name(char_name);
        if (!(this.has(char_name_str) || this.has_rev(nickname))) {
            const nickname_array = [...char_name, nickname];
            this.forward_lookup.set(char_name_str, nickname_array);
            this.reverse_lookup.set(nickname, char_name_str);
            if (this.settings.get("session_cache")) {
                const scn = this.session_cache.get("nicknames");
                if (!scn) {
                    scn = {};
                }
                scn[char_name_str] = nickname_array;
                this.session_cache.set("nicknames", scn);
            }
        }
    }

    set_nickname(char_string, world_name, nickname, overwrite=true) {
        const match = char_string.match(char_name_re);
        if (match) {
            const char_name = [match[1], match[2], world_name]
            this._set_nickname(char_name, nickname);
            return char_name;
        } else {
            throw new XIV_ParseError(`Could not parse character character name for [ ${char_string}, ${world_name}, ${nickname} ]`);
        }
    }

    _remove_nickname(char_name_str) {
        const name_array = this.forward_lookup.get(char_name_str);
        this.forward_lookup.delete(char_name_str);
        this.reverse_lookup.delete(name_array[3]);
        if (this.settings.get("session_cache")) {
            const scn = this.session_cache.get("nicknames");
            if (char_name_str in scn) {
                delete scn[char_name_str];
                this.session_cache.set("nicknames", scn);
            }
        }
        return name_array;
    }

    remove_nickname_char_name(char_name) {
        let char_name_str;
        if (typeof char_name == "string" || char_name instanceof String) {
            char_name_str = char_name;
        } else {
            char_name_str = XIV_NickNameinator.hash_char_name(char_name);
        }
        return this._remove_nickname(char_name_str);
    }

    remove_nickname_nickname(nickname) {
        char_name_str = this.reverse_lookup.get(nickname);
        return this._remove_nickname(char_name_str);
    }
}

class XIV_FlagClusterinator {
    constructor(map_index, settings, session_cache) {
        this.map_index = map_index;
        this.settings = settings;
        this.session_cache = session_cache;
        this.wp = null;
        this.maps = new Map();
        this.flags = new Map();
        this.reverse_lookup = new Map();
        this.nicknames = new XIV_NickNameinator(this.settings, this.session_cache);
    }

    add_map_area(map_area) {
        if(this.maps.has(map_area.expansion)) {
            this.maps.get(map_area.expansion).set(map_area.map_key, map_area);
        } else {
            this.maps.set(map_area.expansion, new Map());
            this.maps.get(map_area.expansion).set(map_area.map_key, map_area);
        }
        this.reverse_lookup.set(map_area.map_info["name"], [map_area.expansion, map_area.map_key]);
    }

    add_map_flag(map_input) {
        let map_flag
        if (map_input instanceof XIV_MapFlag) {
            map_flag = map_input;
        } else if (map_input instanceof Map) {
            map_flag = XIV_MapFlag.from_dict(map_input, this.maps, this.reverse_lookup, this.nicknames, this.settings);
        } else {
            map_flag = XIV_MapFlag.from_mapstr(map_input, this.wp, this.maps, this.reverse_lookup, this.nicknames, this.settings);
        }
        if (this.maps.get(map_flag.map_area[0]).get(map_flag.map_area[1]).add_flag(map_flag)) {
            this.flags.set(map_flag.toString(), map_flag);
            this.cache_flag(map_flag);
            return map_flag;
        } else {
            return null;
        }
    }

    cache_load() {
        this.nicknames.cache_load();
        if (this.settings.get("session_cache")) {
            let scf = this.session_cache.get("flags");
            if (scf) {
                for (const f of Object.values(scf)) {
                    const map_flag = XIV_MapFlag.from_dict(new Map(Object.entries(f)), this.maps, this.reverse_lookup, this.nicknames, this.settings);
                    this.add_map_flag(map_flag);
                }
            }
        }
    }

    cache_flag(map_flag) {
        if (this.settings.get("session_cache")) {
            let scf = this.session_cache.get("flags");
            if (!scf) {
                scf = {};
            }
            scf[map_flag.toString()] = Object.fromEntries(map_flag.to_dict().entries());
            this.session_cache.set("flags", scf);
        }
    }

    cache_rebuild() {
        console.log("Rebuilding cache (if enabled)");
        this.reset_cache_flag();
        for (const m of this.flags.values()) {
            this.cache_flag(m);
        }
        this.nicknames.cache_rebuild();
    }

    cache_merge() {
        this.cache_load();
        this.cache_rebuild();
    }

    remove_map_flag(map_string) {
        const map_flag = this.flags.get(map_string);
        this.uncache_flag(map_string);
        this.maps.get(map_flag.map_area[0]).get(map_flag.map_area[1]).remove_flag(map_flag);
        this.flags.delete(map_string)
    }

    uncache_flag(map_string) {
        if (this.settings.get("session_cache")) {
            const scf = this.session_cache.get("flags");
            //console.log("Deleting", map_string, "from", scf);
            if (map_string in scf) {
                delete scf[map_string];
                this.session_cache.set("flags", scf);
            }
        }
    }

    reset_maps() {
        console.log("Resetting map data");
        this.maps.clear();
        this.reverse_lookup.clear();
    }

    reset_cache_flag() {
        if (settings.get("session_cache")) {
            this.session_cache.set("flags", {});
        }
    }

    reload_flags() {
        for (const map_flag of this.flags.values()) {
            console.log(`Reloading flag ${map_flag.toString()}`);
            this.maps.get(map_flag.map_area[0]).get(map_flag.map_area[1]).add_flag(map_flag);
        }
    }

    switch_map_positions(idx0, idx1) {
        if (idx0 < 0 || idx1 < 0 || idx0 >= this.flags.size || idx1 >= this.flags.size) {
            return;
        }
        let temp_flags = new Map();
        let flag_keys = Array.from(this.flags.keys());
        console.log(`Switching ${flag_keys[idx0]} with ${flag_keys[idx1]}`);
        [flag_keys[idx0], flag_keys[idx1]] = [flag_keys[idx1], flag_keys[idx0]];
        for (const k of flag_keys) {
            temp_flags.set(k, this.flags.get(k));
        }
        this.flags = temp_flags;
    }

    set_nickname(char_string, world_name, nickname) {
        const char_name = this.nicknames.set_nickname(char_string, world_name, nickname);
        if (char_name) {
            this.update_vectors();
            return char_name;
        }
    }

    remove_nickname(char_name_str) {
        const name_array = this.nicknames.remove_nickname_char_name(char_name_str);
        this.update_vectors();
        return name_array;
    }

    update_vectors() {
        for (const expansion of this.maps.keys()) {
            const area_group = this.maps.get(expansion);
            for (const map_name of area_group.keys()) {
                const map = area_group.get(map_name);
                for (const c of map.clusters) {
                    c.update_vector();
                }
            }
        }
    }
}

class XIV_ParseError extends Error {
    constructor(message) {
        super(message)
        this.name = "XIV_ParseError";
    }
}