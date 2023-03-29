class XIV_WorldParser {
    constructor(server_data_file) {
        this.server_data_file = server_data_file;
    }
    async init() {
        console.log(`Loading server names from ${this.server_data_file}...`)
        this.datacenter_server = await fetchJSON(this.server_data_file)
        this.reverse_servers = {}
        for (const [datacenter, server_list] of Object.entries(this.datacenter_server)) {
            for (const server of server_list) {
                this.reverse_servers[server] = datacenter;
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
            if (!this.reverse_servers.hasOwnProperty(world_name)) {
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
    constructor(map_string, world_parser, maps, reverse_lookup) {
        const match = map_string.match(map_pin_re);
        if (match) {
            this.char_name = world_parser.parse_charname(match[1]);
            if (this.char_name[2] == null) {
                this.char_name_str = `${this.char_name[0]} ${this.char_name[1]}`;
            } else {
                this.char_name_str = `${this.char_name[0]} ${this.char_name[1]} @ ${this.char_name[2]}`;
            }
            this.map_name = match[2];
            this.map_area = reverse_lookup[match[2]];
            this.map_info = maps[this.map_area[0]][this.map_area[1]].map_info;
            this.coords = [parseFloat(match[3]), parseFloat(match[4])];
            this.vector_mark = null;
        } else {
            throw new XIV_ParseError("Unable to parse map string");
        }
    }

    toString() {
        return `${this.char_name_str} --> ${this.map_name} @ (${this.coords[0]}, ${this.coords[1]})`;
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
        this.flags = {};
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
            console.log(flag_to_add.char_name_str, fc, this.coords, this.coords[0]-this.proximity, this.coords[0]+this.proximity, "||", this.coords[1]-this.proximity, this.coords[1]+this.proximity);
            const prox_left = this.coords[0]-this.proximity <= fc[0];
            const prox_right = this.coords[0]+this.proximity >= fc[0];
            const prox_top = this.coords[1]-this.proximity <= fc[1];
            const prox_bottom = this.coords[1]+this.proximity >= fc[1];
            if (prox_left && prox_right && prox_top && prox_bottom) {
                this.flags[flag_to_add.toString()] = flag_to_add;
                flag_to_add.generate_vector(this.svg_parent);
                this.update_vector();
                return true;
            } else {
                return false;
            }
        } else {
            this.coords = flag_to_add.coords;
            this.flags[flag_to_add.toString()] = flag_to_add;
            flag_to_add.generate_vector(this.svg_parent);
            this.update_vector();
            return true;
        }
    }

    remove_flag(flag_key_name) {
        if (this.flags.hasOwnProperty(flag_key_name)) {
            const flag_to_remove = this.flags[flag_key_name];
            flag_to_remove.erase_vector();
            delete this.flags[flag_key_name];
            this.update_vector()
        }
        return Object.keys(this.flags).length;
    }

    update_vector() {
        const label = [`(${this.coords[0]}, ${this.coords[1]})`];
        for (const [k,m] of Object.entries(this.flags)) {
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
        this.flags = {};
        this.clusters = [];
    }

    add_flag(flag_to_add) {
        if (this.flags.hasOwnProperty(flag_to_add.toString())) {
            console.log(`Refusing to add duplicate map: ${flag_to_add}`);
            return false;
        }
        for (const c of this.clusters) {
            console.log(c);
            if (c.add_flag(flag_to_add)) {
                this.flags[flag_to_add.toString()] = c
                return true;
            }
        }
        const new_cluster = new XIV_MapFlagCluster(this.map_info["name"], this.map_info, this.svg, this.proximity);
        new_cluster.add_flag(flag_to_add);
        this.flags[flag_to_add.toString()] = new_cluster;
        this.clusters.push(new_cluster);
        return true;
    }

    remove_flag(flag_to_remove) {
        const cluster = this.flags[flag_to_remove.toString()]
        const fc = cluster.remove_flag(flag_to_remove.toString())
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
    constructor(map_index) {
        this.map_index = map_index;
        this.wp = null;
        this.maps = {}
        this.flags = {}
    }

    add_map_area(map_area) {
        if(this.maps.hasOwnProperty(map_area.expansion)) {
            this.maps[map_area.expansion][map_area.map_key] = map_area;
        } else {
            this.maps[map_area.expansion] = {};
            this.maps[map_area.expansion][map_area.map_key] = map_area;
        }
        this.reverse_lookup[map_area.map_info["name"]] = [map_area.expansion, map_area.map_key];
    }

    add_map_flag(map_string) {
        const map_flag = new XIV_MapFlag(map_string, this.wp, this.maps, this.reverse_lookup);
        if (this.maps[map_flag.map_area[0]][map_flag.map_area[1]].add_flag(map_flag)) {
            this.flags[map_flag.toString()] = map_flag;
            return map_flag;
        } else {
            return null;
        }
    }

    remove_map_flag(map_string) {
        const map_flag = this.flags[map_string];
        this.maps[map_flag.map_area[0]][map_flag.map_area[1]].remove_flag(map_flag);
        delete this.flags[map_string]
    }

    clear() {
        this.maps = {}
        this.reverse_lookup = {}
    }
}

class XIV_ParseError extends Error {
    constructor(message) {
        super(message)
        this.name = "XIV_ParseError";
    }
}