class XIV_WorldParser {
    constructor(server_data_file) {
        this.server_data_file = server_data_file;
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
        //console.log(`${first_last[0]}/${last_name}/${world_name}`);
        return [first_last[0], last_name, world_name];
    }
}

const map_pin_re = new RegExp(/^(?:\[\d\d?:\d\d\])?(?:\[[\w\d]+\])?[\(<]\W?\W?([\w'\- ]+)[\)>].+\ue0bb([\w' ]+) \( (\d+\.\d+)  , (\d+\.\d+) \)/u);
class XIV_MapFlag {
    constructor(char_name, map_name, coords, maps, reverse_lookup) {
        this.char_name = char_name;
        if (this.char_name[2] == null) {
            this.char_name_str = `${this.char_name[0]} ${this.char_name[1]}`;
        } else {
            this.char_name_str = `${this.char_name[0]} ${this.char_name[1]} @ ${this.char_name[2]}`;
        }
        this.map_name = map_name;
        this.map_area = reverse_lookup.get(map_name);
        this.map_info = maps.get(this.map_area[0]).get(this.map_area[1]).map_info;
        this.coords = coords;
        this.vector_mark = null;
    }

    static from_mapstr(map_string, world_parser, maps, reverse_lookup) {
        const match = map_string.match(map_pin_re);
        if (match) {
            const char_name = world_parser.parse_charname(match[1]);
            const map_name = match[2];
            const coords = [parseFloat(match[3]), parseFloat(match[4])];
            return new XIV_MapFlag(char_name, map_name, coords, maps, reverse_lookup);
        } else {
            throw new XIV_ParseError("Unable to parse map string");
        }
    }

    static from_dict(map_dict, maps, reverse_lookup) {
        return new XIV_MapFlag(
            map_dict.get("char_name"),
            map_dict.get("map_name"),
            map_dict.get("coords"),
            maps,
            reverse_lookup
        );
    }

    static from_json(map_json, maps, reverse_lookup) {
        return XIV_MapFlag.from_dict(new Map(Object.entries(JSON.parse(map_json))), maps, reverse_lookup);
    }

    toString() {
        return `${this.char_name_str} --> ${this.map_name} @ (${this.coords[0]}, ${this.coords[1]})`;
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

    generate_vector(svg_parent, radius=20) {
        if (this.vector_text != null) {
            this.erase_vector()
        }
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
        this.vector_mark = gen_svg_cross(pixel_x, pixel_y, radius);
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
    constructor(map_fullname, map_info, svg_parent, proximity) {
        this.map_fullname = map_fullname;
        this.map_info = map_info;
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
            label.push(m.char_name_str);
        }
        if (this.vector_text == null) {
            const coords_rel = this.convert_coords();
            const mw = this.svg_parent.viewBox.baseVal.width;
            const mh = this.svg_parent.viewBox.baseVal.height;
            let calibration;
            if (this.map_info["calibration"]) {
                calibration = map_info["calibration"];
            } else {
                calibration = [0, 0];
            }
            this.pixel_x = Math.round(mw*coords_rel[0] + calibration[0])+25;
            this.pixel_y = Math.round(mh*coords_rel[1] + calibration[1])-20;
            this.vector_text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            this.vector_text.setAttribute("x", this.pixel_x);
            this.vector_text.setAttribute("y", this.pixel_y);
            this.vector_text.setAttribute("style", "font-size: 20px;")
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
    constructor(expansion, map_key, map_info, proximity=2) {
        this.expansion = expansion;
        this.map_key = map_key;
        this.map_info = map_info;
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
        const new_cluster = new XIV_MapFlagCluster(this.map_info["name"], this.map_info, this.svg, this.proximity);
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
            map_flag = XIV_MapFlag.from_mapstr(map_input, this.wp, this.maps, this.reverse_lookup);
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
            let scf = this.session_cache.get("flags");
            if (scf) {
                for (const f of Object.values(scf)) {
                    const map_flag = XIV_MapFlag.from_dict(new Map(Object.entries(f)), this.maps, this.reverse_lookup);
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
    }

    cache_merge() {
        this.load_cache();
        this.cache_rebuild();
    }

    remove_map_flag(map_string) {
        const map_flag = this.flags.get(map_string);
        this.uncache_flag(map_flag);
        this.maps.get(map_flag.map_area[0]).get(map_flag.map_area[1]).remove_flag(map_flag);
        this.flags.delete(map_string)
    }

    uncache_flag(map_string) {
        if (settings.get("session_cache")) {
            const scf = this.session_cache.get("flags");
            if (Object.hasOwnProperty(scf, map_string)) {
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
}

class XIV_ParseError extends Error {
    constructor(message) {
        super(message)
        this.name = "XIV_ParseError";
    }
}