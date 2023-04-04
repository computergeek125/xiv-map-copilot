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
        const first_last = this.name_split(char_name);
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

const map_pin_re = new RegExp(/^(?:\[\d\d?:\d\d\])?(?:\[[\w\d]+\])?[\(<]\W?\W?([\w'\- ]+)[\)>].+\ue0bb([\w' ]+) \( (\d+\.\d+)  , (\d+\.\d+) \)/u);
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
        const match = map_string.match(map_pin_re);
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
        return new XIV_MapFlag(
            map_dict.get("char_name"),
            map_dict.get("map_name"),
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
        const char_fullname = `${this.char_name[0]} ${this.char_name[1]} @ ${this.char_name[2]}`;
        if (full) {
            return char_fullname;
        }
        const nickname = this.nicknames.get(char_fullname);
        if (nickname) {
            return nickname;
        } else if (this.char_name[2] == null || (this.settings.get("home_world_hide") && this.char_name[2] == this.settings.get("home_world"))) {
            return `${this.char_name[0]} ${this.char_name[1]}`;
        } else {
            return `${this.char_name[0]} ${this.char_name[1]} @ ${this.char_name[2]}`;
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
const char_nickname_rev_re = new RegExp(/^([\w\-']+) ([\w\-']+) @ ([\w\-']+) --> ([\w\-' ]+)$/u);
class XIV_FlagClusterinator {
    constructor(map_index, settings, session_cache) {
        this.map_index = map_index;
        this.settings = settings;
        this.session_cache = session_cache;
        this.wp = null;
        this.maps = new Map();
        this.flags = new Map();
        this.reverse_lookup = new Map();
        this.nicknames = new Map();
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

    load_cache() {
        if (this.settings.get("session_cache")) {
            let scn = this.session_cache.get("nicknames");
            if (scn) {
                for (const [c,n] of Object.entries(scn)) {
                    if (!this.nicknames.has(c)) {
                        this.nicknames.set(c, n);
                    }
                }
            }
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
        if (this.settings.get("session_cache")) {
            this.session_cache.set("nicknames", Object.fromEntries(this.nicknames.entries()));
        }
    }

    cache_merge() {
        this.load_cache();
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

    _set_nickname(char_name, nickname) {
        const char_name_str = `${char_name[0]} ${char_name[1]} @ ${char_name[2]}`;
        this.nicknames.set(char_name_str, nickname);
        this.update_vectors();
        if (this.settings.get("session_cache")) {
            const scn = this.session_cache.get("nicknames");
            if (!scn) {
                scn = {};
            }
            scn[char_name_str] = nickname;
            this.session_cache.set("nicknames", scn);
        }
    }

    set_nickname(char_string, world_name, nickname) {
        const match = char_string.match(char_name_re);
        if (match) {
            const char_name = [match[1], match[2], world_name]
            this._set_nickname(char_name, nickname);
            return char_name;
        } else {
            throw new XIV_ParseError(`Could not parse character character name for [ ${char_string}, ${world_name}, ${nickname} ]`);
        }
    }

    _remove_nickname(char_name) {
        const char_name_str = `${char_name[0]} ${char_name[1]} @ ${char_name[2]}`;
        this.nicknames.delete(char_name_str);
        this.update_vectors();
        if (this.settings.get("session_cache")) {
            const scn = this.session_cache.get("nicknames");
            if (char_name_str in scn) {
                delete scn[char_name_str];
                this.session_cache.set("nicknames", scn);
            }
        }
    }

    remove_nickname(nickname_string) {
        const match = nickname_string.match(char_nickname_rev_re);
        if (match) {
            this._remove_nickname(match.slice(1));
        } else {
            throw new XIV_ParseError(`Could not parse nickname string ${nickname_string}`);
        }
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