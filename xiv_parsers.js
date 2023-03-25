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
        console.log(`${first_last[0]}/${last_name}/${world_name}`);
        return [first_last[0], last_name, world_name];
    }
}

const map_pin_re = new RegExp(/^(?:\[\d\d?:\d\d\])?(?:\[[\w\d]+\])?[\(<]\W?\W?([\w'\- ]+)[\)>].+\ue0bb([\w ]+) \( (\d+\.\d+)  , (\d+\.\d+) \)/u);
class XIV_MapFlag {
    constructor(map_string, world_parser, reverse_lookup) {
        const match = map_string.match(map_pin_re);
        if (match) {
            this.char_name = world_parser.parse_charname(match.slice(1)[0]);
            this.map_area = reverse_lookup[match[1]];
            this.coords = [match[2], match[3]];
        } else {
            throw new XIV_ParseError("Unable to parse map string");
        }
    }
    /*get char_name() {
        return this.char_name;
    }
    get coords() {
        return this.coords;
    }
    get map_area() {
        return this.map_area;
    }*/
}

class XIV_ParseError extends Error {
    constructor(message) {
        super(message)
        this.name = "XIV_ParseError";
    }
}